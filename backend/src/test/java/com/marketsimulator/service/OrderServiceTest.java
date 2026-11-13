package com.marketsimulator.service;

import com.marketsimulator.domain.Portfolio;
import com.marketsimulator.domain.Position;
import com.marketsimulator.dto.MarketOrderRequest;
import com.marketsimulator.dto.MarketQuoteDto;
import com.marketsimulator.dto.OrderFillDto;
import com.marketsimulator.exception.InsufficientFundsException;
import com.marketsimulator.exception.InsufficientPositionException;
import com.marketsimulator.exception.NoRecentPriceException;
import com.marketsimulator.repository.PortfolioRepository;
import com.marketsimulator.repository.PositionRepository;
import com.marketsimulator.repository.TradeRepository;
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
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OrderServiceTest {

    @Mock private PortfolioRepository portfolioRepository;
    @Mock private PositionRepository positionRepository;
    @Mock private TradeRepository tradeRepository;
    @Mock private MarketDataIngestionService ingestionService;
    @Mock private PortfolioService portfolioService;
    @Mock private PreTradeRiskService preTradeRiskService;

    @InjectMocks
    private OrderService orderService;

    private Portfolio portfolio;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(orderService, "maxQuoteAgeSec", 30L);

        portfolio = Portfolio.builder()
                .id(1L)
                .cashBalance(new BigDecimal("100000.00"))
                .build();

        when(portfolioService.ensurePortfolio(anyLong())).thenReturn(portfolio);
        when(portfolioRepository.findByUserIdWithLock(anyLong())).thenReturn(Optional.of(portfolio));
    }

    // ── Fresh quote helper ────────────────────────────────────────────────────

    private MarketQuoteDto freshQuote(String symbol, double price) {
        return MarketQuoteDto.builder()
                .symbol(symbol)
                .price(new BigDecimal(price))
                .ts(Instant.now())
                .source("FINNHUB")
                .build();
    }

    private MarketOrderRequest orderRequest(String symbol, String side, double qty) {
        MarketOrderRequest req = new MarketOrderRequest();
        req.setSymbol(symbol);
        req.setSide(side);
        req.setQuantity(new BigDecimal(qty));
        return req;
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("BUY - should fill when sufficient cash")
    void buy_sufficientCash_shouldFill() {
        when(ingestionService.getLatestQuote("AAPL")).thenReturn(freshQuote("AAPL", 190.0));
        when(positionRepository.findByPortfolioIdAndSymbol(any(), eq("AAPL"))).thenReturn(Optional.empty());
        when(portfolioRepository.save(any())).thenReturn(portfolio);
        when(positionRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(tradeRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        OrderFillDto fill = orderService.placeMarketOrder(1L, orderRequest("AAPL", "BUY", 10));

        assertThat(fill.getStatus()).isEqualTo("FILLED");
        assertThat(fill.getSide()).isEqualTo("BUY");
        assertThat(fill.getCashAfter()).isEqualByComparingTo(new BigDecimal("98100.00"));
    }

    @Test
    @DisplayName("BUY - should reject when insufficient cash")
    void buy_insufficientCash_shouldThrow() {
        portfolio.setCashBalance(new BigDecimal("100.00"));
        when(ingestionService.getLatestQuote("AAPL")).thenReturn(freshQuote("AAPL", 190.0));

        assertThatThrownBy(() -> orderService.placeMarketOrder(1L, orderRequest("AAPL", "BUY", 10)))
                .isInstanceOf(InsufficientFundsException.class)
                .hasMessageContaining("Insufficient cash");
    }

    @Test
    @DisplayName("SELL - should reject when selling more than position")
    void sell_moreThanPosition_shouldThrow() {
        when(ingestionService.getLatestQuote("AAPL")).thenReturn(freshQuote("AAPL", 190.0));
        Position pos = Position.builder().portfolio(portfolio).symbol("AAPL")
                .quantity(new BigDecimal("5")).avgPrice(new BigDecimal("180")).build();
        when(positionRepository.findByPortfolioIdAndSymbolWithLock(any(), eq("AAPL"))).thenReturn(Optional.of(pos));
        when(positionRepository.findByPortfolioIdAndSymbol(any(), eq("AAPL"))).thenReturn(Optional.of(pos));

        assertThatThrownBy(() -> orderService.placeMarketOrder(1L, orderRequest("AAPL", "SELL", 10)))
                .isInstanceOf(InsufficientPositionException.class);
    }

    @Test
    @DisplayName("BUY then SELL - cash and position should update correctly")
    void buyThenSell_cashAndPositionUpdated() {
        // BUY 10 @ 190
        when(ingestionService.getLatestQuote("AAPL")).thenReturn(freshQuote("AAPL", 190.0));
        when(positionRepository.findByPortfolioIdAndSymbol(any(), eq("AAPL"))).thenReturn(Optional.empty());
        when(portfolioRepository.save(any())).thenReturn(portfolio);
        when(positionRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(tradeRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        orderService.placeMarketOrder(1L, orderRequest("AAPL", "BUY", 10));
        assertThat(portfolio.getCashBalance()).isEqualByComparingTo(new BigDecimal("98100.00"));

        // SELL 5 @ 200 (profit)
        Position pos = Position.builder().portfolio(portfolio).symbol("AAPL")
                .quantity(new BigDecimal("10")).avgPrice(new BigDecimal("190")).build();
        when(ingestionService.getLatestQuote("AAPL")).thenReturn(freshQuote("AAPL", 200.0));
        when(positionRepository.findByPortfolioIdAndSymbolWithLock(any(), eq("AAPL"))).thenReturn(Optional.of(pos));
        when(positionRepository.findByPortfolioIdAndSymbol(any(), eq("AAPL"))).thenReturn(Optional.of(pos));

        OrderFillDto sellFill = orderService.placeMarketOrder(1L, orderRequest("AAPL", "SELL", 5));

        assertThat(sellFill.getRealizedPnl()).isEqualByComparingTo(new BigDecimal("50.000000")); // (200-190)*5
        // cash should have increased by 5*200 = 1000
        assertThat(portfolio.getCashBalance()).isEqualByComparingTo(new BigDecimal("99100.00"));
    }

    @Test
    @DisplayName("Order should reject when no recent price available")
    void order_noRecentPrice_shouldThrow() {
        when(ingestionService.getLatestQuote("UNKNOWN")).thenReturn(null);

        assertThatThrownBy(() -> orderService.placeMarketOrder(1L, orderRequest("UNKNOWN", "BUY", 1)))
                .isInstanceOf(NoRecentPriceException.class);
    }

    @Test
    @DisplayName("Order should reject when quote is stale")
    void order_stalePrice_shouldThrow() {
        MarketQuoteDto stale = MarketQuoteDto.builder()
                .symbol("AAPL")
                .price(new BigDecimal("190"))
                .ts(Instant.now().minusSeconds(60)) // 60s old, max is 30s
                .source("FINNHUB")
                .build();
        when(ingestionService.getLatestQuote("AAPL")).thenReturn(stale);

        assertThatThrownBy(() -> orderService.placeMarketOrder(1L, orderRequest("AAPL", "BUY", 1)))
                .isInstanceOf(NoRecentPriceException.class)
                .hasMessageContaining("stale");
    }

    @Test
    @DisplayName("BUY with Stop-Loss & Take-Profit should store levels on position")
    void buy_withSlTp_shouldStoreOnPosition() {
        when(ingestionService.getLatestQuote("AAPL")).thenReturn(freshQuote("AAPL", 150.0));
        when(positionRepository.findByPortfolioIdAndSymbol(any(), eq("AAPL"))).thenReturn(Optional.empty());
        when(portfolioRepository.save(any())).thenReturn(portfolio);
        when(positionRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(tradeRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        MarketOrderRequest req = orderRequest("AAPL", "BUY", 10);
        req.setStopLoss(new BigDecimal("140.00"));
        req.setTakeProfit(new BigDecimal("170.00"));

        OrderFillDto fill = orderService.placeMarketOrder(1L, req);

        assertThat(fill.getStatus()).isEqualTo("FILLED");
        assertThat(fill.getStopLoss()).isEqualByComparingTo(new BigDecimal("140.00"));
        assertThat(fill.getTakeProfit()).isEqualByComparingTo(new BigDecimal("170.00"));
        assertThat(fill.getTradeReason()).isEqualTo("MANUAL");
    }

    @Test
    @DisplayName("BUY with invalid Stop-Loss above execution price should throw")
    void buy_invalidSl_shouldThrow() {
        when(ingestionService.getLatestQuote("AAPL")).thenReturn(freshQuote("AAPL", 150.0));

        MarketOrderRequest req = orderRequest("AAPL", "BUY", 10);
        req.setStopLoss(new BigDecimal("160.00")); // above execution price 150

        assertThatThrownBy(() -> orderService.placeMarketOrder(1L, req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Stop-Loss");
    }

    @Test
    @DisplayName("executeSlTpOrder should execute simulated closure and record trade")
    void executeSlTpOrder_shouldClosePosition() {
        Position pos = Position.builder()
                .id(20L)
                .portfolio(portfolio)
                .symbol("AAPL")
                .quantity(new BigDecimal("10.000000"))
                .avgPrice(new BigDecimal("150.000000"))
                .stopLoss(new BigDecimal("140.000000"))
                .build();

        when(positionRepository.findByPortfolioIdAndSymbolWithLock(1L, "AAPL")).thenReturn(Optional.of(pos));
        when(portfolioRepository.save(any())).thenReturn(portfolio);
        when(tradeRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        OrderFillDto fill = orderService.executeSlTpOrder(
                1L, "AAPL", new BigDecimal("10.000000"), new BigDecimal("139.500000"), "STOP_LOSS", 0L
        );

        assertThat(fill.getStatus()).isEqualTo("FILLED");
        assertThat(fill.getSide()).isEqualTo("SELL");
        assertThat(fill.getTradeReason()).isEqualTo("STOP_LOSS");
        assertThat(fill.getRealizedPnl()).isEqualByComparingTo(new BigDecimal("-105.000000")); // (139.50 - 150) * 10
        verify(positionRepository).delete(pos);
    }

    @Test
    @DisplayName("placeMarketOrder should call preTradeRiskService and reject if risk limit breached")
    void placeMarketOrder_riskLimitBreached_throwsException() {
        when(ingestionService.getLatestQuote("AAPL")).thenReturn(MarketQuoteDto.builder()
                .symbol("AAPL")
                .price(new BigDecimal("150.00"))
                .ts(Instant.now())
                .build());

        MarketOrderRequest request = MarketOrderRequest.builder()
                .symbol("AAPL")
                .side("BUY")
                .quantity(new BigDecimal("10"))
                .build();

        doThrow(new com.marketsimulator.exception.RiskLimitBreachedException("Dépassement de la limite"))
                .when(preTradeRiskService).validateOrderOrThrow(eq(1L), eq(request), eq(0L), any());

        assertThatThrownBy(() -> orderService.placeMarketOrder(1L, request))
                .isInstanceOf(com.marketsimulator.exception.RiskLimitBreachedException.class)
                .hasMessageContaining("Dépassement de la limite");

        verify(tradeRepository, never()).save(any());
    }
}
