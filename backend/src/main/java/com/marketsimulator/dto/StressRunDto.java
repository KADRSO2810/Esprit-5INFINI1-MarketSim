package com.marketsimulator.dto;

import com.marketsimulator.domain.StressRunStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StressRunDto {
    private Long id;
    private Long scenarioId;
    private String scenarioName;
    private Long modelId;
    private String modelName;
    private String targetKey;
    private StressRunStatus status;
    private String errorMessage;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private LocalDateTime createdAt;
}
