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
public class IncomeStatementDto {
    private String periodLabel; // ex: "FY 2026", "Q3 2026"
    private int year;
    private int quarter;        // 0 pour annuel
    private String form;        // 10-K, 10-Q
    private String filedDate;
    private String startDate;
    private String endDate;

    // Métriques principales
    private BigDecimal revenue;
    private BigDecimal costOfGoodsSold;
    private BigDecimal grossProfit;
    private BigDecimal researchAndDevelopment;
    private BigDecimal sellingGeneralAdmin;
    private BigDecimal operatingExpenses;
    private BigDecimal operatingIncome;
    private BigDecimal ebitda;
    private BigDecimal netInterestExpense;
    private BigDecimal pretaxIncome;
    private BigDecimal incomeTax;
    private BigDecimal netIncome;
    private BigDecimal epsBasic;
    private BigDecimal epsDiluted;
    private BigDecimal sharesBasic;
    private BigDecimal sharesDiluted;

    // Marges calculées
    private BigDecimal grossMarginPct;     // (Gross Profit / Revenue) * 100
    private BigDecimal operatingMarginPct; // (Operating Income / Revenue) * 100
    private BigDecimal netMarginPct;       // (Net Income / Revenue) * 100
}
