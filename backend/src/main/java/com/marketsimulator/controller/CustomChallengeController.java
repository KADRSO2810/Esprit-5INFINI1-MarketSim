package com.marketsimulator.controller;

import com.marketsimulator.domain.User;
import com.marketsimulator.dto.challenge.*;
import com.marketsimulator.exception.ResourceNotFoundException;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.service.challenge.CustomChallengeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/challenges")
@RequiredArgsConstructor
@Tag(name = "Custom Challenges & Tournois Admin", description = "Création de scénarios manuels d'Actif X (10/20/30 min) par l'Admin et jeu Solo / 1v1 par les traders")
@SecurityRequirement(name = "BearerAuth")
public class CustomChallengeController {

    private final CustomChallengeService challengeService;
    private final UserRepository userRepository;

    @Operation(summary = "Lister les challenges personnalisés actifs créés par l'Admin")
    @GetMapping("/active")
    public ResponseEntity<List<CustomChallengeDto>> getActiveChallenges() {
        return ResponseEntity.ok(challengeService.getActiveChallenges());
    }

    @Operation(summary = "Obtenir les détails complets et la trajectoire d'un challenge")
    @GetMapping("/{id}")
    public ResponseEntity<CustomChallengeDto> getChallengeById(@PathVariable Long id) {
        return ResponseEntity.ok(challengeService.getChallengeById(id));
    }

    @Operation(summary = "Créer un scénario manuel pour un Actif X (Réservé aux Administrateurs)")
    @PostMapping("/admin/create")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<CustomChallengeDto> createChallenge(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CreateCustomChallengeRequest request) {
        User admin = resolveUser(userDetails);
        return ResponseEntity.ok(challengeService.createChallenge(admin, request));
    }

    @Operation(summary = "Supprimer un challenge créé (Réservé aux Administrateurs)")
    @DeleteMapping("/admin/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteChallenge(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id) {
        User admin = resolveUser(userDetails);
        challengeService.deleteChallenge(id, admin);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Enregistrer le run d'un trader sur un challenge personnalisé")
    @PostMapping("/{id}/submit")
    public ResponseEntity<Void> submitRun(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @Valid @RequestBody SubmitChallengeRunRequest request) {
        User user = resolveUser(userDetails);
        request.setChallengeId(id);
        challengeService.submitRun(user, request);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Consulter le podium / classement d'un challenge spécifique")
    @GetMapping("/{id}/leaderboard")
    public ResponseEntity<List<ChallengeLeaderboardDto>> getLeaderboard(@PathVariable Long id) {
        return ResponseEntity.ok(challengeService.getLeaderboard(id));
    }

    private User resolveUser(UserDetails userDetails) {
        if (userDetails == null) {
            return userRepository.findAll().stream().findFirst()
                    .orElseThrow(() -> new ResourceNotFoundException("Aucun utilisateur disponible"));
        }
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable : " + userDetails.getUsername()));
    }
}
