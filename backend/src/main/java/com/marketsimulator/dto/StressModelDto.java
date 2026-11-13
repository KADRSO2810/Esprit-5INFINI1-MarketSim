package com.marketsimulator.dto;

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
public class StressModelDto {
    private Long id;
    private String modelUuid;
    private String name;
    private String modelType;
    private String targetKey;
    private List<String> featureKeys;
    private Map<String, Object> metrics;
    private LocalDateTime createdAt;
}
