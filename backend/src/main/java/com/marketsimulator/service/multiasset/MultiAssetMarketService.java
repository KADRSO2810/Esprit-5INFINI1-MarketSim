package com.marketsimulator.service.multiasset;

import com.marketsimulator.domain.AssetClass;
import com.marketsimulator.domain.MarketAsset;
import com.marketsimulator.domain.Portfolio;
import com.marketsimulator.domain.Position;
import com.marketsimulator.dto.MarketQuoteDto;
import com.marketsimulator.dto.multiasset.*;
import com.marketsimulator.repository.MarketAssetRepository;
import com.marketsimulator.repository.PortfolioRepository;
import com.marketsimulator.repository.PositionRepository;
import com.marketsimulator.service.market.MarketDataIngestionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
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
public class MultiAssetMarketService {

    private final MarketAssetRepository assetRepository;
    private final ForexMarketService forexService;
    private final BondMarketService bondService;
    private final CommodityMarketService commodityService;
    @Lazy private final MarketDataIngestionService ingestionService;
    private final PortfolioRepository portfolioRepository;
    private final PositionRepository positionRepository;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.marketsimulator.repository.MarketQuoteRepository quoteRepository;

    /**
     * Resolves the asset class for any symbol string.
     */
    public AssetClass resolveAssetClass(String symbol) {
        if (symbol == null || symbol.isBlank()) return AssetClass.EQUITY;
        String clean = symbol.trim().toUpperCase();

        var assetOpt = assetRepository.findBySymbol(clean);
        if (assetOpt.isPresent() && assetOpt.get().getAssetClass() != null) {
            return assetOpt.get().getAssetClass();
        }
        return AssetClass.fromSymbol(clean);
    }

    /**
     * Resolves execution price according to asset class and side (BUY=Ask, SELL=Bid).
     */
    public BigDecimal resolveExecutionPrice(String rawSymbol, String side) {
        String symbol = rawSymbol.trim().toUpperCase();
        AssetClass assetClass = resolveAssetClass(symbol);
        boolean isBuy = "BUY".equalsIgnoreCase(side);

        if (assetClass == AssetClass.FOREX) {
            ForexQuoteDto fx = forexService.getQuote(symbol);
            return isBuy ? fx.getAsk() : fx.getBid();
        } else if (assetClass == AssetClass.BOND) {
            BondInstrumentDto bond = bondService.getBondInstrument(symbol);
            return bond.getCleanPrice();
        } else if (assetClass == AssetClass.COMMODITY) {
            CommodityInstrumentDto cmd = commodityService.getCommodityInstrument(symbol);
            return isBuy ? cmd.getAsk() : cmd.getBid();
        } else {
            if (ingestionService != null) {
                MarketQuoteDto quote = ingestionService.getLatestQuote(symbol);
                if (quote == null && symbol.contains(":")) {
                    quote = ingestionService.getLatestQuote(symbol.substring(symbol.indexOf(':') + 1));
                }
                if (quote == null && !symbol.contains(":")) {
                    quote = ingestionService.getLatestQuote("BINANCE:" + symbol);
                }
                if (quote != null && quote.getPrice() != null && quote.getPrice().compareTo(BigDecimal.ZERO) > 0) {
                    return quote.getPrice();
                }
            }
            if (quoteRepository != null) {
                var lastDbQuote = quoteRepository.findFirstBySymbolOrderByTsDesc(symbol);
                if (lastDbQuote.isPresent() && lastDbQuote.get().getPrice() != null) {
                    return lastDbQuote.get().getPrice();
                }
            }
            return getRealisticReferencePrice(symbol);
        }
    }

    /**
     * Returns full catalog of instruments, optionally filtered by AssetClass.
     */
    public List<MarketInstrumentDto> getCatalog(AssetClass filterClass) {
        List<MarketAsset> assets = (filterClass != null)
                ? assetRepository.findByAssetClass(filterClass)
                : assetRepository.findAll();

        return assets.stream()
                .map(this::enrichAssetToInstrumentDto)
                .collect(Collectors.toList());
    }

    /**
     * Returns instrument details by symbol.
     */
    public MarketInstrumentDto getInstrumentDetails(String rawSymbol) {
        String symbol = rawSymbol.trim().toUpperCase();
        MarketAsset asset = assetRepository.findBySymbol(symbol)
                .orElseGet(() -> {
                    AssetClass cls = resolveAssetClass(symbol);
                    return MarketAsset.builder()
                            .symbol(symbol)
                            .name(symbol)
                            .assetClass(cls)
                            .quoteCurrency("USD")
                            .pricePrecision(2)
                            .minQuantity(BigDecimal.ONE)
                            .build();
                });

        return enrichAssetToInstrumentDto(asset);
    }

    private MarketInstrumentDto enrichAssetToInstrumentDto(MarketAsset asset) {
        String sym = asset.getSymbol();
        AssetClass cls = asset.getAssetClass() != null ? asset.getAssetClass() : AssetClass.fromSymbol(sym);

        MarketInstrumentDto.MarketInstrumentDtoBuilder builder = MarketInstrumentDto.builder()
                .symbol(sym)
                .displayName(asset.getName())
                .assetClass(cls)
                .quoteCurrency(asset.getQuoteCurrency() != null ? asset.getQuoteCurrency() : "USD")
                .pricePrecision(asset.getPricePrecision() != null ? asset.getPricePrecision() : 2)
                .minQuantity(asset.getMinQuantity() != null ? asset.getMinQuantity() : BigDecimal.ONE)
                .unit(asset.getUnit())
                .marketDataSource(asset.getDataSource() != null ? asset.getDataSource() : "Institutional Data Feed")
                .lastUpdated(Instant.now());

        if (cls == AssetClass.FOREX) {
            ForexQuoteDto fx = forexService.getQuote(sym);
            builder.baseCurrency(fx.getBaseCurrency())
                    .quoteCurrency(fx.getQuoteCurrency())
                    .currentPrice(fx.getMidPrice())
                    .bid(fx.getBid())
                    .ask(fx.getAsk())
                    .spread(fx.getSpreadPrice())
                    .spreadPips(fx.getSpreadPips())
                    .change24h(fx.getChange24h())
                    .change24hPct(fx.getChange24hPct())
                    .high24h(fx.getHigh24h())
                    .low24h(fx.getLow24h())
                    .tradingSession("24/5 Interbank Session")
                    .tradingStatus(fx.getSessionStatus())
                    .marketDataSource(fx.getMarketDataSource());
        } else if (cls == AssetClass.BOND) {
            BondInstrumentDto b = bondService.getBondInstrument(sym);
            builder.currentPrice(b.getCleanPrice())
                    .bid(b.getCleanPrice().subtract(new BigDecimal("0.05")))
                    .ask(b.getCleanPrice().add(new BigDecimal("0.05")))
                    .spread(new BigDecimal("0.10"))
                    .change24hPct(b.getChange24hPct())
                    .high24h(b.getHigh24h())
                    .low24h(b.getLow24h())
                    .tradingSession(b.getTradingSession())
                    .tradingStatus("OPEN")
                    .marketDataSource(b.getMarketDataSource());
        } else if (cls == AssetClass.COMMODITY) {
            CommodityInstrumentDto cmd = commodityService.getCommodityInstrument(sym);
            builder.currentPrice(cmd.getCurrentPrice())
                    .bid(cmd.getBid())
                    .ask(cmd.getAsk())
                    .spread(cmd.getSpreadPrice())
                    .change24hPct(cmd.getChange24hPct())
                    .high24h(cmd.getHigh24h())
                    .low24h(cmd.getLow24h())
                    .volume(cmd.getVolume())
                    .unit(cmd.getUnit())
                    .tradingSession(cmd.getTradingSession())
                    .tradingStatus("OPEN")
                    .marketDataSource(cmd.getMarketDataSource());
        } else {
            BigDecimal price = new BigDecimal("100.00");
            BigDecimal change = BigDecimal.ZERO;
            if (ingestionService != null) {
                MarketQuoteDto quote = ingestionService.getLatestQuote(sym);
                if (quote != null) {
                    price = quote.getPrice();
                }
            }
            builder.currentPrice(price)
                    .bid(price.subtract(new BigDecimal("0.02")))
                    .ask(price.add(new BigDecimal("0.02")))
                    .spread(new BigDecimal("0.04"))
                    .change24hPct(change)
                    .tradingSession(cls == AssetClass.CRYPTO ? "24/7 Continuous" : "US Regular (09:30 - 16:00 EST)")
                    .tradingStatus("OPEN")
                    .marketDataSource(cls == AssetClass.CRYPTO ? "Binance WebSocket" : "Finnhub Institutional");
        }

        return builder.build();
    }

    /**
     * Computes multi-asset portfolio breakdown across all 5 asset classes + cash.
     */
    @Transactional(readOnly = true)
    public AssetAllocationBreakdownDto calculateAssetAllocation(Long userId, Long sessionId) {
        long sId = (sessionId != null) ? sessionId : 0L;
        Portfolio portfolio = (sId == 0L ? portfolioRepository.findByUserId(userId) : portfolioRepository.findByUserIdAndSessionId(userId, sId))
                .orElse(null);

        BigDecimal cash = (portfolio != null) ? portfolio.getCashBalance() : BigDecimal.ZERO;
        List<Position> positions = (portfolio != null)
                ? positionRepository.findByPortfolioId(portfolio.getId())
                : Collections.emptyList();

        Map<AssetClass, BigDecimal> valuesMap = new EnumMap<>(AssetClass.class);
        Map<AssetClass, Integer> countsMap = new EnumMap<>(AssetClass.class);

        for (AssetClass ac : AssetClass.values()) {
            valuesMap.put(ac, BigDecimal.ZERO);
            countsMap.put(ac, 0);
        }

        BigDecimal totalPositionsValue = BigDecimal.ZERO;

        for (Position pos : positions) {
            AssetClass ac = resolveAssetClass(pos.getSymbol());
            BigDecimal price = resolveExecutionPrice(pos.getSymbol(), "SELL");
            BigDecimal mv = price.multiply(pos.getQuantity());

            valuesMap.put(ac, valuesMap.get(ac).add(mv));
            countsMap.put(ac, countsMap.get(ac) + 1);
            totalPositionsValue = totalPositionsValue.add(mv);
        }

        BigDecimal totalPortfolioValue = cash.add(totalPositionsValue);
        if (totalPortfolioValue.compareTo(BigDecimal.ZERO) <= 0) {
            totalPortfolioValue = BigDecimal.ONE;
        }

        BigDecimal cashWeight = cash.divide(totalPortfolioValue, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"));

        Map<AssetClass, BigDecimal> weightsMap = new EnumMap<>(AssetClass.class);
        List<AssetAllocationBreakdownDto.AssetClassSliceDto> slices = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        Map<AssetClass, String> colorMap = Map.of(
                AssetClass.EQUITY, "#38BDF8",      // Cyan
                AssetClass.CRYPTO, "#F59E0B",      // Amber
                AssetClass.FOREX, "#10B981",       // Emerald
                AssetClass.BOND, "#6366F1",        // Indigo
                AssetClass.COMMODITY, "#EC4899"    // Rose / Pink
        );

        int activeClassesCount = 0;
        for (AssetClass ac : AssetClass.values()) {
            BigDecimal val = valuesMap.get(ac);
            BigDecimal wt = val.divide(totalPortfolioValue, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"));
            weightsMap.put(ac, wt);

            if (val.compareTo(BigDecimal.ZERO) > 0) {
                activeClassesCount++;
                if (wt.compareTo(new BigDecimal("50.00")) > 0) {
                    warnings.add(String.format("Forte concentration sur la classe %s (%.1f%% du portefeuille > limite prudentielle 50%%).",
                            ac.getFrenchLabel(), wt.doubleValue()));
                }
            }

            slices.add(AssetAllocationBreakdownDto.AssetClassSliceDto.builder()
                    .assetClass(ac)
                    .label(ac.getFrenchLabel())
                    .marketValue(val.setScale(2, RoundingMode.HALF_UP))
                    .weightPct(wt.setScale(2, RoundingMode.HALF_UP))
                    .positionsCount(countsMap.get(ac))
                    .colorCode(colorMap.getOrDefault(ac, "#94A3B8"))
                    .build());
        }

        boolean isDiversified = activeClassesCount >= 2 && warnings.isEmpty();
        String commentary = isDiversified
                ? String.format("Excellente diversification multi-actifs (%d classes d'actifs actives). Allocation équilibrée.", activeClassesCount)
                : (activeClassesCount <= 1
                ? "Portefeuille mono-classe d'actif ou faiblement diversifié. Envisagez d'incorporer des obligations ou des matières premières pour réduire la volatilité."
                : "Attention : certaines classes d'actifs dépassent les seuils de tolérance au risque recommandés.");

        return AssetAllocationBreakdownDto.builder()
                .totalPortfolioValue(totalPortfolioValue.setScale(2, RoundingMode.HALF_UP))
                .cashBalance(cash.setScale(2, RoundingMode.HALF_UP))
                .cashWeightPct(cashWeight.setScale(2, RoundingMode.HALF_UP))
                .valuesByAssetClass(valuesMap)
                .weightsByAssetClass(weightsMap)
                .slices(slices)
                .isDiversified(isDiversified)
                .riskCommentary(commentary)
                .concentrationAlerts(warnings)
                .calculatedAt(Instant.now())
                .build();
    }

    public static BigDecimal getRealisticReferencePrice(String rawSymbol) {
        if (rawSymbol == null || rawSymbol.isBlank()) return new BigDecimal("100.00");
        String clean = rawSymbol.trim().toUpperCase().replace("BINANCE:", "").replace("COINBASE:", "");
        if (clean.contains("BTC")) return new BigDecimal("60680.00");
        if (clean.contains("ETH")) return new BigDecimal("3150.00");
        if (clean.contains("SOL")) return new BigDecimal("110.90");
        if (clean.contains("BNB")) return new BigDecimal("590.00");
        if (clean.contains("AVAX")) return new BigDecimal("28.50");
        if (clean.contains("ADA")) return new BigDecimal("0.75");
        if (clean.contains("DOGE")) return new BigDecimal("0.38");
        if (clean.contains("XRP")) return new BigDecimal("1.10");
        if (clean.contains("LINK")) return new BigDecimal("14.50");
        if (clean.contains("DOT")) return new BigDecimal("8.50");
        if (clean.equals("AAPL")) return new BigDecimal("228.00");
        if (clean.equals("NVDA")) return new BigDecimal("136.20");
        if (clean.equals("TSLA")) return new BigDecimal("242.50");
        if (clean.equals("MSFT")) return new BigDecimal("425.00");
        if (clean.equals("GOOGL")) return new BigDecimal("175.00");
        if (clean.equals("AMZN")) return new BigDecimal("205.00");
        if (clean.equals("META")) return new BigDecimal("565.00");
        if (clean.equals("NFLX")) return new BigDecimal("850.00");
        if (clean.equals("AMD")) return new BigDecimal("142.00");
        if (clean.equals("INTC")) return new BigDecimal("24.50");
        if (clean.equals("JPM")) return new BigDecimal("240.00");
        if (clean.equals("BABA")) return new BigDecimal("85.00");
        if (clean.equals("DIS")) return new BigDecimal("115.00");
        if (clean.equals("GLD")) return new BigDecimal("322.80");
        if (clean.equals("USO")) return new BigDecimal("74.50");
        if (clean.equals("SLV")) return new BigDecimal("31.20");
        return new BigDecimal("100.00");
    }
}
