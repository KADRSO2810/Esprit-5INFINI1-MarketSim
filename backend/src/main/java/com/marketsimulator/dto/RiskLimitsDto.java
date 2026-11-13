package com.marketsimulator.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RiskLimitsDto {

    @NotNull(message = "Le risque max par trade est requis")
    @DecimalMin(value = "0.10", message = "Le risque par trade doit être d'au moins 0.10%")
    @DecimalMax(value = "20.00", message = "Le risque par trade ne peut excéder 20.00%")
    private BigDecimal maxRiskPerTradePct;

    @NotNull(message = "L'exposition max par actif est requise")
    @DecimalMin(value = "1.00", message = "L'exposition max par actif doit être d'au moins 1.00%")
    @DecimalMax(value = "100.00", message = "L'exposition max par actif ne peut excéder 100.00%")
    private BigDecimal maxAssetExposurePct;

    @NotNull(message = "L'exposition max par secteur est requise")
    @DecimalMin(value = "1.00", message = "L'exposition max par secteur doit être d'au moins 1.00%")
    @DecimalMax(value = "100.00", message = "L'exposition max par secteur ne peut excéder 100.00%")
    private BigDecimal maxSectorExposurePct;

    @NotNull(message = "L'exposition totale max du portefeuille est requise")
    @DecimalMin(value = "10.00", message = "L'exposition totale doit être d'au moins 10.00%")
    @DecimalMax(value = "200.00", message = "L'exposition totale ne peut excéder 200.00%")
    private BigDecimal maxPortfolioExposurePct;
}
