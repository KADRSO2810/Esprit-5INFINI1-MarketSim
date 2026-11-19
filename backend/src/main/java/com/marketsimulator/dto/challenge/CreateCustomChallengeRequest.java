package com.marketsimulator.dto.challenge;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateCustomChallengeRequest {

    @NotBlank(message = "Le nom de l'actif est obligatoire")
    private String assetName;

    @NotBlank(message = "Le symbole ou ticker est obligatoire")
    private String assetSymbol;

    @NotBlank(message = "La catégorie est obligatoire")
    private String category;

    @NotBlank(message = "La description du défi est obligatoire")
    private String description;

    @Min(value = 5, message = "La durée minimale est de 5 minutes")
    private int durationMinutes;

    @NotNull(message = "Le prix initial est obligatoire")
    @DecimalMin(value = "0.01", message = "Le prix initial doit être supérieur à zéro")
    private BigDecimal initialPrice;

    private BigDecimal initialCapital;
    private Integer maxLeverage;

    private List<ChallengePhaseDto> phases;

    // Trajectoire personnalisée tracée directement par l'admin (Chandeliers japonais OHLCV)
    private List<com.marketsimulator.dto.duel.DuelPricePointDto> customTrajectory;
}
