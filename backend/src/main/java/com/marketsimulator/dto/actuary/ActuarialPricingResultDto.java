package com.marketsimulator.dto.actuary;

import lombok.*;

import java.math.BigDecimal;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ActuarialPricingResultDto {

    private InsuranceProductType productType;
    private String productLabel;

    // Primes actuarielles
    private BigDecimal purePremium; // Prime pure = E[N] * E[X]
    private BigDecimal safetyLoadingAmount; // Chargement de sécurité ($)
    private BigDecimal expenseLoadingAmount; // Frais de gestion & acquisition ($)
    private BigDecimal targetProfitAmount; // Marge de profit cible ($)
    private BigDecimal commercialPremium; // Prime commerciale annuelle brute
    private BigDecimal monthlyPremium; // Mensualité commerciale

    // Indicateurs de risque sous-jacent
    private BigDecimal expectedClaimFrequency; // Probabilité annuelle de survenance (ex. 12.4%)
    private BigDecimal expectedClaimSeverity; // Coût moyen par sinistre (€)
    private BigDecimal expectedAnnualClaimsCost; // Coût global attendu des sinistres

    // Rentabilité & Marges de prime
    private BigDecimal premiumMargin; // Marge nette = Prime Commerciale - Sinistres Attendus - Frais
    private BigDecimal premiumMarginPct; // Taux de marge brute %
    private BigDecimal lossRatio; // Ratio S/P (Sinistres / Primes) %
    private BigDecimal combinedRatio; // Ratio Combiné = (Sinistres + Frais) / Primes %

    // Diagnostic actuariel
    private boolean isProfitable;
    private String underwritingAssessment;
    private Map<String, Object> riskCoefficients;
}
