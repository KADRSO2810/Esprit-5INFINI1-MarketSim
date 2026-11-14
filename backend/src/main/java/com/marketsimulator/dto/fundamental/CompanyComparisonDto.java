package com.marketsimulator.dto.fundamental;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompanyComparisonDto {
    private List<String> symbols;
    private List<CompanyProfileDto> profiles;
    private List<ComparisonMetricRowDto> comparisonRows;
    private List<String> warnings;
    private Instant comparedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ComparisonMetricRowDto {
        private String key;             // revenue, revenueGrowth, eps, pe, pb, roe, netMargin, debtToEquity, dividendYield, freeCashFlow
        private String label;           // Chiffre d'Affaires, Croissance CA YoY, etc.
        private String category;        // VALUATION, PROFITABILITY, HEALTH, GROWTH, GENERAL
        private String unit;            // "$B", "%", "x", "$"
        private String description;
        private Map<String, String> valuesBySymbol;       // symbol -> formatted value ("$478.8B", "39.4x", "N/A")
        private Map<String, Double> rawValuesBySymbol;     // symbol -> double value for sorting/coloring
        private String bestSymbol;                         // Symbole avec la meilleure valeur (si applicable)
        private boolean higherIsBetter;                    // ex: ROE higher is better, DebtToEquity lower is better
    }
}
