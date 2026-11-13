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
public class PortfolioRiskAnalyticsDto {

    // 1. Portfolio Equity & Exposures
    private BigDecimal portfolioEquity;
    private BigDecimal cashBalance;
    private BigDecimal investedValue;
    private BigDecimal totalExposurePct;
    private int positionsCount;

    // 2. Value at Risk (VaR)
    private BigDecimal var95Pct;
    private BigDecimal var95Amount;
    private BigDecimal var99Pct;
    private BigDecimal var99Amount;
    private String varMethodology;

    // 3. Conditional Value at Risk (CVaR / Expected Shortfall)
    private BigDecimal cvar95Pct;
    private BigDecimal cvar95Amount;
    private BigDecimal cvar99Pct;
    private BigDecimal cvar99Amount;
    private String cvarExplanation;

    // 4. Volatility
    private BigDecimal dailyVolatilityPct;
    private BigDecimal annualizedVolatilityPct;

    // 5. Drawdown
    private BigDecimal currentDrawdownPct;
    private BigDecimal maxHistoricalDrawdownPct;
    private BigDecimal peakEquity;

    // 6. Benchmark Beta
    private BigDecimal beta;
    private String benchmarkSymbol;
    private String benchmarkStatus; // ACTIVE, INSUFFICIENT_DATA, CASH_PORTFOLIO

    // 7. Diversification & Concentration Metrics
    private BigDecimal hhi; // Herfindahl-Hirschman Index
    private String hhiLevel; // DIVERSIFIED, MODERATE, HIGHLY_CONCENTRATED
    private BigDecimal diversificationRatio;
    private String largestRiskContributor;

    // 8. Breakdown Collections
    private List<PositionRiskContributionDto> positionsRisk;
    private List<SectorConcentrationDto> sectorConcentration;
    private CorrelationMatrixDto correlationMatrix;
    private List<RiskEvolutionPointDto> riskEvolution;
    private List<RiskAlertDto> activeAlerts;
    private PostTradeRiskEvaluationDto lastPostTradeImpact;

    // 9. Meta & Diagnostic Info
    private int observationWindow;
    private String observationStatus; // ROBUST, LIMITED_HISTORY, CASH_ONLY
    private String message;
    private Instant calculatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskEvolutionPointDto {
        private Instant ts;
        private BigDecimal equity;
        private BigDecimal drawdownPct;
        private BigDecimal dailyReturnPct;
    }
}
