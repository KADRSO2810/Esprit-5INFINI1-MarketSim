package com.marketsimulator.dto.duel;

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
public class DuelLeaderboardDto {
    private int rank;
    private Long matchId;
    private String winnerName;
    private String loserName;
    private String scenarioTitle;
    private BigDecimal winnerPnl;
    private BigDecimal winnerRoi;
    private Integer winnerScore;
    private LocalDateTime completedAt;
}
