package com.marketsimulator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.domain.*;
import com.marketsimulator.dto.*;
import com.marketsimulator.repository.*;
import com.marketsimulator.service.market.MarketDataIngestionService;
import com.marketsimulator.util.SectorClassificationUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PortfolioRiskAnalyticsService {

    private final PortfolioRepository portfolioRepository;
    private final PositionRepository positionRepository;
    private final PortfolioSnapshotRepository snapshotRepository;
    private final MarketCandleRepository candleRepository;
    private final MarketQuoteRepository quoteRepository;
    private final PostTradeRiskEvaluationRepository postTradeRiskRepository;
    private final RiskAlertService riskAlertService;
    private final ObjectMapper objectMapper;
    @Lazy private final MarketDataIngestionService ingestionService;
    @Lazy private final SimpMessagingTemplate messagingTemplate;

    private static final int DEFAULT_OBSERVATION_DAYS = 90;
    private static final String DEFAULT_BENCHMARK = "SPY";
    private static final double SQRT_252 = Math.sqrt(252.0);

    @Transactional
    public PortfolioRiskAnalyticsDto computeAnalytics(Long userId, Long sessionId) {
        long sId = sessionId != null ? sessionId : 0L;

        Portfolio portfolio = portfolioRepository.findByUserIdAndSessionId(userId, sId)
                .or(() -> portfolioRepository.findByUserId(userId))
                .orElseThrow(() -> new RuntimeException("Portefeuille introuvable pour l'utilisateur: " + userId));

        List<Position> positions = positionRepository.findByPortfolioId(portfolio.getId());
        BigDecimal cash = portfolio.getCashBalance() != null ? portfolio.getCashBalance() : BigDecimal.ZERO;

        // 1. Calculate Market Values and Total Equity
        BigDecimal totalMv = BigDecimal.ZERO;
        Map<String, BigDecimal> prices = new LinkedHashMap<>();
        Map<String, BigDecimal> marketValues = new LinkedHashMap<>();

        for (Position pos : positions) {
            String sym = pos.getSymbol();
            var quote = ingestionService.getLatestQuote(sym);
            BigDecimal price = (quote != null && quote.getPrice() != null)
                    ? quote.getPrice()
                    : pos.getAvgPrice();

            prices.put(sym, price);
            BigDecimal mv = price.multiply(pos.getQuantity());
            marketValues.put(sym, mv);
            totalMv = totalMv.add(mv);
        }

        BigDecimal equity = cash.add(totalMv);

        // Handle empty portfolio (100% Cash)
        if (positions.isEmpty() || totalMv.compareTo(BigDecimal.ZERO) <= 0) {
            return buildCashOnlyAnalytics(portfolio, equity, cash);
        }

        // 2. Compute Asset Weights
        Map<String, Double> weights = new LinkedHashMap<>();
        for (Position pos : positions) {
            String sym = pos.getSymbol();
            double w = equity.compareTo(BigDecimal.ZERO) > 0
                    ? marketValues.get(sym).divide(equity, 8, RoundingMode.HALF_UP).doubleValue()
                    : 0.0;
            weights.put(sym, w);
        }

        double totalExposure = equity.compareTo(BigDecimal.ZERO) > 0
                ? totalMv.divide(equity, 6, RoundingMode.HALF_UP).doubleValue() * 100.0
                : 0.0;

        // 3. Fetch Historical Aligned Return Series for held assets
        Map<String, List<Double>> assetReturns = fetchAlignedReturnSeries(positions, DEFAULT_OBSERVATION_DAYS);
        int obsCount = assetReturns.values().stream().mapToInt(List::size).min().orElse(0);

        // 4. Calculate Portfolio Simulated Returns
        List<Double> portfolioReturns = new ArrayList<>(obsCount);
        for (int t = 0; t < obsCount; t++) {
            double r_p = 0.0;
            for (Position pos : positions) {
                String sym = pos.getSymbol();
                double w = weights.getOrDefault(sym, 0.0);
                List<Double> rList = assetReturns.get(sym);
                double r_i = (rList != null && t < rList.size()) ? rList.get(t) : 0.0;
                r_p += w * r_i;
            }
            portfolioReturns.add(r_p);
        }

        // 5. VaR & CVaR (Historical Simulation Methodology)
        List<Double> sortedReturns = new ArrayList<>(portfolioReturns);
        Collections.sort(sortedReturns); // Ascending (worst returns first)

        double var95Pct = 0.0;
        double var99Pct = 0.0;
        double cvar95Pct = 0.0;
        double cvar99Pct = 0.0;

        if (!sortedReturns.isEmpty()) {
            int idx95 = Math.max(0, (int) Math.floor(0.05 * sortedReturns.size()));
            int idx99 = Math.max(0, (int) Math.floor(0.01 * sortedReturns.size()));

            var95Pct = Math.max(0.0, -sortedReturns.get(idx95)) * 100.0;
            var99Pct = Math.max(0.0, -sortedReturns.get(idx99)) * 100.0;

            // CVaR (Expected Shortfall): mean of returns below VaR
            double sum95 = 0.0;
            for (int i = 0; i <= idx95; i++) {
                sum95 += sortedReturns.get(i);
            }
            cvar95Pct = Math.max(0.0, -(sum95 / (idx95 + 1))) * 100.0;

            double sum99 = 0.0;
            for (int i = 0; i <= idx99; i++) {
                sum99 += sortedReturns.get(i);
            }
            cvar99Pct = Math.max(0.0, -(sum99 / (idx99 + 1))) * 100.0;
        }

        BigDecimal var95Amount = equity.multiply(BigDecimal.valueOf(var95Pct / 100.0)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal var99Amount = equity.multiply(BigDecimal.valueOf(var99Pct / 100.0)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal cvar95Amount = equity.multiply(BigDecimal.valueOf(cvar95Pct / 100.0)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal cvar99Amount = equity.multiply(BigDecimal.valueOf(cvar99Pct / 100.0)).setScale(2, RoundingMode.HALF_UP);

        // 6. Volatility (Daily & Annualized)
        double meanReturn = portfolioReturns.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        double portVar = portfolioReturns.size() > 1
                ? portfolioReturns.stream().mapToDouble(r -> Math.pow(r - meanReturn, 2)).sum() / (portfolioReturns.size() - 1)
                : 0.0;
        double dailyVol = Math.sqrt(portVar);
        double annualVolPct = dailyVol * SQRT_252 * 100.0;

        // 7. Drawdown from Snapshot History
        List<PortfolioSnapshot> snapshots = snapshotRepository.findByPortfolioIdOrderByTsAsc(
                portfolio.getId(), PageRequest.of(0, 300));
        DrawdownStats ddStats = calculateDrawdownStats(snapshots, equity);

        // 8. Beta vs Benchmark (SPY)
        BetaResult betaResult = calculateBeta(portfolioReturns, DEFAULT_BENCHMARK, obsCount);

        // 9. Component Risk Contribution per position (Euler Decomposition)
        List<PositionRiskContributionDto> positionContributions = calculatePositionRiskContributions(
                positions, marketValues, weights, assetReturns, portfolioReturns, dailyVol, equity);

        String largestContributor = positionContributions.stream()
                .max(Comparator.comparing(PositionRiskContributionDto::getRiskContributionPct))
                .map(PositionRiskContributionDto::getSymbol)
                .orElse(null);

        // 10. Concentration & Diversification
        double hhi = weights.values().stream()
                .mapToDouble(w -> Math.pow(w * 100.0, 2))
                .sum();

        String hhiLevel = hhi < 1500 ? "DIVERSIFIÉ" : (hhi < 2500 ? "MODÉRÉ" : "FORTEMENT_CONCENTRÉ");

        double weightedIndivVol = positionContributions.stream()
                .mapToDouble(p -> (p.getWeightPct().doubleValue() / 100.0) * (p.getAssetVolatilityPct().doubleValue() / 100.0))
                .sum();
        double divRatio = (dailyVol > 1e-9) ? (weightedIndivVol / dailyVol) : 1.0;

        // 11. Sector Breakdown
        List<SectorConcentrationDto> sectorConcentrations = calculateSectorConcentration(positions, marketValues, equity);

        // 12. Correlation Matrix
        CorrelationMatrixDto correlationMatrix = calculateCorrelationMatrix(positions, assetReturns);

        // 13. Active Risk Alerts
        List<RiskAlertDto> activeAlerts = riskAlertService.evaluateAndSyncAlerts(
                portfolio.getUser(),
                portfolio,
                equity,
                BigDecimal.valueOf(totalExposure).setScale(2, RoundingMode.HALF_UP),
                BigDecimal.valueOf(var95Pct).setScale(2, RoundingMode.HALF_UP),
                BigDecimal.valueOf(annualVolPct).setScale(2, RoundingMode.HALF_UP),
                ddStats.currentDrawdownPct,
                positionContributions,
                sectorConcentrations,
                correlationMatrix
        );

        // 14. Last Post-Trade Impact
        PostTradeRiskEvaluationDto lastPostTradeImpact = postTradeRiskRepository
                .findFirstByPortfolioIdOrderByCreatedAtDesc(portfolio.getId())
                .map(this::mapPostTradeToDto)
                .orElse(null);

        String obsStatus = obsCount >= 30 ? "ROBUST" : (obsCount >= 5 ? "LIMITED_HISTORY" : "MINIMAL_DATA");

        return PortfolioRiskAnalyticsDto.builder()
                .portfolioEquity(equity.setScale(2, RoundingMode.HALF_UP))
                .cashBalance(cash.setScale(2, RoundingMode.HALF_UP))
                .investedValue(totalMv.setScale(2, RoundingMode.HALF_UP))
                .totalExposurePct(BigDecimal.valueOf(totalExposure).setScale(2, RoundingMode.HALF_UP))
                .positionsCount(positions.size())
                .var95Pct(BigDecimal.valueOf(var95Pct).setScale(2, RoundingMode.HALF_UP))
                .var95Amount(var95Amount)
                .var99Pct(BigDecimal.valueOf(var99Pct).setScale(2, RoundingMode.HALF_UP))
                .var99Amount(var99Amount)
                .varMethodology("Simulation Historique (fenêtre d'observation de " + obsCount + " cours journaliers alignés)")
                .cvar95Pct(BigDecimal.valueOf(cvar95Pct).setScale(2, RoundingMode.HALF_UP))
                .cvar95Amount(cvar95Amount)
                .cvar99Pct(BigDecimal.valueOf(cvar99Pct).setScale(2, RoundingMode.HALF_UP))
                .cvar99Amount(cvar99Amount)
                .cvarExplanation("Perte moyenne attendue dans les pires 5% (resp. 1%) des scénarios de marché extrêmes au-delà du seuil de VaR.")
                .dailyVolatilityPct(BigDecimal.valueOf(dailyVol * 100.0).setScale(2, RoundingMode.HALF_UP))
                .annualizedVolatilityPct(BigDecimal.valueOf(annualVolPct).setScale(2, RoundingMode.HALF_UP))
                .currentDrawdownPct(ddStats.currentDrawdownPct)
                .maxHistoricalDrawdownPct(ddStats.maxDrawdownPct)
                .peakEquity(ddStats.peakEquity)
                .beta(betaResult.beta != null ? BigDecimal.valueOf(betaResult.beta).setScale(3, RoundingMode.HALF_UP) : null)
                .benchmarkSymbol(betaResult.benchmark)
                .benchmarkStatus(betaResult.status)
                .hhi(BigDecimal.valueOf(hhi).setScale(1, RoundingMode.HALF_UP))
                .hhiLevel(hhiLevel)
                .diversificationRatio(BigDecimal.valueOf(divRatio).setScale(2, RoundingMode.HALF_UP))
                .largestRiskContributor(largestContributor)
                .positionsRisk(positionContributions)
                .sectorConcentration(sectorConcentrations)
                .correlationMatrix(correlationMatrix)
                .riskEvolution(ddStats.evolutionPoints)
                .activeAlerts(activeAlerts)
                .lastPostTradeImpact(lastPostTradeImpact)
                .observationWindow(obsCount)
                .observationStatus(obsStatus)
                .message(obsCount < 15 ? "Historique d'observation limité. Les estimations statistiques se fiabilisent à mesure de l'accumulation des cours." : null)
                .calculatedAt(Instant.now())
                .build();
    }

    // =========================================================================
    // Post-Trade Risk Evaluation Trigger
    // =========================================================================

    @Transactional
    public PostTradeRiskEvaluationDto evaluatePostTradeRisk(Portfolio portfolio, Trade trade) {
        try {
            // Snapshot of risk immediately after trade
            PortfolioRiskAnalyticsDto currentAnalytics = computeAnalytics(portfolio.getUser().getId(), portfolio.getSessionId());

            // Get previous post-trade record or derive baseline
            var previousOpt = postTradeRiskRepository.findFirstByPortfolioIdOrderByCreatedAtDesc(portfolio.getId());

            BigDecimal equityBefore = previousOpt.map(PostTradeRiskEvaluation::getEquityAfter)
                    .orElse(currentAnalytics.getPortfolioEquity());
            BigDecimal exposureBefore = previousOpt.map(PostTradeRiskEvaluation::getExposurePctAfter)
                    .orElse(currentAnalytics.getTotalExposurePct());
            BigDecimal var95Before = previousOpt.map(PostTradeRiskEvaluation::getVar95After)
                    .orElse(currentAnalytics.getVar95Amount());
            BigDecimal hhiBefore = previousOpt.map(PostTradeRiskEvaluation::getConcentrationHhiAfter)
                    .orElse(currentAnalytics.getHhi());

            BigDecimal deltaExp = currentAnalytics.getTotalExposurePct().subtract(exposureBefore);
            BigDecimal deltaVar = currentAnalytics.getVar95Amount().subtract(var95Before);

            List<String> warnings = new ArrayList<>();
            if (deltaExp.compareTo(new BigDecimal("15.00")) > 0) {
                warnings.add(String.format("Forte augmentation de l'exposition (+%.2f%%) consécutive à l'ordre.", deltaExp));
            }
            if (deltaVar.compareTo(BigDecimal.ZERO) > 0 && var95Before.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal varIncreasePct = deltaVar.divide(var95Before, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"));
                if (varIncreasePct.compareTo(new BigDecimal("20.00")) > 0) {
                    warnings.add(String.format("Hausse notable de la VaR 95%% (+%.1f%%) suite à cette opération.", varIncreasePct));
                }
            }

            String warningsJson;
            try {
                warningsJson = objectMapper.writeValueAsString(warnings);
            } catch (Exception e) {
                warningsJson = "[]";
            }

            PostTradeRiskEvaluation eval = PostTradeRiskEvaluation.builder()
                    .portfolio(portfolio)
                    .tradeId(trade.getId())
                    .symbol(trade.getSymbol())
                    .side(trade.getSide())
                    .quantity(trade.getQuantity())
                    .price(trade.getPrice())
                    .equityBefore(equityBefore)
                    .equityAfter(currentAnalytics.getPortfolioEquity())
                    .exposurePctBefore(exposureBefore)
                    .exposurePctAfter(currentAnalytics.getTotalExposurePct())
                    .var95Before(var95Before)
                    .var95After(currentAnalytics.getVar95Amount())
                    .deltaExposurePct(deltaExp)
                    .deltaVar95(deltaVar)
                    .concentrationHhiBefore(hhiBefore)
                    .concentrationHhiAfter(currentAnalytics.getHhi())
                    .warningsJson(warningsJson)
                    .createdAt(Instant.now())
                    .build();

            eval = postTradeRiskRepository.save(eval);

            PostTradeRiskEvaluationDto dto = mapPostTradeToDto(eval);

            // Broadcast risk update over WebSocket if template available
            try {
                if (messagingTemplate != null) {
                    messagingTemplate.convertAndSend(
                            "/topic/portfolio-risk/" + portfolio.getUser().getId(),
                            currentAnalytics);
                }
            } catch (Exception wsEx) {
                log.debug("[RISK WS] Broadcast non bloquant : {}", wsEx.getMessage());
            }

            return dto;
        } catch (Exception ex) {
            log.warn("[POST-TRADE RISK] Évaluation post-trade ignorée suite à erreur non bloquante : {}", ex.getMessage());
            return null;
        }
    }

    // =========================================================================
    // Mathematical Computations & Helpers
    // =========================================================================

    private Map<String, List<Double>> fetchAlignedReturnSeries(List<Position> positions, int days) {
        Map<String, List<Double>> result = new LinkedHashMap<>();
        Instant from = Instant.now().minus(days * 2L, ChronoUnit.DAYS);
        Instant to = Instant.now();

        // Check if daily candles exist in DB
        for (Position pos : positions) {
            String sym = pos.getSymbol();
            List<MarketCandle> candles = candleRepository.findBySymbolAndResolutionAndTsBetweenOrderByTsAsc(
                    sym, "D", from, to);

            List<Double> returns = new ArrayList<>();
            if (candles.size() >= 2) {
                for (int i = 1; i < candles.size(); i++) {
                    double c0 = candles.get(i - 1).getClose().doubleValue();
                    double c1 = candles.get(i).getClose().doubleValue();
                    if (c0 > 0) {
                        returns.add((c1 - c0) / c0);
                    }
                }
            } else {
                // Fallback: derive returns from recent quotes in DB
                var quotes = quoteRepository.findBySymbolOrderByTsDesc(sym, PageRequest.of(0, 60));
                if (quotes.size() >= 2) {
                    for (int i = quotes.size() - 2; i >= 0; i--) {
                        double p0 = quotes.get(i + 1).getPrice().doubleValue();
                        double p1 = quotes.get(i).getPrice().doubleValue();
                        if (p0 > 0) {
                            returns.add((p1 - p0) / p0);
                        }
                    }
                }
            }
            result.put(sym, returns);
        }

        // Align lengths to minimum common observation count (at least 2 observations)
        int minLen = result.values().stream().mapToInt(List::size).min().orElse(0);
        if (minLen > 0) {
            for (String sym : new ArrayList<>(result.keySet())) {
                List<Double> full = result.get(sym);
                result.put(sym, new ArrayList<>(full.subList(full.size() - minLen, full.size())));
            }
        }

        return result;
    }

    private List<PositionRiskContributionDto> calculatePositionRiskContributions(
            List<Position> positions,
            Map<String, BigDecimal> marketValues,
            Map<String, Double> weights,
            Map<String, List<Double>> assetReturns,
            List<Double> portfolioReturns,
            double portVol,
            BigDecimal equity) {

        List<PositionRiskContributionDto> list = new ArrayList<>();
        int n = portfolioReturns.size();
        double pMean = portfolioReturns.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);

        for (Position pos : positions) {
            String sym = pos.getSymbol();
            double w = weights.getOrDefault(sym, 0.0);
            List<Double> rList = assetReturns.getOrDefault(sym, List.of());

            double assetVol = 0.0;
            double cov = 0.0;

            if (rList.size() > 1 && n > 1) {
                double aMean = rList.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
                double aVar = rList.stream().mapToDouble(r -> Math.pow(r - aMean, 2)).sum() / (rList.size() - 1);
                assetVol = Math.sqrt(aVar);

                double sumCross = 0.0;
                for (int t = 0; t < Math.min(rList.size(), n); t++) {
                    sumCross += (rList.get(t) - aMean) * (portfolioReturns.get(t) - pMean);
                }
                cov = sumCross / (n - 1);
            }

            double mrc = (portVol > 1e-9) ? (cov / portVol) : 0.0;
            double crc = w * mrc;
            double riskPct = (portVol > 1e-9) ? (crc / portVol) * 100.0 : w * 100.0;

            list.add(PositionRiskContributionDto.builder()
                    .symbol(sym)
                    .quantity(pos.getQuantity())
                    .currentPrice(marketValues.get(sym).divide(pos.getQuantity(), 4, RoundingMode.HALF_UP))
                    .marketValue(marketValues.get(sym).setScale(2, RoundingMode.HALF_UP))
                    .weightPct(BigDecimal.valueOf(w * 100.0).setScale(2, RoundingMode.HALF_UP))
                    .assetVolatilityPct(BigDecimal.valueOf(assetVol * SQRT_252 * 100.0).setScale(2, RoundingMode.HALF_UP))
                    .marginalRiskContribution(BigDecimal.valueOf(mrc).setScale(4, RoundingMode.HALF_UP))
                    .componentRiskContribution(BigDecimal.valueOf(crc).setScale(6, RoundingMode.HALF_UP))
                    .riskContributionPct(BigDecimal.valueOf(riskPct).setScale(2, RoundingMode.HALF_UP))
                    .sector(SectorClassificationUtil.getSector(sym))
                    .build());
        }

        list.sort(Comparator.comparing(PositionRiskContributionDto::getRiskContributionPct).reversed());
        return list;
    }

    private List<SectorConcentrationDto> calculateSectorConcentration(
            List<Position> positions, Map<String, BigDecimal> marketValues, BigDecimal equity) {

        Map<String, BigDecimal> sectorMv = new LinkedHashMap<>();
        Map<String, List<String>> sectorSymbols = new LinkedHashMap<>();

        for (Position pos : positions) {
            String sector = SectorClassificationUtil.getSector(pos.getSymbol());
            BigDecimal mv = marketValues.getOrDefault(pos.getSymbol(), BigDecimal.ZERO);

            sectorMv.merge(sector, mv, BigDecimal::add);
            sectorSymbols.computeIfAbsent(sector, k -> new ArrayList<>()).add(pos.getSymbol());
        }

        return sectorMv.entrySet().stream()
                .map(e -> {
                    BigDecimal weight = equity.compareTo(BigDecimal.ZERO) > 0
                            ? e.getValue().divide(equity, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"))
                            : BigDecimal.ZERO;

                    return SectorConcentrationDto.builder()
                            .sector(e.getKey())
                            .marketValue(e.getValue().setScale(2, RoundingMode.HALF_UP))
                            .weightPct(weight.setScale(2, RoundingMode.HALF_UP))
                            .assetsCount(sectorSymbols.get(e.getKey()).size())
                            .symbols(sectorSymbols.get(e.getKey()))
                            .build();
                })
                .sorted(Comparator.comparing(SectorConcentrationDto::getWeightPct).reversed())
                .collect(Collectors.toList());
    }

    private CorrelationMatrixDto calculateCorrelationMatrix(
            List<Position> positions, Map<String, List<Double>> assetReturns) {

        List<String> symbols = positions.stream().map(Position::getSymbol).distinct().collect(Collectors.toList());
        int k = symbols.size();
        double[][] matrix = new double[k][k];
        List<CorrelationMatrixDto.CorrelatedPairDto> highCorr = new ArrayList<>();

        for (int i = 0; i < k; i++) {
            matrix[i][i] = 1.0;
            String symA = symbols.get(i);
            List<Double> rA = assetReturns.getOrDefault(symA, List.of());

            for (int j = i + 1; j < k; j++) {
                String symB = symbols.get(j);
                List<Double> rB = assetReturns.getOrDefault(symB, List.of());

                double corr = computePearsonCorrelation(rA, rB);
                matrix[i][j] = corr;
                matrix[j][i] = corr;

                if (corr > 0.85) {
                    highCorr.add(CorrelationMatrixDto.CorrelatedPairDto.builder()
                            .symbolA(symA)
                            .symbolB(symB)
                            .correlation(Math.round(corr * 1000.0) / 1000.0)
                            .warning("Forte corrélation (> 0.85) réduisant le bénéfice de diversification.")
                            .build());
                }
            }
        }

        return CorrelationMatrixDto.builder()
                .symbols(symbols)
                .matrix(matrix)
                .highlyCorrelatedPairs(highCorr)
                .build();
    }

    private double computePearsonCorrelation(List<Double> xs, List<Double> ys) {
        int n = Math.min(xs.size(), ys.size());
        if (n < 3) return 0.0;

        double meanX = 0.0;
        double meanY = 0.0;
        for (int i = 0; i < n; i++) {
            meanX += xs.get(i);
            meanY += ys.get(i);
        }
        meanX /= n;
        meanY /= n;

        double sumCross = 0.0;
        double sumSqX = 0.0;
        double sumSqY = 0.0;

        for (int i = 0; i < n; i++) {
            double dx = xs.get(i) - meanX;
            double dy = ys.get(i) - meanY;
            sumCross += dx * dy;
            sumSqX += dx * dx;
            sumSqY += dy * dy;
        }

        double denom = Math.sqrt(sumSqX * sumSqY);
        if (denom < 1e-12) return 0.0;

        double r = sumCross / denom;
        return Math.max(-1.0, Math.min(1.0, r));
    }

    private BetaResult calculateBeta(List<Double> portfolioReturns, String benchmark, int requiredObs) {
        Instant from = Instant.now().minus(DEFAULT_OBSERVATION_DAYS * 2L, ChronoUnit.DAYS);
        Instant to = Instant.now();

        List<MarketCandle> benchCandles = candleRepository.findBySymbolAndResolutionAndTsBetweenOrderByTsAsc(
                benchmark, "D", from, to);

        List<Double> benchReturns = new ArrayList<>();
        if (benchCandles.size() >= 2) {
            for (int i = 1; i < benchCandles.size(); i++) {
                double c0 = benchCandles.get(i - 1).getClose().doubleValue();
                double c1 = benchCandles.get(i).getClose().doubleValue();
                if (c0 > 0) benchReturns.add((c1 - c0) / c0);
            }
        } else {
            var quotes = quoteRepository.findBySymbolOrderByTsDesc(benchmark, PageRequest.of(0, 60));
            if (quotes.size() >= 2) {
                for (int i = quotes.size() - 2; i >= 0; i--) {
                    double p0 = quotes.get(i + 1).getPrice().doubleValue();
                    double p1 = quotes.get(i).getPrice().doubleValue();
                    if (p0 > 0) benchReturns.add((p1 - p0) / p0);
                }
            }
        }

        int n = Math.min(portfolioReturns.size(), benchReturns.size());
        if (n < 5) {
            return new BetaResult(null, benchmark, "INSUFFICIENT_DATA");
        }

        List<Double> pSlice = portfolioReturns.subList(portfolioReturns.size() - n, portfolioReturns.size());
        List<Double> bSlice = benchReturns.subList(benchReturns.size() - n, benchReturns.size());

        double meanP = pSlice.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        double meanB = bSlice.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);

        double cov = 0.0;
        double varB = 0.0;
        for (int i = 0; i < n; i++) {
            double dp = pSlice.get(i) - meanP;
            double db = bSlice.get(i) - meanB;
            cov += dp * db;
            varB += db * db;
        }

        if (varB < 1e-12) {
            return new BetaResult(null, benchmark, "ZERO_VARIANCE");
        }

        double beta = cov / varB;
        return new BetaResult(beta, benchmark, "ACTIVE");
    }

    private DrawdownStats calculateDrawdownStats(List<PortfolioSnapshot> snapshots, BigDecimal currentEquity) {
        if (snapshots.isEmpty()) {
            return new DrawdownStats(BigDecimal.ZERO, BigDecimal.ZERO, currentEquity, List.of());
        }

        double peak = Double.NEGATIVE_INFINITY;
        double maxDd = 0.0;
        List<PortfolioRiskAnalyticsDto.RiskEvolutionPointDto> points = new ArrayList<>();

        double prevEq = snapshots.get(0).getEquity().doubleValue();

        for (PortfolioSnapshot snap : snapshots) {
            double eq = snap.getEquity().doubleValue();
            if (eq > peak) peak = eq;

            double dd = (peak > 0) ? (peak - eq) / peak : 0.0;
            if (dd > maxDd) maxDd = dd;

            double ret = (prevEq > 0) ? (eq - prevEq) / prevEq : 0.0;
            prevEq = eq;

            points.add(PortfolioRiskAnalyticsDto.RiskEvolutionPointDto.builder()
                    .ts(snap.getTs())
                    .equity(snap.getEquity().setScale(2, RoundingMode.HALF_UP))
                    .drawdownPct(BigDecimal.valueOf(dd * 100.0).setScale(2, RoundingMode.HALF_UP))
                    .dailyReturnPct(BigDecimal.valueOf(ret * 100.0).setScale(2, RoundingMode.HALF_UP))
                    .build());
        }

        double currEqDouble = currentEquity.doubleValue();
        if (currEqDouble > peak) peak = currEqDouble;

        double currDd = (peak > 0) ? (peak - currEqDouble) / peak : 0.0;
        if (currDd > maxDd) maxDd = currDd;

        return new DrawdownStats(
                BigDecimal.valueOf(currDd * 100.0).setScale(2, RoundingMode.HALF_UP),
                BigDecimal.valueOf(maxDd * 100.0).setScale(2, RoundingMode.HALF_UP),
                BigDecimal.valueOf(peak).setScale(2, RoundingMode.HALF_UP),
                points
        );
    }

    private PortfolioRiskAnalyticsDto buildCashOnlyAnalytics(Portfolio portfolio, BigDecimal equity, BigDecimal cash) {
        List<PortfolioSnapshot> snapshots = snapshotRepository.findByPortfolioIdOrderByTsAsc(
                portfolio.getId(), PageRequest.of(0, 100));
        DrawdownStats dd = calculateDrawdownStats(snapshots, equity);

        return PortfolioRiskAnalyticsDto.builder()
                .portfolioEquity(equity.setScale(2, RoundingMode.HALF_UP))
                .cashBalance(cash.setScale(2, RoundingMode.HALF_UP))
                .investedValue(BigDecimal.ZERO)
                .totalExposurePct(BigDecimal.ZERO)
                .positionsCount(0)
                .var95Pct(BigDecimal.ZERO)
                .var95Amount(BigDecimal.ZERO)
                .var99Pct(BigDecimal.ZERO)
                .var99Amount(BigDecimal.ZERO)
                .varMethodology("Aucune position ouverte — Risque de marché nul (100% Cash)")
                .cvar95Pct(BigDecimal.ZERO)
                .cvar95Amount(BigDecimal.ZERO)
                .cvar99Pct(BigDecimal.ZERO)
                .cvar99Amount(BigDecimal.ZERO)
                .cvarExplanation("Le portefeuille est intégralement liquide, aucune perte de marché attendue.")
                .dailyVolatilityPct(BigDecimal.ZERO)
                .annualizedVolatilityPct(BigDecimal.ZERO)
                .currentDrawdownPct(dd.currentDrawdownPct)
                .maxHistoricalDrawdownPct(dd.maxDrawdownPct)
                .peakEquity(dd.peakEquity)
                .beta(BigDecimal.ZERO)
                .benchmarkSymbol(DEFAULT_BENCHMARK)
                .benchmarkStatus("CASH_PORTFOLIO")
                .hhi(BigDecimal.ZERO)
                .hhiLevel("DIVERSIFIÉ")
                .diversificationRatio(BigDecimal.ONE)
                .largestRiskContributor(null)
                .positionsRisk(List.of())
                .sectorConcentration(List.of())
                .correlationMatrix(CorrelationMatrixDto.builder().symbols(List.of()).matrix(new double[0][0]).highlyCorrelatedPairs(List.of()).build())
                .riskEvolution(dd.evolutionPoints)
                .activeAlerts(List.of())
                .lastPostTradeImpact(null)
                .observationWindow(0)
                .observationStatus("CASH_ONLY")
                .message("Portefeuille 100% liquide — Aucun risque de marché actif.")
                .calculatedAt(Instant.now())
                .build();
    }

    private PostTradeRiskEvaluationDto mapPostTradeToDto(PostTradeRiskEvaluation entity) {
        List<String> warnings = List.of();
        if (entity.getWarningsJson() != null && !entity.getWarningsJson().isBlank()) {
            try {
                warnings = objectMapper.readValue(entity.getWarningsJson(), List.class);
            } catch (Exception ignored) {}
        }

        return PostTradeRiskEvaluationDto.builder()
                .id(entity.getId())
                .tradeId(entity.getTradeId())
                .symbol(entity.getSymbol())
                .side(entity.getSide())
                .quantity(entity.getQuantity())
                .price(entity.getPrice())
                .equityBefore(entity.getEquityBefore())
                .equityAfter(entity.getEquityAfter())
                .exposurePctBefore(entity.getExposurePctBefore())
                .exposurePctAfter(entity.getExposurePctAfter())
                .deltaExposurePct(entity.getDeltaExposurePct())
                .var95Before(entity.getVar95Before())
                .var95After(entity.getVar95After())
                .deltaVar95(entity.getDeltaVar95())
                .concentrationHhiBefore(entity.getConcentrationHhiBefore())
                .concentrationHhiAfter(entity.getConcentrationHhiAfter())
                .warnings(warnings)
                .createdAt(entity.getCreatedAt())
                .build();
    }

    private static class BetaResult {
        final Double beta;
        final String benchmark;
        final String status;

        BetaResult(Double beta, String benchmark, String status) {
            this.beta = beta;
            this.benchmark = benchmark;
            this.status = status;
        }
    }

    private static class DrawdownStats {
        final BigDecimal currentDrawdownPct;
        final BigDecimal maxDrawdownPct;
        final BigDecimal peakEquity;
        final List<PortfolioRiskAnalyticsDto.RiskEvolutionPointDto> evolutionPoints;

        DrawdownStats(BigDecimal currentDrawdownPct, BigDecimal maxDrawdownPct, BigDecimal peakEquity,
                      List<PortfolioRiskAnalyticsDto.RiskEvolutionPointDto> evolutionPoints) {
            this.currentDrawdownPct = currentDrawdownPct;
            this.maxDrawdownPct = maxDrawdownPct;
            this.peakEquity = peakEquity;
            this.evolutionPoints = evolutionPoints != null ? evolutionPoints : List.of();
        }
    }
}
