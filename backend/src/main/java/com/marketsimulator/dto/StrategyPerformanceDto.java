package com.marketsimulator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StrategyPerformanceDto {
    private Long strategyId;
    private int totalSignals;
    private int buySignals;
    private int sellSignals;
    private int holdSignals;
    private int totalExecutions;
    private BigDecimal totalVolume;
    private BigDecimal winRatePct;
    private BigDecimal realizedPnl;
    private BigDecimal returnPct;
    private BigDecimal maxDrawdownPct;
}
