package com.marketsimulator.dto.challenge;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChallengeLeaderboardDto {
    private int rank;
    private Long runId;
    private String traderName;
    private String mode;
    private BigDecimal finalEquity;
    private BigDecimal netPnl;
    private BigDecimal returnPct;
    private BigDecimal maxDrawdownPct;
    private int tradesCount;
    private int score;
    private LocalDateTime completedAt;
}
