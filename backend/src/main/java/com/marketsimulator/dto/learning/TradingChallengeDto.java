package com.marketsimulator.dto.learning;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TradingChallengeDto {
    private String id;
    private String title;
    private String description;
    private String category;
    private String difficulty;
    private String rewardBadgeCode;
    private int rewardPoints;
    private int participantsCount;
    private int daysRemaining;
    private String status; // ACTIVE, UPCOMING, COMPLETED
    private String objective;
    private boolean joined;
}
