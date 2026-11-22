package com.marketsimulator.dto.actuary;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * DTO d'analyse actuarielle quantitative du risque de trading.
 * Répond directement à la problématique académique :
 * "En quoi le calcul actuariel et ses notions sont-ils cruciaux dans la gestion et le calcul du risque en trading ?"
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TradingActuarialAnalysisDto {

    // 1. Théorie de la Ruine de Cramér-Lundberg
    private BigDecimal currentCapital;
    private double winRatePct;
    private double rewardRiskRatio;
    private double riskPerTradePct;
    private double currentLeverage;
    private double lundbergRuinProbability;
    private double lundbergAdjustmentCoefficientR;
    private double optimalKellyFractionPct;
    private double actuarialSafePositionSizePct;
    private double maxSafeLeverage;

    // 2. Théorie des Valeurs Extrêmes (EVT) vs Finance Classique (Loi Normale)
    private double gaussianVaR95;
    private double gaussianVaR99;
    private double actuarialEvtVaR95;
    private double actuarialEvtVaR99;
    private double expectedShortfallCVaR99;
    private double riskUnderestimationFactor;
    private double tailIndexXi;
    private String evtDiagnosis;

    // 3. Modèles de Survie & Tables de Mortalité du Trading (Kaplan-Meier)
    private int halfLifeTrades;
    private Map<String, Integer> survivalDaysByLeverage;
    private double capitalSurvivalProbability100Trades;

    // 4. Capital Économique & Solvabilité II (SCR Trading)
    private BigDecimal recommendedSolvencyBuffer;
    private double solvencyRatioPct;
    private BigDecimal tenYearStressDrawdown;
    private boolean isSolventSolvency2;

    // 5. Synthèse Académique de Soutenance (Réponse directe au professeur)
    private String professorQuestionAnswer;
    private List<ActuarialComparisonRowDto> comparativeMatrix;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ActuarialComparisonRowDto {
        private String dimension;
        private String classicalFinance;
        private String actuarialApproach;
        private String concreteImpact;
    }
}
