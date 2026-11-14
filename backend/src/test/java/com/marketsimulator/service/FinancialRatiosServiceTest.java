package com.marketsimulator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.marketsimulator.dto.fundamental.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class FinancialRatiosServiceTest {

    private FinancialRatiosService service;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        service = new FinancialRatiosService();
        objectMapper = new ObjectMapper();
    }

    @Test
    @DisplayName("Devrait gérer gracieusement les bénéfices négatifs (P/E marqué NEGATIVE_EARNINGS)")
    void testNegativeEarningsHandling() {
        IncomeStatementDto income = IncomeStatementDto.builder()
                .revenue(BigDecimal.valueOf(100_000_000))
                .netIncome(BigDecimal.valueOf(-15_000_000)) // Perte nette
                .epsDiluted(BigDecimal.valueOf(-1.50))
                .build();

        CompanyRatiosDto ratios = service.computeRatios(
                "DEFICIT_CO",
                null,
                income,
                null,
                null,
                null,
                null,
                null,
                BigDecimal.valueOf(45.00) // Prix marché positif
        );

        assertNotNull(ratios);
        FinancialRatioItemDto peRatio = ratios.getValuationRatios().stream()
                .filter(r -> "peRatio".equals(r.getKey()))
                .findFirst()
                .orElse(null);

        assertNotNull(peRatio);
        assertEquals("NEGATIVE_EARNINGS", peRatio.getStatus());
        assertTrue(peRatio.getFormattedValue().contains("N/A"));
        assertTrue(peRatio.getFormattedValue().contains("Déficitaire"));
        assertNull(peRatio.getValue());
    }

    @Test
    @DisplayName("Devrait gérer la division par zéro si capitaux propres ou passifs circulants sont nuls")
    void testZeroDenominatorHandling() {
        IncomeStatementDto income = IncomeStatementDto.builder()
                .revenue(BigDecimal.valueOf(50_000_000))
                .netIncome(BigDecimal.valueOf(5_000_000))
                .epsDiluted(BigDecimal.valueOf(2.50))
                .build();

        BalanceSheetDto balance = BalanceSheetDto.builder()
                .totalStockholdersEquity(BigDecimal.ZERO) // Capitaux propres nuls
                .currentLiabilities(BigDecimal.ZERO)      // Passif circulant nul
                .currentAssets(BigDecimal.valueOf(10_000_000))
                .totalDebt(BigDecimal.valueOf(20_000_000))
                .build();

        CompanyRatiosDto ratios = service.computeRatios(
                "ZERO_DENOM_CO",
                null,
                income,
                null,
                balance,
                null,
                null,
                null,
                BigDecimal.valueOf(50.00)
        );

        assertNotNull(ratios);

        // ROE avec equity = 0 ne doit pas lever de ArithmeticException
        FinancialRatioItemDto roe = ratios.getProfitabilityRatios().stream()
                .filter(r -> "roe".equals(r.getKey()))
                .findFirst()
                .orElse(null);
        assertNotNull(roe);
        assertEquals("UNAVAILABLE", roe.getStatus());

        // Debt-to-Equity avec equity = 0
        FinancialRatioItemDto de = ratios.getHealthRatios().stream()
                .filter(r -> "debtToEquity".equals(r.getKey()))
                .findFirst()
                .orElse(null);
        assertNotNull(de);
        assertEquals("UNAVAILABLE", de.getStatus());

        // Current Ratio avec currentLiabilities = 0
        FinancialRatioItemDto cr = ratios.getHealthRatios().stream()
                .filter(r -> "currentRatio".equals(r.getKey()))
                .findFirst()
                .orElse(null);
        assertNotNull(cr);
        assertEquals("UNAVAILABLE", cr.getStatus());
    }

    @Test
    @DisplayName("Devrait calculer correctement les ratios de rentabilité et valorisation sur données saines")
    void testHealthyRatiosCalculation() {
        IncomeStatementDto income = IncomeStatementDto.builder()
                .revenue(BigDecimal.valueOf(400_000_000_000L))
                .grossProfit(BigDecimal.valueOf(180_000_000_000L))
                .operatingIncome(BigDecimal.valueOf(120_000_000_000L))
                .netIncome(BigDecimal.valueOf(100_000_000_000L))
                .epsDiluted(BigDecimal.valueOf(10.00))
                .grossMarginPct(BigDecimal.valueOf(45.00))
                .operatingMarginPct(BigDecimal.valueOf(30.00))
                .netMarginPct(BigDecimal.valueOf(25.00))
                .build();

        BalanceSheetDto balance = BalanceSheetDto.builder()
                .totalAssets(BigDecimal.valueOf(350_000_000_000L))
                .totalStockholdersEquity(BigDecimal.valueOf(100_000_000_000L))
                .totalDebt(BigDecimal.valueOf(80_000_000_000L))
                .currentAssets(BigDecimal.valueOf(140_000_000_000L))
                .currentLiabilities(BigDecimal.valueOf(100_000_000_000L))
                .build();

        CompanyRatiosDto ratios = service.computeRatios(
                "AAPL_MOCK",
                null,
                income,
                null,
                balance,
                null,
                null,
                null,
                BigDecimal.valueOf(200.00) // P/E = 200 / 10 = 20.0x
        );

        assertNotNull(ratios);

        // P/E = 200 / 10 = 20x
        FinancialRatioItemDto pe = ratios.getValuationRatios().stream()
                .filter(r -> "peRatio".equals(r.getKey()))
                .findFirst().orElseThrow();
        assertEquals("AVAILABLE", pe.getStatus());
        assertEquals(0, BigDecimal.valueOf(20.00).compareTo(pe.getValue()));

        // ROE = (100B / 100B) * 100 = 100%
        FinancialRatioItemDto roe = ratios.getProfitabilityRatios().stream()
                .filter(r -> "roe".equals(r.getKey()))
                .findFirst().orElseThrow();
        assertEquals("AVAILABLE", roe.getStatus());
        assertEquals(0, BigDecimal.valueOf(100.00).compareTo(roe.getValue()));

        // D/E = 80B / 100B = 0.8x
        FinancialRatioItemDto de = ratios.getHealthRatios().stream()
                .filter(r -> "debtToEquity".equals(r.getKey()))
                .findFirst().orElseThrow();
        assertEquals("AVAILABLE", de.getStatus());
        assertEquals(0, BigDecimal.valueOf(0.80).setScale(2).compareTo(de.getValue()));

        // Current Ratio = 140B / 100B = 1.4x
        FinancialRatioItemDto cr = ratios.getHealthRatios().stream()
                .filter(r -> "currentRatio".equals(r.getKey()))
                .findFirst().orElseThrow();
        assertEquals("AVAILABLE", cr.getStatus());
        assertEquals(0, BigDecimal.valueOf(1.40).setScale(2).compareTo(cr.getValue()));
    }

    @Test
    @DisplayName("Devrait calculer la croissance annuelle YoY entre deux exercices consécutifs")
    void testGrowthCalculationBetweenPeriods() {
        IncomeStatementDto current = IncomeStatementDto.builder()
                .revenue(BigDecimal.valueOf(120_000_000))
                .epsDiluted(BigDecimal.valueOf(3.60))
                .netIncome(BigDecimal.valueOf(24_000_000))
                .build();

        IncomeStatementDto prev = IncomeStatementDto.builder()
                .revenue(BigDecimal.valueOf(100_000_000))
                .epsDiluted(BigDecimal.valueOf(3.00))
                .netIncome(BigDecimal.valueOf(20_000_000))
                .build();

        CompanyRatiosDto ratios = service.computeRatios(
                "GROWTH_CO",
                null,
                current,
                prev,
                null,
                null,
                null,
                null,
                null
        );

        assertNotNull(ratios);

        // Revenue Growth = (120 - 100) / 100 * 100 = +20%
        FinancialRatioItemDto revGr = ratios.getGrowthRatios().stream()
                .filter(r -> "revenueGrowthYoY".equals(r.getKey()))
                .findFirst().orElseThrow();
        assertEquals("AVAILABLE", revGr.getStatus());
        assertEquals(0, BigDecimal.valueOf(20.00).compareTo(revGr.getValue()));

        // EPS Growth = (3.60 - 3.00) / 3.00 * 100 = +20%
        FinancialRatioItemDto epsGr = ratios.getGrowthRatios().stream()
                .filter(r -> "epsGrowthYoY".equals(r.getKey()))
                .findFirst().orElseThrow();
        assertEquals("AVAILABLE", epsGr.getStatus());
        assertEquals(0, BigDecimal.valueOf(20.00).compareTo(epsGr.getValue()));
    }
}
