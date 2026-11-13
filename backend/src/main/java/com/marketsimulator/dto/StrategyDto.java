package com.marketsimulator.dto;

import com.marketsimulator.domain.PositionSizingType;
import com.marketsimulator.domain.StrategyMode;
import com.marketsimulator.domain.StrategyStatus;
import com.marketsimulator.domain.StrategyType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StrategyDto {
    private Long id;
    private String name;
    private StrategyType strategyType;
    private List<String> symbols;
    private String resolution;
    private Map<String, Object> params;
    private StrategyMode mode;
    private Long sessionId;
    private Boolean autoTrade;
    private PositionSizingType positionSizing;
    private BigDecimal sizingValue;
    private Map<String, Object> riskRules;
    private StrategyStatus status;
    private LocalDateTime createdAt;
    private StrategySignalDto latestSignal;
}
