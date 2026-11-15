package com.marketsimulator.dto.actuary;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClaimSimulationResultDto {

    private int portfolioSize; // Nombre d'assurés simulés
    private int simulatedClaimsCount; // Nombre total de sinistres observés
    private BigDecimal empiricalFrequency; // Fréquence empirique (sinistres / assurés)

    private BigDecimal totalClaimsCost; // Montant total des indemnités versées ($)
    private BigDecimal averageClaimSeverity; // Coût moyen par sinistre constaté ($)
    private BigDecimal maxSingleClaim; // Sinistre maximal observé (crête de sinistre)

    private BigDecimal totalPremiumsCollected; // Total des primes brutes collectées ($)
    private BigDecimal totalExpenses; // Frais généraux & acquisition ($)
    private BigDecimal netUnderwritingResult; // Résultat technique net = Primes - Sinistres - Frais ($)

    private BigDecimal simulatedLossRatio; // S/P observé (%)
    private BigDecimal simulatedCombinedRatio; // Ratio Combiné observé (%)
    private BigDecimal varClaims99; // Value-at-Risk 99% sur la charge de sinistres (Solvabilité II)

    private List<ClaimBucketDto> claimsDistribution; // Discrétisation pour histogramme
    private boolean isSolvent;
    private String riskDiagnosis;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ClaimBucketDto {
        private String rangeLabel;
        private double minAmount;
        private double maxAmount;
        private int count;
        private double percentage;
    }
}
