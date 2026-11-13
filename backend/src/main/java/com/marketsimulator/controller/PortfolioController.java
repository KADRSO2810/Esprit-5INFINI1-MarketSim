package com.marketsimulator.controller;

import com.marketsimulator.dto.PortfolioSummaryDto;
import com.marketsimulator.dto.PositionDto;
import com.marketsimulator.dto.TradeDto;
import com.marketsimulator.dto.UpdateSlTpRequest;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.service.PortfolioService;
import com.marketsimulator.service.StopLossTakeProfitService;
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
@RequestMapping("/api/portfolio")
@RequiredArgsConstructor
@Tag(name = "Portfolio", description = "Paper trading portfolio management")
@SecurityRequirement(name = "bearerAuth")
public class PortfolioController {

    private final PortfolioService portfolioService;
    private final StopLossTakeProfitService slTpService;
    private final UserRepository userRepository;

    @Operation(summary = "Get portfolio summary (equity, cash, PnL)")
    @GetMapping("/summary")
    public ResponseEntity<PortfolioSummaryDto> getSummary(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = resolveUserId(userDetails);
        return ResponseEntity.ok(portfolioService.getSummary(userId));
    }

    @Operation(summary = "List open positions with live PnL")
    @GetMapping("/positions")
    public ResponseEntity<List<PositionDto>> getPositions(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = resolveUserId(userDetails);
        return ResponseEntity.ok(portfolioService.listPositions(userId));
    }

    @Operation(summary = "List trade history (most recent first)")
    @GetMapping("/trades")
    public ResponseEntity<List<TradeDto>> getTrades(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "50") int limit) {
        Long userId = resolveUserId(userDetails);
        return ResponseEntity.ok(portfolioService.listTrades(userId, limit));
    }

    @Operation(summary = "Configure or update Stop-Loss and Take-Profit for an open position")
    @PutMapping("/positions/{symbol}/sl-tp")
    public ResponseEntity<PositionDto> updateSlTp(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String symbol,
            @Valid @RequestBody UpdateSlTpRequest request,
            @RequestParam(defaultValue = "0") Long sessionId) {
        Long userId = resolveUserId(userDetails);
        PositionDto updated = slTpService.updateSlTp(userId, symbol, request.getStopLoss(), request.getTakeProfit(), sessionId);
        return ResponseEntity.ok(updated);
    }

    @Operation(summary = "Remove Stop-Loss and Take-Profit from an open position")
    @DeleteMapping("/positions/{symbol}/sl-tp")
    public ResponseEntity<PositionDto> removeSlTp(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String symbol,
            @RequestParam(defaultValue = "0") Long sessionId) {
        Long userId = resolveUserId(userDetails);
        PositionDto updated = slTpService.removeSlTp(userId, symbol, sessionId);
        return ResponseEntity.ok(updated);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private Long resolveUserId(UserDetails userDetails) {
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();
    }
}
