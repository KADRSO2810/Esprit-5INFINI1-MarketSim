package com.marketsimulator.service;

import com.marketsimulator.domain.AssetClass;
import com.marketsimulator.domain.LimitOrder;
import com.marketsimulator.dto.MarketOrderRequest;
import com.marketsimulator.dto.orderbook.OrderBookDto;
import com.marketsimulator.dto.orderbook.OrderBookEntryDto;
import com.marketsimulator.repository.LimitOrderRepository;
import com.marketsimulator.service.market.MarketDataIngestionService;
import com.marketsimulator.service.multiasset.MultiAssetMarketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderBookService {

    private final LimitOrderRepository limitOrderRepository;
    private final MarketDataIngestionService ingestionService;
    @Lazy private final MultiAssetMarketService multiAssetMarketService;
    @Lazy private final OrderService orderService;

    /**
     * Génère un carnet d'ordres Level 2 (profondeur de marché) temps réel
     * centré sur le cours réel de l'actif, en intégrant les ordres limites en attente.
     */
    public OrderBookDto getOrderBook(String rawSymbol) {
        String symbol = rawSymbol.trim().toUpperCase();
        AssetClass assetClass = AssetClass.EQUITY;
        if (multiAssetMarketService != null) {
            try {
                assetClass = multiAssetMarketService.resolveAssetClass(symbol);
            } catch (Exception ignored) {}
        }

        BigDecimal lastPrice = resolveCurrentPrice(symbol, assetClass);
        int priceScale = getPriceScale(assetClass, symbol);
        BigDecimal tickSize = getTickSize(assetClass, lastPrice);
        BigDecimal spread = calculateRealisticSpread(assetClass, lastPrice, tickSize);

        BigDecimal bestBid = lastPrice.subtract(spread.divide(BigDecimal.valueOf(2), priceScale, RoundingMode.HALF_UP));
        BigDecimal bestAsk = lastPrice.add(spread.divide(BigDecimal.valueOf(2), priceScale, RoundingMode.HALF_UP));
        if (bestBid.compareTo(BigDecimal.ZERO) <= 0) {
            bestBid = lastPrice.multiply(BigDecimal.valueOf(0.999)).setScale(priceScale, RoundingMode.HALF_UP);
        }

        // Récupérer les ordres limites réels placés par les utilisateurs
        List<LimitOrder> pendingOrders = limitOrderRepository.findBySymbolAndStatus(symbol, "PENDING");
        Map<BigDecimal, BigDecimal> userBids = new HashMap<>();
        Map<BigDecimal, BigDecimal> userAsks = new HashMap<>();

        for (LimitOrder lo : pendingOrders) {
            BigDecimal roundedLimit = lo.getLimitPrice().setScale(priceScale, RoundingMode.HALF_UP);
            if ("BUY".equalsIgnoreCase(lo.getSide())) {
                userBids.merge(roundedLimit, lo.getQuantity(), BigDecimal::add);
            } else {
                userAsks.merge(roundedLimit, lo.getQuantity(), BigDecimal::add);
            }
        }

        // Générer 12 niveaux de profondeur ASKS (Vente - rouge, prix croissants)
        List<OrderBookEntryDto> asks = new ArrayList<>();
        BigDecimal askCumul = BigDecimal.ZERO;
        long timeSeed = Instant.now().getEpochSecond() / 3; // Mise à jour progressive du carnet
        Random rng = new Random(Objects.hash(symbol, timeSeed));

        BigDecimal currentAskPrice = bestAsk;
        for (int i = 0; i < 12; i++) {
            BigDecimal baseQty = generateDepthQuantity(assetClass, i, rng);
            BigDecimal userQty = userAsks.getOrDefault(currentAskPrice, BigDecimal.ZERO);
            BigDecimal totalLevelQty = baseQty.add(userQty);
            askCumul = askCumul.add(totalLevelQty);

            asks.add(OrderBookEntryDto.builder()
                    .price(currentAskPrice)
                    .quantity(totalLevelQty)
                    .total(askCumul)
                    .orderCount(1 + rng.nextInt(6) + (userQty.compareTo(BigDecimal.ZERO) > 0 ? 1 : 0))
                    .build());

            currentAskPrice = currentAskPrice.add(tickSize).setScale(priceScale, RoundingMode.HALF_UP);
        }

        // Générer 12 niveaux de profondeur BIDS (Achat - vert, prix décroissants)
        List<OrderBookEntryDto> bids = new ArrayList<>();
        BigDecimal bidCumul = BigDecimal.ZERO;
        BigDecimal currentBidPrice = bestBid;

        for (int i = 0; i < 12; i++) {
            BigDecimal baseQty = generateDepthQuantity(assetClass, i, rng);
            BigDecimal userQty = userBids.getOrDefault(currentBidPrice, BigDecimal.ZERO);
            BigDecimal totalLevelQty = baseQty.add(userQty);
            bidCumul = bidCumul.add(totalLevelQty);

            bids.add(OrderBookEntryDto.builder()
                    .price(currentBidPrice)
                    .quantity(totalLevelQty)
                    .total(bidCumul)
                    .orderCount(1 + rng.nextInt(6) + (userQty.compareTo(BigDecimal.ZERO) > 0 ? 1 : 0))
                    .build());

            currentBidPrice = currentBidPrice.subtract(tickSize).setScale(priceScale, RoundingMode.HALF_UP);
            if (currentBidPrice.compareTo(BigDecimal.ZERO) <= 0) break;
        }

        // Normaliser les pourcentages de profondeur visuelle (0 à 100%)
        BigDecimal maxAskCumul = askCumul.max(BigDecimal.ONE);
        for (OrderBookEntryDto ask : asks) {
            double pct = ask.getTotal().divide(maxAskCumul, 4, RoundingMode.HALF_UP).doubleValue() * 100.0;
            ask.setDepthPercentage(Math.min(100.0, Math.max(5.0, pct)));
        }

        BigDecimal maxBidCumul = bidCumul.max(BigDecimal.ONE);
        for (OrderBookEntryDto bid : bids) {
            double pct = bid.getTotal().divide(maxBidCumul, 4, RoundingMode.HALF_UP).doubleValue() * 100.0;
            bid.setDepthPercentage(Math.min(100.0, Math.max(5.0, pct)));
        }

        BigDecimal effectiveSpread = bestAsk.subtract(bestBid).max(BigDecimal.ZERO);
        BigDecimal spreadPct = BigDecimal.ZERO;
        if (lastPrice.compareTo(BigDecimal.ZERO) > 0) {
            spreadPct = effectiveSpread.divide(lastPrice, 6, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100));
        }

        return OrderBookDto.builder()
                .symbol(symbol)
                .lastPrice(lastPrice)
                .bestBid(bestBid)
                .bestAsk(bestAsk)
                .spread(effectiveSpread)
                .spreadPercentage(spreadPct)
                .bids(bids)
                .asks(asks)
                .totalBidVolume(bidCumul)
                .totalAskVolume(askCumul)
                .timestamp(Instant.now())
                .assetClass(assetClass.name())
                .build();
    }

    /**
     * Enregistre un ordre à cours limité (LIMIT) dans le carnet d'ordres
     */
    @Transactional
    public LimitOrder placeLimitOrder(Long userId, MarketOrderRequest request, Long sessionId) {
        long sId = (sessionId != null) ? sessionId : 0L;
        String symbol = request.getSymbol().trim().toUpperCase();
        BigDecimal limitPrice = request.getLimitPrice();
        if (limitPrice == null || limitPrice.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Le prix limite est obligatoire et doit être strictement positif.");
        }

        LimitOrder order = LimitOrder.builder()
                .userId(userId)
                .sessionId(sId)
                .symbol(symbol)
                .side(request.getSide().toUpperCase())
                .orderType("LIMIT")
                .quantity(request.getQuantity())
                .limitPrice(limitPrice)
                .stopLoss(request.getStopLoss())
                .takeProfit(request.getTakeProfit())
                .status("PENDING")
                .createdAt(Instant.now())
                .build();

        return limitOrderRepository.save(order);
    }

    public List<LimitOrder> getPendingOrders(Long userId, Long sessionId) {
        long sId = (sessionId != null) ? sessionId : 0L;
        return limitOrderRepository.findByUserIdAndSessionIdAndStatus(userId, sId, "PENDING");
    }

    @Transactional
    public boolean cancelLimitOrder(Long userId, Long orderId) {
        Optional<LimitOrder> opt = limitOrderRepository.findById(orderId);
        if (opt.isPresent()) {
            LimitOrder order = opt.get();
            if (order.getUserId().equals(userId) && "PENDING".equals(order.getStatus())) {
                order.setStatus("CANCELLED");
                limitOrderRepository.save(order);
                return true;
            }
        }
        return false;
    }

    private BigDecimal resolveCurrentPrice(String symbol, AssetClass assetClass) {
        if (multiAssetMarketService != null) {
            try {
                if (assetClass == AssetClass.FOREX || assetClass == AssetClass.BOND || assetClass == AssetClass.COMMODITY) {
                    return multiAssetMarketService.resolveExecutionPrice(symbol, "BUY");
                }
            } catch (Exception ignored) {}
        }

        var quote = ingestionService.getLatestQuote(symbol);
        if (quote != null && quote.getPrice() != null && quote.getPrice().compareTo(BigDecimal.ZERO) > 0) {
            return quote.getPrice();
        }

        // Essayer avec le symbole nettoyé (ex: BINANCE:BTCUSDT -> BTCUSDT)
        String clean = symbol.replace("BINANCE:", "").replace("COINBASE:", "").trim();
        var cleanQuote = ingestionService.getLatestQuote(clean);
        if (cleanQuote != null && cleanQuote.getPrice() != null && cleanQuote.getPrice().compareTo(BigDecimal.ZERO) > 0) {
            return cleanQuote.getPrice();
        }

        if (multiAssetMarketService != null) {
            try {
                return multiAssetMarketService.resolveExecutionPrice(symbol, "BUY");
            } catch (Exception ignored) {}
        }

        // Valeurs sentinelles réalistes par défaut
        if (clean.contains("BTC")) return new BigDecimal("89500.00");
        if (clean.contains("ETH")) return new BigDecimal("3150.00");
        if (clean.contains("SOL")) return new BigDecimal("215.00");
        if (clean.equals("AAPL")) return new BigDecimal("228.00");
        if (clean.equals("NVDA")) return new BigDecimal("142.00");
        if (clean.equals("TSLA")) return new BigDecimal("330.00");
        if (clean.equals("MSFT")) return new BigDecimal("425.00");
        if (clean.equals("GOOGL")) return new BigDecimal("175.00");
        if (clean.equals("AMZN")) return new BigDecimal("205.00");
        if (clean.equals("EUR/USD") || clean.equals("EURUSD")) return new BigDecimal("1.0850");
        if (clean.equals("GBP/USD") || clean.equals("GBPUSD")) return new BigDecimal("1.2950");
        if (clean.equals("USD/JPY") || clean.equals("USDJPY")) return new BigDecimal("154.20");
        if (clean.equals("GOLD") || clean.equals("XAU/USD") || clean.equals("XAUUSD")) return new BigDecimal("2650.00");
        if (clean.equals("OIL") || clean.equals("BRENT")) return new BigDecimal("74.50");
        if (clean.equals("US10Y") || clean.equals("OAT-10Y") || clean.equals("BUND-10Y")) return new BigDecimal("98.50");

        return new BigDecimal("150.00");
    }

    private int getPriceScale(AssetClass assetClass, String symbol) {
        if (assetClass == AssetClass.FOREX) {
            return symbol.contains("JPY") ? 3 : 5;
        }
        if (assetClass == AssetClass.CRYPTO) {
            return 2;
        }
        return 2;
    }

    private BigDecimal getTickSize(AssetClass assetClass, BigDecimal price) {
        if (assetClass == AssetClass.FOREX) {
            return price.compareTo(BigDecimal.valueOf(50)) > 0 ? new BigDecimal("0.01") : new BigDecimal("0.0001");
        }
        if (assetClass == AssetClass.CRYPTO) {
            return price.compareTo(BigDecimal.valueOf(1000)) > 0 ? new BigDecimal("2.50") : new BigDecimal("0.05");
        }
        if (assetClass == AssetClass.COMMODITY) {
            return price.compareTo(BigDecimal.valueOf(500)) > 0 ? new BigDecimal("0.25") : new BigDecimal("0.05");
        }
        return price.compareTo(BigDecimal.valueOf(200)) > 0 ? new BigDecimal("0.10") : new BigDecimal("0.05");
    }

    private BigDecimal calculateRealisticSpread(AssetClass assetClass, BigDecimal price, BigDecimal tickSize) {
        if (assetClass == AssetClass.FOREX) {
            return tickSize.multiply(BigDecimal.valueOf(1.5));
        }
        if (assetClass == AssetClass.CRYPTO) {
            return tickSize.multiply(BigDecimal.valueOf(2.0));
        }
        return tickSize;
    }

    private BigDecimal generateDepthQuantity(AssetClass assetClass, int depthIndex, Random rng) {
        // La profondeur augmente généralement avec la distance au cours actuel
        double factor = 1.0 + (depthIndex * 0.25);
        if (assetClass == AssetClass.FOREX) {
            int baseLots = 50000 + rng.nextInt(75000);
            return BigDecimal.valueOf((long) (baseLots * factor));
        }
        if (assetClass == AssetClass.CRYPTO) {
            double baseBtc = 0.5 + (rng.nextDouble() * 2.5);
            return BigDecimal.valueOf(baseBtc * factor).setScale(4, RoundingMode.HALF_UP);
        }
        int baseShares = 100 + rng.nextInt(400);
        return BigDecimal.valueOf((long) (baseShares * factor));
    }
}
