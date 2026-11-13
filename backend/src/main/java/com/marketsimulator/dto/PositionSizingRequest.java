package com.marketsimulator.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
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
public class PositionSizingRequest {

    @NotBlank(message = "Le symbole est requis")
    private String symbol;

    @DecimalMin(value = "0.01", message = "Le pourcentage de risque doit être positif")
    private BigDecimal riskPercentage; // e.g. 2.0%

    @DecimalMin(value = "0.000001", message = "Le prix d'entrée doit être strictement positif")
    private BigDecimal entryPrice; // optional; defaults to live price

    @NotNull(message = "Le Stop-Loss est requis pour le calcul du dimensionnement basé sur le risque")
    @DecimalMin(value = "0.000001", message = "Le Stop-Loss doit être strictement positif")
    private BigDecimal stopLoss;

    private Long sessionId;
}
