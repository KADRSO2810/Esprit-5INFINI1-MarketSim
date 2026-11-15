package com.marketsimulator.service;

import com.marketsimulator.domain.LimitOrder;
import com.marketsimulator.dto.MarketOrderRequest;
import com.marketsimulator.dto.orderbook.OrderBookDto;
import com.marketsimulator.repository.LimitOrderRepository;
import com.marketsimulator.service.market.MarketDataIngestionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class OrderBookServiceTest {

    private LimitOrderRepository limitOrderRepo;
    private MarketDataIngestionService ingestionService;
    private OrderBookService orderBookService;

    @BeforeEach
    void setUp() {
        limitOrderRepo = mock(LimitOrderRepository.class);
        ingestionService = mock(MarketDataIngestionService.class);
        orderBookService = new OrderBookService(limitOrderRepo, ingestionService, null, null);
    }

    @Test
    @DisplayName("Devrait générer un carnet d'ordres L2 équilibré avec Bids, Asks et Spread")
    void shouldGenerateLevel2OrderBook() {
        when(limitOrderRepo.findBySymbolAndStatus("AAPL", "PENDING")).thenReturn(Collections.emptyList());

        OrderBookDto book = orderBookService.getOrderBook("AAPL");

        assertThat(book).isNotNull();
        assertThat(book.getSymbol()).isEqualTo("AAPL");
        assertThat(book.getAsks()).hasSize(12);
        assertThat(book.getBids()).hasSize(12);
        assertThat(book.getBestAsk()).isGreaterThan(book.getBestBid());
        assertThat(book.getSpread()).isPositive();
        assertThat(book.getTotalBidVolume()).isPositive();
        assertThat(book.getTotalAskVolume()).isPositive();
    }

    @Test
    @DisplayName("Devrait enregistrer un ordre limite PENDING dans le repository")
    void shouldPlaceLimitOrder() {
        MarketOrderRequest request = MarketOrderRequest.builder()
                .symbol("AAPL")
                .side("BUY")
                .quantity(BigDecimal.valueOf(10))
                .orderType("LIMIT")
                .limitPrice(BigDecimal.valueOf(145.50))
                .build();

        when(limitOrderRepo.save(any(LimitOrder.class))).thenAnswer(invocation -> invocation.getArgument(0));

        LimitOrder order = orderBookService.placeLimitOrder(1L, request, 0L);

        assertThat(order).isNotNull();
        assertThat(order.getSymbol()).isEqualTo("AAPL");
        assertThat(order.getSide()).isEqualTo("BUY");
        assertThat(order.getLimitPrice()).isEqualTo(BigDecimal.valueOf(145.50));
        assertThat(order.getStatus()).isEqualTo("PENDING");
    }
}
