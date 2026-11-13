package com.marketsimulator.dto;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BacktestRequest {

    @NotBlank(message = "Le symbole ne peut pas être vide")
    private String symbol;

    @NotBlank(message = "La résolution est obligatoire")
    @Pattern(regexp = "^(1|5|15|60|D)$", message = "Résolution supportée : 1, 5, 15, 60, D")
    private String resolution;

    @NotNull(message = "fromEpochSec est obligatoire")
    private Long fromEpochSec;

    @NotNull(message = "toEpochSec est obligatoire")
    private Long toEpochSec;

    @Builder.Default
    private String strategy = "SMA_CROSS";

    @NotNull(message = "Les paramètres de stratégie sont obligatoires")
    private Map<String, Object> params;

    @NotNull(message = "initialCash est obligatoire")
    @DecimalMin(value = "10.0", message = "Le capital initial doit être d'au moins 10 $")
    private BigDecimal initialCash;
}
