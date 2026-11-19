package com.marketsimulator.service;

import com.marketsimulator.domain.*;
import com.marketsimulator.dto.MarketOrderRequest;
import com.marketsimulator.dto.MarketQuoteDto;
import com.marketsimulator.dto.OrderFillDto;
import com.marketsimulator.exception.InsufficientFundsException;
import com.marketsimulator.exception.InsufficientPositionException;
import com.marketsimulator.exception.NoRecentPriceException;
import com.marketsimulator.repository.PortfolioRepository;
import com.marketsimulator.repository.PositionRepository;
import com.marketsimulator.repository.TradeRepository;
import com.marketsimulator.service.market.MarketDataIngestionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final PortfolioRepository portfolioRepository;
    private final PositionRepository positionRepository;
    private final TradeRepository tradeRepository;
    private final MarketDataIngestionService ingestionService;
    private final PortfolioService portfolioService;
    @Lazy private final PreTradeRiskService preTradeRiskService;
    @Lazy private final PortfolioRiskAnalyticsService riskAnalyticsService;
    @Lazy private final com.marketsimulator.service.multiasset.MultiAssetMarketService multiAssetMarketService;

    @Value("${app.trading.max-quote-age-sec:30}")
    private long maxQuoteAgeSec;

    // ── Place a market order ─────────────────────────────────────────────────

    @Transactional
    public OrderFillDto placeMarketOrder(Long userId, MarketOrderRequest request) {
        return placeMarketOrder(userId, request, 0L);
    }

    @Transactional
    public OrderFillDto placeMarketOrder(Long userId, MarketOrderRequest request, Long sessionId) {
        long sId = (sessionId != null) ? sessionId : 0L;
        String symbol = request.getSymbol().trim().toUpperCase();
        String side = request.getSide().toUpperCase();
        BigDecimal quantity = request.getQuantity();

        // 1. Resolve execution price (must be recent real price)
        BigDecimal price = resolvePrice(symbol, side);

        // 2. Ensure portfolio exists and lock it
        portfolioService.ensurePortfolio(userId, sId);
        Portfolio portfolio = (sId == 0L ? portfolioRepository.findByUserIdWithLock(userId) : portfolioRepository.findByUserIdAndSessionIdWithLock(userId, sId))
                .orElseThrow(() -> new RuntimeException("Portfolio not found for user: " + userId));

        // 3. Validation autoritaire du risque pré-trade (Pre-Trade Risk Engine)
        if (preTradeRiskService != null) {
            preTradeRiskService.validateOrderOrThrow(userId, request, sId, price);
        }

        BigDecimal fee = BigDecimal.ZERO;  // no fee in this step
        BigDecimal realizedPnl = null;

        BigDecimal sl = request.getStopLoss();
        BigDecimal tp = request.getTakeProfit();

        if ("BUY".equals(side)) {
            // Validation des seuils SL et TP pour position LONG
            if (sl != null) {
                if (sl.compareTo(BigDecimal.ZERO) <= 0) {
                    throw new IllegalArgumentException("Le Stop-Loss doit être strictement supérieur à 0");
                }
                if (sl.compareTo(price) >= 0) {
                    throw new IllegalArgumentException(
                            String.format("Le Stop-Loss (%.4f) doit être strictement inférieur au cours d'exécution (%.4f)", sl, price));
                }
            }
            if (tp != null) {
                if (tp.compareTo(BigDecimal.ZERO) <= 0) {
                    throw new IllegalArgumentException("Le Take-Profit doit être strictement supérieur à 0");
                }
                if (tp.compareTo(price) <= 0) {
                    throw new IllegalArgumentException(
                            String.format("Le Take-Profit (%.4f) doit être strictement supérieur au cours d'exécution (%.4f)", tp, price));
                }
            }
            if (sl != null && tp != null && sl.compareTo(tp) >= 0) {
                throw new IllegalArgumentException("Le Stop-Loss doit être strictement inférieur au Take-Profit");
            }

            BigDecimal cost = price.multiply(quantity);
            if (portfolio.getCashBalance().compareTo(cost) < 0) {
                throw new InsufficientFundsException(
                        String.format("Insufficient cash: need %.2f, have %.2f", cost, portfolio.getCashBalance()));
            }
            portfolio.setCashBalance(portfolio.getCashBalance().subtract(cost));
            upsertPosition(portfolio, symbol, quantity, price, true, sl, tp);

        } else { // SELL
            Position position = positionRepository
                    .findByPortfolioIdAndSymbolWithLock(portfolio.getId(), symbol)
                    .orElseThrow(() -> new InsufficientPositionException(
                            "No open position for symbol: " + symbol));

            if (position.getQuantity().compareTo(quantity) < 0) {
                throw new InsufficientPositionException(
                        String.format("Insufficient position: have %.6f, selling %.6f",
                                position.getQuantity(), quantity));
            }

            // Realized PnL for SELL
            realizedPnl = price.subtract(position.getAvgPrice())
                    .multiply(quantity)
                    .subtract(fee)
                    .setScale(6, RoundingMode.HALF_UP);

            BigDecimal proceeds = price.multiply(quantity).subtract(fee);
            portfolio.setCashBalance(portfolio.getCashBalance().add(proceeds));
            upsertPosition(portfolio, symbol, quantity, price, false, null, null);
        }

        portfolioRepository.save(portfolio);

        // 3. Record Trade
        Trade trade = Trade.builder()
                .portfolio(portfolio)
                .symbol(symbol)
                .side(side)
                .quantity(quantity)
                .price(price.setScale(6, RoundingMode.HALF_UP))
                .fee(fee)
                .realizedPnl(realizedPnl)
                .tradeReason("MANUAL")
                .build();
        tradeRepository.save(trade);

        // Post-Trade Risk Monitoring & Audit
        if (riskAnalyticsService != null) {
            riskAnalyticsService.evaluatePostTradeRisk(portfolio, trade);
        }

        log.info("[TRADE] userId={} sessionId={} {} {} {} @ {}", userId, sId, side, quantity, symbol, price);

        return OrderFillDto.builder()
                .status("FILLED")
                .symbol(symbol)
                .side(side)
                .quantity(quantity)
                .price(price.setScale(6, RoundingMode.HALF_UP))
                .fee(fee)
                .realizedPnl(realizedPnl)
                .cashAfter(portfolio.getCashBalance().setScale(2, RoundingMode.HALF_UP))
                .stopLoss(sl)
                .takeProfit(tp)
                .tradeReason("MANUAL")
                .build();
    }

    private BigDecimal resolvePrice(String symbol, String side) {
        // 0. Pour les classes d'actifs alternatives (Matières Premières comme GLD, Forex, Obligations), résolution dédiée
        AssetClass assetClass = AssetClass.EQUITY;
        if (multiAssetMarketService != null) {
            try {
                assetClass = multiAssetMarketService.resolveAssetClass(symbol);
            } catch (Throwable ignored) {}
        }

        if (assetClass == AssetClass.COMMODITY || assetClass == AssetClass.FOREX || assetClass == AssetClass.BOND) {
            if (multiAssetMarketService != null) {
                try {
                    return multiAssetMarketService.resolveExecutionPrice(symbol, side);
                } catch (NoRecentPriceException e) {
                    throw e;
                } catch (Throwable ex) {
                    log.warn("[ORDER] Échec résolution multi-actif prioritaire pour {}: {}", symbol, ex.getMessage());
                }
            }
        }

        // 1. Cotation directe en temps réel (Actions US / Crypto)
        if (ingestionService != null) {
            MarketQuoteDto quote = null;
            try {
                quote = ingestionService.getLatestQuote(symbol);
            } catch (Throwable ex) {
                log.warn("[ORDER] Ingestion quote lookup warning pour {}: {}", symbol, ex.getMessage());
            }

            if (quote != null) {
                // Pour les cotations temps réel actives (WebSocket), vérifier la fraîcheur.
                // Les cours officiels de clôture pré-chargés depuis MariaDB (source DB_CLOSE) sont valides hors séance.
                if (quote.getTs() != null && !"DB_CLOSE".equalsIgnoreCase(quote.getSource())) {
                    long ageSeconds = Duration.between(quote.getTs(), Instant.now()).getSeconds();
                    if (ageSeconds > maxQuoteAgeSec) {
                        throw new NoRecentPriceException(
                                String.format("Price for %s is stale (%d s old, max %d s)", symbol, ageSeconds, maxQuoteAgeSec));
                    }
                }
                if (quote.getPrice() != null && quote.getPrice().compareTo(BigDecimal.ZERO) > 0) {
                    return quote.getPrice();
                }
            }
        }

        // 2. Résolution Multi-Actifs (Forex, Obligations, Matières Premières)
        if (multiAssetMarketService != null) {
            try {
                return multiAssetMarketService.resolveExecutionPrice(symbol, side);
            } catch (NoRecentPriceException e) {
                throw e;
            } catch (Throwable ex) {
                log.warn("[ORDER] Échec résolution multi-actif pour {}: {}", symbol, ex.getMessage());
            }
        }

        throw new NoRecentPriceException("No price available for symbol: " + symbol);
    }

    private void upsertPosition(Portfolio portfolio, String symbol, BigDecimal qty, BigDecimal price, boolean isBuy, BigDecimal sl, BigDecimal tp) {
        var posOpt = positionRepository.findByPortfolioIdAndSymbol(portfolio.getId(), symbol);

        if (isBuy) {
            if (posOpt.isPresent()) {
                Position pos = posOpt.get();
                // Weighted average price
                BigDecimal totalQty = pos.getQuantity().add(qty);
                BigDecimal newAvg = pos.getAvgPrice().multiply(pos.getQuantity())
                        .add(price.multiply(qty))
                        .divide(totalQty, 6, RoundingMode.HALF_UP);
                pos.setQuantity(totalQty);
                pos.setAvgPrice(newAvg);
                if (sl != null) {
                    pos.setStopLoss(sl);
                }
                if (tp != null) {
                    pos.setTakeProfit(tp);
                }
                positionRepository.save(pos);
            } else {
                Position pos = Position.builder()
                        .portfolio(portfolio)
                        .symbol(symbol)
                        .quantity(qty)
                        .avgPrice(price.setScale(6, RoundingMode.HALF_UP))
                        .stopLoss(sl)
                        .takeProfit(tp)
                        .build();
                positionRepository.save(pos);
            }
        } else {
            // SELL — position must exist (checked upstream)
            Position pos = posOpt.get();
            BigDecimal newQty = pos.getQuantity().subtract(qty);
            if (newQty.compareTo(BigDecimal.valueOf(0.000001)) < 0) {
                positionRepository.delete(pos);
            } else {
                pos.setQuantity(newQty);
                positionRepository.save(pos);
            }
        }
    }

    /**
     * Executes an automated position closure triggered by Stop-Loss or Take-Profit.
     */
    @Transactional
    public OrderFillDto executeSlTpOrder(Long userId, String symbol, BigDecimal quantity, BigDecimal executionPrice, String triggerType, Long sessionId) {
        long sId = (sessionId != null) ? sessionId : 0L;
        String normalizedSymbol = symbol.trim().toUpperCase();

        Portfolio portfolio = (sId == 0L ? portfolioRepository.findByUserIdWithLock(userId) : portfolioRepository.findByUserIdAndSessionIdWithLock(userId, sId))
                .orElseThrow(() -> new RuntimeException("Portfolio not found for user: " + userId));

        Position position = positionRepository
                .findByPortfolioIdAndSymbolWithLock(portfolio.getId(), normalizedSymbol)
                .orElseThrow(() -> new InsufficientPositionException("No open position to trigger for symbol: " + normalizedSymbol));

        BigDecimal executionQty = quantity.min(position.getQuantity());
        if (executionQty.compareTo(BigDecimal.ZERO) <= 0) {
            throw new InsufficientPositionException("Zero or negative position quantity for: " + normalizedSymbol);
        }

        BigDecimal fee = BigDecimal.ZERO;
        BigDecimal realizedPnl = executionPrice.subtract(position.getAvgPrice())
                .multiply(executionQty)
                .subtract(fee)
                .setScale(6, RoundingMode.HALF_UP);

        BigDecimal proceeds = executionPrice.multiply(executionQty).subtract(fee);
        portfolio.setCashBalance(portfolio.getCashBalance().add(proceeds));

        // Update / close position
        BigDecimal remainingQty = position.getQuantity().subtract(executionQty);
        if (remainingQty.compareTo(BigDecimal.valueOf(0.000001)) < 0) {
            positionRepository.delete(position);
        } else {
            position.setQuantity(remainingQty);
            positionRepository.save(position);
        }

        portfolioRepository.save(portfolio);

        // Record trade with exact trigger reason
        Trade trade = Trade.builder()
                .portfolio(portfolio)
                .symbol(normalizedSymbol)
                .side("SELL")
                .quantity(executionQty)
                .price(executionPrice.setScale(6, RoundingMode.HALF_UP))
                .fee(fee)
                .realizedPnl(realizedPnl)
                .tradeReason(triggerType)
                .build();
        tradeRepository.save(trade);

        log.info("[SL/TP TRIGGERED] userId={} {} executed for {} qty={} @ {} (PnL={})",
                userId, triggerType, normalizedSymbol, executionQty, executionPrice, realizedPnl);

        return OrderFillDto.builder()
                .status("FILLED")
                .symbol(normalizedSymbol)
                .side("SELL")
                .quantity(executionQty)
                .price(executionPrice.setScale(6, RoundingMode.HALF_UP))
                .fee(fee)
                .realizedPnl(realizedPnl)
                .cashAfter(portfolio.getCashBalance().setScale(2, RoundingMode.HALF_UP))
                .tradeReason(triggerType)
                .build();
    }
}
