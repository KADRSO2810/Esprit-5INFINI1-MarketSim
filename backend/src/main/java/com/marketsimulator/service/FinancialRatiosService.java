package com.marketsimulator.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.marketsimulator.dto.fundamental.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Moteur quantitatif de calcul et de normalisation des ratios financiers fondamentaux.
 * Gère de manière rigoureuse les dénominateurs nuls, les résultats déficitaires et les données absentes.
 */
@Slf4j
@Service
public class FinancialRatiosService {

    /**
     * Calcule ou extrait l'ensemble des ratios fondamentaux d'une entreprise.
     */
    public CompanyRatiosDto computeRatios(
            String symbol,
            CompanyProfileDto profile,
            IncomeStatementDto latestIncome,
            IncomeStatementDto prevIncome,
            BalanceSheetDto latestBalance,
            CashFlowStatementDto latestCashFlow,
            CashFlowStatementDto prevCashFlow,
            JsonNode finnhubMetrics,
            BigDecimal currentPrice) {

        List<FinancialRatioItemDto> valuation = new ArrayList<>();
        List<FinancialRatioItemDto> profitability = new ArrayList<>();
        List<FinancialRatioItemDto> health = new ArrayList<>();
        List<FinancialRatioItemDto> growth = new ArrayList<>();

        JsonNode metricObj = (finnhubMetrics != null && finnhubMetrics.has("metric"))
                ? finnhubMetrics.get("metric")
                : null;

        // ─────────────────────────────────────────────────────────────────────────
        // 1. RATIOS DE VALORISATION
        // ─────────────────────────────────────────────────────────────────────────

        // P/E Ratio (Trailing P/E)
        BigDecimal eps = (latestIncome != null && latestIncome.getEpsDiluted() != null)
                ? latestIncome.getEpsDiluted()
                : getMetricDecimal(metricObj, "epsTTM");

        if (eps != null && eps.compareTo(BigDecimal.ZERO) < 0) {
            valuation.add(FinancialRatioItemDto.builder()
                    .key("peRatio")
                    .label("Price-to-Earnings (P/E)")
                    .category("VALUATION")
                    .value(null)
                    .formattedValue("N/A (Déficitaire)")
                    .unit("x")
                    .formula("Cours / BPA Dilué")
                    .tooltip("Le ratio Cours/Bénéfice n'est pas applicable lorsque l'entreprise enregistre des pertes nettes.")
                    .benchmarkText("Non applicable si pertes")
                    .source("CALCULATED")
                    .status("NEGATIVE_EARNINGS")
                    .build());
        } else if (currentPrice != null && eps != null && eps.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal pe = currentPrice.divide(eps, 2, RoundingMode.HALF_UP);
            valuation.add(FinancialRatioItemDto.builder()
                    .key("peRatio")
                    .label("Price-to-Earnings (P/E)")
                    .category("VALUATION")
                    .value(pe)
                    .formattedValue(pe.toPlainString() + "x")
                    .unit("x")
                    .formula("Cours / BPA Dilué")
                    .tooltip("Mesure le montant que les investisseurs sont prêts à payer pour chaque dollar de bénéfice net généré.")
                    .benchmarkText("Sain entre 15x et 35x selon secteur")
                    .source("CALCULATED")
                    .status("AVAILABLE")
                    .build());
        } else {
            BigDecimal peFromProvider = getMetricDecimal(metricObj, "peTTM");
            valuation.add(buildRatioItem("peRatio", "Price-to-Earnings (P/E)", "VALUATION",
                    peFromProvider, "x", "Cours / BPA TTM",
                    "Multiple de bénéfice fourni par les données de marché.",
                    "Sain entre 15x et 35x"));
        }

        // Forward P/E
        BigDecimal forwardPe = getMetricDecimal(metricObj, "forwardPE");
        valuation.add(buildRatioItem("forwardPe", "Forward P/E (Anticipé)", "VALUATION",
                forwardPe, "x", "Cours / BPA Estimé N+1",
                "Anticipation de valorisation basée sur le consensus des analystes pour les bénéfices du prochain exercice.",
                "Inférieur au P/E courant si croissance attendue"));

        // Price-to-Book (P/B)
        BigDecimal pbRatio = getMetricDecimal(metricObj, "pb");
        if (pbRatio == null && profile != null && profile.getMarketCapitalization() != null
                && latestBalance != null && latestBalance.getTotalStockholdersEquity() != null) {
            BigDecimal equityInMillions = latestBalance.getTotalStockholdersEquity()
                    .divide(BigDecimal.valueOf(1_000_000), 2, RoundingMode.HALF_UP);
            if (equityInMillions.compareTo(BigDecimal.ZERO) > 0) {
                pbRatio = profile.getMarketCapitalization().divide(equityInMillions, 2, RoundingMode.HALF_UP);
            }
        }
        valuation.add(buildRatioItem("pbRatio", "Price-to-Book (P/B)", "VALUATION",
                pbRatio, "x", "Capitalisation / Capitaux Propres",
                "Compare la valeur de marché de l'entreprise à sa valeur comptable nette d'actif.",
                "Sous 3.0x pour entreprises traditionnelles, plus élevé pour la Tech"));

        // Price-to-Sales (P/S)
        BigDecimal psRatio = getMetricDecimal(metricObj, "psTTM");
        if (psRatio == null && profile != null && profile.getMarketCapitalization() != null
                && latestIncome != null && latestIncome.getRevenue() != null) {
            BigDecimal revInMillions = latestIncome.getRevenue()
                    .divide(BigDecimal.valueOf(1_000_000), 2, RoundingMode.HALF_UP);
            if (revInMillions.compareTo(BigDecimal.ZERO) > 0) {
                psRatio = profile.getMarketCapitalization().divide(revInMillions, 2, RoundingMode.HALF_UP);
            }
        }
        valuation.add(buildRatioItem("psRatio", "Price-to-Sales (P/S)", "VALUATION",
                psRatio, "x", "Capitalisation / Chiffre d'Affaires",
                "Indicateur de valorisation utile pour les entreprises en forte croissance ou temporairement non rentables.",
                "Intéressant si < 5.0x"));

        // EV / EBITDA
        BigDecimal evEbitda = getMetricDecimal(metricObj, "evEbitdaTTM");
        valuation.add(buildRatioItem("evEbitda", "EV / EBITDA", "VALUATION",
                evEbitda, "x", "Valeur d'Entreprise / EBITDA",
                "Multiple d'acquisition standard mesurant la valorisation opérationnelle globale, hors impact de l'endettement.",
                "Sain entre 8x et 18x"));

        // Dividend Yield
        BigDecimal divYield = getMetricDecimal(metricObj, "dividendYieldIndicatedAnnual");
        if (divYield == null) divYield = getMetricDecimal(metricObj, "currentDividendYieldTTM");
        valuation.add(buildRatioItem("dividendYield", "Rendement du Dividende", "VALUATION",
                divYield, "%", "Dividende Annuel / Cours",
                "Rendement annuel brut distribué par l'action sous forme de dividende.",
                "Moyenne S&P 500 : ~1.5%"));

        // ─────────────────────────────────────────────────────────────────────────
        // 2. RATIOS DE RENTABILITÉ
        // ─────────────────────────────────────────────────────────────────────────

        // Return on Equity (ROE)
        BigDecimal roe = null;
        if (latestIncome != null && latestIncome.getNetIncome() != null
                && latestBalance != null && latestBalance.getTotalStockholdersEquity() != null) {
            BigDecimal equity = latestBalance.getTotalStockholdersEquity();
            if (equity.compareTo(BigDecimal.ZERO) > 0) {
                roe = latestIncome.getNetIncome()
                        .multiply(BigDecimal.valueOf(100))
                        .divide(equity, 2, RoundingMode.HALF_UP);
            }
        }
        if (roe == null) roe = getMetricDecimal(metricObj, "roeTTM");
        profitability.add(buildRatioItem("roe", "Return on Equity (ROE)", "PROFITABILITY",
                roe, "%", "(Résultat Net / Capitaux Propres) × 100",
                "Mesure l'efficacité avec laquelle les capitaux investis par les actionnaires génèrent du profit net.",
                "Excellent si > 15%"));

        // Return on Assets (ROA)
        BigDecimal roa = null;
        if (latestIncome != null && latestIncome.getNetIncome() != null
                && latestBalance != null && latestBalance.getTotalAssets() != null) {
            BigDecimal assets = latestBalance.getTotalAssets();
            if (assets.compareTo(BigDecimal.ZERO) > 0) {
                roa = latestIncome.getNetIncome()
                        .multiply(BigDecimal.valueOf(100))
                        .divide(assets, 2, RoundingMode.HALF_UP);
            }
        }
        if (roa == null) roa = getMetricDecimal(metricObj, "roaTTM");
        profitability.add(buildRatioItem("roa", "Return on Assets (ROA)", "PROFITABILITY",
                roa, "%", "(Résultat Net / Total Actifs) × 100",
                "Mesure la rentabilité globale des investissements matériels et immatériels de l'entreprise.",
                "Sain si > 5%"));

        // Gross Margin
        BigDecimal grossMargin = (latestIncome != null && latestIncome.getGrossMarginPct() != null)
                ? latestIncome.getGrossMarginPct()
                : getMetricDecimal(metricObj, "grossMarginTTM");
        profitability.add(buildRatioItem("grossMargin", "Marge Brute", "PROFITABILITY",
                grossMargin, "%", "(Marge Brute / Chiffre d'Affaires) × 100",
                "Pourcentage du chiffre d'affaires restant après couverture directe des coûts de fabrication/services.",
                "Supérieur à 40% pour les entreprises à fort pouvoir de fixation des prix"));

        // Operating Margin (Marge Opérationnelle)
        BigDecimal opMargin = (latestIncome != null && latestIncome.getOperatingMarginPct() != null)
                ? latestIncome.getOperatingMarginPct()
                : getMetricDecimal(metricObj, "operatingMarginTTM");
        profitability.add(buildRatioItem("operatingMargin", "Marge Opérationnelle", "PROFITABILITY",
                opMargin, "%", "(Résultat d'Exploitation / CA) × 100",
                "Efficacité opérationnelle avant déduction des charges d'intérêts et impôts.",
                "Excellente si > 15%"));

        // Net Profit Margin (Marge Nette)
        BigDecimal netMargin = (latestIncome != null && latestIncome.getNetMarginPct() != null)
                ? latestIncome.getNetMarginPct()
                : getMetricDecimal(metricObj, "netProfitMarginTTM");
        profitability.add(buildRatioItem("netMargin", "Marge Nette", "PROFITABILITY",
                netMargin, "%", "(Bénéfice Net / Chiffre d'Affaires) × 100",
                "Pourcentage de chaque dollar de vente qui se transforme effectivement en bénéfice net attribuable.",
                "Sain si > 10%"));

        // ─────────────────────────────────────────────────────────────────────────
        // 3. RATIOS DE SANTÉ FINANCIÈRE & STRUCTURE DU BILAN
        // ─────────────────────────────────────────────────────────────────────────

        // Debt-to-Equity (D/E)
        BigDecimal debtToEquity = null;
        if (latestBalance != null && latestBalance.getTotalDebt() != null
                && latestBalance.getTotalStockholdersEquity() != null) {
            BigDecimal eq = latestBalance.getTotalStockholdersEquity();
            if (eq.compareTo(BigDecimal.ZERO) > 0) {
                debtToEquity = latestBalance.getTotalDebt().divide(eq, 2, RoundingMode.HALF_UP);
            }
        }
        if (debtToEquity == null) debtToEquity = getMetricDecimal(metricObj, "totalDebt/totalEquityQuarterly");
        if (debtToEquity == null) debtToEquity = getMetricDecimal(metricObj, "longTermDebt/equityQuarterly");
        health.add(buildRatioItem("debtToEquity", "Debt-to-Equity (Dette / Fonds Propres)", "HEALTH",
                debtToEquity, "x", "Dette Totale / Capitaux Propres",
                "Levier financier mesurant l'équilibre entre financement par dette et capitaux propres.",
                "Sain si < 1.5x à 2.0x"));

        // Current Ratio (Liquidité Générale)
        BigDecimal currentRatio = null;
        if (latestBalance != null && latestBalance.getCurrentAssets() != null
                && latestBalance.getCurrentLiabilities() != null) {
            BigDecimal cl = latestBalance.getCurrentLiabilities();
            if (cl.compareTo(BigDecimal.ZERO) > 0) {
                currentRatio = latestBalance.getCurrentAssets().divide(cl, 2, RoundingMode.HALF_UP);
            }
        }
        if (currentRatio == null) currentRatio = getMetricDecimal(metricObj, "currentRatioQuarterly");
        health.add(buildRatioItem("currentRatio", "Ratio de Liquidité Générale", "HEALTH",
                currentRatio, "x", "Actif Circulant / Passif Circulant",
                "Capacité de l'entreprise à rembourser ses dettes à moins d'un an avec ses actifs à court terme.",
                "Recommandé : > 1.0x (idéalement > 1.2x)"));

        // Quick Ratio (Liquidité Réduite)
        BigDecimal quickRatio = getMetricDecimal(metricObj, "quickRatioQuarterly");
        health.add(buildRatioItem("quickRatio", "Quick Ratio (Acid Test)", "HEALTH",
                quickRatio, "x", "(Trésorerie + Créances) / Passif Circulant",
                "Liquidité immédiate en excluant les stocks qui nécessitent un délai de vente.",
                "Sain si > 0.8x"));

        // Interest Coverage (Couverture des Intérêts)
        BigDecimal interestCoverage = getMetricDecimal(metricObj, "netInterestCoverageAnnual");
        if (interestCoverage == null) interestCoverage = getMetricDecimal(metricObj, "netInterestCoverageTTM");
        health.add(buildRatioItem("interestCoverage", "Couverture des Intérêts", "HEALTH",
                interestCoverage, "x", "Résultat d'Exploitation / Charges d'Intérêts",
                "Marge de sécurité opérationnelle pour honorer les intérêts financiers de la dette.",
                "Solide si > 5.0x"));

        // ─────────────────────────────────────────────────────────────────────────
        // 4. MÉTRIQUES DE CROISSANCE (GROWTH)
        // ─────────────────────────────────────────────────────────────────────────

        // Revenue Growth YoY
        BigDecimal revGrowth = null;
        if (latestIncome != null && prevIncome != null
                && latestIncome.getRevenue() != null && prevIncome.getRevenue() != null
                && prevIncome.getRevenue().compareTo(BigDecimal.ZERO) > 0) {
            revGrowth = latestIncome.getRevenue().subtract(prevIncome.getRevenue())
                    .multiply(BigDecimal.valueOf(100))
                    .divide(prevIncome.getRevenue(), 2, RoundingMode.HALF_UP);
        }
        if (revGrowth == null) revGrowth = getMetricDecimal(metricObj, "revenueGrowthTTMYoy");
        growth.add(buildRatioItem("revenueGrowthYoY", "Croissance du CA (YoY)", "GROWTH",
                revGrowth, "%", "((CA_N - CA_N-1) / CA_N-1) × 100",
                "Taux de croissance annuel du chiffre d'affaires sur un an.",
                "Objectif : > 8% (hors récession)"));

        // EPS Growth YoY
        BigDecimal epsGrowth = null;
        if (latestIncome != null && prevIncome != null
                && latestIncome.getEpsDiluted() != null && prevIncome.getEpsDiluted() != null
                && prevIncome.getEpsDiluted().abs().compareTo(BigDecimal.ZERO) > 0) {
            epsGrowth = latestIncome.getEpsDiluted().subtract(prevIncome.getEpsDiluted())
                    .multiply(BigDecimal.valueOf(100))
                    .divide(prevIncome.getEpsDiluted().abs(), 2, RoundingMode.HALF_UP);
        }
        if (epsGrowth == null) epsGrowth = getMetricDecimal(metricObj, "epsGrowthTTMYoy");
        growth.add(buildRatioItem("epsGrowthYoY", "Croissance du BPA (YoY)", "GROWTH",
                epsGrowth, "%", "((BPA_N - BPA_N-1) / |BPA_N-1|) × 100",
                "Progression annuelle du bénéfice net par action pour l'investisseur.",
                "Objectif : > 10%"));

        // Net Income Growth YoY
        BigDecimal netIncomeGrowth = null;
        if (latestIncome != null && prevIncome != null
                && latestIncome.getNetIncome() != null && prevIncome.getNetIncome() != null
                && prevIncome.getNetIncome().abs().compareTo(BigDecimal.ZERO) > 0) {
            netIncomeGrowth = latestIncome.getNetIncome().subtract(prevIncome.getNetIncome())
                    .multiply(BigDecimal.valueOf(100))
                    .divide(prevIncome.getNetIncome().abs(), 2, RoundingMode.HALF_UP);
        }
        growth.add(buildRatioItem("netIncomeGrowthYoY", "Croissance du Résultat Net", "GROWTH",
                netIncomeGrowth, "%", "((RésultatNet_N - RésultatNet_N-1) / |RésultatNet_N-1|) × 100",
                "Augmentation en pourcentage des profits nets totaux d'une année sur l'autre.",
                "Positif si expansion des marges"));

        // Free Cash Flow Growth
        BigDecimal fcfGrowth = null;
        if (latestCashFlow != null && prevCashFlow != null
                && latestCashFlow.getFreeCashFlow() != null && prevCashFlow.getFreeCashFlow() != null
                && prevCashFlow.getFreeCashFlow().abs().compareTo(BigDecimal.ZERO) > 0) {
            fcfGrowth = latestCashFlow.getFreeCashFlow().subtract(prevCashFlow.getFreeCashFlow())
                    .multiply(BigDecimal.valueOf(100))
                    .divide(prevCashFlow.getFreeCashFlow().abs(), 2, RoundingMode.HALF_UP);
        }
        growth.add(buildRatioItem("fcfGrowth", "Croissance du Free Cash Flow", "GROWTH",
                fcfGrowth, "%", "((FCF_N - FCF_N-1) / |FCF_N-1|) × 100",
                "Progression des flux de trésorerie disponibles réels générés par l'activité.",
                "Garantie fondamentale de solidité du dividende"));

        return CompanyRatiosDto.builder()
                .symbol(symbol)
                .available(true)
                .provider("Finnhub + Standard GAAP Calculations")
                .valuationRatios(valuation)
                .profitabilityRatios(profitability)
                .healthRatios(health)
                .growthRatios(growth)
                .calculatedAt(Instant.now())
                .build();
    }

    private FinancialRatioItemDto buildRatioItem(
            String key,
            String label,
            String category,
            BigDecimal value,
            String unit,
            String formula,
            String tooltip,
            String benchmark) {

        if (value == null) {
            return FinancialRatioItemDto.builder()
                    .key(key)
                    .label(label)
                    .category(category)
                    .value(null)
                    .formattedValue("Non disponible")
                    .unit(unit)
                    .formula(formula)
                    .tooltip(tooltip)
                    .benchmarkText(benchmark)
                    .source("FINNHUB_PROVIDER")
                    .status("UNAVAILABLE")
                    .build();
        }

        String formatted = value.setScale(2, RoundingMode.HALF_UP).toPlainString() + unit;
        return FinancialRatioItemDto.builder()
                .key(key)
                .label(label)
                .category(category)
                .value(value.setScale(2, RoundingMode.HALF_UP))
                .formattedValue(formatted)
                .unit(unit)
                .formula(formula)
                .tooltip(tooltip)
                .benchmarkText(benchmark)
                .source("FINNHUB_PROVIDER")
                .status("AVAILABLE")
                .build();
    }

    private BigDecimal getMetricDecimal(JsonNode metricNode, String field) {
        if (metricNode != null && metricNode.has(field) && !metricNode.get(field).isNull()) {
            try {
                double val = metricNode.get(field).asDouble();
                if (!Double.isNaN(val) && !Double.isInfinite(val)) {
                    return BigDecimal.valueOf(val).setScale(4, RoundingMode.HALF_UP);
                }
            } catch (Exception ignored) {
            }
        }
        return null;
    }
}
