package com.marketsimulator.controller;

import com.marketsimulator.dto.RiskMetricsDto;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.service.RiskService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/risk")
@RequiredArgsConstructor
@Tag(name = "Risk", description = "Portfolio risk metrics (VaR, drawdown, exposure)")
@SecurityRequirement(name = "bearerAuth")
public class RiskController {

    private final RiskService riskService;
    private final UserRepository userRepository;

    @Operation(summary = "Get risk metrics: VaR95, max drawdown, symbol exposure")
    @GetMapping("/metrics")
    public ResponseEntity<RiskMetricsDto> getRiskMetrics(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();
        return ResponseEntity.ok(riskService.computeRiskMetrics(userId));
    }
}
