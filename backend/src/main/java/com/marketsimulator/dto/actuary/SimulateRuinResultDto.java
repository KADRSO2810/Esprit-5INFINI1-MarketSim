package com.marketsimulator.dto.actuary;

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
public class SimulateRuinResultDto {
    private double empiricalRuinProbability;
    private double theoreticalLundbergBound;
    private double maxDrawdownAverage;
    private double maxDrawdownWorstCase;
    private BigDecimal medianFinalCapital;
    private double survivalRate100Trades;
    private List<RuinTrajectoryDto> sampleTrajectories;
    private Map<Integer, Double> survivalCurve;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RuinTrajectoryDto {
        private String name;
        private List<Double> equityPath;
        private boolean ruined;
        private double maxDrawdownPct;
    }
}
