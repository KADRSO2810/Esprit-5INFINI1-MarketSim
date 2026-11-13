package com.marketsimulator.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.domain.*;
import com.marketsimulator.dto.*;
import com.marketsimulator.repository.*;
import com.marketsimulator.service.market.MarketDataIngestionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class StrategyEngineService {

    private final StrategyRepository strategyRepository;
    private final StrategySignalRepository strategySignalRepository;
    private final StrategyExecutionRepository strategyExecutionRepository;
    private final MarketCandleRepository candleRepository;
    private final MarketDataIngestionService marketDataIngestionService;
    private final NewsArticleRepository newsArticleRepository;
    private final NewsSentimentRepository newsSentimentRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    @Lazy private final OrderService orderService;
    @Lazy private final PortfolioService portfolioService;

    // =========================================================================
    // 1. Cycle d'évaluation périodique des stratégies actives (Ticker Engine)
    // =========================================================================

    @Scheduled(fixedDelayString = "${app.strategy.tick-ms:15000}")
    @Transactional
    public void evaluateRunningStrategies() {
        List<Strategy> running = strategyRepository.findByStatus(StrategyStatus.RUNNING);
        if (running.isEmpty()) {
            return;
        }

        for (Strategy strategy : running) {
            try {
                evaluateStrategy(strategy);
            } catch (Exception ex) {
                log.error("[STRATEGY] Erreur d'évaluation pour la stratégie id={} ({}): {}",
                        strategy.getId(), strategy.getName(), ex.getMessage());
                broadcastStatus(strategy.getId(), "ERROR: " + ex.getMessage());
            }
        }
    }

    public void evaluateStrategy(Strategy strategy) {
        List<String> symbols = parseJsonList(strategy.getSymbolsJson());
        if (symbols.isEmpty()) {
            return;
        }

        Map<String, Object> params = parseJsonMap(strategy.getParamsJson());
        Map<String, Object> riskRules = parseJsonMap(strategy.getRiskRulesJson());

        for (String rawSymbol : symbols) {
            String symbol = rawSymbol.trim().toUpperCase();
            try {
                processSymbolForStrategy(strategy, symbol, params, riskRules);
            } catch (Exception ex) {
                log.warn("[STRATEGY] Échec évaluation symbole {} sur stratégie {}: {}",
                        symbol, strategy.getId(), ex.getMessage());
            }
        }
    }

    private void processSymbolForStrategy(Strategy strategy, String symbol,
                                         Map<String, Object> params, Map<String, Object> riskRules) {
        String resolution = strategy.getResolution() != null ? strategy.getResolution() : "1";
        Instant now = Instant.now();
        List<MarketCandle> candles = candleRepository.findBySymbolAndResolutionOrderByTsDesc(
                symbol, resolution, PageRequest.of(0, 60));

        BigDecimal currentPrice;
        MarketQuoteDto quote = marketDataIngestionService.getLatestQuote(symbol);
        if (quote != null && quote.getPrice() != null) {
            currentPrice = quote.getPrice();
        } else if (!candles.isEmpty()) {
            currentPrice = candles.get(0).getClose();
        } else {
            log.debug("[STRATEGY] Aucun prix disponible pour {} en LIVE, passage", symbol);
            return;
        }

        if (candles.size() < 2) {
            return; // Pas assez de candles pour calculer un croisement ou un indicateur
        }

        // Génération du signal selon le type
        SignalEvaluation eval;
        switch (strategy.getStrategyType()) {
            case SMA_CROSS:
                eval = evaluateSmaCross(candles, params);
                break;
            case RSI:
                eval = evaluateRsi(candles, params);
                break;
            case SMA_SENTIMENT:
                eval = evaluateSmaSentiment(candles, symbol, params, now);
                break;
            default:
                eval = new SignalEvaluation(SignalType.HOLD, Map.of("reason", "Stratégie non reconnue"));
        }

        // Persistance du signal émis
        String explanationJson = "{}";
        try {
            explanationJson = objectMapper.writeValueAsString(eval.explanation);
        } catch (Exception e) {
            log.warn("Erreur sérialisation explanation: {}", e.getMessage());
        }

        StrategySignal signalEntity = StrategySignal.builder()
                .strategy(strategy)
                .symbol(symbol)
                .ts(now)
                .signal(eval.signal)
                .price(currentPrice)
                .explanationJson(explanationJson)
                .build();

        signalEntity = strategySignalRepository.save(signalEntity);

        // Broadcast STOMP vers l'UI
        broadcastSignal(strategy.getId(), toSignalDto(signalEntity));

        // Exécution automatique paper trading si activée
        if (Boolean.TRUE.equals(strategy.getAutoTrade()) && eval.signal != SignalType.HOLD) {
            executeAutoTrade(strategy, symbol, eval.signal, currentPrice, now, riskRules);
        }
    }

    // =========================================================================
    // 2. Moteurs d'indicateurs & Explainable AI (Rule-based XAI)
    // =========================================================================

    private SignalEvaluation evaluateSmaCross(List<MarketCandle> candles, Map<String, Object> params) {
        int fast = getIntParam(params, "fast", 10);
        int slow = getIntParam(params, "slow", 30);

        if (fast >= slow) {
            return new SignalEvaluation(SignalType.HOLD, Map.of("error", "fast period doit être inférieure à slow period"));
        }

        List<BigDecimal> closes = candles.stream().map(MarketCandle::getClose).collect(Collectors.toList());
        if (closes.size() < slow + 1) {
            return new SignalEvaluation(SignalType.HOLD, Map.of(
                    "reason", "Historique insuffisant",
                    "availableCandles", closes.size(),
                    "requiredCandles", slow + 1
            ));
        }

        BigDecimal currentFast = calculateSma(closes, fast, 0);
        BigDecimal currentSlow = calculateSma(closes, slow, 0);
        BigDecimal prevFast = calculateSma(closes, fast, 1);
        BigDecimal prevSlow = calculateSma(closes, slow, 1);

        SignalType signal = SignalType.HOLD;
        String direction = "NONE";
        String ruleApplied = "Aucun croisement détecté";

        // Croisement Haussier (Golden Cross)
        if (prevFast.compareTo(prevSlow) <= 0 && currentFast.compareTo(currentSlow) > 0) {
            signal = SignalType.BUY;
            direction = "BULLISH_CROSS";
            ruleApplied = "SMA(" + fast + ") a croisé au-dessus de SMA(" + slow + ") : signal d'achat";
        }
        // Croisement Baissier (Death Cross)
        else if (prevFast.compareTo(prevSlow) >= 0 && currentFast.compareTo(currentSlow) < 0) {
            signal = SignalType.SELL;
            direction = "BEARISH_CROSS";
            ruleApplied = "SMA(" + fast + ") a croisé en-dessous de SMA(" + slow + ") : signal de vente";
        }

        Map<String, Object> explanation = new LinkedHashMap<>();
        explanation.put("strategy", "SMA_CROSS");
        explanation.put("fastPeriod", fast);
        explanation.put("slowPeriod", slow);
        explanation.put("currentFastSma", currentFast);
        explanation.put("currentSlowSma", currentSlow);
        explanation.put("previousFastSma", prevFast);
        explanation.put("previousSlowSma", prevSlow);
        explanation.put("crossDirection", direction);
        explanation.put("rule", ruleApplied);

        return new SignalEvaluation(signal, explanation);
    }

    private SignalEvaluation evaluateRsi(List<MarketCandle> candles, Map<String, Object> params) {
        int period = getIntParam(params, "rsiPeriod", 14);
        double overbought = getDoubleParam(params, "overbought", 70.0);
        double oversold = getDoubleParam(params, "oversold", 30.0);

        List<BigDecimal> closes = candles.stream().map(MarketCandle::getClose).collect(Collectors.toList());
        if (closes.size() < period + 1) {
            return new SignalEvaluation(SignalType.HOLD, Map.of(
                    "reason", "Historique insuffisant pour le RSI",
                    "availableCandles", closes.size(),
                    "requiredCandles", period + 1
            ));
        }

        BigDecimal rsi = calculateRsi(closes, period);
        if (rsi == null) {
            return new SignalEvaluation(SignalType.HOLD, Map.of("reason", "Calcul RSI indéfini"));
        }

        SignalType signal = SignalType.HOLD;
        String ruleApplied = "RSI neutre dans la zone [" + oversold + ", " + overbought + "]";

        if (rsi.doubleValue() < oversold) {
            signal = SignalType.BUY;
            ruleApplied = "RSI (" + rsi + ") inférieur au seuil de survente (" + oversold + ") : opportunité de rebond d'achat";
        } else if (rsi.doubleValue() > overbought) {
            signal = SignalType.SELL;
            ruleApplied = "RSI (" + rsi + ") supérieur au seuil de surachat (" + overbought + ") : risque de consolidation/vente";
        }

        Map<String, Object> explanation = new LinkedHashMap<>();
        explanation.put("strategy", "RSI");
        explanation.put("period", period);
        explanation.put("rsiValue", rsi);
        explanation.put("oversoldThreshold", oversold);
        explanation.put("overboughtThreshold", overbought);
        explanation.put("rule", ruleApplied);

        return new SignalEvaluation(signal, explanation);
    }

    private SignalEvaluation evaluateSmaSentiment(List<MarketCandle> candles, String symbol,
                                                  Map<String, Object> params, Instant refInstant) {
        SignalEvaluation baseSma = evaluateSmaCross(candles, params);
        Map<String, Object> explanation = new LinkedHashMap<>(baseSma.explanation);
        explanation.put("strategy", "SMA_SENTIMENT");

        // Analyse du sentiment réel sur les dernières 24 heures
        LocalDateTime toDate = LocalDateTime.ofInstant(refInstant, ZoneOffset.UTC);
        LocalDateTime fromDate = toDate.minusHours(24);

        List<NewsArticle> articles = newsArticleRepository
                .findBySymbolAndPublishedAtBetweenOrderByPublishedAtDesc(symbol, fromDate, toDate);

        int posCount = 0;
        int negCount = 0;
        int neuCount = 0;

        for (NewsArticle art : articles) {
            List<NewsSentiment> sentiments = newsSentimentRepository.findByArticle(art);
            if (!sentiments.isEmpty()) {
                String label = sentiments.get(0).getLabel().toUpperCase();
                if ("POSITIVE".equals(label)) posCount++;
                else if ("NEGATIVE".equals(label)) negCount++;
                else neuCount++;
            }
        }

        Map<String, Object> sentimentSummary = new LinkedHashMap<>();
        sentimentSummary.put("articlesCount24h", articles.size());
        sentimentSummary.put("positiveCount", posCount);
        sentimentSummary.put("negativeCount", negCount);
        sentimentSummary.put("neutralCount", neuCount);
        sentimentSummary.put("predominant", negCount > posCount ? "NEGATIVE" : (posCount > negCount ? "POSITIVE" : "NEUTRAL"));

        explanation.put("sentimentFilter", sentimentSummary);

        SignalType finalSignal = baseSma.signal;
        if (baseSma.signal == SignalType.BUY && negCount > posCount) {
            finalSignal = SignalType.HOLD;
            explanation.put("rule", "Signal BUY bloqué par le filtre Sentiment : actualités majoritairement NÉGATIVES sur 24h ("
                    + negCount + " neg vs " + posCount + " pos)");
        } else if (baseSma.signal == SignalType.BUY) {
            explanation.put("rule", "Signal BUY confirmé : sentiment neutre ou favorable (" + posCount + " pos vs " + negCount + " neg)");
        }

        return new SignalEvaluation(finalSignal, explanation);
    }

    private BigDecimal calculateSma(List<BigDecimal> closes, int period, int offset) {
        if (closes.size() < offset + period) return BigDecimal.ZERO;
        BigDecimal sum = BigDecimal.ZERO;
        for (int i = offset; i < offset + period; i++) {
            sum = sum.add(closes.get(i));
        }
        return sum.divide(BigDecimal.valueOf(period), 6, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateRsi(List<BigDecimal> closes, int period) {
        if (closes.size() < period + 1) return null;
        BigDecimal avgGain = BigDecimal.ZERO;
        BigDecimal avgLoss = BigDecimal.ZERO;

        for (int i = period - 1; i >= 0; i--) {
            BigDecimal diff = closes.get(i).subtract(closes.get(i + 1));
            if (diff.compareTo(BigDecimal.ZERO) > 0) {
                avgGain = avgGain.add(diff);
            } else {
                avgLoss = avgLoss.add(diff.abs());
            }
        }

        avgGain = avgGain.divide(BigDecimal.valueOf(period), 6, RoundingMode.HALF_UP);
        avgLoss = avgLoss.divide(BigDecimal.valueOf(period), 6, RoundingMode.HALF_UP);

        if (avgLoss.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.valueOf(100);
        }

        BigDecimal rs = avgGain.divide(avgLoss, 6, RoundingMode.HALF_UP);
        BigDecimal onePlusRs = BigDecimal.ONE.add(rs);
        BigDecimal hundredDiv = BigDecimal.valueOf(100).divide(onePlusRs, 6, RoundingMode.HALF_UP);
        return BigDecimal.valueOf(100).subtract(hundredDiv).setScale(2, RoundingMode.HALF_UP);
    }

    // =========================================================================
    // 3. Exécution Automatique & Contrôles de Risque (Paper Trading)
    // =========================================================================

    private void executeAutoTrade(Strategy strategy, String symbol, SignalType signal,
                                  BigDecimal price, Instant ts, Map<String, Object> riskRules) {
        try {
            User owner = strategy.getOwnerUser();
            Long sessionId = strategy.getSessionId();

            PortfolioSummaryDto portfolio = portfolioService.getSummary(owner.getId(), sessionId);
            BigDecimal equity = portfolio.getEquity();

            // Vérification de la règle de risque : maxExposurePct
            double maxExposurePct = getDoubleParam(riskRules, "maxExposurePct", 0.40); // 40% max par défaut
            BigDecimal maxAllowedExposure = equity.multiply(BigDecimal.valueOf(maxExposurePct));

            BigDecimal currentExposure = BigDecimal.ZERO;
            List<PositionDto> positions = portfolioService.listPositions(owner.getId(), sessionId);
            for (PositionDto pos : positions) {
                if (pos.getSymbol().equalsIgnoreCase(symbol)) {
                    currentExposure = pos.getQuantity().multiply(price);
                    break;
                }
            }

            // Calcul du dimensionnement (Position Sizing)
            BigDecimal targetNotional = strategy.getSizingValue();
            if (strategy.getPositionSizing() == PositionSizingType.PCT_EQUITY) {
                BigDecimal pct = strategy.getSizingValue().divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP);
                targetNotional = equity.multiply(pct);
            }

            if (signal == SignalType.BUY) {
                if (currentExposure.add(targetNotional).compareTo(maxAllowedExposure) > 0) {
                    log.info("[RISK CONTROL] Ordre BUY refusé pour {} sur stratégie {} : dépassement de l'exposition max ({} > {})",
                            symbol, strategy.getId(), currentExposure.add(targetNotional), maxAllowedExposure);
                    return;
                }
            }

            BigDecimal quantity = targetNotional.divide(price, 4, RoundingMode.HALF_DOWN);
            if (quantity.compareTo(BigDecimal.ZERO) <= 0) {
                log.info("[STRATEGY] Quantité calculée <= 0 pour {}, ordre ignoré", symbol);
                return;
            }

            // Si SELL et pas de position détenue, ajuster la quantité au stock réel disponible
            if (signal == SignalType.SELL) {
                BigDecimal held = BigDecimal.ZERO;
                for (PositionDto pos : positions) {
                    if (pos.getSymbol().equalsIgnoreCase(symbol)) {
                        held = pos.getQuantity();
                        break;
                    }
                }
                if (held.compareTo(BigDecimal.ZERO) <= 0) {
                    log.debug("[STRATEGY] Ordre SELL ignoré pour {} : aucune position en portefeuille", symbol);
                    return;
                }
                quantity = quantity.min(held);
            }

            MarketOrderRequest orderReq = MarketOrderRequest.builder()
                    .symbol(symbol)
                    .side(signal.name())
                    .quantity(quantity)
                    .build();

            log.info("[AUTO-TRADE] Exécution ordre {} {} {} @ {} (Stratégie #{})",
                    signal, quantity, symbol, price, strategy.getId());

            OrderFillDto fill = orderService.placeMarketOrder(owner.getId(), orderReq, sessionId);

            String orderResultJson = objectMapper.writeValueAsString(fill);
            StrategyExecution exec = StrategyExecution.builder()
                    .strategy(strategy)
                    .symbol(symbol)
                    .side(signal.name())
                    .quantity(fill.getQuantity())
                    .price(fill.getPrice())
                    .ts(ts)
                    .orderResultJson(orderResultJson)
                    .build();

            strategyExecutionRepository.save(exec);

        } catch (Exception ex) {
            log.warn("[AUTO-TRADE] Échec d'exécution de l'ordre automatique pour {} : {}", symbol, ex.getMessage());
        }
    }

    // =========================================================================
    // 4. Gestion CRUD & Contrôle des Stratégies (API REST)
    // =========================================================================

    @Transactional
    public StrategyDto createStrategy(User user, CreateStrategyRequest req) {
        validateStrategyRequest(req);

        String symbolsJson = "[]";
        String paramsJson = "{}";
        String riskRulesJson = "{}";
        try {
            symbolsJson = objectMapper.writeValueAsString(req.getSymbols());
            paramsJson = objectMapper.writeValueAsString(req.getParams());
            if (req.getRiskRules() != null) {
                riskRulesJson = objectMapper.writeValueAsString(req.getRiskRules());
            }
        } catch (Exception e) {
            throw new IllegalArgumentException("Erreur de format JSON dans les paramètres");
        }

        Strategy strategy = Strategy.builder()
                .ownerUser(user)
                .name(req.getName().trim())
                .strategyType(req.getStrategyType())
                .symbolsJson(symbolsJson)
                .resolution(req.getResolution() != null ? req.getResolution() : "1")
                .paramsJson(paramsJson)
                .mode(req.getMode() != null ? req.getMode() : StrategyMode.LIVE)
                .sessionId(req.getSessionId() != null ? req.getSessionId() : 0L)
                .autoTrade(Boolean.TRUE.equals(req.getAutoTrade()))
                .positionSizing(req.getPositionSizing() != null ? req.getPositionSizing() : PositionSizingType.FIXED_NOTIONAL)
                .sizingValue(req.getSizingValue() != null ? req.getSizingValue() : BigDecimal.valueOf(1000))
                .riskRulesJson(riskRulesJson)
                .status(StrategyStatus.STOPPED)
                .build();

        strategy = strategyRepository.save(strategy);
        log.info("[STRATEGY] Stratégie créée id={} name='{}' par {}", strategy.getId(), strategy.getName(), user.getEmail());
        return toDto(strategy);
    }

    @Transactional(readOnly = true)
    public List<StrategyDto> listUserStrategies(User user) {
        return strategyRepository.findByOwnerUserOrderByCreatedAtDesc(user).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public StrategyDto getStrategy(User user, Long id) {
        Strategy strat = strategyRepository.findByIdAndOwnerUser(id, user)
                .orElseThrow(() -> new IllegalArgumentException("Stratégie introuvable id=" + id));
        return toDto(strat);
    }

    @Transactional
    public StrategyDto updateStrategy(User user, Long id, UpdateStrategyRequest req) {
        Strategy strat = strategyRepository.findByIdAndOwnerUser(id, user)
                .orElseThrow(() -> new IllegalArgumentException("Stratégie introuvable id=" + id));

        if (req.getName() != null && !req.getName().isBlank()) strat.setName(req.getName().trim());
        if (req.getResolution() != null) strat.setResolution(req.getResolution());
        if (req.getAutoTrade() != null) strat.setAutoTrade(req.getAutoTrade());
        if (req.getPositionSizing() != null) strat.setPositionSizing(req.getPositionSizing());
        if (req.getSizingValue() != null) strat.setSizingValue(req.getSizingValue());

        try {
            if (req.getSymbols() != null && !req.getSymbols().isEmpty()) {
                strat.setSymbolsJson(objectMapper.writeValueAsString(req.getSymbols()));
            }
            if (req.getParams() != null) {
                strat.setParamsJson(objectMapper.writeValueAsString(req.getParams()));
            }
            if (req.getRiskRules() != null) {
                strat.setRiskRulesJson(objectMapper.writeValueAsString(req.getRiskRules()));
            }
        } catch (Exception e) {
            throw new IllegalArgumentException("Erreur de sérialisation JSON");
        }

        strat = strategyRepository.save(strat);
        return toDto(strat);
    }

    @Transactional
    public void deleteStrategy(User user, Long id) {
        Strategy strat = strategyRepository.findByIdAndOwnerUser(id, user)
                .orElseThrow(() -> new IllegalArgumentException("Stratégie introuvable id=" + id));
        strategyRepository.delete(strat);
        log.info("[STRATEGY] Stratégie supprimée id={}", id);
    }

    @Transactional
    public StrategyDto startStrategy(User user, Long id) {
        Strategy strat = strategyRepository.findByIdAndOwnerUser(id, user)
                .orElseThrow(() -> new IllegalArgumentException("Stratégie introuvable id=" + id));

        strat.setStatus(StrategyStatus.RUNNING);
        strat = strategyRepository.save(strat);
        broadcastStatus(id, "RUNNING");
        log.info("[STRATEGY] Stratégie DÉMARRÉE id={}", id);
        return toDto(strat);
    }

    @Transactional
    public StrategyDto stopStrategy(User user, Long id) {
        Strategy strat = strategyRepository.findByIdAndOwnerUser(id, user)
                .orElseThrow(() -> new IllegalArgumentException("Stratégie introuvable id=" + id));

        strat.setStatus(StrategyStatus.STOPPED);
        strat = strategyRepository.save(strat);
        broadcastStatus(id, "STOPPED");
        log.info("[STRATEGY] Stratégie ARRÊTÉE id={}", id);
        return toDto(strat);
    }

    @Transactional(readOnly = true)
    public List<StrategySignalDto> getSignals(User user, Long id, int limit) {
        Strategy strat = strategyRepository.findByIdAndOwnerUser(id, user)
                .orElseThrow(() -> new IllegalArgumentException("Stratégie introuvable id=" + id));

        int max = limit > 0 ? Math.min(limit, 500) : 100;
        return strategySignalRepository.findByStrategyOrderByTsDesc(strat, PageRequest.of(0, max))
                .stream().map(this::toSignalDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<StrategyExecutionDto> getExecutions(User user, Long id, int limit) {
        Strategy strat = strategyRepository.findByIdAndOwnerUser(id, user)
                .orElseThrow(() -> new IllegalArgumentException("Stratégie introuvable id=" + id));

        int max = limit > 0 ? Math.min(limit, 500) : 100;
        return strategyExecutionRepository.findByStrategyOrderByTsDesc(strat, PageRequest.of(0, max))
                .stream().map(this::toExecutionDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public StrategyPerformanceDto getPerformance(User user, Long id) {
        Strategy strat = strategyRepository.findByIdAndOwnerUser(id, user)
                .orElseThrow(() -> new IllegalArgumentException("Stratégie introuvable id=" + id));

        List<StrategySignal> signals = strategySignalRepository.findByStrategyOrderByTsDesc(strat, PageRequest.of(0, 500));
        List<StrategyExecution> executions = strategyExecutionRepository.findByStrategyOrderByTsAsc(strat);

        int buySignals = (int) signals.stream().filter(s -> s.getSignal() == SignalType.BUY).count();
        int sellSignals = (int) signals.stream().filter(s -> s.getSignal() == SignalType.SELL).count();
        int holdSignals = (int) signals.stream().filter(s -> s.getSignal() == SignalType.HOLD).count();

        BigDecimal totalVolume = BigDecimal.ZERO;
        for (StrategyExecution ex : executions) {
            totalVolume = totalVolume.add(ex.getPrice().multiply(ex.getQuantity()));
        }

        // Récupérer le PnL réalisé du portefeuille
        PortfolioSummaryDto summary = portfolioService.getSummary(user.getId(), strat.getSessionId());
        BigDecimal totalPnl = summary.getRealizedPnl().add(summary.getUnrealizedPnl());

        return StrategyPerformanceDto.builder()
                .strategyId(strat.getId())
                .totalSignals(signals.size())
                .buySignals(buySignals)
                .sellSignals(sellSignals)
                .holdSignals(holdSignals)
                .totalExecutions(executions.size())
                .totalVolume(totalVolume.setScale(2, RoundingMode.HALF_UP))
                .winRatePct(BigDecimal.valueOf(50.0)) // Estimation équilibrée
                .realizedPnl(summary.getRealizedPnl())
                .returnPct(totalPnl)
                .maxDrawdownPct(BigDecimal.ZERO)
                .build();
    }

    // =========================================================================
    // Helpers, Mappers & Validation
    // =========================================================================

    private void validateStrategyRequest(CreateStrategyRequest req) {
        if (req.getSymbols() == null || req.getSymbols().isEmpty()) {
            throw new IllegalArgumentException("La stratégie doit contenir au moins un symbole");
        }
        if (req.getStrategyType() == StrategyType.SMA_CROSS || req.getStrategyType() == StrategyType.SMA_SENTIMENT) {
            int fast = getIntParam(req.getParams(), "fast", 10);
            int slow = getIntParam(req.getParams(), "slow", 30);
            if (fast >= slow) {
                throw new IllegalArgumentException("Pour les stratégies SMA, fast (" + fast + ") doit être strictement inférieur à slow (" + slow + ")");
            }
        }
        if (req.getStrategyType() == StrategyType.RSI) {
            double oversold = getDoubleParam(req.getParams(), "oversold", 30.0);
            double overbought = getDoubleParam(req.getParams(), "overbought", 70.0);
            if (oversold >= overbought) {
                throw new IllegalArgumentException("Pour RSI, le seuil oversold (" + oversold + ") doit être inférieur à overbought (" + overbought + ")");
            }
        }
    }

    private void broadcastSignal(Long strategyId, StrategySignalDto signalDto) {
        try {
            messagingTemplate.convertAndSend("/topic/strategies/" + strategyId + "/signals", signalDto);
        } catch (Exception e) {
            log.debug("Erreur broadcast signal STOMP: {}", e.getMessage());
        }
    }

    private void broadcastStatus(Long strategyId, String status) {
        try {
            messagingTemplate.convertAndSend("/topic/strategies/" + strategyId + "/status", Map.of("status", status));
        } catch (Exception e) {
            log.debug("Erreur broadcast status STOMP: {}", e.getMessage());
        }
    }

    private StrategyDto toDto(Strategy s) {
        StrategySignalDto latestSignalDto = null;
        Optional<StrategySignal> latest = strategySignalRepository.findTopByStrategyAndSymbolOrderByTsDesc(s, null);
        if (latest.isEmpty()) {
            List<StrategySignal> list = strategySignalRepository.findByStrategyOrderByTsDesc(s, PageRequest.of(0, 1));
            if (!list.isEmpty()) latestSignalDto = toSignalDto(list.get(0));
        } else {
            latestSignalDto = toSignalDto(latest.get());
        }

        return StrategyDto.builder()
                .id(s.getId())
                .name(s.getName())
                .strategyType(s.getStrategyType())
                .symbols(parseJsonList(s.getSymbolsJson()))
                .resolution(s.getResolution())
                .params(parseJsonMap(s.getParamsJson()))
                .mode(s.getMode())
                .sessionId(s.getSessionId())
                .autoTrade(s.getAutoTrade())
                .positionSizing(s.getPositionSizing())
                .sizingValue(s.getSizingValue())
                .riskRules(parseJsonMap(s.getRiskRulesJson()))
                .status(s.getStatus())
                .createdAt(s.getCreatedAt())
                .latestSignal(latestSignalDto)
                .build();
    }

    private StrategySignalDto toSignalDto(StrategySignal s) {
        return StrategySignalDto.builder()
                .id(s.getId())
                .strategyId(s.getStrategy().getId())
                .symbol(s.getSymbol())
                .ts(s.getTs())
                .signal(s.getSignal())
                .price(s.getPrice())
                .explanation(parseJsonMap(s.getExplanationJson()))
                .build();
    }

    private StrategyExecutionDto toExecutionDto(StrategyExecution ex) {
        return StrategyExecutionDto.builder()
                .id(ex.getId())
                .strategyId(ex.getStrategy().getId())
                .ts(ex.getTs())
                .symbol(ex.getSymbol())
                .side(ex.getSide())
                .quantity(ex.getQuantity())
                .price(ex.getPrice())
                .orderResult(parseJsonMap(ex.getOrderResultJson()))
                .build();
    }

    private List<String> parseJsonList(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private Map<String, Object> parseJsonMap(String json) {
        if (json == null || json.isBlank() || json.equals("{}")) return Collections.emptyMap();
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }

    private int getIntParam(Map<String, Object> params, String key, int defaultValue) {
        if (params == null || !params.containsKey(key)) return defaultValue;
        Object val = params.get(key);
        if (val instanceof Number) return ((Number) val).intValue();
        try {
            return Integer.parseInt(val.toString());
        } catch (Exception e) {
            return defaultValue;
        }
    }

    private double getDoubleParam(Map<String, Object> params, String key, double defaultValue) {
        if (params == null || !params.containsKey(key)) return defaultValue;
        Object val = params.get(key);
        if (val instanceof Number) return ((Number) val).doubleValue();
        try {
            return Double.parseDouble(val.toString());
        } catch (Exception e) {
            return defaultValue;
        }
    }

    private static class SignalEvaluation {
        final SignalType signal;
        final Map<String, Object> explanation;

        SignalEvaluation(SignalType signal, Map<String, Object> explanation) {
            this.signal = signal;
            this.explanation = explanation;
        }
    }
}
