package com.marketsimulator.dto.fundamental;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompanyFundamentalOverviewDto {
    private String symbol;
    private boolean available;
    private String message;
    private String provider;
    private String dataFreshness;

    // Profil de l'entreprise
    private CompanyProfileDto profile;

    // Dernier cours de marché en direct (si disponible)
    private BigDecimal currentPrice;

    // Derniers états financiers reportés (10-K ou 10-Q le plus récent)
    private IncomeStatementDto latestIncomeStatement;
    private BalanceSheetDto latestBalanceSheet;
    private CashFlowStatementDto latestCashFlowStatement;

    // Ratios fondamentaux
    private CompanyRatiosDto ratios;

    // Série temporelle historique pour les graphiques d'évolution
    private List<HistoricalFinancialPointDto> historicalAnnual;
    private List<HistoricalFinancialPointDto> historicalQuarterly;

    // Résumé exécutif
    private String reportingPeriod;
    private BigDecimal latestRevenue;
    private BigDecimal latestNetIncome;
    private BigDecimal latestEps;
    private BigDecimal roe;
    private BigDecimal debtToEquity;
    private BigDecimal peRatio;
    private BigDecimal dividendYield;
    private BigDecimal revenueGrowthYoY;
    private BigDecimal epsGrowthYoY;
    private BigDecimal freeCashFlow;

    private Instant evaluatedAt;
}
