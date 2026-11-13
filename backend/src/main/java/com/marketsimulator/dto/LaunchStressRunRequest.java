package com.marketsimulator.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LaunchStressRunRequest {

    @NotNull(message = "L'ID du scénario est obligatoire")
    private Long scenarioId;

    @NotNull(message = "L'ID du modèle est obligatoire")
    private Long modelId;
}
