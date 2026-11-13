package com.marketsimulator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PositionSizingResponse {

    private String symbol;
    private BigDecimal portfolioEquity;
    private BigDecimal riskPercentage;
    private BigDecimal riskBudget;
    private BigDecimal entryPrice;
    private BigDecimal stopLoss;
    private BigDecimal riskPerUnit;
    private BigDecimal maxQuantityByRisk;
    private BigDecimal maxQuantityByCash;
    private BigDecimal maxQuantityByAssetExposure;
    private BigDecimal suggestedQuantity;
    private String formulaExplanation;
}
