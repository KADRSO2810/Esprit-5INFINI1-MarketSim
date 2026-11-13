package com.marketsimulator.controller;

import com.marketsimulator.domain.User;
import com.marketsimulator.dto.*;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.service.StrategyEngineService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/api/strategies", "/strategies"})
@RequiredArgsConstructor
@Tag(name = "Strategy Lab & Auto-Trading", description = "Agent de Trading Automatique, Strategy Lab et Explainable AI")
@SecurityRequirement(name = "bearerAuth")
public class StrategyController {

    private final StrategyEngineService strategyEngineService;
    private final UserRepository userRepository;

    @Operation(summary = "Créer une nouvelle stratégie de trading (LIVE)")
    @PostMapping
    public ResponseEntity<StrategyDto> createStrategy(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CreateStrategyRequest request
    ) {
        User user = resolveUser(userDetails);
        StrategyDto created = strategyEngineService.createStrategy(user, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @Operation(summary = "Lister les stratégies de l'utilisateur connecté")
    @GetMapping
    public ResponseEntity<List<StrategyDto>> listStrategies(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(strategyEngineService.listUserStrategies(user));
    }

    @Operation(summary = "Obtenir les détails d'une stratégie")
    @GetMapping("/{id}")
    public ResponseEntity<StrategyDto> getStrategy(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id
    ) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(strategyEngineService.getStrategy(user, id));
    }

    @Operation(summary = "Modifier les paramètres, symboles ou règles d'une stratégie")
    @PutMapping("/{id}")
    public ResponseEntity<StrategyDto> updateStrategy(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @RequestBody UpdateStrategyRequest request
    ) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(strategyEngineService.updateStrategy(user, id, request));
    }

    @Operation(summary = "Supprimer une stratégie")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteStrategy(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id
    ) {
        User user = resolveUser(userDetails);
        strategyEngineService.deleteStrategy(user, id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Démarrer une stratégie (statut RUNNING)")
    @PostMapping("/{id}/start")
    public ResponseEntity<StrategyDto> startStrategy(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id
    ) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(strategyEngineService.startStrategy(user, id));
    }

    @Operation(summary = "Arrêter une stratégie (statut STOPPED)")
    @PostMapping("/{id}/stop")
    public ResponseEntity<StrategyDto> stopStrategy(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id
    ) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(strategyEngineService.stopStrategy(user, id));
    }

    @Operation(summary = "Obtenir l'historique des signaux émis par la stratégie avec explications XAI")
    @GetMapping("/{id}/signals")
    public ResponseEntity<List<StrategySignalDto>> getSignals(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @RequestParam(defaultValue = "100") int limit
    ) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(strategyEngineService.getSignals(user, id, limit));
    }

    @Operation(summary = "Obtenir les ordres auto-exécutés par la stratégie")
    @GetMapping("/{id}/executions")
    public ResponseEntity<List<StrategyExecutionDto>> getExecutions(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @RequestParam(defaultValue = "100") int limit
    ) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(strategyEngineService.getExecutions(user, id, limit));
    }

    @Operation(summary = "Obtenir les métriques de performance et statistiques de la stratégie")
    @GetMapping("/{id}/performance")
    public ResponseEntity<StrategyPerformanceDto> getPerformance(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id
    ) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(strategyEngineService.getPerformance(user, id));
    }

    private User resolveUser(UserDetails userDetails) {
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable: " + userDetails.getUsername()));
    }
}
