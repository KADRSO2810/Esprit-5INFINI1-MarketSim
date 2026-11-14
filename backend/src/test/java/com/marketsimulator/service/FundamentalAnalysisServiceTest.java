package com.marketsimulator.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.dto.fundamental.CompanyComparisonDto;
import com.marketsimulator.dto.fundamental.CompanyFundamentalOverviewDto;
import com.marketsimulator.dto.fundamental.CompanySearchItemDto;
import com.marketsimulator.service.market.FinnhubFundamentalProvider;
import com.marketsimulator.service.market.MarketDataIngestionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FundamentalAnalysisServiceTest {

    @Mock
    private FinnhubFundamentalProvider provider;

    @Mock
    private MarketDataIngestionService marketDataIngestionService;

    private FinancialRatiosService ratiosService;
    private FundamentalAnalysisService fundamentalService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        ratiosService = new FinancialRatiosService();
        fundamentalService = new FundamentalAnalysisService(provider, ratiosService, marketDataIngestionService);
    }

    @Test
    @DisplayName("Devrait rejeter les actifs crypto sans fabriquer de faux états financiers")
    void testCryptoSymbolRejection() {
        when(provider.isCrypto("BINANCE:BTCUSDT")).thenReturn(true);

        CompanyFundamentalOverviewDto overview = fundamentalService.getCompanyOverview("BINANCE:BTCUSDT");

        assertNotNull(overview);
        assertFalse(overview.isAvailable());
        assertTrue(overview.getMessage().contains("cryptomonnaie décentralisée"));
        assertNull(overview.getLatestIncomeStatement());
        assertNull(overview.getLatestBalanceSheet());
    }

    @Test
    @DisplayName("Devrait trouver des sociétés via l'autocomplétion")
    void testSearchCompanies() {
        List<CompanySearchItemDto> results = fundamentalService.searchCompanies("apple");
        assertFalse(results.isEmpty());
        assertTrue(results.stream().anyMatch(c -> "AAPL".equals(c.getSymbol())));

        List<CompanySearchItemDto> emptyQuery = fundamentalService.searchCompanies("");
        assertFalse(emptyQuery.isEmpty());
    }

    @Test
    @DisplayName("Devrait comparer plusieurs sociétés et identifier le meilleur ratio")
    void testCompareCompanies() throws Exception {
        when(provider.isCrypto(anyString())).thenReturn(false);

        // Mock profil AAPL
        String aaplProfileJson = "{\"ticker\":\"AAPL\",\"name\":\"Apple Inc.\",\"marketCapitalization\":3000000,\"finnhubIndustry\":\"Technology\"}";
        when(provider.getCompanyProfile("AAPL")).thenReturn(Optional.of(objectMapper.readTree(aaplProfileJson)));

        // Mock profil MSFT
        String msftProfileJson = "{\"ticker\":\"MSFT\",\"name\":\"Microsoft Corp.\",\"marketCapitalization\":3100000,\"finnhubIndustry\":\"Technology\"}";
        when(provider.getCompanyProfile("MSFT")).thenReturn(Optional.of(objectMapper.readTree(msftProfileJson)));

        CompanyComparisonDto comparison = fundamentalService.compareCompanies(List.of("AAPL", "MSFT"));

        assertNotNull(comparison);
        assertEquals(2, comparison.getSymbols().size());
        assertFalse(comparison.getComparisonRows().isEmpty());
        assertTrue(comparison.getComparisonRows().stream().anyMatch(r -> "revenue".equals(r.getKey())));
        assertTrue(comparison.getComparisonRows().stream().anyMatch(r -> "pe".equals(r.getKey())));
    }
}
