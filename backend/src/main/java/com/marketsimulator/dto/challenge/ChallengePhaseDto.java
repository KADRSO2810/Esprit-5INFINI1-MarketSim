package com.marketsimulator.dto.challenge;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChallengePhaseDto {
    private int phaseOrder;
    private String name;
    private int startMinute;
    private int endMinute;
    private String trendType; // "BULLISH", "BEARISH", "VOLATILE_RANGE", "PARABOLIC_CRASH", "RECOVERY_SQUEEZE"
    private Double targetPriceChangePct; // ex: -30.0 pour -30%
    private String volatilityLevel; // "LOW", "MEDIUM", "HIGH", "EXTREME"
    private String breakingNewsHeadline;
    private String breakingNewsSeverity; // "INFO", "WARNING", "PANIC", "EUPHORIA"
}
