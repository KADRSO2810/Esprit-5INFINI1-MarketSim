package com.marketsimulator.dto.signal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MarketHealthDto {
    private boolean nyseOpen;
    private String nyseStatusLabel;
    private String marketRegime; // TRENDING_BULLISH, TRENDING_BEARISH, RANGE_CHOPPY, HIGH_VOLATILITY_INSTABILITY
    private boolean isStableForTrading;
    private String goldStatus;
    private String advisoryMessage;
    private int activeSignalsCount;
    private double overallWinRate;
    private double averageRiskReward;
    private LocalDateTime evaluatedAt;
}
