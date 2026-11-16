package com.marketsimulator.controller;

import com.marketsimulator.dto.PortfolioSummaryDto;
import com.marketsimulator.dto.actuary.*;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.service.PortfolioService;
import com.marketsimulator.service.actuary.ActuarialService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/actuary")
@RequiredArgsConstructor
@Tag(name = "Actuarial Engine", description = "Modélisation de produits d'assurance, tarification, marges de prime et provisionnement des sinistres")
public class ActuarialController {

    private final ActuarialService actuarialService;
    private final PortfolioService portfolioService;
    private final UserRepository userRepository;

    @Operation(summary = "Calcule la tarification actuarielle prédictive et les marges de prime")
    @PostMapping("/pricing")
    public ResponseEntity<ActuarialPricingResultDto> calculatePricing(
            @Valid @RequestBody PolicyholderProfileDto profile) {
        return ResponseEntity.ok(actuarialService.calculatePricing(profile));
    }

    @Operation(summary = "Simulation stochastique de portefeuille de sinistres (Monte Carlo / Poisson)")
    @PostMapping("/simulate-claims")
    public ResponseEntity<ClaimSimulationResultDto> simulateClaims(
            @Valid @RequestBody PolicyholderProfileDto profile) {
        return ResponseEntity.ok(actuarialService.simulatePortfolioClaims(profile));
    }

    @Operation(summary = "Calcul des provisions pour sinistres et IBNR par la méthode Chain-Ladder")
    @GetMapping("/provisioning")
    public ResponseEntity<ProvisioningResultDto> getProvisioning(
            @RequestParam(required = false, defaultValue = "AUTO") String productType) {
        return ResponseEntity.ok(actuarialService.calculateChainLadderProvisioning(productType));
    }

    @Operation(summary = "Liste des produits d'assurance disponibles avec hypothèses de base")
    @GetMapping("/products")
    public ResponseEntity<List<InsuranceProductDto>> getProducts() {
        List<InsuranceProductDto> list = Arrays.stream(InsuranceProductType.values())
                .map(p -> new InsuranceProductDto(
                        p.name(),
                        p.getLabel(),
                        p.getDescription(),
                        p.getBaseFrequency(),
                        p.getBaseSeverity()
                ))
                .collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    @Operation(summary = "Transfère l'excédent / bénéfice technique d'assurance vers le Cash de trading (ALM Transfer)")
    @PostMapping("/transfer-to-trading")
    public ResponseEntity<PortfolioSummaryDto> transferToTrading(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "0") Long sessionId,
            @RequestParam BigDecimal amount) {
        Long userId = getUserId(userDetails);
        PortfolioSummaryDto summary = portfolioService.injectCash(userId, sessionId, amount, "ALM_INSURANCE_SURPLUS");
        return ResponseEntity.ok(summary);
    }

    private Long getUserId(UserDetails userDetails) {
        if (userDetails == null) {
            return userRepository.findAll().stream().findFirst()
                    .orElseThrow(() -> new RuntimeException("No user found"))
                    .getId();
        }
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found: " + userDetails.getUsername()))
                .getId();
    }

    public record InsuranceProductDto(
            String type,
            String label,
            String description,
            double baseFrequency,
            double baseSeverity
    ) {}
}
