package com.marketsimulator.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class PositionDto {
    private String symbol;
    private BigDecimal quantity;
    private BigDecimal avgPrice;
    private BigDecimal lastPrice;
    private BigDecimal marketValue;
    private BigDecimal unrealizedPnl;
    private BigDecimal unrealizedPnlPercent;
    private BigDecimal stopLoss;
    private BigDecimal takeProfit;
    private BigDecimal potentialLoss;
    private BigDecimal potentialProfit;
    private BigDecimal riskRewardRatio;
    private BigDecimal slDistancePercent;
    private BigDecimal tpDistancePercent;
    private String slTpStatus;
}
