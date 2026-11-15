package com.marketsimulator.controller;

import com.marketsimulator.dto.actuary.*;
import com.marketsimulator.service.actuary.ActuarialService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/actuary")
@RequiredArgsConstructor
@Tag(name = "Actuarial Engine", description = "Modélisation de produits d'assurance, tarification, marges de prime et provisionnement des sinistres")
public class ActuarialController {

    private final ActuarialService actuarialService;

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

    public record InsuranceProductDto(
            String type,
            String label,
            String description,
            double baseFrequency,
            double baseSeverity
    ) {}
}
