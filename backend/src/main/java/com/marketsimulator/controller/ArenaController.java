package com.marketsimulator.controller;

import com.marketsimulator.domain.User;
import com.marketsimulator.dto.arena.*;
import com.marketsimulator.exception.ResourceNotFoundException;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.service.arena.FlashCrashArenaService;
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
@RequestMapping("/api/arena")
@RequiredArgsConstructor
@Tag(name = "Flash Crash Arena", description = "Mode Survie & Boss Fight Macroéconomique en temps accéléré")
@SecurityRequirement(name = "BearerAuth")
public class ArenaController {

    private final FlashCrashArenaService arenaService;
    private final UserRepository userRepository;

    @Operation(summary = "Lister les Boss de crise macroéconomique disponibles")
    @GetMapping("/bosses")
    public ResponseEntity<List<ArenaBossDto>> getBosses() {
        return ResponseEntity.ok(arenaService.getBosses());
    }

    @Operation(summary = "Obtenir les détails, événements et trajectoire d'un Boss spécifique")
    @GetMapping("/bosses/{bossId}")
    public ResponseEntity<ArenaBossDto> getBossById(@PathVariable String bossId) {
        return arenaService.getBossById(bossId)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new ResourceNotFoundException("Boss de crise introuvable : " + bossId));
    }

    @Operation(summary = "Enregistrer le résultat d'un run et calculer la note officielle")
    @PostMapping("/runs")
    public ResponseEntity<ArenaRunResponse> recordRun(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ArenaRunRequest request) {
        User user = resolveUser(userDetails);
        ArenaRunResponse response = arenaService.recordArenaRun(user, request);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Consulter le classement et podium mondial de l'arène")
    @GetMapping("/leaderboard")
    public ResponseEntity<List<ArenaLeaderboardEntryDto>> getLeaderboard() {
        return ResponseEntity.ok(arenaService.getLeaderboard());
    }

    @Operation(summary = "Consulter l'historique des runs du joueur connecté")
    @GetMapping("/my-history")
    public ResponseEntity<List<ArenaRunResponse>> getMyHistory(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(arenaService.getUserHistory(user));
    }

    private User resolveUser(UserDetails userDetails) {
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouvé avec l'email: " + userDetails.getUsername()));
    }
}
