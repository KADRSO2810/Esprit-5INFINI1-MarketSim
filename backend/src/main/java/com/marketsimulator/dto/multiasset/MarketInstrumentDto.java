package com.marketsimulator.dto.multiasset;

import com.marketsimulator.domain.AssetClass;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MarketInstrumentDto {
    private String symbol;
    private String displayName;
    private AssetClass assetClass;
    private String baseCurrency;
    private String quoteCurrency;
    private Integer pricePrecision;
    private BigDecimal minQuantity;
    private String unit;
    private String tradingStatus; // OPEN, CLOSED, PRE_MARKET, POST_MARKET, HALTED
    private String marketDataSource;
    private String tradingSession; // 24/5, 24/7, REGULAR_US

    private BigDecimal currentPrice;
    private BigDecimal bid;
    private BigDecimal ask;
    private BigDecimal spread;
    private BigDecimal spreadPips;

    private BigDecimal change24h;
    private BigDecimal change24hPct;
    private BigDecimal high24h;
    private BigDecimal low24h;
    private BigDecimal volume;

    private Map<String, Object> metadata;
    private Instant lastUpdated;
}
