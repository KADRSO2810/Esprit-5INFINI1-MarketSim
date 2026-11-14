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
public class CompanyRatiosDto {
    private String symbol;
    private boolean available;
    private String provider;
    private String message;

    private List<FinancialRatioItemDto> valuationRatios;
    private List<FinancialRatioItemDto> profitabilityRatios;
    private List<FinancialRatioItemDto> healthRatios;
    private List<FinancialRatioItemDto> growthRatios;

    private Instant calculatedAt;
}
