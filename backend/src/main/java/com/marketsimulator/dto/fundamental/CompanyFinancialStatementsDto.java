package com.marketsimulator.dto.fundamental;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompanyFinancialStatementsDto {
    private String symbol;
    private String frequency; // "ANNUAL" ou "QUARTERLY"
    private boolean available;
    private String provider;
    private String dataFreshness;
    private String message;

    private List<IncomeStatementDto> incomeStatements;
    private List<BalanceSheetDto> balanceSheets;
    private List<CashFlowStatementDto> cashFlowStatements;

    private Instant retrievedAt;
}
