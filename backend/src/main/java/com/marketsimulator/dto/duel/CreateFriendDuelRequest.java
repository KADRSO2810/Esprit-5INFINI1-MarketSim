package com.marketsimulator.dto.duel;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateFriendDuelRequest {

    @NotBlank(message = "L'adresse email de votre ami est obligatoire")
    @Email(message = "Format d'adresse email invalide")
    private String friendEmail;

    @NotBlank(message = "L'identifiant du scénario est obligatoire")
    private String scenarioId;
}
