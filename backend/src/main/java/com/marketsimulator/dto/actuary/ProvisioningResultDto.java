package com.marketsimulator.dto.actuary;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProvisioningResultDto {

    private String methodName; // "Chain-Ladder (Mack's Method / Triangle de Liquidation)"
    private List<Integer> originYears; // Années de survenance (ex. 2021, 2022, 2023, 2024, 2025)
    private List<Integer> developmentYears; // Années de développement (0, 1, 2, 3, 4)

    // Triangles de liquidation
    private double[][] cumulativeTriangle; // Triangle des paiements cumulés
    private double[][] incrementalTriangle; // Triangle des paiements annuels incrémentaux
    private List<Double> developmentFactors; // Facteurs de passage f_j (Link Ratios)

    // Résultats des provisions par année de survenance
    private Map<Integer, BigDecimal> ultimateClaimsByYear; // Sinistres ultimes projetés
    private Map<Integer, BigDecimal> paidClaimsByYear; // Sinistres déjà réglés à ce jour
    private Map<Integer, BigDecimal> ibnrReservesByYear; // Provisions IBNR nécessaires (Ultimes - Payés)

    // Totaux consolidés
    private BigDecimal totalPaidToDate;
    private BigDecimal totalUltimateClaims;
    private BigDecimal totalIbnrReserve; // Provisions pour sinistres à payer (IBNR)
    private BigDecimal solvencyCapitalRequirement; // Marge de solvabilité requise (Solvabilité II)

    private String commentary;
}
