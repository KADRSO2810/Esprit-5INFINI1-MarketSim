package com.marketsimulator.controller;

import com.marketsimulator.dto.BacktestEquityPointDto;
import com.marketsimulator.dto.BacktestRequest;
import com.marketsimulator.dto.BacktestRunResponse;
import com.marketsimulator.dto.BacktestTradeDto;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.service.BacktestService;
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
@RequestMapping("/api/backtests")
@RequiredArgsConstructor
@Tag(name = "Backtesting", description = "Lancement et analyse de simulations de trading sur données réelles")
@SecurityRequirement(name = "BearerAuth")
public class BacktestController {

    private final BacktestService backtestService;
    private final UserRepository userRepository;

    @Operation(summary = "Lancer un nouveau backtest sur un intervalle de bougies réelles")
    @PostMapping
    public ResponseEntity<BacktestRunResponse> launchBacktest(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody BacktestRequest request) {
        Long userId = resolveUserId(userDetails);
        BacktestRunResponse response = backtestService.createAndQueueRun(userId, request);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }

    @Operation(summary = "Lister les backtests exécutés par l'utilisateur connecté")
    @GetMapping
    public ResponseEntity<List<BacktestRunResponse>> listRuns(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = resolveUserId(userDetails);
        return ResponseEntity.ok(backtestService.listUserRuns(userId));
    }

    @Operation(summary = "Consulter le statut et les métriques d'un run spécifique")
    @GetMapping("/{runId}")
    public ResponseEntity<BacktestRunResponse> getRun(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long runId) {
        Long userId = resolveUserId(userDetails);
        return ResponseEntity.ok(backtestService.getRun(runId, userId));
    }

    @Operation(summary = "Obtenir la liste des trades exécutés pendant le backtest")
    @GetMapping("/{runId}/trades")
    public ResponseEntity<List<BacktestTradeDto>> getRunTrades(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long runId) {
        Long userId = resolveUserId(userDetails);
        return ResponseEntity.ok(backtestService.getRunTrades(runId, userId));
    }

    @Operation(summary = "Obtenir la courbe d'equity temporelle du backtest")
    @GetMapping("/{runId}/equity")
    public ResponseEntity<List<BacktestEquityPointDto>> getRunEquity(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long runId) {
        Long userId = resolveUserId(userDetails);
        return ResponseEntity.ok(backtestService.getRunEquity(runId, userId));
    }

    private Long resolveUserId(UserDetails userDetails) {
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé avec l'email: " + userDetails.getUsername()))
                .getId();
    }
}
