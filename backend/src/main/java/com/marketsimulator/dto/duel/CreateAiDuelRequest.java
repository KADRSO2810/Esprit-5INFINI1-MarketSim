package com.marketsimulator.dto.duel;

import com.marketsimulator.domain.DuelBotProfile;
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
public class CreateAiDuelRequest {

    @NotBlank(message = "L'identifiant du scénario est obligatoire")
    private String scenarioId;

    @NotNull(message = "Le profil du Bot IA est obligatoire")
    private DuelBotProfile botProfile;
}
