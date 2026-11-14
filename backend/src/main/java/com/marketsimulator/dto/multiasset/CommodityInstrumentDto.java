package com.marketsimulator.dto.multiasset;

import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommodityInstrumentDto {
    private String symbol;
    private String displayName;
    private String commodityGroup; // PRECIOUS_METALS, ENERGY, INDUSTRIAL_METALS, AGRICULTURE
    private String unit; // Troy Ounce, Barrel, MMBtu, Pound, Bushel
    private String contractType; // SPOT_PROXY, PHYSICAL_BACKED
    private String physicalBacking;

    private BigDecimal currentPrice;
    private BigDecimal bid;
    private BigDecimal ask;
    private BigDecimal spreadPrice;

    private BigDecimal change24hPct;
    private BigDecimal high24h;
    private BigDecimal low24h;
    private BigDecimal volume;

    private String tradingSession;
    private String marketDataSource;
    private Instant timestamp;
}
