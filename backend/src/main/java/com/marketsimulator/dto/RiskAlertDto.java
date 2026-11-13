package com.marketsimulator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RiskAlertDto {
    private Long id;
    private String alertType;
    private String severity; // INFO, WARNING, CRITICAL
    private String title;
    private String description;
    private String metricName;
    private BigDecimal metricValue;
    private BigDecimal thresholdValue;
    private List<String> affectedSymbols;
    private String suggestion;
    private boolean acknowledged;
    private Instant createdAt;
}
