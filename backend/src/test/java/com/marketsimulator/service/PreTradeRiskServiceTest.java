package com.marketsimulator.service;

import com.marketsimulator.domain.Portfolio;
import com.marketsimulator.domain.Position;
import com.marketsimulator.domain.RiskLimit;
import com.marketsimulator.domain.User;
import com.marketsimulator.dto.*;
import com.marketsimulator.exception.RiskLimitBreachedException;
import com.marketsimulator.repository.PortfolioRepository;
import com.marketsimulator.repository.PositionRepository;
import com.marketsimulator.repository.RiskLimitRepository;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.service.market.MarketDataIngestionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PreTradeRiskServiceTest {

    @Mock private RiskLimitRepository riskLimitRepository;
    @Mock private PortfolioRepository portfolioRepository;
    @Mock private PositionRepository positionRepository;
    @Mock private UserRepository userRepository;
    @Mock private MarketDataIngestionService ingestionService;
    @Mock private PortfolioService portfolioService;

    @InjectMocks
    private PreTradeRiskService preTradeRiskService;

    private User user;
    private Portfolio portfolio;
    private Position existingAaplPosition;

    @BeforeEach
    void setUp() {
        user = User.builder().id(1L).email("trader@test.com").build();
        portfolio = Portfolio.builder()
                .id(10L)
                .user(user)
                .sessionId(0L)
                .cashBalance(new BigDecimal("100000.00"))
                .build();

        existingAaplPosition = Position.builder()
                .id(100L)
                .portfolio(portfolio)
                .symbol("AAPL")
                .quantity(new BigDecimal("10.000000"))
                .avgPrice(new BigDecimal("150.000000"))
                .build();

        when(portfolioService.ensurePortfolio(eq(1L), anyLong())).thenReturn(portfolio);
        when(positionRepository.findByPortfolioId(10L)).thenReturn(new ArrayList<>(List.of(existingAaplPosition)));

        when(ingestionService.getLatestQuote("AAPL")).thenReturn(MarketQuoteDto.builder()
                .symbol("AAPL")
                .price(new BigDecimal("150.000000"))
                .ts(Instant.now())
                .build());

        when(ingestionService.getLatestQuote("MSFT")).thenReturn(MarketQuoteDto.builder()
                .symbol("MSFT")
                .price(new BigDecimal("300.000000"))
                .ts(Instant.now())
                .build());

        when(riskLimitRepository.findByUserId(1L)).thenReturn(Optional.empty()); // defaults
    }

    @Test
    @DisplayName("calculatePositionSize - standard Long calculation respecte la règle des 2% et les bornes")
    void calculatePositionSize_standardLong_computesCorrectQuantity() {
        PositionSizingRequest request = PositionSizingRequest.builder()
                .symbol("MSFT")
                .riskPercentage(new BigDecimal("2.00"))
                .entryPrice(new BigDecimal("300.00"))
                .stopLoss(new BigDecimal("285.00"))
                .sessionId(0L)
                .build();

        // Equity = 100,000 cash + (10 * 150 AAPL) = 101,500
        // Risk budget 2% = 2,030.00
        // Risk per unit = 300 - 285 = 15.00
        // Max qty by risk = 2,030 / 15 = 135.333333
        // Max asset budget (20%) = 20,300.00 -> Max qty by asset = 20,300 / 300 = 67.666666
        // Suggested qty = min(135.33, 67.66) = 67.66

        PositionSizingResponse res = preTradeRiskService.calculatePositionSize(1L, request);

        assertThat(res.getRiskBudget()).isEqualByComparingTo(new BigDecimal("2030.00"));
        assertThat(res.getRiskPerUnit()).isEqualByComparingTo(new BigDecimal("15.00"));
        assertThat(res.getSuggestedQuantity()).isEqualByComparingTo(new BigDecimal("67.66"));
    }

    @Test
    @DisplayName("calculatePositionSize - Stop-Loss manquant ou égal au prix d'entrée lève une exception")
    void calculatePositionSize_invalidStopLoss_throws() {
        PositionSizingRequest reqNullSl = PositionSizingRequest.builder()
                .symbol("MSFT")
                .entryPrice(new BigDecimal("300.00"))
                .stopLoss(null)
                .build();

        assertThatThrownBy(() -> preTradeRiskService.calculatePositionSize(1L, reqNullSl))
                .isInstanceOf(IllegalArgumentException.class);

        PositionSizingRequest reqEqualSl = PositionSizingRequest.builder()
                .symbol("MSFT")
                .entryPrice(new BigDecimal("300.00"))
                .stopLoss(new BigDecimal("300.00"))
                .build();

        assertThatThrownBy(() -> preTradeRiskService.calculatePositionSize(1L, reqEqualSl))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("assessPreTradeRisk - ordre BUY conforme avec SL/TP renvoie APPROVED")
    void assessPreTradeRisk_withinLimits_returnsApproved() {
        PreTradeRiskRequest req = PreTradeRiskRequest.builder()
                .symbol("MSFT")
                .side("BUY")
                .quantity(new BigDecimal("10.00"))
                .price(new BigDecimal("300.00"))
                .stopLoss(new BigDecimal("290.00"))
                .takeProfit(new BigDecimal("330.00"))
                .sessionId(0L)
                .build();

        PreTradeRiskResponse res = preTradeRiskService.assessPreTradeRisk(1L, req);

        assertThat(res.getDecision()).isEqualTo("APPROVED");
        assertThat(res.getPotentialLoss()).isEqualByComparingTo(new BigDecimal("100.00")); // (300 - 290) * 10
        assertThat(res.getPotentialProfit()).isEqualByComparingTo(new BigDecimal("300.00")); // (330 - 300) * 10
        assertThat(res.getRiskRewardRatio()).isEqualByComparingTo(new BigDecimal("3.00")); // 300 / 100
        assertThat(res.getRejections()).isEmpty();
        assertThat(res.getWarnings()).isEmpty();
    }

    @Test
    @DisplayName("assessPreTradeRisk - BUY sans Stop-Loss renvoie WARNING")
    void assessPreTradeRisk_noStopLoss_returnsWarning() {
        PreTradeRiskRequest req = PreTradeRiskRequest.builder()
                .symbol("MSFT")
                .side("BUY")
                .quantity(new BigDecimal("5.00"))
                .price(new BigDecimal("300.00"))
                .sessionId(0L)
                .build();

        PreTradeRiskResponse res = preTradeRiskService.assessPreTradeRisk(1L, req);

        assertThat(res.getDecision()).isEqualTo("WARNING");
        assertThat(res.getWarnings()).anyMatch(w -> w.contains("Stop-Loss"));
        assertThat(res.getRejections()).isEmpty();
    }

    @Test
    @DisplayName("assessPreTradeRisk - liquidités insuffisantes renvoie REJECTED")
    void assessPreTradeRisk_insufficientCash_returnsRejected() {
        portfolio.setCashBalance(new BigDecimal("500.00")); // cash insuffisant pour 3,000

        PreTradeRiskRequest req = PreTradeRiskRequest.builder()
                .symbol("MSFT")
                .side("BUY")
                .quantity(new BigDecimal("10.00"))
                .price(new BigDecimal("300.00"))
                .sessionId(0L)
                .build();

        PreTradeRiskResponse res = preTradeRiskService.assessPreTradeRisk(1L, req);

        assertThat(res.getDecision()).isEqualTo("REJECTED");
        assertThat(res.getRejections()).anyMatch(r -> r.contains("Liquidités insuffisantes"));
    }

    @Test
    @DisplayName("assessPreTradeRisk - dépassement de la limite d'exposition par actif (20%) renvoie REJECTED")
    void assessPreTradeRisk_exceedsAssetExposure_returnsRejected() {
        // Equity ~ 101,500. Limite 20% = ~20,300.
        // On tente d'acheter 100 MSFT @ 300 = 30,000 (environ 29.5% de l'equity)
        PreTradeRiskRequest req = PreTradeRiskRequest.builder()
                .symbol("MSFT")
                .side("BUY")
                .quantity(new BigDecimal("100.00"))
                .price(new BigDecimal("300.00"))
                .sessionId(0L)
                .build();

        PreTradeRiskResponse res = preTradeRiskService.assessPreTradeRisk(1L, req);

        assertThat(res.getDecision()).isEqualTo("REJECTED");
        assertThat(res.getRejections()).anyMatch(r -> r.contains("limite d'exposition par actif"));
    }

    @Test
    @DisplayName("assessPreTradeRisk - risque par transaction excessif (> 2%) renvoie REJECTED")
    void assessPreTradeRisk_exceedsRiskPerTrade_returnsRejected() {
        // Equity ~ 101,500. Limite 2% = 2,030.
        // Achat de 50 actions MSFT @ 300 avec SL à 220 -> Perte = 50 * 80 = 4,000 (3.94% de l'equity)
        PreTradeRiskRequest req = PreTradeRiskRequest.builder()
                .symbol("MSFT")
                .side("BUY")
                .quantity(new BigDecimal("50.00"))
                .price(new BigDecimal("300.00"))
                .stopLoss(new BigDecimal("220.00"))
                .sessionId(0L)
                .build();

        PreTradeRiskResponse res = preTradeRiskService.assessPreTradeRisk(1L, req);

        assertThat(res.getDecision()).isEqualTo("REJECTED");
        assertThat(res.getRejections()).anyMatch(r -> r.contains("Risque par transaction excessif"));
    }

    @Test
    @DisplayName("assessPreTradeRisk - SELL d'une quantité supérieure à la position détenue renvoie REJECTED")
    void assessPreTradeRisk_oversell_returnsRejected() {
        PreTradeRiskRequest req = PreTradeRiskRequest.builder()
                .symbol("AAPL")
                .side("SELL")
                .quantity(new BigDecimal("25.00")) // possède seulement 10
                .price(new BigDecimal("150.00"))
                .sessionId(0L)
                .build();

        PreTradeRiskResponse res = preTradeRiskService.assessPreTradeRisk(1L, req);

        assertThat(res.getDecision()).isEqualTo("REJECTED");
        assertThat(res.getRejections()).anyMatch(r -> r.contains("Position insuffisante"));
    }

    @Test
    @DisplayName("validateOrderOrThrow - rejette l'ordre et lève RiskLimitBreachedException si la décision est REJECTED")
    void validateOrderOrThrow_whenRejected_throwsRiskLimitBreachedException() {
        portfolio.setCashBalance(new BigDecimal("100.00")); // insuffisant pour 10 AAPL @ 150 = 1500

        MarketOrderRequest orderReq = MarketOrderRequest.builder()
                .symbol("AAPL")
                .side("BUY")
                .quantity(new BigDecimal("10.00"))
                .build();

        assertThatThrownBy(() -> preTradeRiskService.validateOrderOrThrow(1L, orderReq, 0L, new BigDecimal("150.00")))
                .isInstanceOf(RiskLimitBreachedException.class)
                .hasMessageContaining("Ordre refusé");
    }

    @Test
    @DisplayName("updateRiskLimits - met à jour et persiste les limites correctement")
    void updateRiskLimits_valid_updatesAndSaves() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(riskLimitRepository.findByUserIdWithLock(1L)).thenReturn(Optional.empty());
        when(riskLimitRepository.save(any(RiskLimit.class))).thenAnswer(i -> i.getArgument(0));

        RiskLimitsDto newLimits = RiskLimitsDto.builder()
                .maxRiskPerTradePct(new BigDecimal("3.00"))
                .maxAssetExposurePct(new BigDecimal("25.00"))
                .maxSectorExposurePct(new BigDecimal("50.00"))
                .maxPortfolioExposurePct(new BigDecimal("120.00"))
                .build();

        RiskLimitsDto result = preTradeRiskService.updateRiskLimits(1L, newLimits);

        assertThat(result.getMaxRiskPerTradePct()).isEqualByComparingTo(new BigDecimal("3.00"));
        assertThat(result.getMaxAssetExposurePct()).isEqualByComparingTo(new BigDecimal("25.00"));
        assertThat(result.getMaxSectorExposurePct()).isEqualByComparingTo(new BigDecimal("50.00"));
        assertThat(result.getMaxPortfolioExposurePct()).isEqualByComparingTo(new BigDecimal("120.00"));
    }
}
