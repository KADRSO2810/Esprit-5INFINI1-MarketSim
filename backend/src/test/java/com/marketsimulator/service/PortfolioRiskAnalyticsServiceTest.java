package com.marketsimulator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.domain.*;
import com.marketsimulator.dto.*;
import com.marketsimulator.repository.*;
import com.marketsimulator.service.market.MarketDataIngestionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

import org.mockito.quality.Strictness;
import org.mockito.junit.jupiter.MockitoSettings;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PortfolioRiskAnalyticsServiceTest {

    @Mock private PortfolioRepository portfolioRepository;
    @Mock private PositionRepository positionRepository;
    @Mock private PortfolioSnapshotRepository snapshotRepository;
    @Mock private MarketCandleRepository candleRepository;
    @Mock private MarketQuoteRepository quoteRepository;
    @Mock private PostTradeRiskEvaluationRepository postTradeRiskRepository;
    @Mock private RiskAlertService riskAlertService;
    @Mock private MarketDataIngestionService ingestionService;

    private PortfolioRiskAnalyticsService analyticsService;

    private User testUser;
    private Portfolio testPortfolio;

    @BeforeEach
    void setUp() {
        analyticsService = new PortfolioRiskAnalyticsService(
                portfolioRepository,
                positionRepository,
                snapshotRepository,
                candleRepository,
                quoteRepository,
                postTradeRiskRepository,
                riskAlertService,
                new ObjectMapper(),
                ingestionService,
                null
        );

        testUser = User.builder().id(100L).email("trader@marketsim.com").build();
        testPortfolio = Portfolio.builder()
                .id(1L)
                .user(testUser)
                .sessionId(0L)
                .cashBalance(new BigDecimal("100000.00"))
                .build();

        lenient().when(portfolioRepository.findByUserIdAndSessionId(100L, 0L)).thenReturn(Optional.of(testPortfolio));
        lenient().when(portfolioRepository.findByUserId(100L)).thenReturn(Optional.of(testPortfolio));
    }

    @Test
    void computeAnalytics_cashOnlyPortfolio_returnsZeroRiskMetrics() {
        when(portfolioRepository.findByUserId(100L)).thenReturn(Optional.of(testPortfolio));
        when(positionRepository.findByPortfolioId(1L)).thenReturn(List.of());
        when(snapshotRepository.findByPortfolioIdOrderByTsAsc(eq(1L), any(Pageable.class)))
                .thenReturn(List.of());

        PortfolioRiskAnalyticsDto analytics = analyticsService.computeAnalytics(100L, 0L);

        assertThat(analytics).isNotNull();
        assertThat(analytics.getPortfolioEquity()).isEqualByComparingTo("100000.00");
        assertThat(analytics.getCashBalance()).isEqualByComparingTo("100000.00");
        assertThat(analytics.getTotalExposurePct()).isEqualByComparingTo("0.00");
        assertThat(analytics.getVar95Pct()).isEqualByComparingTo("0.00");
        assertThat(analytics.getVar95Amount()).isEqualByComparingTo("0.00");
        assertThat(analytics.getCvar95Pct()).isEqualByComparingTo("0.00");
        assertThat(analytics.getAnnualizedVolatilityPct()).isEqualByComparingTo("0.00");
        assertThat(analytics.getObservationStatus()).isEqualTo("CASH_ONLY");
    }

    @Test
    void computeAnalytics_singlePositionPortfolio_computesVaRAndRiskContribution() {
        when(portfolioRepository.findByUserId(100L)).thenReturn(Optional.of(testPortfolio));

        Position aaplPos = Position.builder()
                .id(10L)
                .portfolio(testPortfolio)
                .symbol("AAPL")
                .quantity(new BigDecimal("100.00"))
                .avgPrice(new BigDecimal("150.00"))
                .build();

        when(positionRepository.findByPortfolioId(1L)).thenReturn(List.of(aaplPos));
        when(ingestionService.getLatestQuote("AAPL")).thenReturn(
                MarketQuoteDto.builder().symbol("AAPL").price(new BigDecimal("160.00")).ts(Instant.now()).build()
        );

        // Generate 30 daily candles with returns
        List<MarketCandle> mockCandles = new ArrayList<>();
        Instant start = Instant.now().minus(60, ChronoUnit.DAYS);
        double price = 140.0;
        for (int i = 0; i < 30; i++) {
            price = price * (1.0 + (i % 2 == 0 ? 0.02 : -0.015));
            mockCandles.add(MarketCandle.builder()
                    .symbol("AAPL")
                    .resolution("D")
                    .ts(start.plus(i, ChronoUnit.DAYS))
                    .close(BigDecimal.valueOf(price))
                    .build());
        }

        when(candleRepository.findBySymbolAndResolutionAndTsBetweenOrderByTsAsc(
                eq("AAPL"), eq("D"), any(Instant.class), any(Instant.class)))
                .thenReturn(mockCandles);

        when(snapshotRepository.findByPortfolioIdOrderByTsAsc(eq(1L), any(Pageable.class)))
                .thenReturn(List.of());

        PortfolioRiskAnalyticsDto analytics = analyticsService.computeAnalytics(100L, 0L);

        assertThat(analytics).isNotNull();
        // Equity = 100,000 cash + (100 * 160) = 116,000
        assertThat(analytics.getPortfolioEquity()).isEqualByComparingTo("116000.00");
        assertThat(analytics.getInvestedValue()).isEqualByComparingTo("16000.00");
        // Exposure = 16,000 / 116,000 ~= 13.79%
        assertThat(analytics.getTotalExposurePct()).isGreaterThan(BigDecimal.ZERO);

        // VaR should be strictly positive
        assertThat(analytics.getVar95Pct()).isGreaterThanOrEqualTo(BigDecimal.ZERO);
        assertThat(analytics.getVar95Amount()).isGreaterThanOrEqualTo(BigDecimal.ZERO);
        assertThat(analytics.getCvar95Pct()).isGreaterThanOrEqualTo(analytics.getVar95Pct());

        // Positions risk contribution
        assertThat(analytics.getPositionsRisk()).hasSize(1);
        var aaplRisk = analytics.getPositionsRisk().get(0);
        assertThat(aaplRisk.getSymbol()).isEqualTo("AAPL");
        assertThat(aaplRisk.getSector()).isEqualTo("Technology");
        assertThat(aaplRisk.getRiskContributionPct()).isGreaterThanOrEqualTo(BigDecimal.ZERO);

        // Sector breakdown
        assertThat(analytics.getSectorConcentration()).isNotEmpty();
        assertThat(analytics.getSectorConcentration().get(0).getSector()).isEqualTo("Technology");
    }

    @Test
    void computeAnalytics_multiAssetPortfolio_computesCorrelationMatrixAndDiversification() {
        when(portfolioRepository.findByUserId(100L)).thenReturn(Optional.of(testPortfolio));

        Position aapl = Position.builder().id(1L).portfolio(testPortfolio).symbol("AAPL").quantity(new BigDecimal("50")).avgPrice(new BigDecimal("150")).build();
        Position msft = Position.builder().id(2L).portfolio(testPortfolio).symbol("MSFT").quantity(new BigDecimal("50")).avgPrice(new BigDecimal("300")).build();

        when(positionRepository.findByPortfolioId(1L)).thenReturn(List.of(aapl, msft));
        when(ingestionService.getLatestQuote("AAPL")).thenReturn(MarketQuoteDto.builder().symbol("AAPL").price(new BigDecimal("150")).ts(Instant.now()).build());
        when(ingestionService.getLatestQuote("MSFT")).thenReturn(MarketQuoteDto.builder().symbol("MSFT").price(new BigDecimal("300")).ts(Instant.now()).build());

        List<MarketCandle> aaplCandles = new ArrayList<>();
        List<MarketCandle> msftCandles = new ArrayList<>();
        Instant start = Instant.now().minus(30, ChronoUnit.DAYS);
        for (int i = 0; i < 20; i++) {
            aaplCandles.add(MarketCandle.builder().symbol("AAPL").resolution("D").ts(start.plus(i, ChronoUnit.DAYS)).close(BigDecimal.valueOf(150 + i)).build());
            msftCandles.add(MarketCandle.builder().symbol("MSFT").resolution("D").ts(start.plus(i, ChronoUnit.DAYS)).close(BigDecimal.valueOf(300 + i * 2)).build());
        }

        when(candleRepository.findBySymbolAndResolutionAndTsBetweenOrderByTsAsc(eq("AAPL"), eq("D"), any(), any())).thenReturn(aaplCandles);
        when(candleRepository.findBySymbolAndResolutionAndTsBetweenOrderByTsAsc(eq("MSFT"), eq("D"), any(), any())).thenReturn(msftCandles);
        when(snapshotRepository.findByPortfolioIdOrderByTsAsc(any(), any())).thenReturn(List.of());

        PortfolioRiskAnalyticsDto analytics = analyticsService.computeAnalytics(100L, 0L);

        assertThat(analytics.getPositionsRisk()).hasSize(2);
        assertThat(analytics.getCorrelationMatrix()).isNotNull();
        assertThat(analytics.getCorrelationMatrix().getSymbols()).containsExactly("AAPL", "MSFT");
        assertThat(analytics.getCorrelationMatrix().getMatrix()).hasDimensions(2, 2);
        // Diagonal should be 1.0
        assertThat(analytics.getCorrelationMatrix().getMatrix()[0][0]).isEqualTo(1.0);
        assertThat(analytics.getCorrelationMatrix().getMatrix()[1][1]).isEqualTo(1.0);
    }
}
