package com.marketsimulator.dto.actuary;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PolicyholderProfileDto {

    @NotNull(message = "Le type de produit est obligatoire")
    private InsuranceProductType productType;

    @Min(value = 18, message = "L'âge minimum est de 18 ans")
    @Max(value = 100, message = "L'âge maximum est de 100 ans")
    private int age;

    @Builder.Default
    private BigDecimal bonusMalus = new BigDecimal("1.00"); // 0.50 (bonus 50%) à 2.50 (malus max)

    @Builder.Default
    private BigDecimal coverageAmount = new BigDecimal("50000.00"); // Capital garanti

    @Builder.Default
    private BigDecimal deductible = new BigDecimal("400.00"); // Franchise

    @Builder.Default
    private String geographicalZone = "B"; // A (Urbain dense), B (Péri-urbain), C (Rural)

    @Min(value = 0)
    @Max(value = 10)
    @Builder.Default
    private int historyClaimsCount = 0; // Nombre de sinistres passés (3 dernières années)

    @Builder.Default
    private int portfolioSize = 5000; // Taille de la cohorte pour simulation de portefeuille

    @Builder.Default
    private BigDecimal safetyLoadingPct = new BigDecimal("15.0"); // Chargement de sécurité %

    @Builder.Default
    private BigDecimal expenseLoadingPct = new BigDecimal("20.0"); // Chargement de frais de gestion %

    @Builder.Default
    private BigDecimal targetProfitPct = new BigDecimal("8.0"); // Marge de profit cible %
}
