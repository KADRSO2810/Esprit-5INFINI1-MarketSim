package com.marketsimulator.dto;

import com.marketsimulator.domain.SignalType;
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
public class StrategySignalDto {
    private Long id;
    private Long strategyId;
    private Instant ts;
    private String symbol;
    private SignalType signal;
    private BigDecimal price;
    private Map<String, Object> explanation;
}
