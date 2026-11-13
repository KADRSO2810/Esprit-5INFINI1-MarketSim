package com.marketsimulator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NewsSentimentDto {
    private String model;
    private String label;
    private BigDecimal score;
    private Map<String, Object> details;
    private Map<String, Object> xai;
}
