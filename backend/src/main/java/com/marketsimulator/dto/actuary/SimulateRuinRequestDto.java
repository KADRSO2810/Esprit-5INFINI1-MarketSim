package com.marketsimulator.dto.actuary;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SimulateRuinRequestDto {
    private BigDecimal initialCapital;
    private Double winRatePct;
    private Double rewardRiskRatio;
    private Double riskPerTradePct;
    private Double leverage;
    private Integer numTrades;
    private Integer numSimulations;
}
