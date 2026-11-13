package com.marketsimulator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StressScenarioDto {
    private Long id;
    private String name;
    private String description;
    private Map<String, Double> shocks;
    private String createdByEmail;
    private LocalDateTime createdAt;
}
