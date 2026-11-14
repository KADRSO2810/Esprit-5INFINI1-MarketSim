package com.marketsimulator.dto.multiasset;

import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ForexQuoteDto {
    private String symbol;
    private String displayName;
    private String baseCurrency;
    private String quoteCurrency;

    private BigDecimal bid;
    private BigDecimal ask;
    private BigDecimal midPrice;
    private BigDecimal spreadPrice;
    private BigDecimal spreadPips;
    private BigDecimal pipSize;
    private BigDecimal pipValueUsd;

    private BigDecimal change24h;
    private BigDecimal change24hPct;
    private BigDecimal high24h;
    private BigDecimal low24h;

    private String sessionStatus; // OPEN (24/5), CLOSED (Weekend)
    private String sessionDescription;
    private String marketDataSource;
    private Instant timestamp;

    /** Recent historical exchange rates for sparklines and mini-charts */
    private Map<String, BigDecimal> historicalRates;
}
