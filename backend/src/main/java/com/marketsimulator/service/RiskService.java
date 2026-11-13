package com.marketsimulator.service;

import com.marketsimulator.domain.Portfolio;
import com.marketsimulator.domain.PortfolioSnapshot;
import com.marketsimulator.domain.Position;
import com.marketsimulator.dto.RiskMetricsDto;
import com.marketsimulator.repository.MarketQuoteRepository;
import com.marketsimulator.repository.PortfolioSnapshotRepository;
import com.marketsimulator.repository.PositionRepository;
import com.marketsimulator.service.market.MarketDataIngestionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RiskService {

    private final PortfolioService portfolioService;
    private final PortfolioSnapshotRepository snapshotRepository;
    private final PositionRepository positionRepository;
    private final MarketQuoteRepository quoteRepository;
    private final MarketDataIngestionService ingestionService;

    @Value("${app.trading.risk-window-ticks:300}")
    private int riskWindowTicks;

    @Value("${app.trading.drawdown-window:120}")
    private int drawdownWindow;

    private static final double Z_95 = 1.6449;  // z-score for 95% VaR

    // ── Snapshot scheduler (every 10s) ───────────────────────────────────────

    @Scheduled(fixedRate = 10_000)
    @Transactional
    public void snapshotAllPortfolios() {
        portfolioService.getAllPortfolioIds().entrySet().forEach(entry -> {
            try {
                Long portfolioId = entry.getKey();
                Portfolio portfolio = entry.getValue();
                BigDecimal equity = computeEquity(portfolioId, portfolio);
                BigDecimal cash = portfolio.getCashBalance();
                PortfolioSnapshot snap = PortfolioSnapshot.builder()
                        .portfolio(portfolio)
                        .equity(equity)
                        .cash(cash)
                        .ts(Instant.now())
                        .build();
                snapshotRepository.save(snap);
            } catch (Exception ex) {
                log.warn("[RISK] Failed to snapshot portfolio {}: {}", entry.getKey(), ex.getMessage());
            }
        });
    }

    // ── Risk metrics ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public RiskMetricsDto computeRiskMetrics(Long userId) {
        Portfolio portfolio = portfolioService.ensurePortfolio(userId);
        List<Position> positions = positionRepository.findByPortfolioId(portfolio.getId());

        if (positions.isEmpty()) {
            return RiskMetricsDto.builder()
                    .var95(BigDecimal.ZERO)
                    .maxDrawdown(BigDecimal.ZERO)
                    .portfolioEquity(portfolio.getCashBalance())
                    .exposureBySymbol(List.of())
                    .quoteWindowUsed(0)
                    .snapshotWindowUsed(0)
                    .message("No open positions — no risk to measure")
                    .build();
        }

        // ── Compute equity & exposures ────────────────────────────────────────
        BigDecimal totalMv = BigDecimal.ZERO;
        Map<String, BigDecimal> mvBySymbol = new LinkedHashMap<>();

        for (Position pos : positions) {
            var quote = ingestionService.getLatestQuote(pos.getSymbol());
            BigDecimal lastPrice = quote != null ? quote.getPrice() : pos.getAvgPrice();
            BigDecimal mv = lastPrice.multiply(pos.getQuantity());
            mvBySymbol.put(pos.getSymbol(), mv);
            totalMv = totalMv.add(mv);
        }

        BigDecimal equity = portfolio.getCashBalance().add(totalMv);

        List<RiskMetricsDto.ExposureEntry> exposures = mvBySymbol.entrySet().stream()
                .map(e -> {
                    BigDecimal weight = equity.compareTo(BigDecimal.ZERO) != 0
                            ? e.getValue().divide(equity, 6, RoundingMode.HALF_UP)
                            : BigDecimal.ZERO;
                    return RiskMetricsDto.ExposureEntry.builder()
                            .symbol(e.getKey())
                            .marketValue(e.getValue().setScale(2, RoundingMode.HALF_UP))
                            .weight(weight)
                            .build();
                })
                .sorted(Comparator.comparing(RiskMetricsDto.ExposureEntry::getWeight).reversed())
                .collect(Collectors.toList());

        // ── VaR 95% using portfolio return series (weighted volatility) ───────
        BigDecimal var95 = computeVar95(positions, mvBySymbol, equity);
        int quotesUsed = riskWindowTicks;

        // ── Max drawdown from snapshots ───────────────────────────────────────
        List<PortfolioSnapshot> snapshots = snapshotRepository
                .findByPortfolioIdOrderByTsAsc(portfolio.getId(), PageRequest.of(0, drawdownWindow));

        BigDecimal maxDrawdown = computeMaxDrawdown(snapshots);
        int snapshotsUsed = snapshots.size();

        String message = null;
        if (snapshotsUsed < 5) {
            message = "Insufficient snapshot history for drawdown — keep system running to accumulate data.";
        }

        return RiskMetricsDto.builder()
                .var95(var95 != null ? var95.setScale(2, RoundingMode.HALF_UP) : null)
                .maxDrawdown(maxDrawdown != null ? maxDrawdown.setScale(6, RoundingMode.HALF_UP) : null)
                .portfolioEquity(equity.setScale(2, RoundingMode.HALF_UP))
                .exposureBySymbol(exposures)
                .quoteWindowUsed(quotesUsed)
                .snapshotWindowUsed(snapshotsUsed)
                .message(message)
                .build();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private BigDecimal computeEquity(Long portfolioId, Portfolio portfolio) {
        List<Position> positions = positionRepository.findByPortfolioId(portfolioId);
        BigDecimal mv = BigDecimal.ZERO;
        for (Position pos : positions) {
            var quote = ingestionService.getLatestQuote(pos.getSymbol());
            BigDecimal lastPrice = quote != null ? quote.getPrice() : pos.getAvgPrice();
            mv = mv.add(lastPrice.multiply(pos.getQuantity()));
        }
        return portfolio.getCashBalance().add(mv);
    }

    private BigDecimal computeVar95(List<Position> positions,
                                     Map<String, BigDecimal> mvBySymbol,
                                     BigDecimal equity) {
        if (equity.compareTo(BigDecimal.ZERO) == 0) return BigDecimal.ZERO;

        // For each position: fetch last N quotes, compute stddev of returns, weight by portfolio share
        double portfolioVariance = 0.0;
        int quotesUsed = 0;

        for (Position pos : positions) {
            String sym = pos.getSymbol();
            BigDecimal weight = mvBySymbol.getOrDefault(sym, BigDecimal.ZERO)
                    .divide(equity, 10, RoundingMode.HALF_UP);
            double w = weight.doubleValue();
            if (w == 0) continue;

            // Get recent quotes from DB
            var recentQuotes = quoteRepository.findBySymbolOrderByTsDesc(sym, PageRequest.of(0, riskWindowTicks));
            if (recentQuotes.size() < 2) continue;

            List<Double> returns = new ArrayList<>();
            for (int i = 0; i < recentQuotes.size() - 1; i++) {
                double p1 = recentQuotes.get(i).getPrice().doubleValue();
                double p0 = recentQuotes.get(i + 1).getPrice().doubleValue();
                if (p0 > 0) returns.add((p1 - p0) / p0);
            }

            if (returns.isEmpty()) continue;
            quotesUsed = Math.max(quotesUsed, returns.size());

            double mean = returns.stream().mapToDouble(Double::doubleValue).average().orElse(0);
            double variance = returns.stream()
                    .mapToDouble(r -> (r - mean) * (r - mean))
                    .average().orElse(0);
            double sigma = Math.sqrt(variance);

            // Weighted contribution to portfolio variance (simplified: assumes zero correlation)
            portfolioVariance += (w * sigma) * (w * sigma);
        }

        double portfolioSigma = Math.sqrt(portfolioVariance);
        double equityD = equity.doubleValue();
        double var = Z_95 * portfolioSigma * equityD;

        return BigDecimal.valueOf(var);
    }

    private BigDecimal computeMaxDrawdown(List<PortfolioSnapshot> snapshots) {
        if (snapshots.size() < 2) return null;

        double peak = Double.NEGATIVE_INFINITY;
        double maxDD = 0.0;

        for (PortfolioSnapshot snap : snapshots) {
            double eq = snap.getEquity().doubleValue();
            if (eq > peak) peak = eq;
            if (peak > 0) {
                double dd = (peak - eq) / peak;
                if (dd > maxDD) maxDD = dd;
            }
        }
        return BigDecimal.valueOf(maxDD);
    }
}
