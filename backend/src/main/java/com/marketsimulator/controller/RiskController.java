package com.marketsimulator.controller;

import com.marketsimulator.domain.PostTradeRiskEvaluation;
import com.marketsimulator.dto.*;
import com.marketsimulator.repository.PostTradeRiskEvaluationRepository;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.service.PortfolioRiskAnalyticsService;
import com.marketsimulator.service.PortfolioService;
import com.marketsimulator.service.PreTradeRiskService;
import com.marketsimulator.service.RiskAlertService;
import com.marketsimulator.service.RiskService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/risk")
@RequiredArgsConstructor
@Tag(name = "Risk", description = "Portfolio risk metrics and Pre-Trade Risk Management System")
@SecurityRequirement(name = "bearerAuth")
public class RiskController {

    private final RiskService riskService;
    private final PreTradeRiskService preTradeRiskService;
    private final PortfolioRiskAnalyticsService portfolioRiskAnalyticsService;
    private final RiskAlertService riskAlertService;
    private final PortfolioService portfolioService;
    private final PostTradeRiskEvaluationRepository postTradeRiskRepository;
    private final UserRepository userRepository;

    @Operation(summary = "Get full institutional Portfolio Risk Analytics: VaR 95/99%, CVaR, Volatility, Drawdown, Beta, Risk Contribution, Correlation")
    @GetMapping("/portfolio-analytics")
    public ResponseEntity<PortfolioRiskAnalyticsDto> getPortfolioRiskAnalytics(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false, defaultValue = "0") Long sessionId) {
        Long userId = resolveUserId(userDetails);
        return ResponseEntity.ok(portfolioRiskAnalyticsService.computeAnalytics(userId, sessionId));
    }

    @Operation(summary = "Get active risk alerts for user")
    @GetMapping("/alerts")
    public ResponseEntity<List<RiskAlertDto>> getActiveRiskAlerts(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = resolveUserId(userDetails);
        return ResponseEntity.ok(riskAlertService.getActiveAlerts(userId));
    }

    @Operation(summary = "Acknowledge a risk alert")
    @PostMapping("/alerts/{alertId}/acknowledge")
    public ResponseEntity<RiskAlertDto> acknowledgeRiskAlert(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long alertId) {
        Long userId = resolveUserId(userDetails);
        return ResponseEntity.ok(riskAlertService.acknowledgeAlert(alertId, userId));
    }

    @Operation(summary = "Get recent post-trade risk evaluations and before/after impact audit")
    @GetMapping("/post-trade-evaluations")
    public ResponseEntity<List<PostTradeRiskEvaluationDto>> getPostTradeEvaluations(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false, defaultValue = "0") Long sessionId) {
        Long userId = resolveUserId(userDetails);
        var portfolio = portfolioService.ensurePortfolio(userId, sessionId);
        List<PostTradeRiskEvaluation> evaluations = postTradeRiskRepository.findByPortfolioIdOrderByCreatedAtDesc(
                portfolio.getId(), PageRequest.of(0, 20));

        List<PostTradeRiskEvaluationDto> dtos = evaluations.stream()
                .map(e -> PostTradeRiskEvaluationDto.builder()
                        .id(e.getId())
                        .tradeId(e.getTradeId())
                        .symbol(e.getSymbol())
                        .side(e.getSide())
                        .quantity(e.getQuantity())
                        .price(e.getPrice())
                        .equityBefore(e.getEquityBefore())
                        .equityAfter(e.getEquityAfter())
                        .exposurePctBefore(e.getExposurePctBefore())
                        .exposurePctAfter(e.getExposurePctAfter())
                        .deltaExposurePct(e.getDeltaExposurePct())
                        .var95Before(e.getVar95Before())
                        .var95After(e.getVar95After())
                        .deltaVar95(e.getDeltaVar95())
                        .concentrationHhiBefore(e.getConcentrationHhiBefore())
                        .concentrationHhiAfter(e.getConcentrationHhiAfter())
                        .warnings(Collections.emptyList())
                        .createdAt(e.getCreatedAt())
                        .build())
                .collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

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
