package com.marketsimulator.dto;

import com.marketsimulator.domain.PositionSizingType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateStrategyRequest {
    private String name;
    private List<String> symbols;
    private String resolution;
    private Map<String, Object> params;
    private Boolean autoTrade;
    private PositionSizingType positionSizing;
    private BigDecimal sizingValue;
    private Map<String, Object> riskRules;
}
