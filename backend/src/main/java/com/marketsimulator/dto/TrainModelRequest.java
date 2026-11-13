package com.marketsimulator.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrainModelRequest {

    @NotBlank(message = "Le nom du modèle est requis")
    private String name;

    @Builder.Default
    private String modelType = "RANDOM_FOREST";

    @NotBlank(message = "La variable cible (targetKey) est requise")
    private String targetKey;

    private List<String> featureKeys;
}
