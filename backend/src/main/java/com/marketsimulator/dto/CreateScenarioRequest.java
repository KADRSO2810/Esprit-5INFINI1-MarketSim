package com.marketsimulator.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateScenarioRequest {

    @NotBlank(message = "Le nom du scénario est requis")
    private String name;

    private String description;

    @NotEmpty(message = "Au moins un choc doit être défini")
    private Map<String, Double> shocks;
}
