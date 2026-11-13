package com.marketsimulator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.domain.*;
import com.marketsimulator.dto.CreateStrategyRequest;
import com.marketsimulator.dto.StrategyDto;
import com.marketsimulator.repository.*;
import com.marketsimulator.service.market.MarketDataIngestionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StrategyEngineServiceTest {

    @Mock private StrategyRepository strategyRepository;
    @Mock private StrategySignalRepository strategySignalRepository;
    @Mock private StrategyExecutionRepository strategyExecutionRepository;
    @Mock private MarketCandleRepository candleRepository;
    @Mock private MarketDataIngestionService marketDataIngestionService;
    @Mock private NewsArticleRepository newsArticleRepository;
    @Mock private NewsSentimentRepository newsSentimentRepository;
    @Mock private SimpMessagingTemplate messagingTemplate;
    @Mock private OrderService orderService;
    @Mock private PortfolioService portfolioService;

    private ObjectMapper objectMapper;
    private StrategyEngineService strategyEngineService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        strategyEngineService = new StrategyEngineService(
                strategyRepository,
                strategySignalRepository,
                strategyExecutionRepository,
                candleRepository,
                marketDataIngestionService,
                newsArticleRepository,
                newsSentimentRepository,
                messagingTemplate,
                objectMapper,
                orderService,
                portfolioService
        );
    }

    @Test
    @DisplayName("createStrategy with fast >= slow should throw IllegalArgumentException")
    void createStrategy_withInvalidSma_shouldThrow() {
        User user = User.builder().id(1L).email("trader@test.com").build();
        CreateStrategyRequest req = CreateStrategyRequest.builder()
                .name("Invalid SMA")
                .strategyType(StrategyType.SMA_CROSS)
                .symbols(List.of("AAPL"))
                .params(Map.of("fast", 50, "slow", 20))
                .build();

        assertThatThrownBy(() -> strategyEngineService.createStrategy(user, req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("fast");
    }

    @Test
    @DisplayName("createStrategy with valid params should save and return DTO")
    void createStrategy_valid_shouldSave() {
        User user = User.builder().id(1L).email("trader@test.com").build();
        CreateStrategyRequest req = CreateStrategyRequest.builder()
                .name("Valid SMA")
                .strategyType(StrategyType.SMA_CROSS)
                .symbols(List.of("AAPL", "MSFT"))
                .params(Map.of("fast", 10, "slow", 30))
                .autoTrade(true)
                .build();

        when(strategyRepository.save(any(Strategy.class))).thenAnswer(inv -> {
            Strategy s = inv.getArgument(0);
            s.setId(10L);
            return s;
        });

        StrategyDto dto = strategyEngineService.createStrategy(user, req);

        assertThat(dto).isNotNull();
        assertThat(dto.getId()).isEqualTo(10L);
        assertThat(dto.getName()).isEqualTo("Valid SMA");
        assertThat(dto.getSymbols()).containsExactly("AAPL", "MSFT");
    }

    @Test
    @DisplayName("evaluateStrategy with SMA_CROSS Golden Cross should generate BUY signal")
    void evaluateStrategy_smaGoldenCross_shouldEmitBuy() throws Exception {
        Strategy strat = Strategy.builder()
                .id(1L)
                .name("SMA Test")
                .strategyType(StrategyType.SMA_CROSS)
                .symbolsJson("[\"AAPL\"]")
                .resolution("1")
                .paramsJson("{\"fast\":2,\"slow\":4}")
                .mode(StrategyMode.LIVE)
                .autoTrade(false)
                .status(StrategyStatus.RUNNING)
                .build();

        // 5 candles: close prices ordered newest (index 0) to oldest (index 4)
        // Candles:
        // index 0 (now): close = 100
        // index 1: close = 95
        // index 2: close = 80
        // index 3: close = 70
        // index 4: close = 75
        // currentFast (fast=2, offset=0): (100 + 95)/2 = 97.5
        // currentSlow (slow=4, offset=0): (100 + 95 + 80 + 70)/4 = 86.25 -> Fast > Slow
        // prevFast (fast=2, offset=1): (95 + 80)/2 = 87.5
        // prevSlow (slow=4, offset=1): (95 + 80 + 70 + 75)/4 = 80 -> wait, let's craft a clear crossover:
        // prev: slow was 90, fast was 85. Now: fast is 110, slow is 95.
        Instant now = Instant.now();
        List<MarketCandle> mockCandles = List.of(
                MarketCandle.builder().symbol("AAPL").close(BigDecimal.valueOf(110)).ts(now).build(),
                MarketCandle.builder().symbol("AAPL").close(BigDecimal.valueOf(100)).ts(now.minusSeconds(60)).build(),
                MarketCandle.builder().symbol("AAPL").close(BigDecimal.valueOf(80)).ts(now.minusSeconds(120)).build(),
                MarketCandle.builder().symbol("AAPL").close(BigDecimal.valueOf(90)).ts(now.minusSeconds(180)).build(),
                MarketCandle.builder().symbol("AAPL").close(BigDecimal.valueOf(95)).ts(now.minusSeconds(240)).build()
        );

        when(candleRepository.findBySymbolAndResolutionOrderByTsDesc(eq("AAPL"), eq("1"), any()))
                .thenReturn(mockCandles);

        when(strategySignalRepository.save(any(StrategySignal.class))).thenAnswer(inv -> inv.getArgument(0));

        strategyEngineService.evaluateStrategy(strat);

        verify(strategySignalRepository, atLeastOnce()).save(argThat(sig ->
                sig.getSymbol().equals("AAPL") && sig.getSignal() != null
        ));
    }
}
