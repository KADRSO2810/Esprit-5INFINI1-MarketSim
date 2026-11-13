package com.marketsimulator.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.domain.*;
import com.marketsimulator.dto.*;
import com.marketsimulator.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class BacktestService {

    private final BacktestRunRepository runRepository;
    private final BacktestTradeRepository tradeRepository;
    private final BacktestEquityPointRepository equityPointRepository;
    private final UserRepository userRepository;
    private final FinnhubCandleService candleService;
    private final ObjectMapper objectMapper;

    public BacktestService(BacktestRunRepository runRepository,
                           BacktestTradeRepository tradeRepository,
                           BacktestEquityPointRepository equityPointRepository,
                           UserRepository userRepository,
                           FinnhubCandleService candleService,
                           ObjectMapper objectMapper) {
        this.runRepository = runRepository;
        this.tradeRepository = tradeRepository;
        this.equityPointRepository = equityPointRepository;
        this.userRepository = userRepository;
        this.candleService = candleService;
        this.objectMapper = objectMapper;
    }

    @Value("${app.backtest.fee-bps:5}")
    private double feeBps; // ex: 5 bps = 0.05% de frais de transaction par ordre

    @Value("${app.backtest.max-window-days:60}")
    private long maxWindowDays;

    /**
     * Valide la requête, persiste l'enregistrement initial avec le statut QUEUED,
     * puis délègue le calcul au moteur asynchrone.
     */
    @Transactional
    public BacktestRunResponse createAndQueueRun(Long userId, BacktestRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé: " + userId));

        // 1. Validation de la plage temporelle
        Instant from = Instant.ofEpochSecond(request.getFromEpochSec());
        Instant to = Instant.ofEpochSecond(request.getToEpochSec());

        if (!from.isBefore(to)) {
            throw new IllegalArgumentException("La date de début (from) doit être strictement antérieure à la date de fin (to).");
        }

        long windowSeconds = to.getEpochSecond() - from.getEpochSecond();
        if (windowSeconds > maxWindowDays * 24 * 3600) {
            throw new IllegalArgumentException(String.format("La fenêtre d'analyse (%d jours) dépasse le maximum autorisé de %d jours.",
                    windowSeconds / (24 * 3600), maxWindowDays));
        }

        // 2. Validation des paramètres de stratégie SMA
        int fast = getIntParam(request.getParams(), "fast", 20);
        int slow = getIntParam(request.getParams(), "slow", 50);

        if (fast < 2) {
            throw new IllegalArgumentException("Le paramètre fast SMA doit être supérieur ou égal à 2.");
        }
        if (slow < 5) {
            throw new IllegalArgumentException("Le paramètre slow SMA doit être supérieur ou égal à 5.");
        }
        if (fast >= slow) {
            throw new IllegalArgumentException(String.format("Le paramètre fast (%d) doit être strictement inférieur à slow (%d).", fast, slow));
        }

        String paramsJson;
        try {
            paramsJson = objectMapper.writeValueAsString(request.getParams());
        } catch (Exception e) {
            paramsJson = "{}";
        }

        BacktestRun run = BacktestRun.builder()
                .user(user)
                .symbol(request.getSymbol().trim().toUpperCase())
                .resolution(request.getResolution())
                .fromTs(from)
                .toTs(to)
                .strategy(request.getStrategy())
                .paramsJson(paramsJson)
                .initialCash(request.getInitialCash())
                .status("QUEUED")
                .build();

        run = runRepository.save(run);

        // Déclenchement de l'exécution asynchrone
        executeRunAsync(run.getId(), fast, slow);

        return toRunResponse(run);
    }

    /**
     * Moteur de calcul du backtest (exécuté en tâche de fond dans un thread dédié).
     */
    @Async
    public void executeRunAsync(Long runId, int fast, int slow) {
        log.info("[BACKTEST] Démarrage de l'exécution du run {}", runId);
        BacktestRun run = runRepository.findById(runId).orElse(null);
        if (run == null) return;

        run.setStatus("RUNNING");
        runRepository.save(run);

        try {
            // 1. Récupération des bougies réelles depuis le service Finnhub
            List<MarketCandle> candles = candleService.ensureCandles(
                    run.getSymbol(), run.getResolution(), run.getFromTs(), run.getToTs(), false);

            if (candles.size() < slow) {
                run.setStatus("FAILED");
                run.setErrorMessage(String.format("Nombre insuffisant de bougies réelles récupérées (%d bougies, %d requises pour la SMA slow).",
                        candles.size(), slow));
                runRepository.save(run);
                return;
            }

            // 2. Simulation de la stratégie SMA Crossover
            simulateSmaCrossover(run, candles, fast, slow);

            run.setStatus("DONE");
            runRepository.save(run);
            log.info("[BACKTEST] Run {} terminé avec succès. Total Return: {}%", runId, run.getTotalReturn());

        } catch (Exception ex) {
            log.error("[BACKTEST ERROR] Échec du run {} : {}", runId, ex.getMessage(), ex);
            run.setStatus("FAILED");
            run.setErrorMessage("Erreur d'exécution du backtest : " + ex.getMessage());
            runRepository.save(run);
        }
    }

    /**
     * Moteur de simulation :
     * - Prix d'exécution = cours de clôture (close) de la bougie du signal.
     * - Mode Long-Only : Achat all-in au croisement haussier, vente totale au croisement baissier.
     * - Prise en compte des frais (fee_bps).
     */
    public void simulateSmaCrossover(BacktestRun run, List<MarketCandle> candles, int fast, int slow) {
        double cash = run.getInitialCash().doubleValue();
        double initialCash = cash;
        double heldQty = 0.0;
        double lastBuyPrice = 0.0;
        double feeRate = (feeBps / 10000.0);

        List<BacktestTrade> trades = new ArrayList<>();
        List<BacktestEquityPoint> equityPoints = new ArrayList<>(candles.size());

        int winningTrades = 0;
        int closedRoundtrips = 0;
        double peakEquity = initialCash;
        double maxDrawdown = 0.0;
        List<Double> returnsList = new ArrayList<>();

        double previousEquity = initialCash;

        // Précalcul des SMA
        double[] smaFast = calculateSma(candles, fast);
        double[] smaSlow = calculateSma(candles, slow);

        for (int i = 0; i < candles.size(); i++) {
            MarketCandle candle = candles.get(i);
            double closePrice = candle.getClose().doubleValue();

            // On vérifie les signaux à partir du moment où fast et slow sont calculées
            if (i >= slow) {
                double fastPrev = smaFast[i - 1];
                double slowPrev = smaSlow[i - 1];
                double fastCurr = smaFast[i];
                double slowCurr = smaSlow[i];

                boolean bullishCross = (fastPrev <= slowPrev) && (fastCurr > slowCurr);
                boolean bearishCross = (fastPrev >= slowPrev) && (fastCurr < slowCurr);

                // Signal BUY
                if (bullishCross && heldQty == 0 && cash > 10.0) {
                    double notionalTarget = cash;
                    double buyQty = notionalTarget / (closePrice * (1.0 + feeRate));
                    double notional = buyQty * closePrice;
                    double fee = notional * feeRate;
                    cash = cash - notional - fee;
                    heldQty = buyQty;
                    lastBuyPrice = closePrice;

                    trades.add(BacktestTrade.builder()
                            .run(run)
                            .ts(candle.getTs())
                            .symbol(candle.getSymbol())
                            .side("BUY")
                            .qty(BigDecimal.valueOf(buyQty).setScale(6, RoundingMode.HALF_UP))
                            .price(BigDecimal.valueOf(closePrice).setScale(6, RoundingMode.HALF_UP))
                            .fee(BigDecimal.valueOf(fee).setScale(6, RoundingMode.HALF_UP))
                            .cashAfter(BigDecimal.valueOf(cash).setScale(2, RoundingMode.HALF_UP))
                            .build());
                }
                // Signal SELL
                else if (bearishCross && heldQty > 0) {
                    double notional = heldQty * closePrice;
                    double fee = notional * feeRate;
                    cash = cash + notional - fee;

                    if (closePrice > lastBuyPrice) {
                        winningTrades++;
                    }
                    closedRoundtrips++;

                    trades.add(BacktestTrade.builder()
                            .run(run)
                            .ts(candle.getTs())
                            .symbol(candle.getSymbol())
                            .side("SELL")
                            .qty(BigDecimal.valueOf(heldQty).setScale(6, RoundingMode.HALF_UP))
                            .price(BigDecimal.valueOf(closePrice).setScale(6, RoundingMode.HALF_UP))
                            .fee(BigDecimal.valueOf(fee).setScale(6, RoundingMode.HALF_UP))
                            .cashAfter(BigDecimal.valueOf(cash).setScale(2, RoundingMode.HALF_UP))
                            .build());

                    heldQty = 0.0;
                }
            }

            // Calcul de l'equity courante
            double currentEquity = cash + (heldQty * closePrice);

            // Suivi du drawdown
            if (currentEquity > peakEquity) {
                peakEquity = currentEquity;
            }
            if (peakEquity > 0) {
                double dd = (peakEquity - currentEquity) / peakEquity;
                if (dd > maxDrawdown) {
                    maxDrawdown = dd;
                }
            }

            // Rendements périodiques pour Sharpe
            if (previousEquity > 0) {
                returnsList.add((currentEquity - previousEquity) / previousEquity);
            }
            previousEquity = currentEquity;

            // Ajout du point d'equity
            equityPoints.add(BacktestEquityPoint.builder()
                    .run(run)
                    .ts(candle.getTs())
                    .equity(BigDecimal.valueOf(currentEquity).setScale(2, RoundingMode.HALF_UP))
                    .build());
        }

        // Sauvegarde groupée des trades et des points d'equity
        if (!trades.isEmpty()) {
            tradeRepository.saveAll(trades);
        }
        if (!equityPoints.isEmpty()) {
            equityPointRepository.saveAll(equityPoints);
        }

        // Calcul des métriques de clôture
        double finalEquity = equityPoints.isEmpty() ? initialCash : equityPoints.get(equityPoints.size() - 1).getEquity().doubleValue();
        double totalReturnPct = ((finalEquity - initialCash) / initialCash) * 100.0;
        double winRatePct = closedRoundtrips > 0 ? ((double) winningTrades / closedRoundtrips) * 100.0 : 0.0;

        // Ratio de Sharpe annualisé approximatif
        double sharpe = computeSharpeRatio(returnsList, run.getResolution());

        run.setTotalReturn(BigDecimal.valueOf(totalReturnPct).setScale(4, RoundingMode.HALF_UP));
        run.setMaxDrawdown(BigDecimal.valueOf(maxDrawdown * 100.0).setScale(4, RoundingMode.HALF_UP));
        run.setSharpeRatio(BigDecimal.valueOf(sharpe).setScale(4, RoundingMode.HALF_UP));
        run.setTradesCount(trades.size());
        run.setWinRate(BigDecimal.valueOf(winRatePct).setScale(4, RoundingMode.HALF_UP));
    }

    private double[] calculateSma(List<MarketCandle> candles, int period) {
        int n = candles.size();
        double[] sma = new double[n];
        double sum = 0.0;

        for (int i = 0; i < n; i++) {
            sum += candles.get(i).getClose().doubleValue();
            if (i >= period) {
                sum -= candles.get(i - period).getClose().doubleValue();
            }
            if (i >= period - 1) {
                sma[i] = sum / period;
            } else {
                sma[i] = Double.NaN;
            }
        }
        return sma;
    }

    private double computeSharpeRatio(List<Double> returns, String resolution) {
        if (returns.size() < 2) return 0.0;

        double mean = returns.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        double variance = returns.stream()
                .mapToDouble(r -> (r - mean) * (r - mean))
                .average().orElse(0.0);
        double std = Math.sqrt(variance);

        if (std == 0.0) return 0.0;

        // Facteur d'annualisation selon la granularité
        double annualFactor = switch (resolution) {
            case "1" -> Math.sqrt(252 * 390);
            case "5" -> Math.sqrt(252 * 78);
            case "15" -> Math.sqrt(252 * 26);
            case "60" -> Math.sqrt(252 * 6.5);
            default -> Math.sqrt(252); // "D"
        };

        return (mean / std) * annualFactor;
    }

    // ── Getters pour API REST ──────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<BacktestRunResponse> listUserRuns(Long userId) {
        return runRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toRunResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public BacktestRunResponse getRun(Long runId, Long userId) {
        BacktestRun run = runRepository.findByIdAndUserId(runId, userId)
                .orElseThrow(() -> new RuntimeException("Backtest non trouvé avec l'id: " + runId));
        return toRunResponse(run);
    }

    @Transactional(readOnly = true)
    public List<BacktestTradeDto> getRunTrades(Long runId, Long userId) {
        // Vérifie les droits de l'utilisateur
        getRun(runId, userId);
        return tradeRepository.findByRunIdOrderByTsAsc(runId).stream()
                .map(t -> BacktestTradeDto.builder()
                        .id(t.getId())
                        .ts(t.getTs())
                        .symbol(t.getSymbol())
                        .side(t.getSide())
                        .qty(t.getQty())
                        .price(t.getPrice())
                        .fee(t.getFee())
                        .cashAfter(t.getCashAfter())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<BacktestEquityPointDto> getRunEquity(Long runId, Long userId) {
        // Vérifie les droits de l'utilisateur
        getRun(runId, userId);
        return equityPointRepository.findByRunIdOrderByTsAsc(runId).stream()
                .map(e -> BacktestEquityPointDto.builder()
                        .ts(e.getTs())
                        .equity(e.getEquity())
                        .build())
                .collect(Collectors.toList());
    }

    private BacktestRunResponse toRunResponse(BacktestRun run) {
        Map<String, Object> params = Collections.emptyMap();
        try {
            if (run.getParamsJson() != null) {
                params = objectMapper.readValue(run.getParamsJson(), new TypeReference<>() {});
            }
        } catch (Exception ignored) {}

        return BacktestRunResponse.builder()
                .id(run.getId())
                .symbol(run.getSymbol())
                .resolution(run.getResolution())
                .fromTs(run.getFromTs())
                .toTs(run.getToTs())
                .strategy(run.getStrategy())
                .params(params)
                .initialCash(run.getInitialCash())
                .status(run.getStatus())
                .errorMessage(run.getErrorMessage())
                .totalReturn(run.getTotalReturn())
                .maxDrawdown(run.getMaxDrawdown())
                .sharpeRatio(run.getSharpeRatio())
                .tradesCount(run.getTradesCount())
                .winRate(run.getWinRate())
                .createdAt(run.getCreatedAt())
                .build();
    }

    private int getIntParam(Map<String, Object> params, String key, int defaultValue) {
        if (params == null || !params.containsKey(key)) return defaultValue;
        Object val = params.get(key);
        if (val instanceof Number) return ((Number) val).intValue();
        try {
            return Integer.parseInt(String.valueOf(val));
        } catch (Exception e) {
            return defaultValue;
        }
    }
}
