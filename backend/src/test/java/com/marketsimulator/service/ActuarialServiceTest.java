package com.marketsimulator.service;

import com.marketsimulator.dto.actuary.*;
import com.marketsimulator.service.actuary.ActuarialService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class ActuarialServiceTest {

    private ActuarialService actuarialService;

    @BeforeEach
    void setUp() {
        actuarialService = new ActuarialService();
    }

    @Test
    @DisplayName("Devrait calculer avec précision la tarification actuarielle et les marges de prime")
    void shouldCalculatePricingAndMarginsAccurately() {
        PolicyholderProfileDto profile = PolicyholderProfileDto.builder()
                .productType(InsuranceProductType.AUTO)
                .age(35)
                .bonusMalus(new BigDecimal("0.80"))
                .coverageAmount(new BigDecimal("50000.00"))
                .deductible(new BigDecimal("400.00"))
                .geographicalZone("B")
                .historyClaimsCount(0)
                .safetyLoadingPct(new BigDecimal("15.0"))
                .expenseLoadingPct(new BigDecimal("20.0"))
                .targetProfitPct(new BigDecimal("8.0"))
                .build();

        ActuarialPricingResultDto result = actuarialService.calculatePricing(profile);

        assertThat(result).isNotNull();
        assertThat(result.getProductType()).isEqualTo(InsuranceProductType.AUTO);
        assertThat(result.getPurePremium()).isPositive();
        assertThat(result.getCommercialPremium()).isGreaterThan(result.getPurePremium());
        assertThat(result.getMonthlyPremium()).isEqualByComparingTo(result.getCommercialPremium().divide(new BigDecimal("12"), 2, java.math.RoundingMode.HALF_UP));

        assertThat(result.getLossRatio()).isPositive();
        assertThat(result.getCombinedRatio()).isPositive();
        assertThat(result.getPremiumMargin()).isNotNull();
    }

    @Test
    @DisplayName("Devrait simuler un portefeuille stochastique de sinistres avec Monte Carlo")
    void shouldSimulatePortfolioClaimsWithMonteCarlo() {
        PolicyholderProfileDto profile = PolicyholderProfileDto.builder()
                .productType(InsuranceProductType.HEALTH)
                .age(42)
                .portfolioSize(2000)
                .coverageAmount(new BigDecimal("10000.00"))
                .deductible(new BigDecimal("50.00"))
                .geographicalZone("A")
                .build();

        ClaimSimulationResultDto simulation = actuarialService.simulatePortfolioClaims(profile);

        assertThat(simulation).isNotNull();
        assertThat(simulation.getPortfolioSize()).isEqualTo(2000);
        assertThat(simulation.getSimulatedClaimsCount()).isPositive();
        assertThat(simulation.getTotalClaimsCost()).isPositive();
        assertThat(simulation.getTotalPremiumsCollected()).isPositive();
        assertThat(simulation.getClaimsDistribution()).isNotEmpty();

        double totalPct = simulation.getClaimsDistribution().stream()
                .mapToDouble(ClaimSimulationResultDto.ClaimBucketDto::getPercentage)
                .sum();
        assertThat(totalPct).isBetween(99.0, 101.0);
    }

    @Test
    @DisplayName("Devrait calculer les provisions techniques IBNR par la méthode Chain-Ladder")
    void shouldCalculateChainLadderProvisioningAndIbnr() {
        ProvisioningResultDto provisioning = actuarialService.calculateChainLadderProvisioning("AUTO");

        assertThat(provisioning).isNotNull();
        assertThat(provisioning.getMethodName()).contains("Chain-Ladder");
        assertThat(provisioning.getOriginYears()).hasSize(5);
        assertThat(provisioning.getDevelopmentFactors()).hasSize(4);

        // Facteurs de passage Chain-Ladder strictement supérieurs à 1.0 (les paiements augmentent avec le temps)
        for (Double factor : provisioning.getDevelopmentFactors()) {
            assertThat(factor).isGreaterThan(1.0);
        }

        assertThat(provisioning.getTotalPaidToDate()).isPositive();
        assertThat(provisioning.getTotalUltimateClaims()).isGreaterThan(provisioning.getTotalPaidToDate());
        assertThat(provisioning.getTotalIbnrReserve()).isPositive();
        assertThat(provisioning.getSolvencyCapitalRequirement()).isPositive();
    }
}
