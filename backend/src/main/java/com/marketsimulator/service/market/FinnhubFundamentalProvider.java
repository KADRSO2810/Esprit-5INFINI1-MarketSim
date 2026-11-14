package com.marketsimulator.service.market;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Provider REST Finnhub pour les données fondamentales, profils et états financiers SEC (10-K, 10-Q).
 * Intègre un cache mémoire thread-safe avec TTL (2 heures) pour respecter les rate-limits de Finnhub.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FinnhubFundamentalProvider {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.finnhub.api-key:db6bck9r01qmd5lj8b6gdb6bck9r01qmd5lj8b70}")
    private String apiKey;

    private static final String FINNHUB_BASE = "https://finnhub.io/api/v1";
    private static final long CACHE_TTL_SECONDS = 7200; // 2 heures de validité

    // Cache structure
    private static class CacheEntry {
        final JsonNode data;
        final Instant timestamp;

        CacheEntry(JsonNode data) {
            this.data = data;
            this.timestamp = Instant.now();
        }

        boolean isExpired() {
            return Instant.now().isAfter(timestamp.plusSeconds(CACHE_TTL_SECONDS));
        }
    }

    private final Map<String, CacheEntry> profileCache = new ConcurrentHashMap<>();
    private final Map<String, CacheEntry> metricsCache = new ConcurrentHashMap<>();
    private final Map<String, CacheEntry> annualFinancialsCache = new ConcurrentHashMap<>();
    private final Map<String, CacheEntry> quarterlyFinancialsCache = new ConcurrentHashMap<>();

    public boolean isCrypto(String rawSymbol) {
        if (rawSymbol == null) return false;
        String s = rawSymbol.toUpperCase().trim();
        return s.startsWith("BINANCE:") || s.contains("USDT") || s.contains("BTC") || s.contains("ETH") || s.contains("SOL") && s.contains(":");
    }

    /**
     * Récupère le profil d'entreprise (/stock/profile2).
     */
    public Optional<JsonNode> getCompanyProfile(String rawSymbol) {
        if (rawSymbol == null || isCrypto(rawSymbol)) {
            return Optional.empty();
        }
        String symbol = rawSymbol.toUpperCase().trim();
        CacheEntry cached = profileCache.get(symbol);
        if (cached != null && !cached.isExpired()) {
            return Optional.of(cached.data);
        }

        try {
            String url = String.format("%s/stock/profile2?symbol=%s&token=%s", FINNHUB_BASE, symbol, apiKey);
            String response = restTemplate.getForObject(url, String.class);
            if (response != null && !response.trim().isEmpty() && !response.equals("{}")) {
                JsonNode node = objectMapper.readTree(response);
                if (node.has("name") && !node.get("name").asText().isEmpty()) {
                    profileCache.put(symbol, new CacheEntry(node));
                    return Optional.of(node);
                }
            }
        } catch (Exception e) {
            log.warn("[FINNHUB] Échec de récupération du profil pour {} : {}", symbol, e.getMessage());
        }
        return Optional.empty();
    }

    /**
     * Récupère l'ensemble des ratios financiers et métriques (/stock/metric?metric=all).
     */
    public Optional<JsonNode> getFinancialMetrics(String rawSymbol) {
        if (rawSymbol == null || isCrypto(rawSymbol)) {
            return Optional.empty();
        }
        String symbol = rawSymbol.toUpperCase().trim();
        CacheEntry cached = metricsCache.get(symbol);
        if (cached != null && !cached.isExpired()) {
            return Optional.of(cached.data);
        }

        try {
            String url = String.format("%s/stock/metric?symbol=%s&metric=all&token=%s", FINNHUB_BASE, symbol, apiKey);
            String response = restTemplate.getForObject(url, String.class);
            if (response != null && !response.trim().isEmpty()) {
                JsonNode node = objectMapper.readTree(response);
                if (node.has("metric") && !node.get("metric").isEmpty()) {
                    metricsCache.put(symbol, new CacheEntry(node));
                    return Optional.of(node);
                }
            }
        } catch (Exception e) {
            log.warn("[FINNHUB] Échec de récupération des métriques pour {} : {}", symbol, e.getMessage());
        }
        return Optional.empty();
    }

    /**
     * Récupère les états financiers déclarés SEC (/stock/financials-reported?freq=annual ou quarterly).
     */
    public Optional<JsonNode> getFinancialsReported(String rawSymbol, boolean quarterly) {
        if (rawSymbol == null || isCrypto(rawSymbol)) {
            return Optional.empty();
        }
        String symbol = rawSymbol.toUpperCase().trim();
        String freq = quarterly ? "quarterly" : "annual";
        Map<String, CacheEntry> cache = quarterly ? quarterlyFinancialsCache : annualFinancialsCache;

        CacheEntry cached = cache.get(symbol);
        if (cached != null && !cached.isExpired()) {
            return Optional.of(cached.data);
        }

        try {
            String url = String.format("%s/stock/financials-reported?symbol=%s&freq=%s&token=%s",
                    FINNHUB_BASE, symbol, freq, apiKey);
            String response = restTemplate.getForObject(url, String.class);
            if (response != null && !response.trim().isEmpty()) {
                JsonNode node = objectMapper.readTree(response);
                if (node.has("data") && node.get("data").isArray() && !node.get("data").isEmpty()) {
                    cache.put(symbol, new CacheEntry(node));
                    return Optional.of(node);
                }
            }
        } catch (Exception e) {
            log.warn("[FINNHUB] Échec de récupération des états financiers ({}) pour {} : {}", freq, symbol, e.getMessage());
        }
        return Optional.empty();
    }

    public void clearCache() {
        profileCache.clear();
        metricsCache.clear();
        annualFinancialsCache.clear();
        quarterlyFinancialsCache.clear();
    }
}
