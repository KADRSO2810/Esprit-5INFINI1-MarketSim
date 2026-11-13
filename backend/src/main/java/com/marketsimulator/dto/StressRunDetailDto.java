package com.marketsimulator.dto;

import com.marketsimulator.domain.StressRunStatus;
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
public class StressRunDetailDto {
    private Long id;
    private Long scenarioId;
    private String scenarioName;
    private Map<String, Double> scenarioShocks;
    private Long modelId;
    private String modelName;
    private String targetKey;
    private StressRunStatus status;
    private String errorMessage;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private LocalDateTime createdAt;

    // Aggregations "WOW"
    private int totalBanksCount;
    private double avgBaseline;
    private double avgStressed;
    private double avgDelta;
    private double maxDelta;
    private String mostImpactedBankName;

    // Comparaison Conventionnelles vs Non-Conventionnelles
    private BankTypeComparisonDto conventionalStats;
    private BankTypeComparisonDto nonConventionalStats;

    // Top N impacted banks preview
    private List<StressResultDto> topImpactedBanks;

    // Global XAI importance preview
    private List<Map<String, Object>> globalFeatureImportance;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BankTypeComparisonDto {
        private String type;
        private int count;
        private double avgBaseline;
        private double avgStressed;
        private double avgDelta;
        private double maxDelta;
    }
}
