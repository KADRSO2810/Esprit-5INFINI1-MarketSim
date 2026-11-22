package com.marketsimulator.controller;

import com.marketsimulator.dto.signal.ExpertSignalDto;
import com.marketsimulator.dto.signal.MarketHealthDto;
import com.marketsimulator.dto.signal.ScanSignalsRequest;
import com.marketsimulator.dto.signal.SignalTrackRecordDto;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.service.signal.ExpertSignalService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/signals")
@RequiredArgsConstructor
@Tag(name = "Signaux Experts & Algorithmiques", description = "Génération de signaux d'élite (Or / GLD & Actions NYSE) avec analyse de liquidité et protection du capital")
@SecurityRequirement(name = "BearerAuth")
public class ExpertSignalController {

    private final ExpertSignalService signalService;
    private final UserRepository userRepository;

    @Operation(summary = "Évaluer la santé et la stabilité du marché (NYSE & Or)")
    @GetMapping("/health")
    public ResponseEntity<MarketHealthDto> getMarketHealth() {
        return ResponseEntity.ok(signalService.getMarketHealth());
    }

    @Operation(summary = "Obtenir les signaux experts actifs recommandés")
    @GetMapping("/active")
    public ResponseEntity<List<ExpertSignalDto>> getActiveSignals() {
        ScanSignalsRequest defaultReq = ScanSignalsRequest.builder()
                .assetFilter("ALL")
                .forceSimulatedScan(false)
                .minRiskReward(2.0)
                .build();
        return ResponseEntity.ok(signalService.scanSignals(defaultReq));
    }

    @Operation(summary = "Scanner les marchés en direct avec filtres (Or, NYSE, seuil R:R)")
    @PostMapping("/scan")
    public ResponseEntity<List<ExpertSignalDto>> scanSignals(@RequestBody(required = false) ScanSignalsRequest request) {
        if (request == null) {
            request = ScanSignalsRequest.builder()
                    .assetFilter("ALL")
                    .forceSimulatedScan(false)
                    .minRiskReward(2.0)
                    .build();
        }
        return ResponseEntity.ok(signalService.scanSignals(request));
    }

    @Operation(summary = "Consulter le track record transparent et historique des signaux")
    @GetMapping("/track-record")
    public ResponseEntity<SignalTrackRecordDto> getTrackRecord() {
        return ResponseEntity.ok(signalService.getTrackRecord());
    }

    @Operation(summary = "Clôturer manuellement une position au cours réel du marché")
    @PostMapping("/boost-tp/{symbol}")
    public ResponseEntity<Map<String, Object>> boostTakeProfit(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String symbol) {
        Long userId = resolveUserId(userDetails);
        return ResponseEntity.ok(signalService.boostTakeProfit(userId, symbol));
    }

    @Operation(summary = "Clôturer les anciennes positions au cours réel du marché")
    @PostMapping("/close-stale-positions")
    public ResponseEntity<Map<String, Object>> closeStalePositions(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = resolveUserId(userDetails);
        return ResponseEntity.ok(signalService.closeStalePositions(userId));
    }

    private Long resolveUserId(UserDetails userDetails) {
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"))
                .getId();
    }
}
