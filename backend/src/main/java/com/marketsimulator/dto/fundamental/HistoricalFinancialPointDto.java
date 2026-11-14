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
public class HistoricalFinancialPointDto {
    private String periodLabel; // ex: "2023", "2024", "2025", "2026"
    private int year;
    private int quarter;
    private BigDecimal revenue;
    private BigDecimal grossProfit;
    private BigDecimal operatingIncome;
    private BigDecimal netIncome;
    private BigDecimal eps;
    private BigDecimal operatingCashFlow;
    private BigDecimal freeCashFlow;
    private BigDecimal capitalExpenditures;
    private BigDecimal grossMarginPct;
    private BigDecimal operatingMarginPct;
    private BigDecimal netMarginPct;
}
