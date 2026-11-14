package com.marketsimulator.dto.fundamental;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FinancialRatioItemDto {
    private String key;             // ex: "peRatio", "roe", "debtToEquity"
    private String label;           // ex: "Price-to-Earnings (P/E)", "Return on Equity (ROE)"
    private String category;        // VALUATION, PROFITABILITY, HEALTH, GROWTH
    private BigDecimal value;
    private String formattedValue;  // ex: "39.37x", "152.00%", "N/A (Déficitaire)"
    private String unit;            // "x", "%", "$"
    private String formula;         // ex: "Market Price / EPS"
    private String tooltip;         // Explication pédagogique pour débutant & pro
    private String benchmarkText;   // ex: "Sain si < 2.0x", "Moyenne secteur: 25.4x"
    private String source;          // "CALCULATED" ou "FINNHUB_PROVIDER"
    private String status;          // "AVAILABLE", "NEGATIVE_EARNINGS", "DIV_ZERO", "UNAVAILABLE"
}
