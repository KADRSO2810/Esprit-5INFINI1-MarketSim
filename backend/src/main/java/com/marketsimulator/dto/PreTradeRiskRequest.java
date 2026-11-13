package com.marketsimulator.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PreTradeRiskRequest {

    @NotBlank(message = "Le symbole de l'actif est requis")
    private String symbol;

    @NotNull(message = "Le sens de l'ordre (BUY ou SELL) est requis")
    @Pattern(regexp = "^(BUY|SELL)$", message = "Le sens doit être BUY ou SELL")
    private String side;

    @NotNull(message = "La quantité est requise")
    @DecimalMin(value = "0.000001", message = "La quantité doit être strictement positive")
    private BigDecimal quantity;

    @DecimalMin(value = "0.000001", message = "Le prix d'entrée doit être strictement positif")
    private BigDecimal price;

    @DecimalMin(value = "0.000001", message = "Le Stop-Loss doit être strictement positif")
    private BigDecimal stopLoss;

    @DecimalMin(value = "0.000001", message = "Le Take-Profit doit être strictement positif")
    private BigDecimal takeProfit;

    private Long sessionId;
}
