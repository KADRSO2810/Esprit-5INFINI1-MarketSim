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
public class CashFlowStatementDto {
    private String periodLabel; // ex: "FY 2026", "Q3 2026"
    private int year;
    private int quarter;
    private String form;
    private String filedDate;

    // Activités Opérationnelles
    private BigDecimal netIncome;
    private BigDecimal depreciationAmortization;
    private BigDecimal stockBasedCompensation;
    private BigDecimal changeInWorkingCapital;
    private BigDecimal operatingCashFlow;

    // Activités d'Investissement
    private BigDecimal capitalExpenditures; // Investissements corporels (CapEx)
    private BigDecimal acquisitionsNet;
    private BigDecimal purchasesMarketableSecurities;
    private BigDecimal salesMarketableSecurities;
    private BigDecimal investingCashFlow;

    // Activités de Financement
    private BigDecimal commonStockIssuance;
    private BigDecimal commonStockRepurchase; // Rachat d'actions
    private BigDecimal dividendsPaid;
    private BigDecimal debtIssuance;
    private BigDecimal debtRepayment;
    private BigDecimal financingCashFlow;

    // Flux Net & Free Cash Flow
    private BigDecimal netChangeInCash;
    private BigDecimal freeCashFlow; // Operating Cash Flow - CapEx
}
