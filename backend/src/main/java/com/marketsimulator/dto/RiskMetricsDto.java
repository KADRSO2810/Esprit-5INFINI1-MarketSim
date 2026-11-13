package com.marketsimulator.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class RiskMetricsDto {

    private BigDecimal var95;           // null if insufficient data
    private BigDecimal maxDrawdown;     // null if insufficient snapshots
    private BigDecimal portfolioEquity;
    private int quoteWindowUsed;        // number of quotes used for VaR calc
    private int snapshotWindowUsed;     // number of snapshots used for drawdown
    private List<ExposureEntry> exposureBySymbol;
    private String message;             // optional info / warning

    @Data
    @Builder
    public static class ExposureEntry {
        private String symbol;
        private BigDecimal weight;       // fraction 0..1
        private BigDecimal marketValue;
    }
}
