package com.marketsimulator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StrategyExecutionDto {
    private Long id;
    private Long strategyId;
    private Instant ts;
    private String symbol;
    private String side;
    private BigDecimal quantity;
    private BigDecimal price;
    private Map<String, Object> orderResult;
}
