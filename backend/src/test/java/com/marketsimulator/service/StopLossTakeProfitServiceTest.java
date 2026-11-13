package com.marketsimulator.service;

import com.marketsimulator.domain.Portfolio;
import com.marketsimulator.domain.Position;
import com.marketsimulator.domain.User;
import com.marketsimulator.dto.MarketQuoteDto;
import com.marketsimulator.dto.OrderFillDto;
import com.marketsimulator.dto.PositionDto;
import com.marketsimulator.dto.SlTpTriggerEvent;
import com.marketsimulator.exception.InsufficientPositionException;
import com.marketsimulator.repository.PortfolioRepository;
import com.marketsimulator.repository.PositionRepository;
import com.marketsimulator.service.market.MarketDataIngestionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StopLossTakeProfitServiceTest {

    @Mock private PositionRepository positionRepository;
    @Mock private PortfolioRepository portfolioRepository;
    @Mock private MarketDataIngestionService ingestionService;
    @Mock private SimpMessagingTemplate messagingTemplate;
    @Mock private OrderService orderService;
    @Mock private PortfolioService portfolioService;

    @InjectMocks
    private StopLossTakeProfitService slTpService;

    private User user;
    private Portfolio portfolio;
    private Position position;

    @BeforeEach
    void setUp() {
        user = User.builder().id(42L).email("trader@marketsim.com").build();
        portfolio = Portfolio.builder().id(10L).user(user).sessionId(0L).cashBalance(new BigDecimal("50000.00")).build();
        position = Position.builder()
                .id(100L)
                .portfolio(portfolio)
                .symbol("AAPL")
                .quantity(new BigDecimal("10.000000"))
                .avgPrice(new BigDecimal("150.000000"))
                .build();

        when(portfolioRepository.findByUserIdWithLock(42L)).thenReturn(Optional.of(portfolio));
        when(positionRepository.findByPortfolioIdAndSymbolWithLock(10L, "AAPL")).thenReturn(Optional.of(position));
        when(ingestionService.getLatestQuote("AAPL")).thenReturn(MarketQuoteDto.builder()
                .symbol("AAPL")
                .price(new BigDecimal("155.000000"))
                .ts(Instant.now())
                .build());
    }

    @Test
    @DisplayName("updateSlTp - valid SL and TP should update position and calculate risk/reward")
    void updateSlTp_validLong_shouldSave() {
        BigDecimal sl = new BigDecimal("140.000000"); // below market 155
        BigDecimal tp = new BigDecimal("170.000000"); // above market 155

        PositionDto result = slTpService.updateSlTp(42L, "AAPL", sl, tp, 0L);

        assertThat(position.getStopLoss()).isEqualByComparingTo(sl);
        assertThat(position.getTakeProfit()).isEqualByComparingTo(tp);
        verify(positionRepository).save(position);

        assertThat(result.getSlTpStatus()).isEqualTo("ACTIVE");
        assertThat(result.getPotentialLoss()).isEqualByComparingTo(new BigDecimal("100.00")); // (150 - 140) * 10
        assertThat(result.getPotentialProfit()).isEqualByComparingTo(new BigDecimal("200.00")); // (170 - 150) * 10
        assertThat(result.getRiskRewardRatio()).isEqualByComparingTo(new BigDecimal("2.00")); // 200 / 100
    }

    @Test
    @DisplayName("updateSlTp - SL >= current market price should throw")
    void updateSlTp_invalidSlAboveMarket_shouldThrow() {
        BigDecimal sl = new BigDecimal("160.000000"); // market is 155
        BigDecimal tp = new BigDecimal("180.000000");

        assertThatThrownBy(() -> slTpService.updateSlTp(42L, "AAPL", sl, tp, 0L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Stop-Loss");
    }

    @Test
    @DisplayName("updateSlTp - TP <= current market price should throw")
    void updateSlTp_invalidTpBelowMarket_shouldThrow() {
        BigDecimal sl = new BigDecimal("140.000000");
        BigDecimal tp = new BigDecimal("150.000000"); // market is 155

        assertThatThrownBy(() -> slTpService.updateSlTp(42L, "AAPL", sl, tp, 0L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Take-Profit");
    }

    @Test
    @DisplayName("updateSlTp - SL >= TP should throw")
    void updateSlTp_slGreaterThanTp_shouldThrow() {
        BigDecimal sl = new BigDecimal("150.000000");
        BigDecimal tp = new BigDecimal("140.000000");

        assertThatThrownBy(() -> slTpService.updateSlTp(42L, "AAPL", sl, tp, 0L))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("removeSlTp - should clear SL and TP levels")
    void removeSlTp_shouldClearLevels() {
        position.setStopLoss(new BigDecimal("140.00"));
        position.setTakeProfit(new BigDecimal("170.00"));

        PositionDto result = slTpService.removeSlTp(42L, "AAPL", 0L);

        assertThat(position.getStopLoss()).isNull();
        assertThat(position.getTakeProfit()).isNull();
        assertThat(result.getSlTpStatus()).isEqualTo("NONE");
        verify(positionRepository).save(position);
    }

    @Test
    @DisplayName("evaluateQuote - Stop-Loss triggered when market price drops to SL level")
    void evaluateQuote_stopLossTriggered() {
        position.setStopLoss(new BigDecimal("145.000000"));
        position.setTakeProfit(new BigDecimal("180.000000"));

        when(positionRepository.findActiveWithSlTpBySymbol("AAPL")).thenReturn(List.of(position));
        when(positionRepository.findByIdWithLock(100L)).thenReturn(Optional.of(position));

        when(orderService.executeSlTpOrder(eq(42L), eq("AAPL"), eq(new BigDecimal("10.000000")), any(), eq("STOP_LOSS"), eq(0L)))
                .thenReturn(OrderFillDto.builder()
                        .status("FILLED")
                        .symbol("AAPL")
                        .side("SELL")
                        .quantity(new BigDecimal("10.000000"))
                        .price(new BigDecimal("144.500000"))
                        .realizedPnl(new BigDecimal("-55.000000"))
                        .cashAfter(new BigDecimal("51445.00"))
                        .tradeReason("STOP_LOSS")
                        .build());

        // Market tick breaches SL (price drops to 144.50)
        slTpService.evaluateQuote("AAPL", new BigDecimal("144.500000"), Instant.now());

        verify(orderService).executeSlTpOrder(eq(42L), eq("AAPL"), eq(new BigDecimal("10.000000")), eq(new BigDecimal("144.500000")), eq("STOP_LOSS"), eq(0L));

        ArgumentCaptor<SlTpTriggerEvent> eventCaptor = ArgumentCaptor.forClass(SlTpTriggerEvent.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/sl-tp-triggers"), eventCaptor.capture());
        SlTpTriggerEvent sent = eventCaptor.getValue();
        assertThat(sent.getTriggerType()).isEqualTo("STOP_LOSS");
        assertThat(sent.getSymbol()).isEqualTo("AAPL");
        assertThat(sent.getRealizedPnl()).isEqualByComparingTo(new BigDecimal("-55.000000"));
    }

    @Test
    @DisplayName("evaluateQuote - Take-Profit triggered when market price rises to TP level")
    void evaluateQuote_takeProfitTriggered() {
        position.setStopLoss(new BigDecimal("140.000000"));
        position.setTakeProfit(new BigDecimal("175.000000"));

        when(positionRepository.findActiveWithSlTpBySymbol("AAPL")).thenReturn(List.of(position));
        when(positionRepository.findByIdWithLock(100L)).thenReturn(Optional.of(position));

        when(orderService.executeSlTpOrder(eq(42L), eq("AAPL"), eq(new BigDecimal("10.000000")), any(), eq("TAKE_PROFIT"), eq(0L)))
                .thenReturn(OrderFillDto.builder()
                        .status("FILLED")
                        .symbol("AAPL")
                        .side("SELL")
                        .quantity(new BigDecimal("10.000000"))
                        .price(new BigDecimal("176.000000"))
                        .realizedPnl(new BigDecimal("260.000000"))
                        .cashAfter(new BigDecimal("51760.00"))
                        .tradeReason("TAKE_PROFIT")
                        .build());

        // Market tick rises to 176.00
        slTpService.evaluateQuote("AAPL", new BigDecimal("176.000000"), Instant.now());

        verify(orderService).executeSlTpOrder(eq(42L), eq("AAPL"), eq(new BigDecimal("10.000000")), eq(new BigDecimal("176.000000")), eq("TAKE_PROFIT"), eq(0L));
    }

    @Test
    @DisplayName("evaluateQuote - Price within SL and TP bounds should not trigger execution")
    void evaluateQuote_withinBounds_shouldNotTrigger() {
        position.setStopLoss(new BigDecimal("140.000000"));
        position.setTakeProfit(new BigDecimal("180.000000"));

        when(positionRepository.findActiveWithSlTpBySymbol("AAPL")).thenReturn(List.of(position));
        when(positionRepository.findByIdWithLock(100L)).thenReturn(Optional.of(position));

        slTpService.evaluateQuote("AAPL", new BigDecimal("160.000000"), Instant.now());

        verify(orderService, never()).executeSlTpOrder(any(), any(), any(), any(), any(), any());
        verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));
    }

    @Test
    @DisplayName("evaluateQuote - with PlatformTransactionManager should execute within transaction")
    void evaluateQuote_withTransactionManager_shouldExecuteInsideTransaction() {
        org.springframework.transaction.PlatformTransactionManager txManager = mock(org.springframework.transaction.PlatformTransactionManager.class);
        org.springframework.transaction.TransactionStatus txStatus = mock(org.springframework.transaction.TransactionStatus.class);
        when(txManager.getTransaction(any())).thenReturn(txStatus);

        StopLossTakeProfitService serviceWithTx = new StopLossTakeProfitService(
                positionRepository, portfolioRepository, ingestionService,
                messagingTemplate, orderService, portfolioService, txManager
        );

        position.setStopLoss(new BigDecimal("145.000000"));
        when(positionRepository.findActiveWithSlTpBySymbol("AAPL")).thenReturn(List.of(position));
        when(positionRepository.findByIdWithLock(100L)).thenReturn(Optional.of(position));
        when(orderService.executeSlTpOrder(any(), any(), any(), any(), any(), any()))
                .thenReturn(OrderFillDto.builder()
                        .status("FILLED")
                        .symbol("AAPL")
                        .side("SELL")
                        .quantity(new BigDecimal("10.000000"))
                        .price(new BigDecimal("144.000000"))
                        .realizedPnl(new BigDecimal("-60.000000"))
                        .cashAfter(new BigDecimal("51440.00"))
                        .tradeReason("STOP_LOSS")
                        .build());

        serviceWithTx.evaluateQuote("AAPL", new BigDecimal("144.000000"), Instant.now());

        verify(txManager).getTransaction(any());
        verify(txManager).commit(txStatus);
        verify(orderService).executeSlTpOrder(eq(42L), eq("AAPL"), eq(new BigDecimal("10.000000")), eq(new BigDecimal("144.000000")), eq("STOP_LOSS"), eq(0L));
        verify(messagingTemplate).convertAndSend(eq("/topic/sl-tp-triggers"), any(SlTpTriggerEvent.class));
    }
}
