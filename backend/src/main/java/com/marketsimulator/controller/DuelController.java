package com.marketsimulator.controller;

import com.marketsimulator.domain.User;
import com.marketsimulator.dto.duel.*;
import com.marketsimulator.exception.ResourceNotFoundException;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.service.duel.DuelService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/duels")
@RequiredArgsConstructor
@Tag(name = "Duels 1v1 Blind Market Replay", description = "Duels de trading en temps réel : Trader Humain vs Agent Quant IA & Défis entre Amis")
@SecurityRequirement(name = "BearerAuth")
public class DuelController {

    private final DuelService duelService;
    private final UserRepository userRepository;

    @Operation(summary = "Lister les scénarios de marché à l'aveugle disponibles")
    @GetMapping("/scenarios")
    public ResponseEntity<List<DuelScenarioDto>> getScenarios() {
        return ResponseEntity.ok(duelService.getScenarios());
    }

    @Operation(summary = "Obtenir un scénario de marché spécifique")
    @GetMapping("/scenarios/{scenarioId}")
    public ResponseEntity<DuelScenarioDto> getScenario(@PathVariable String scenarioId) {
        return ResponseEntity.ok(duelService.getScenarioById(scenarioId));
    }

    @Operation(summary = "Créer un duel 1v1 contre un Agent Quant IA")
    @PostMapping("/ai")
    public ResponseEntity<DuelMatchDto> createAiDuel(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CreateAiDuelRequest request) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(duelService.createAiDuel(user, request));
    }

    @Operation(summary = "Défier un ami par email pour un duel 1v1")
    @PostMapping("/friend")
    public ResponseEntity<DuelMatchDto> createFriendDuel(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CreateFriendDuelRequest request) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(duelService.createFriendDuel(user, request));
    }

    @Operation(summary = "Soumettre le run de trading d'un duel")
    @PostMapping("/submit")
    public ResponseEntity<DuelMatchDto> submitDuelRun(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody SubmitDuelRunRequest request) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(duelService.submitDuelRun(user, request));
    }

    @Operation(summary = "Obtenir les détails d'un match par son ID")
    @GetMapping("/matches/{matchId}")
    public ResponseEntity<DuelMatchDto> getMatchById(@PathVariable Long matchId) {
        return ResponseEntity.ok(duelService.getDuelById(matchId));
    }

    @Operation(summary = "Rejoindre / consulter un duel via son jeton d'invitation")
    @GetMapping("/invite/{token}")
    public ResponseEntity<DuelMatchDto> getMatchByInviteToken(@PathVariable String token) {
        return ResponseEntity.ok(duelService.getDuelByInviteToken(token));
    }

    @Operation(summary = "Lister les duels actifs et terminés du joueur connecté")
    @GetMapping("/my-duels")
    public ResponseEntity<List<DuelMatchDto>> getMyDuels(@AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(duelService.getUserDuels(user));
    }

    @Operation(summary = "Consulter le Panthéon & Classement mondial des Duels 1v1")
    @GetMapping("/leaderboard")
    public ResponseEntity<List<DuelLeaderboardDto>> getLeaderboard() {
        return ResponseEntity.ok(duelService.getLeaderboard());
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
