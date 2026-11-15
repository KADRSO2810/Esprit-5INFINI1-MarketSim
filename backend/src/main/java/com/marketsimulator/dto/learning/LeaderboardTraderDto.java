package com.marketsimulator.dto.learning;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeaderboardTraderDto {
    private int rank;
    private Long userId;
    private String displayName;
    private String email;
    private BigDecimal totalPnl;
    private BigDecimal returnPercentage;
    private BigDecimal winRate;
    private int tradesCount;
    private int badgesCount;
    private String tier; // DIAMOND, PLATINUM, GOLD, SILVER
    private int scoreTotal;
}
