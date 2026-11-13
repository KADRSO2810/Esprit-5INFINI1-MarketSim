package com.marketsimulator.controller;

import com.marketsimulator.dto.*;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.service.PreTradeRiskService;
import com.marketsimulator.service.RiskService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/risk")
@RequiredArgsConstructor
@Tag(name = "Risk", description = "Portfolio risk metrics and Pre-Trade Risk Management System")
@SecurityRequirement(name = "bearerAuth")
public class RiskController {

    private final RiskService riskService;
    private final PreTradeRiskService preTradeRiskService;
    private final UserRepository userRepository;

    @Operation(summary = "Get risk metrics: VaR95, max drawdown, symbol exposure")
    @GetMapping("/metrics")
    public ResponseEntity<RiskMetricsDto> getRiskMetrics(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = resolveUserId(userDetails);
        return ResponseEntity.ok(riskService.computeRiskMetrics(userId));
    }

    @Operation(summary = "Perform real-time pre-trade risk analysis and decision (APPROVED, WARNING, REJECTED)")
    @PostMapping("/pre-trade-assessment")
    public ResponseEntity<PreTradeRiskResponse> assessPreTradeRisk(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody PreTradeRiskRequest request) {
        Long userId = resolveUserId(userDetails);
        PreTradeRiskResponse response = preTradeRiskService.assessPreTradeRisk(userId, request);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Calculate optimal position size based on equity, risk budget and Stop-Loss distance")
    @PostMapping("/position-sizing")
    public ResponseEntity<PositionSizingResponse> calculatePositionSize(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody PositionSizingRequest request) {
        Long userId = resolveUserId(userDetails);
        PositionSizingResponse response = preTradeRiskService.calculatePositionSize(userId, request);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Get user's configured risk limits")
    @GetMapping("/limits")
    public ResponseEntity<RiskLimitsDto> getRiskLimits(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = resolveUserId(userDetails);
        return ResponseEntity.ok(preTradeRiskService.getRiskLimits(userId));
    }

    @Operation(summary = "Update user's configured risk limits")
    @PutMapping("/limits")
    public ResponseEntity<RiskLimitsDto> updateRiskLimits(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody RiskLimitsDto dto) {
        Long userId = resolveUserId(userDetails);
        return ResponseEntity.ok(preTradeRiskService.updateRiskLimits(userId, dto));
    }

    private Long resolveUserId(UserDetails userDetails) {
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé : " + userDetails.getUsername()))
                .getId();
    }
}
