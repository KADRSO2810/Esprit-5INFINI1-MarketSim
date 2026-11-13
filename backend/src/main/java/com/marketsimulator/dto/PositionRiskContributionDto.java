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
public class PositionRiskContributionDto {
    private String symbol;
    private BigDecimal quantity;
    private BigDecimal currentPrice;
    private BigDecimal marketValue;
    private BigDecimal weightPct;
    private BigDecimal assetVolatilityPct;
    private BigDecimal marginalRiskContribution;
    private BigDecimal componentRiskContribution;
    private BigDecimal riskContributionPct;
    private String sector;
}
