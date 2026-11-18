package com.marketsimulator.dto.arena;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ArenaRunRequest {

    @NotBlank(message = "L'identifiant du Boss est requis")
    private String bossId;

    @NotNull(message = "L'equity initiale est requise")
    private Double initialEquity;

    @NotNull(message = "L'equity finale est requise")
    private Double finalEquity;

    @NotNull(message = "Le drawdown maximal est requis")
    private Double maxDrawdownPct;

    @NotNull(message = "La durée de survie est requise")
    private Integer survivalSeconds;

    @NotNull(message = "Le statut de survie est requis")
    private Boolean survived;

    private Integer actionsTaken;

    private Integer hedgesCount;
}
