package com.marketsimulator.controller;

import com.marketsimulator.dto.signal.ExpertSignalDto;
import com.marketsimulator.dto.signal.MarketHealthDto;
import com.marketsimulator.dto.signal.ScanSignalsRequest;
import com.marketsimulator.dto.signal.SignalTrackRecordDto;
import com.marketsimulator.service.signal.ExpertSignalService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/signals")
@RequiredArgsConstructor
@Tag(name = "Signaux Experts & Algorithmiques", description = "Génération de signaux d'élite (Or / GLD & Actions NYSE) avec analyse de liquidité et protection du capital")
@SecurityRequirement(name = "BearerAuth")
public class ExpertSignalController {

    private final ExpertSignalService signalService;

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
}
