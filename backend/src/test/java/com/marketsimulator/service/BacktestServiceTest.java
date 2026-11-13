package com.marketsimulator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.domain.BacktestEquityPoint;
import com.marketsimulator.domain.BacktestRun;
import com.marketsimulator.domain.BacktestTrade;
import com.marketsimulator.domain.MarketCandle;
import com.marketsimulator.domain.User;
import com.marketsimulator.repository.BacktestEquityPointRepository;
import com.marketsimulator.repository.BacktestRunRepository;
import com.marketsimulator.repository.BacktestTradeRepository;
import com.marketsimulator.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BacktestServiceTest {

    @Mock private BacktestRunRepository runRepository;
    @Mock private BacktestTradeRepository tradeRepository;
    @Mock private BacktestEquityPointRepository equityPointRepository;
    @Mock private UserRepository userRepository;
    @Mock private FinnhubCandleService candleService;
    @Spy private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private BacktestService backtestService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(backtestService, "feeBps", 0.0);
        ReflectionTestUtils.setField(backtestService, "maxWindowDays", 60L);
    }

    private MarketCandle createCandle(String symbol, Instant ts, double close) {
        BigDecimal p = BigDecimal.valueOf(close);
        return MarketCandle.builder()
                .symbol(symbol)
                .resolution("1")
                .ts(ts)
                .open(p)
                .high(p)
                .low(p)
                .close(p)
                .volume(BigDecimal.valueOf(1000))
                .build();
    }

    @Test
    @DisplayName("Simulate SMA Crossover: BUY triggers on bullish cross and SELL on bearish cross, equity points generated")
    void simulateSmaCrossover_shouldTriggerTradesAndGenerateEquityPoints() {
        User user = User.builder().id(1L).email("test@example.com").build();
        BacktestRun run = BacktestRun.builder()
                .id(100L)
                .user(user)
                .symbol("AAPL")
                .resolution("1")
                .initialCash(BigDecimal.valueOf(10000))
                .build();

        // Création d'une séquence de 15 bougies générant un croisement haussier puis baissier
        // fast = 2, slow = 4
        // Bougies: prix stables puis forte hausse (croisement haussier) puis forte baisse (croisement baissier)
        double[] prices = { 100, 100, 100, 100, 100, 110, 120, 130, 125, 110, 90, 80, 80, 80, 80 };
        List<MarketCandle> candles = new ArrayList<>();
        Instant baseTime = Instant.now().minusSeconds(15 * 60);

        for (int i = 0; i < prices.length; i++) {
            candles.add(createCandle("AAPL", baseTime.plusSeconds(i * 60), prices[i]));
        }

        backtestService.simulateSmaCrossover(run, candles, 2, 4);

        // Vérification des trades exécutés
        ArgumentCaptor<List<BacktestTrade>> tradesCaptor = ArgumentCaptor.forClass(List.class);
        verify(tradeRepository, atLeastOnce()).saveAll(tradesCaptor.capture());
        List<BacktestTrade> capturedTrades = tradesCaptor.getValue();

        assertThat(capturedTrades).isNotEmpty();
        assertThat(capturedTrades.get(0).getSide()).isEqualTo("BUY");
        assertThat(capturedTrades.stream().anyMatch(t -> "SELL".equals(t.getSide()))).isTrue();

        // Vérification des points d'equity générés (1 par bougie)
        ArgumentCaptor<List<BacktestEquityPoint>> equityCaptor = ArgumentCaptor.forClass(List.class);
        verify(equityPointRepository, atLeastOnce()).saveAll(equityCaptor.capture());
        List<BacktestEquityPoint> capturedPoints = equityCaptor.getValue();

        assertThat(capturedPoints).hasSize(candles.size());

        // Vérification des métriques calculées
        assertThat(run.getTotalReturn()).isNotNull();
        assertThat(run.getMaxDrawdown()).isNotNull();
        assertThat(run.getTradesCount()).isEqualTo(capturedTrades.size());
    }
}
