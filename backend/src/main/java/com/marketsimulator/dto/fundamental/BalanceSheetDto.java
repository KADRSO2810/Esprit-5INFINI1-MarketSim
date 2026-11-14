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
public class BalanceSheetDto {
    private String periodLabel; // ex: "FY 2026", "Q3 2026"
    private int year;
    private int quarter;
    private String form;
    private String filedDate;

    // Actifs
    private BigDecimal cashAndEquivalents;
    private BigDecimal shortTermInvestments;
    private BigDecimal totalCashAndShortTerm;
    private BigDecimal accountsReceivable;
    private BigDecimal inventory;
    private BigDecimal otherCurrentAssets;
    private BigDecimal currentAssets;
    private BigDecimal propertyPlantEquipmentNet;
    private BigDecimal longTermInvestments;
    private BigDecimal intangibleAssets;
    private BigDecimal totalAssets;

    // Passifs
    private BigDecimal accountsPayable;
    private BigDecimal shortTermDebt;
    private BigDecimal currentLiabilities;
    private BigDecimal longTermDebt;
    private BigDecimal totalLiabilities;
    private BigDecimal totalDebt; // shortTermDebt + longTermDebt

    // Capitaux Propres
    private BigDecimal commonStock;
    private BigDecimal retainedEarnings;
    private BigDecimal totalStockholdersEquity;
    private BigDecimal totalLiabilitiesAndEquity;

    // Ratios d'instantané du bilan
    private BigDecimal workingCapital; // currentAssets - currentLiabilities
    private BigDecimal netDebt;        // totalDebt - totalCashAndShortTerm
}
