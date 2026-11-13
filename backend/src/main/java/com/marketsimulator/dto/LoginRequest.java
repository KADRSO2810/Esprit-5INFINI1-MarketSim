package com.marketsimulator.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginRequest {

    @NotBlank(message = "L'adresse email est requise")
    @Email(message = "Le format de l'adresse email est invalide")
    private String email;

    @NotBlank(message = "Le mot de passe est requis")
    private String password;
}
