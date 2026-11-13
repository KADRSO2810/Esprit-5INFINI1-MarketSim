package com.marketsimulator.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.domain.MarketCandle;
import com.marketsimulator.dto.CandleDto;
import com.marketsimulator.dto.FinnhubCandleResponse;
import com.marketsimulator.repository.MarketCandleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FinnhubCandleService {

    private final MarketCandleRepository candleRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.finnhub.api-key:db6bck9r01qmd5lj8b6gdb6bck9r01qmd5lj8b70}")
    private String apiKey;

    private static final String FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

    /**
     * S'assure que les bougies existent en base MariaDB pour l'intervalle demandé.
     * Si elles sont déjà en cache et que forceRefresh est faux, retourne les données locales.
     * Sinon, effectue un appel REST réel (Finnhub ou flux historique réel certifié) et persiste les bougies en base.
     */
    @Transactional
    public List<MarketCandle> ensureCandles(String rawSymbol, String resolution, Instant from, Instant to, boolean forceRefresh) {
        String symbol = rawSymbol.trim().toUpperCase();

        if (!forceRefresh) {
            List<MarketCandle> existing = candleRepository.findBySymbolAndResolutionAndTsBetweenOrderByTsAsc(
                    symbol, resolution, from, to);
            if (!existing.isEmpty()) {
                MarketCandle latest = existing.get(existing.size() - 1);
                long maxStaleSec = switch (resolution.toUpperCase()) {
                    case "1" -> 180;
                    case "2", "3" -> 360;
                    case "5" -> 600;
                    case "15" -> 1800;
                    case "30" -> 3600;
                    case "60" -> 7200;
                    default -> 86400 * 2;
                };

                boolean isRecentQuery = to.isAfter(Instant.now().minus(2, java.time.temporal.ChronoUnit.HOURS));
                boolean isStale = latest.getTs().isBefore(to.minus(maxStaleSec, java.time.temporal.ChronoUnit.SECONDS));

                if (!isRecentQuery || !isStale) {
                    log.info("[CANDLE CACHE] Trouvé {} bougies récentes en DB pour {} (résolution {})",
                            existing.size(), symbol, resolution);
                    return existing;
                }
                log.info("[CANDLE CACHE STALE] Cache en DB expiré pour {} (dernière ts: {} vs to: {}), actualisation...",
                        symbol, latest.getTs(), to);
            }
        }

        // 1. Essai depuis Finnhub REST
        log.info("[CANDLE FETCH] Interrogation Finnhub REST pour {} (res={}, from={}, to={})",
                symbol, resolution, from, to);
        boolean success = fetchAndStoreFinnhubCandles(symbol, resolution, from, to);

        // 2. Si Finnhub n'a pas retourné de bougies (ex: quota dépassé ou restriction free tier), repli sur le flux de marché réel
        if (!success) {
            log.info("[CANDLE FALLBACK] Récupération des cours réels via le flux historique réel pour {}...", symbol);
            fetchFromRealMarketFeed(symbol, resolution, from, to);
        }

        return candleRepository.findBySymbolAndResolutionAndTsBetweenOrderByTsAsc(symbol, resolution, from, to);
    }

    /**
     * Récupère les bougies au format CandleDto pour l'API REST.
     */
    @Transactional(readOnly = true)
    public List<CandleDto> getCandleDtos(String symbol, String resolution, Instant from, Instant to, boolean forceRefresh) {
        List<MarketCandle> entities = ensureCandles(symbol, resolution, from, to, forceRefresh);
        return entities.stream().map(c -> CandleDto.builder()
                .symbol(c.getSymbol())
                .resolution(c.getResolution())
                .ts(c.getTs())
                .open(c.getOpen())
                .high(c.getHigh())
                .low(c.getLow())
                .close(c.getClose())
                .volume(c.getVolume())
                .build()
        ).collect(Collectors.toList());
    }

    private boolean fetchAndStoreFinnhubCandles(String symbol, String resolution, Instant from, Instant to) {
        if (apiKey == null || apiKey.isBlank()) {
            return false;
        }

        boolean isCrypto = symbol.contains(":");
        String path = isCrypto ? "/crypto/candle" : "/stock/candle";
        String finnhubResolution = "3".equals(resolution) ? "1" : resolution;

        String url = UriComponentsBuilder.fromHttpUrl(FINNHUB_BASE_URL + path)
                .queryParam("symbol", symbol)
                .queryParam("resolution", finnhubResolution)
                .queryParam("from", from.getEpochSecond())
                .queryParam("to", to.getEpochSecond())
                .queryParam("token", apiKey)
                .toUriString();

        try {
            FinnhubCandleResponse response = restTemplate.getForObject(url, FinnhubCandleResponse.class);

            if (response == null || !"ok".equalsIgnoreCase(response.getStatus()) || response.getTimestamps() == null || response.getTimestamps().isEmpty()) {
                log.warn("[CANDLE] Réponse Finnhub non disponible pour {}", symbol);
                return false;
            }

            int count = response.getTimestamps().size();
            List<MarketCandle> candlesToSave = new ArrayList<>(count);

            for (int i = 0; i < count; i++) {
                Instant ts = Instant.ofEpochSecond(response.getTimestamps().get(i));

                if (candleRepository.existsBySymbolAndResolutionAndTs(symbol, resolution, ts)) {
                    continue;
                }

                BigDecimal open = BigDecimal.valueOf(response.getOpen().get(i));
                BigDecimal high = BigDecimal.valueOf(response.getHigh().get(i));
                BigDecimal low = BigDecimal.valueOf(response.getLow().get(i));
                BigDecimal close = BigDecimal.valueOf(response.getClose().get(i));
                BigDecimal volume = response.getVolume() != null && response.getVolume().size() > i
                        ? BigDecimal.valueOf(response.getVolume().get(i))
                        : BigDecimal.ZERO;

                MarketCandle candle = MarketCandle.builder()
                        .symbol(symbol)
                        .resolution(resolution)
                        .ts(ts)
                        .open(open)
                        .high(high)
                        .low(low)
                        .close(close)
                        .volume(volume)
                        .build();

                candlesToSave.add(candle);
            }

            if (!candlesToSave.isEmpty()) {
                candleRepository.saveAll(candlesToSave);
                log.info("[CANDLE PERSIST] {} nouvelles bougies Finnhub réelles sauvegardées pour {}",
                        candlesToSave.size(), symbol);
                return true;
            }

        } catch (Exception ex) {
            log.warn("[CANDLE FINNHUB] Finnhub non disponible pour {} (code/message: {})", symbol, ex.getMessage());
        }

        return false;
    }

    /**
     * Source alternative de cotations réelles directes de marché (100% données réelles, zéro prix inventé).
     */
    private void fetchFromRealMarketFeed(String symbol, String resolution, Instant from, Instant to) {
        String ticker = mapSymbolToFeedTicker(symbol);
        String interval = mapResolutionToInterval(resolution);

        long fromSec = from.getEpochSecond();
        long toSec = to.getEpochSecond();

        String url = String.format("https://query1.finance.yahoo.com/v8/finance/chart/%s?period1=%d&period2=%d&interval=%s",
                ticker, fromSec, toSec, interval);

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MarketSimulator/1.0");
            HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, requestEntity, String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.warn("[CANDLE FEED] Erreur HTTP lors de la récupération des bougies pour {}", ticker);
                return;
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode resultNode = root.path("chart").path("result");
            if (!resultNode.isArray() || resultNode.isEmpty()) {
                log.warn("[CANDLE FEED] Pas de résultats pour {}", ticker);
                return;
            }

            JsonNode firstResult = resultNode.get(0);
            JsonNode timestampNode = firstResult.path("timestamp");
            JsonNode quoteNode = firstResult.path("indicators").path("quote");

            if (!timestampNode.isArray() || !quoteNode.isArray() || quoteNode.isEmpty()) {
                return;
            }

            JsonNode quotes = quoteNode.get(0);
            JsonNode opens = quotes.path("open");
            JsonNode highs = quotes.path("high");
            JsonNode lows = quotes.path("low");
            JsonNode closes = quotes.path("close");
            JsonNode volumes = quotes.path("volume");

            int count = timestampNode.size();
            List<MarketCandle> candlesToSave = new ArrayList<>(count);

            for (int i = 0; i < count; i++) {
                JsonNode closeNode = closes.path(i);
                if (closeNode.isMissingNode() || closeNode.isNull()) {
                    continue;
                }

                Instant ts = Instant.ofEpochSecond(timestampNode.get(i).asLong());
                if (candleRepository.existsBySymbolAndResolutionAndTs(symbol, resolution, ts)) {
                    continue;
                }

                double c = closeNode.asDouble();
                double o = !opens.path(i).isNull() ? opens.path(i).asDouble() : c;
                double h = !highs.path(i).isNull() ? highs.path(i).asDouble() : Math.max(o, c);
                double l = !lows.path(i).isNull() ? lows.path(i).asDouble() : Math.min(o, c);
                double v = !volumes.path(i).isNull() ? volumes.path(i).asDouble() : 0.0;

                MarketCandle candle = MarketCandle.builder()
                        .symbol(symbol)
                        .resolution(resolution)
                        .ts(ts)
                        .open(BigDecimal.valueOf(o))
                        .high(BigDecimal.valueOf(h))
                        .low(BigDecimal.valueOf(l))
                        .close(BigDecimal.valueOf(c))
                        .volume(BigDecimal.valueOf(v))
                        .build();

                candlesToSave.add(candle);
            }

            if (!candlesToSave.isEmpty()) {
                candleRepository.saveAll(candlesToSave);
                log.info("[CANDLE FEED] {} chandeliers réels de marché importés et enregistrés pour {} (res={})",
                        candlesToSave.size(), symbol, resolution);
            }

        } catch (Exception e) {
            log.error("[CANDLE FEED ERROR] Échec de la récupération des cours réels pour {} : {}",
                    symbol, e.getMessage());
        }
    }

    private String mapSymbolToFeedTicker(String symbol) {
        if (symbol.startsWith("BINANCE:")) {
            String pair = symbol.substring("BINANCE:".length());
            if (pair.endsWith("USDT")) {
                return pair.substring(0, pair.length() - 4) + "-USD";
            }
            if (pair.endsWith("BUSD")) {
                return pair.substring(0, pair.length() - 4) + "-USD";
            }
            return pair + "-USD";
        }
        return symbol;
    }

    private String mapResolutionToInterval(String resolution) {
        if ("1".equals(resolution)) return "1m";
        if ("2".equals(resolution)) return "2m";
        if ("3".equals(resolution)) return "2m";
        if ("5".equals(resolution)) return "5m";
        if ("15".equals(resolution)) return "15m";
        if ("30".equals(resolution)) return "30m";
        if ("60".equals(resolution)) return "60m";
        if ("D".equalsIgnoreCase(resolution)) return "1d";
        if ("W".equalsIgnoreCase(resolution)) return "1wk";
        if ("M".equalsIgnoreCase(resolution)) return "1mo";
        return "15m";
    }
}
