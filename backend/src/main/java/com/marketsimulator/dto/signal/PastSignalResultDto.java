package com.marketsimulator.dto.signal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PastSignalResultDto {
    private String id;
    private String symbol;
    private String assetName;
    private String side;
    private BigDecimal entryPrice;
    private BigDecimal exitPrice;
    private BigDecimal stopLoss;
    private BigDecimal takeProfit;
    private String result; // "TP1_HIT", "TP2_HIT", "TP3_HIT", "SL_HIT"
    private double profitPct;
    private String closedAt;
}
