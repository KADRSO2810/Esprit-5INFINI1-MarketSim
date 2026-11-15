package com.marketsimulator.service.actuary;

import com.marketsimulator.dto.actuary.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@Slf4j
@Service
public class ActuarialService {

    /**
     * Calcule la tarification actuarielle prédictive (Prime Pure, Prime Commerciale, Marges et Ratios).
     */
    public ActuarialPricingResultDto calculatePricing(PolicyholderProfileDto profile) {
        InsuranceProductType product = profile.getProductType();
        if (product == null) {
            product = InsuranceProductType.AUTO;
        }

        // 1. Modélisation de la fréquence annuelle des sinistres (GLM Multiplicatif)
        double lambda = calculateExpectedFrequency(product, profile);

        // 2. Modélisation de la sévérité moyenne d'un sinistre (avec franchise et plafond)
        double expectedSeverity = calculateExpectedSeverity(product, profile);

        // 3. Prime Pure = Fréquence attendue * Sévérité moyenne
        BigDecimal purePremium = BigDecimal.valueOf(lambda * expectedSeverity).setScale(2, RoundingMode.HALF_UP);

        // 4. Chargements actuariels
        BigDecimal safetyPct = profile.getSafetyLoadingPct() != null ? profile.getSafetyLoadingPct() : new BigDecimal("15.0");
        BigDecimal expensePct = profile.getExpenseLoadingPct() != null ? profile.getExpenseLoadingPct() : new BigDecimal("20.0");
        BigDecimal profitPct = profile.getTargetProfitPct() != null ? profile.getTargetProfitPct() : new BigDecimal("8.0");

        BigDecimal safetyLoadingAmount = purePremium.multiply(safetyPct).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);

        // Prime Commerciale = (Prime Pure + Chargement Sécurité) / (1 - % Frais - % Profit Cible)
        BigDecimal divisor = BigDecimal.ONE
                .subtract(expensePct.divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP))
                .subtract(profitPct.divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP));

        if (divisor.compareTo(new BigDecimal("0.10")) < 0) {
            divisor = new BigDecimal("0.60");
        }

        BigDecimal commercialPremium = purePremium.add(safetyLoadingAmount).divide(divisor, 2, RoundingMode.HALF_UP);
        BigDecimal monthlyPremium = commercialPremium.divide(new BigDecimal("12"), 2, RoundingMode.HALF_UP);

        BigDecimal expenseLoadingAmount = commercialPremium.multiply(expensePct).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        BigDecimal targetProfitAmount = commercialPremium.multiply(profitPct).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);

        // 5. Analyse de la marge de prime et des ratios techniques
        BigDecimal expectedAnnualClaimsCost = purePremium;
        BigDecimal premiumMargin = commercialPremium.subtract(expectedAnnualClaimsCost).subtract(expenseLoadingAmount);
        BigDecimal premiumMarginPct = commercialPremium.compareTo(BigDecimal.ZERO) > 0
                ? premiumMargin.divide(commercialPremium, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100")).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // Ratio S/P (Sinistres / Primes) et Ratio Combiné (S+Frais / Primes)
        BigDecimal lossRatio = commercialPremium.compareTo(BigDecimal.ZERO) > 0
                ? purePremium.divide(commercialPremium, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100")).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        BigDecimal combinedRatio = lossRatio.add(expensePct).setScale(2, RoundingMode.HALF_UP);

        boolean isProfitable = combinedRatio.compareTo(new BigDecimal("100.00")) < 0;
        String assessment = isProfitable
                ? String.format("Souscription rentable : Marge technique positive de %.1f%% (Ratio combiné %.1f%% < 100%%)",
                premiumMarginPct.doubleValue(), combinedRatio.doubleValue())
                : String.format("Alerte sous-tarification : Ratio combiné déficitaire de %.1f%% (> 100%%). Relever la franchise ou la prime.",
                combinedRatio.doubleValue());

        Map<String, Object> riskCoeffs = new LinkedHashMap<>();
        riskCoeffs.put("lambdaBase", product.getBaseFrequency());
        riskCoeffs.put("lambdaAjuste", Math.round(lambda * 10000.0) / 100.0 + "%");
        riskCoeffs.put("coutMoyenBrut", product.getBaseSeverity() + " €");
        riskCoeffs.put("coutMoyenNetFranchise", Math.round(expectedSeverity * 100.0) / 100.0 + " €");
        riskCoeffs.put("impactFranchiseReduction", Math.round((product.getBaseSeverity() - expectedSeverity) * 100.0) / 100.0 + " €");

        return ActuarialPricingResultDto.builder()
                .productType(product)
                .productLabel(product.getLabel())
                .purePremium(purePremium)
                .safetyLoadingAmount(safetyLoadingAmount)
                .expenseLoadingAmount(expenseLoadingAmount)
                .targetProfitAmount(targetProfitAmount)
                .commercialPremium(commercialPremium)
                .monthlyPremium(monthlyPremium)
                .expectedClaimFrequency(BigDecimal.valueOf(lambda * 100.0).setScale(2, RoundingMode.HALF_UP))
                .expectedClaimSeverity(BigDecimal.valueOf(expectedSeverity).setScale(2, RoundingMode.HALF_UP))
                .expectedAnnualClaimsCost(expectedAnnualClaimsCost)
                .premiumMargin(premiumMargin)
                .premiumMarginPct(premiumMarginPct)
                .lossRatio(lossRatio)
                .combinedRatio(combinedRatio)
                .isProfitable(isProfitable)
                .underwritingAssessment(assessment)
                .riskCoefficients(riskCoeffs)
                .build();
    }

    /**
     * Simulation stochastique de portefeuille (Monte Carlo & Lois de Poisson / Log-Normale).
     */
    public ClaimSimulationResultDto simulatePortfolioClaims(PolicyholderProfileDto profile) {
        ActuarialPricingResultDto pricing = calculatePricing(profile);
        int n = Math.max(100, Math.min(profile.getPortfolioSize(), 50000));
        double lambda = pricing.getExpectedClaimFrequency().doubleValue() / 100.0;
        double meanSeverity = pricing.getExpectedClaimSeverity().doubleValue();
        double deductible = profile.getDeductible() != null ? profile.getDeductible().doubleValue() : 400.0;
        double maxCoverage = profile.getCoverageAmount() != null ? profile.getCoverageAmount().doubleValue() : 50000.0;

        Random random = new Random(42); // Seed stable pour reproductibilité institutionnelle
        int totalClaims = 0;
        double totalCost = 0.0;
        double maxClaim = 0.0;
        List<Double> claimAmounts = new ArrayList<>();

        // Paramètres Log-Normale pour sévérité (mu et sigma)
        double sigma = 0.85; // volatilité des montants de sinistres
        double mu = Math.log(meanSeverity) - (sigma * sigma / 2.0);

        for (int i = 0; i < n; i++) {
            // Survenance d'un sinistre (Loi de Bernoulli avec proba lambda)
            if (random.nextDouble() < lambda) {
                totalClaims++;
                // Tirage de sévérité Log-Normale
                double z = random.nextGaussian();
                double grossCost = Math.exp(mu + sigma * z);

                // Application de la franchise et du plafond
                double netCost = Math.max(0.0, grossCost - deductible);
                netCost = Math.min(netCost, maxCoverage);

                if (netCost > 0) {
                    claimAmounts.add(netCost);
                    totalCost += netCost;
                    if (netCost > maxClaim) maxClaim = netCost;
                }
            }
        }

        double empiricalFreq = (double) totalClaims / n;
        double avgSeverity = totalClaims > 0 ? totalCost / totalClaims : 0.0;

        BigDecimal totalPremiums = pricing.getCommercialPremium().multiply(BigDecimal.valueOf(n)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalExpenses = pricing.getExpenseLoadingAmount().multiply(BigDecimal.valueOf(n)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalClaimsCostBd = BigDecimal.valueOf(totalCost).setScale(2, RoundingMode.HALF_UP);

        BigDecimal netUnderwritingResult = totalPremiums.subtract(totalClaimsCostBd).subtract(totalExpenses);

        BigDecimal simulatedLossRatio = totalPremiums.compareTo(BigDecimal.ZERO) > 0
                ? totalClaimsCostBd.divide(totalPremiums, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100")).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        BigDecimal simulatedCombinedRatio = simulatedLossRatio.add(profile.getExpenseLoadingPct()).setScale(2, RoundingMode.HALF_UP);

        // VaR 99% sur la charge de sinistre (quantile 99%)
        Collections.sort(claimAmounts);
        double var99PerClaim = !claimAmounts.isEmpty()
                ? claimAmounts.get((int) Math.min(claimAmounts.size() - 1, Math.floor(claimAmounts.size() * 0.99)))
                : 0.0;
        BigDecimal varClaims99 = BigDecimal.valueOf(var99PerClaim * Math.sqrt(Math.max(1, totalClaims))).setScale(2, RoundingMode.HALF_UP);

        // Histogramme discrétisé (5 tranches)
        List<ClaimSimulationResultDto.ClaimBucketDto> buckets = buildDistributionBuckets(claimAmounts, maxClaim);

        boolean isSolvent = netUnderwritingResult.compareTo(BigDecimal.ZERO) > 0;
        String diag = isSolvent
                ? String.format("Portefeuille solvable : Bénéfice technique net de %s € (Ratio combiné simulé de %.1f%%)",
                netUnderwritingResult.setScale(0, RoundingMode.HALF_UP).toString(), simulatedCombinedRatio.doubleValue())
                : String.format("Alerte de solvabilité : Perte technique de %s € due à la volatilité des sinistres extrêmes.",
                netUnderwritingResult.setScale(0, RoundingMode.HALF_UP).toString());

        return ClaimSimulationResultDto.builder()
                .portfolioSize(n)
                .simulatedClaimsCount(totalClaims)
                .empiricalFrequency(BigDecimal.valueOf(empiricalFreq * 100.0).setScale(2, RoundingMode.HALF_UP))
                .totalClaimsCost(totalClaimsCostBd)
                .averageClaimSeverity(BigDecimal.valueOf(avgSeverity).setScale(2, RoundingMode.HALF_UP))
                .maxSingleClaim(BigDecimal.valueOf(maxClaim).setScale(2, RoundingMode.HALF_UP))
                .totalPremiumsCollected(totalPremiums)
                .totalExpenses(totalExpenses)
                .netUnderwritingResult(netUnderwritingResult)
                .simulatedLossRatio(simulatedLossRatio)
                .simulatedCombinedRatio(simulatedCombinedRatio)
                .varClaims99(varClaims99)
                .claimsDistribution(buckets)
                .isSolvent(isSolvent)
                .riskDiagnosis(diag)
                .build();
    }

    /**
     * Calcul des provisions pour sinistres et IBNR par la méthode actuarielle Chain-Ladder (Mack).
     */
    public ProvisioningResultDto calculateChainLadderProvisioning(String productTypeStr) {
        List<Integer> originYears = List.of(2021, 2022, 2023, 2024, 2025);
        List<Integer> devYears = List.of(0, 1, 2, 3, 4);

        // Triangle de règlements cumulés historique représentatif (k€)
        double[][] cumTriangle = {
                { 1250.0, 1820.0, 2150.0, 2340.0, 2450.0 }, // 2021 (complet)
                { 1340.0, 1960.0, 2310.0, 2520.0,    0.0 }, // 2022
                { 1420.0, 2080.0, 2460.0,    0.0,    0.0 }, // 2023
                { 1510.0, 2210.0,    0.0,    0.0,    0.0 }, // 2024
                { 1620.0,    0.0,    0.0,    0.0,    0.0 }  // 2025
        };

        int n = cumTriangle.length;

        // 1. Calcul des facteurs de développement (Link Ratios f_j)
        List<Double> factors = new ArrayList<>();
        for (int j = 0; j < n - 1; j++) {
            double sumColCurrent = 0.0;
            double sumColNext = 0.0;
            for (int i = 0; i < n - 1 - j; i++) {
                sumColCurrent += cumTriangle[i][j];
                sumColNext += cumTriangle[i][j + 1];
            }
            double factor = sumColCurrent > 0 ? sumColNext / sumColCurrent : 1.0;
            factors.add(Math.round(factor * 1000.0) / 1000.0);
        }

        // 2. Projection du triangle inférieur (Sinistres Ultimes)
        double[][] projected = new double[n][n];
        for (int i = 0; i < n; i++) {
            System.arraycopy(cumTriangle[i], 0, projected[i], 0, n);
            int knownDev = n - 1 - i;
            for (int j = knownDev + 1; j < n; j++) {
                double prevVal = projected[i][j - 1];
                double factor = factors.get(j - 1);
                projected[i][j] = Math.round(prevVal * factor * 10.0) / 10.0;
            }
        }

        // 3. Calcul des provisions IBNR par année
        Map<Integer, BigDecimal> ultimateByYear = new LinkedHashMap<>();
        Map<Integer, BigDecimal> paidByYear = new LinkedHashMap<>();
        Map<Integer, BigDecimal> ibnrByYear = new LinkedHashMap<>();

        double totalPaid = 0.0;
        double totalUltimate = 0.0;
        double totalIbnr = 0.0;

        for (int i = 0; i < n; i++) {
            int year = originYears.get(i);
            int latestKnownCol = n - 1 - i;
            double paid = cumTriangle[i][latestKnownCol];
            double ultimate = projected[i][n - 1];
            double ibnr = Math.max(0.0, ultimate - paid);

            ultimateByYear.put(year, BigDecimal.valueOf(ultimate * 1000.0).setScale(2, RoundingMode.HALF_UP));
            paidByYear.put(year, BigDecimal.valueOf(paid * 1000.0).setScale(2, RoundingMode.HALF_UP));
            ibnrByYear.put(year, BigDecimal.valueOf(ibnr * 1000.0).setScale(2, RoundingMode.HALF_UP));

            totalPaid += paid;
            totalUltimate += ultimate;
            totalIbnr += ibnr;
        }

        // Triangle incrémental
        double[][] incTriangle = new double[n][n];
        for (int i = 0; i < n; i++) {
            incTriangle[i][0] = projected[i][0];
            for (int j = 1; j < n; j++) {
                incTriangle[i][j] = Math.max(0.0, Math.round((projected[i][j] - projected[i][j - 1]) * 10.0) / 10.0);
            }
        }

        BigDecimal totalPaidBd = BigDecimal.valueOf(totalPaid * 1000.0).setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalUltBd = BigDecimal.valueOf(totalUltimate * 1000.0).setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalIbnrBd = BigDecimal.valueOf(totalIbnr * 1000.0).setScale(2, RoundingMode.HALF_UP);

        // Marge de solvabilité requise (SCR provisionnel = 15% des réserves IBNR)
        BigDecimal scr = totalIbnrBd.multiply(new BigDecimal("0.15")).setScale(2, RoundingMode.HALF_UP);

        String commentary = String.format("Méthode Chain-Ladder calibrée avec succès : Provisions IBNR globales de %s € recommandées pour couvrir les règlements tardifs (avec exigence de capital SCR Solvabilité II de %s €).",
                totalIbnrBd.setScale(0, RoundingMode.HALF_UP).toString(), scr.setScale(0, RoundingMode.HALF_UP).toString());

        return ProvisioningResultDto.builder()
                .methodName("Chain-Ladder Actuariel (Triangles de Liquidation & IBNR)")
                .originYears(originYears)
                .developmentYears(devYears)
                .cumulativeTriangle(projected)
                .incrementalTriangle(incTriangle)
                .developmentFactors(factors)
                .ultimateClaimsByYear(ultimateByYear)
                .paidClaimsByYear(paidByYear)
                .ibnrReservesByYear(ibnrByYear)
                .totalPaidToDate(totalPaidBd)
                .totalUltimateClaims(totalUltBd)
                .totalIbnrReserve(totalIbnrBd)
                .solvencyCapitalRequirement(scr)
                .commentary(commentary)
                .build();
    }

    private double calculateExpectedFrequency(InsuranceProductType product, PolicyholderProfileDto profile) {
        double base = product.getBaseFrequency();
        double factorAge = 1.0;
        int age = profile.getAge();

        switch (product) {
            case AUTO:
                if (age < 25) factorAge = 1.65;
                else if (age > 70) factorAge = 1.30;
                break;
            case HEALTH:
                if (age < 30) factorAge = 0.75;
                else if (age > 50 && age <= 65) factorAge = 1.45;
                else if (age > 65) factorAge = 1.95;
                break;
            case LIFE:
                factorAge = Math.exp(0.045 * (age - 40));
                break;
            case HOME:
                if (age < 28) factorAge = 1.20;
                break;
            case COMMERCIAL:
                factorAge = 1.0;
                break;
        }

        double factorZone = switch (profile.getGeographicalZone().toUpperCase()) {
            case "A" -> 1.25; // Urbain dense
            case "C" -> 0.85; // Rural
            default -> 1.00;  // Péri-urbain
        };

        double bm = profile.getBonusMalus() != null ? profile.getBonusMalus().doubleValue() : 1.0;
        double factorClaims = 1.0 + (profile.getHistoryClaimsCount() * 0.28);

        double freq = base * factorAge * factorZone * bm * factorClaims;
        return Math.max(0.005, Math.min(freq, 0.95));
    }

    private double calculateExpectedSeverity(InsuranceProductType product, PolicyholderProfileDto profile) {
        double baseSeverity = product.getBaseSeverity();
        double deductible = profile.getDeductible() != null ? profile.getDeductible().doubleValue() : 400.0;
        double coverage = profile.getCoverageAmount() != null ? profile.getCoverageAmount().doubleValue() : 50000.0;

        // Effet d'absorption de la franchise sur le coût moyen
        double deductibleAbsorption = Math.exp(-deductible / (baseSeverity * 0.75));
        double adjusted = baseSeverity * deductibleAbsorption;

        // Plafonnement au capital garanti
        return Math.min(adjusted, coverage * 0.60);
    }

    private List<ClaimSimulationResultDto.ClaimBucketDto> buildDistributionBuckets(List<Double> claims, double maxClaim) {
        List<ClaimSimulationResultDto.ClaimBucketDto> buckets = new ArrayList<>();
        if (claims.isEmpty() || maxClaim <= 0) {
            return buckets;
        }

        double step = maxClaim / 5.0;
        int total = claims.size();

        for (int i = 0; i < 5; i++) {
            double min = i * step;
            double max = (i + 1) * step;
            int count = 0;
            for (double c : claims) {
                if (c >= min && (i == 4 ? c <= max : c < max)) {
                    count++;
                }
            }
            double pct = total > 0 ? ((double) count / total) * 100.0 : 0.0;
            String label = String.format("%.0f € - %.0f €", min, max);

            buckets.add(ClaimSimulationResultDto.ClaimBucketDto.builder()
                    .rangeLabel(label)
                    .minAmount(min)
                    .maxAmount(max)
                    .count(count)
                    .percentage(Math.round(pct * 10.0) / 10.0)
                    .build());
        }

        return buckets;
    }
}
