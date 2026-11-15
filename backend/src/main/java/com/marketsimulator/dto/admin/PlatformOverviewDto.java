package com.marketsimulator.dto.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlatformOverviewDto {
    private long totalUsers;
    private long totalPortfolios;
    private long totalTrades;
    private long totalStressRuns;
    private long totalQuizAttempts;
    private long totalAiModels;
    private Map<String, Boolean> serviceHealth;
    private List<UserSummaryDto> recentUsers;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserSummaryDto {
        private Long id;
        private String email;
        private String role;
        private LocalDateTime createdAt;
    }
}
