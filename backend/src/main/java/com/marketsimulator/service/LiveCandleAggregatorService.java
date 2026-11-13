package com.marketsimulator.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.domain.MarketCandle;
import com.marketsimulator.domain.MarketQuote;
import com.marketsimulator.domain.Strategy;
import com.marketsimulator.domain.StrategyStatus;
import com.marketsimulator.dto.MarketQuoteDto;
import com.marketsimulator.repository.MarketCandleRepository;
import com.marketsimulator.repository.MarketQuoteRepository;
import com.marketsimulator.repository.StrategyRepository;
import com.marketsimulator.service.market.MarketDataIngestionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class LiveCandleAggregatorService {

    private final MarketDataIngestionService marketDataIngestionService;
    private final MarketQuoteRepository quoteRepository;
    private final MarketCandleRepository candleRepository;
    private final StrategyRepository strategyRepository;
    private final ObjectMapper objectMapper;

    /**
     * Agrège les ticks reçus en bougies 1 minute toutes les 10 secondes.
     * Fournit une base stable aux indicateurs techniques sans consommer les quotas REST.
     */
    @Scheduled(fixedDelay = 10000)
    @Transactional
    public void aggregateLiveCandles() {
        Set<String> trackedSymbols = new HashSet<>(marketDataIngestionService.getWatchlist());

        // Ajouter les symboles des stratégies actives en mode LIVE
        try {
            List<Strategy> runningStrategies = strategyRepository.findByStatus(StrategyStatus.RUNNING);
            for (Strategy strat : runningStrategies) {
                if (strat.getSymbolsJson() != null && !strat.getSymbolsJson().isBlank()) {
                    List<String> syms = objectMapper.readValue(strat.getSymbolsJson(), new TypeReference<List<String>>() {});
                    trackedSymbols.addAll(syms);
                }
            }
        } catch (Exception e) {
            log.debug("Erreur lecture symboles stratégies : {}", e.getMessage());
        }

        if (trackedSymbols.isEmpty()) {
            return;
        }

        long currentSec = Instant.now().getEpochSecond();
        long currentMinuteStart = (currentSec / 60) * 60;
        long previousMinuteStart = currentMinuteStart - 60;

        // On agrège la minute précédente (fermée) et la minute courante (en cours)
        long[] buckets = new long[]{previousMinuteStart, currentMinuteStart};

        for (String rawSymbol : trackedSymbols) {
            String symbol = rawSymbol.trim().toUpperCase();
            for (long bucketSec : buckets) {
                Instant start = Instant.ofEpochSecond(bucketSec);
                Instant end = Instant.ofEpochSecond(bucketSec + 59);

                List<MarketQuote> quotes = quoteRepository.findBySymbolAndTsBetweenOrderByTsAsc(symbol, start, end);

                if (!quotes.isEmpty()) {
                    BigDecimal open = quotes.get(0).getPrice();
                    BigDecimal close = quotes.get(quotes.size() - 1).getPrice();
                    BigDecimal high = open;
                    BigDecimal low = open;

                    for (MarketQuote q : quotes) {
                        if (q.getPrice().compareTo(high) > 0) high = q.getPrice();
                        if (q.getPrice().compareTo(low) < 0) low = q.getPrice();
                    }

                    BigDecimal volume = BigDecimal.valueOf(quotes.size());
                    upsertCandle(symbol, "1", start, open, high, low, close, volume);

                } else if (bucketSec == currentMinuteStart) {
                    // Si pas de ticks en DB pour la minute courante, tenter le dernier prix du cache
                    MarketQuoteDto latest = marketDataIngestionService.getLatestQuote(symbol);
                    if (latest != null && latest.getPrice() != null) {
                        BigDecimal p = latest.getPrice();
                        upsertCandle(symbol, "1", start, p, p, p, p, BigDecimal.ONE);
                    }
                }
            }
        }
    }

    private void upsertCandle(String symbol, String resolution, Instant ts,
                              BigDecimal open, BigDecimal high, BigDecimal low, BigDecimal close, BigDecimal volume) {
        Optional<MarketCandle> existing = candleRepository.findBySymbolAndResolutionAndTs(symbol, resolution, ts);
        if (existing.isPresent()) {
            MarketCandle c = existing.get();
            if (high.compareTo(c.getHigh()) > 0) c.setHigh(high);
            if (low.compareTo(c.getLow()) < 0) c.setLow(low);
            c.setClose(close);
            c.setVolume(c.getVolume().add(volume));
            candleRepository.save(c);
        } else {
            MarketCandle c = MarketCandle.builder()
                    .symbol(symbol)
                    .resolution(resolution)
                    .ts(ts)
                    .open(open)
                    .high(high)
                    .low(low)
                    .close(close)
                    .volume(volume)
                    .build();
            candleRepository.save(c);
        }
    }
}
