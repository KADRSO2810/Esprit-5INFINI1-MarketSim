package com.marketsimulator.service.market;

import com.marketsimulator.domain.MarketAsset;
import com.marketsimulator.domain.MarketQuote;
import com.marketsimulator.dto.MarketQuoteDto;
import com.marketsimulator.repository.MarketAssetRepository;
import com.marketsimulator.repository.MarketQuoteRepository;
import com.marketsimulator.service.StopLossTakeProfitService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.stream.Collectors;

@Slf4j
@Service
@EnableScheduling
public class MarketDataIngestionService {

    private final List<MarketDataProvider> marketDataProviders;
    private final MarketAssetRepository assetRepository;
    private final MarketQuoteRepository quoteRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final StopLossTakeProfitService slTpService;

    public MarketDataIngestionService(
            List<MarketDataProvider> marketDataProviders,
            MarketAssetRepository assetRepository,
            MarketQuoteRepository quoteRepository,
            SimpMessagingTemplate messagingTemplate,
            @Lazy StopLossTakeProfitService slTpService) {
        this.marketDataProviders = marketDataProviders;
        this.assetRepository = assetRepository;
        this.quoteRepository = quoteRepository;
        this.messagingTemplate = messagingTemplate;
        this.slTpService = slTpService;
    }

    @Value("${app.market.default-watchlist:AAPL,MSFT,TSLA,NVDA,AMZN}")
    private String defaultWatchlistConfig;

    private final Set<String> activeWatchlist = ConcurrentHashMap.newKeySet();
    private final Map<String, MarketQuoteDto> latestQuotes = new ConcurrentHashMap<>();
    private final Queue<MarketQuote> persistenceBuffer = new ConcurrentLinkedQueue<>();

    @PostConstruct
    public void init() {
        // Enregistrement du listener sur les cotations reçues de tous les providers
        for (MarketDataProvider provider : marketDataProviders) {
            provider.setQuoteListener(this::handleIncomingQuote);
        }

        // Chargement de la watchlist initiale
        List<String> initialSymbols = Arrays.stream(defaultWatchlistConfig.split(","))
                .map(String::trim)
                .map(String::toUpperCase)
                .filter(s -> !s.isBlank())
                .distinct()
                .toList();

        for (String sym : initialSymbols) {
            ensureAssetExists(sym);
            activeWatchlist.add(sym);

            // Pré-chargement immédiat du dernier cours officiel connu depuis MariaDB (indispensable hors séance NYSE)
            try {
                quoteRepository.findFirstBySymbolOrderByTsDesc(sym).ifPresent(q -> {
                    latestQuotes.put(sym, MarketQuoteDto.builder()
                            .symbol(q.getSymbol())
                            .price(q.getPrice())
                            .ts(q.getTs())
                            .source("DB_CLOSE")
                            .build());
                });
            } catch (Exception ex) {
                log.debug("[MARKET] Erreur pré-chargement quote pour {} : {}", sym, ex.getMessage());
            }

            for (MarketDataProvider provider : marketDataProviders) {
                provider.subscribe(sym);
            }
        }

        // Connexion aux flux de tous les providers (Finnhub & Binance)
        for (MarketDataProvider provider : marketDataProviders) {
            provider.connect();
        }
        log.info("[MARKET] Ingestion initialisée avec {} providers et la watchlist : {}", marketDataProviders.size(), activeWatchlist);
    }

    public void handleIncomingQuote(MarketQuoteDto quoteDto) {
        String symbol = quoteDto.getSymbol().toUpperCase();

        // 1. Mémorisation du dernier prix en cache mémoire pour accès instantané
        latestQuotes.put(symbol, quoteDto);

        // 2. Rebroadcast temps réel via WebSocket STOMP vers les clients connectés
        try {
            messagingTemplate.convertAndSend("/topic/quotes", quoteDto);
        } catch (Exception ex) {
            log.error("[STOMP] Échec d'envoi du quote pour {} : {}", symbol, ex.getMessage());
        }

        // 3. Ajout au tampon pour écriture batchée dans MariaDB
        MarketQuote entity = MarketQuote.builder()
                .symbol(symbol)
                .price(quoteDto.getPrice())
                .ts(quoteDto.getTs())
                .source(quoteDto.getSource())
                .build();
        persistenceBuffer.add(entity);

        // 4. Évaluation temps réel des niveaux Stop-Loss et Take-Profit
        try {
            slTpService.evaluateQuote(symbol, quoteDto.getPrice(), quoteDto.getTs());
        } catch (Exception ex) {
            log.error("[SL/TP EVAL] Erreur d'évaluation pour {} : {}", symbol, ex.getMessage());
        }
    }

    @Scheduled(fixedDelayString = "${app.market.batch-interval-ms:2000}")
    public void flushQuotesToDatabase() {
        if (persistenceBuffer.isEmpty()) {
            return;
        }

        List<MarketQuote> batch = new ArrayList<>();
        MarketQuote item;
        while ((item = persistenceBuffer.poll()) != null && batch.size() < 1000) {
            batch.add(item);
        }

        if (!batch.isEmpty()) {
            try {
                quoteRepository.saveAll(batch);
                log.debug("[MARKET] Batch de {} cotations persisté avec succès dans MariaDB", batch.size());
            } catch (Exception ex) {
                log.error("[MARKET] Erreur lors de la persistance batch en base de données : {}", ex.getMessage());
            }
        }
    }

    /** Returns the latest known quote for a symbol from the in-memory cache, or searches DB if none. */
    public MarketQuoteDto getLatestQuote(String symbol) {
        if (symbol == null || symbol.isBlank()) return null;
        String sym = symbol.trim().toUpperCase();
        MarketQuoteDto quote = latestQuotes.get(sym);
        if (quote == null && quoteRepository != null) {
            try {
                quote = quoteRepository.findFirstBySymbolOrderByTsDesc(sym)
                        .map(q -> MarketQuoteDto.builder()
                                .symbol(q.getSymbol())
                                .price(q.getPrice())
                                .ts(q.getTs())
                                .source("DB_CLOSE")
                                .build())
                        .orElse(null);
                if (quote != null) {
                    latestQuotes.put(sym, quote);
                }
            } catch (Exception ex) {
                log.debug("[MARKET] Erreur lookup DB pour quote {} : {}", sym, ex.getMessage());
            }
        }
        return quote;
    }

    public synchronized List<String> getWatchlist() {
        return activeWatchlist.stream().sorted().collect(Collectors.toList());
    }

    public synchronized List<String> updateWatchlist(List<String> newSymbols) {
        Set<String> targetSymbols = newSymbols.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .map(String::toUpperCase)
                .filter(s -> !s.isBlank())
                .collect(Collectors.toSet());

        // Identifier les symboles à supprimer
        Set<String> toRemove = new HashSet<>(activeWatchlist);
        toRemove.removeAll(targetSymbols);
        for (String sym : toRemove) {
            activeWatchlist.remove(sym);
            for (MarketDataProvider provider : marketDataProviders) {
                provider.unsubscribe(sym);
            }
        }

        // Identifier les symboles à ajouter
        Set<String> toAdd = new HashSet<>(targetSymbols);
        toAdd.removeAll(activeWatchlist);
        for (String sym : toAdd) {
            ensureAssetExists(sym);
            activeWatchlist.add(sym);
            for (MarketDataProvider provider : marketDataProviders) {
                provider.subscribe(sym);
            }
        }

        log.info("[MARKET] Watchlist mise à jour. Nouveaux symboles suivis : {}", activeWatchlist);
        return getWatchlist();
    }

    public List<MarketQuoteDto> getLastQuotes() {
        List<MarketQuoteDto> result = new ArrayList<>();
        for (String symbol : activeWatchlist) {
            MarketQuoteDto quote = latestQuotes.get(symbol);
            if (quote == null) {
                // Recherche du dernier cours en base si pas encore reçu en mémoire
                quote = quoteRepository.findFirstBySymbolOrderByTsDesc(symbol)
                        .map(q -> MarketQuoteDto.builder()
                                .symbol(q.getSymbol())
                                .price(q.getPrice())
                                .ts(q.getTs())
                                .source(q.getSource())
                                .build())
                        .orElse(null);
            }
            if (quote != null) {
                result.add(quote);
            }
        }
        return result;
    }

    public List<MarketQuoteDto> getRecentQuotes(String symbol, int limit) {
        String normalized = symbol.trim().toUpperCase();
        return quoteRepository.findBySymbolOrderByTsDesc(normalized, PageRequest.of(0, Math.min(limit, 100)))
                .stream()
                .map(q -> MarketQuoteDto.builder()
                        .symbol(q.getSymbol())
                        .price(q.getPrice())
                        .ts(q.getTs())
                        .source(q.getSource())
                        .build())
                .collect(Collectors.toList());
    }

    private void ensureAssetExists(String symbol) {
        if (!assetRepository.existsBySymbol(symbol)) {
            MarketAsset asset = MarketAsset.builder()
                    .symbol(symbol)
                    .name(symbol + " Stock")
                    .exchange("US")
                    .currency("USD")
                    .build();
            try {
                assetRepository.save(asset);
            } catch (Exception ignored) {
            }
        }
    }
}
