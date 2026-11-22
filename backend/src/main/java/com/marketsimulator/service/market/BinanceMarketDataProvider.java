package com.marketsimulator.service.market;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.dto.MarketQuoteDto;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;

/**
 * Fournisseur de données de marché officiel Binance 24/7/365.
 * Combine WebSocket direct (flux ultra-rapide @trade et @miniTicker)
 * et un poller REST haute résilience (fallback toutes les 2.5s)
 * garantissant que 100% des cryptomonnaies (SOL, BTC, ETH, MATIC, AVAX, etc.)
 * s'actualisent continuellement sans aucune interruption.
 */
@Slf4j
@Component
public class BinanceMarketDataProvider implements MarketDataProvider {

    private final String wsBaseUrl;
    private final String restBaseUrl;
    private final ObjectMapper objectMapper;
    private final Set<String> subscribedCryptoPairs = ConcurrentHashMap.newKeySet();
    private final Map<String, String> pairToAppSymbol = new ConcurrentHashMap<>();
    private final ScheduledExecutorService reconnectExecutor = Executors.newSingleThreadScheduledExecutor();

    private volatile WebSocket webSocket;
    private volatile boolean isRunning = false;
    private volatile boolean isConnected = false;
    private Consumer<MarketQuoteDto> quoteListener;

    private int reconnectAttempts = 0;
    private static final int MAX_RECONNECT_DELAY_SECONDS = 15;
    private final HttpClient httpClient;

    public BinanceMarketDataProvider(
            @Value("${app.binance.ws-url:wss://stream.binance.com:9443/ws}") String wsBaseUrl,
            @Value("${app.binance.rest-url:https://api.binance.com/api/v3}") String restBaseUrl) {
        this.wsBaseUrl = wsBaseUrl;
        this.restBaseUrl = restBaseUrl;
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(6))
                .build();
    }

    @Override
    public void setQuoteListener(Consumer<MarketQuoteDto> listener) {
        this.quoteListener = listener;
    }

    @Override
    public synchronized void connect() {
        isRunning = true;
        establishConnection();
    }

    private synchronized void establishConnection() {
        if (!isRunning) return;

        try {
            log.info("[BINANCE] Tentative de connexion WebSocket à {}...", wsBaseUrl);

            httpClient.newWebSocketBuilder()
                    .connectTimeout(Duration.ofSeconds(10))
                    .buildAsync(URI.create(wsBaseUrl), new BinanceWebSocketListener())
                    .thenAccept(ws -> {
                        this.webSocket = ws;
                        this.isConnected = true;
                        this.reconnectAttempts = 0;
                        log.info("[BINANCE] Connexion WebSocket établie avec succès (Flux 24/7 actif) !");

                        // Souscription immédiate à toutes les paires cryptos suivies
                        sendBatchSubscribe(ws, subscribedCryptoPairs);
                    })
                    .exceptionally(ex -> {
                        log.warn("[BINANCE] Échec de connexion WebSocket : {}. Le poller REST assure la continuité 24/7.", ex.getMessage());
                        scheduleReconnect();
                        return null;
                    });
        } catch (Exception ex) {
            log.warn("[BINANCE] Erreur initialisation WebSocket : {}. Bascule sur REST polling.", ex.getMessage());
            scheduleReconnect();
        }
    }

    private void scheduleReconnect() {
        if (!isRunning) return;

        isConnected = false;
        reconnectAttempts++;
        long delay = Math.min((long) Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY_SECONDS);
        log.info("[BINANCE] Reconnexion WebSocket planifiée dans {} secondes (tentative #{})", delay, reconnectAttempts);

        reconnectExecutor.schedule(this::establishConnection, delay, TimeUnit.SECONDS);
    }

    @Override
    public synchronized void disconnect() {
        isRunning = false;
        isConnected = false;
        if (webSocket != null) {
            try {
                webSocket.sendClose(WebSocket.NORMAL_CLOSURE, "Arrêt du service Binance");
            } catch (Exception ignored) {
            }
        }
    }

    @Override
    public void subscribe(String symbol) {
        if (symbol == null || symbol.isBlank()) return;
        String normalized = symbol.trim().toUpperCase();
        if (!isCrypto(normalized)) {
            return;
        }

        String rawPair = extractRawPair(normalized);
        subscribedCryptoPairs.add(rawPair);
        pairToAppSymbol.put(rawPair, normalized);

        if (isConnected && webSocket != null) {
            sendSingleSubscribe(webSocket, rawPair);
        }
    }

    @Override
    public void unsubscribe(String symbol) {
        if (symbol == null || symbol.isBlank()) return;
        String normalized = symbol.trim().toUpperCase();
        if (!isCrypto(normalized)) {
            return;
        }

        String rawPair = extractRawPair(normalized);
        subscribedCryptoPairs.remove(rawPair);

        if (isConnected && webSocket != null) {
            sendSingleUnsubscribe(webSocket, rawPair);
        }
    }

    @Override
    public boolean isConnected() {
        return isConnected;
    }

    private boolean isCrypto(String symbol) {
        return symbol.startsWith("BINANCE:") || symbol.contains("USDT") || symbol.contains("BUSD")
                || symbol.equals("BTC") || symbol.equals("ETH") || symbol.equals("SOL")
                || symbol.equals("MATIC") || symbol.equals("AVAX") || symbol.equals("DOGE")
                || symbol.equals("LINK") || symbol.equals("LTC") || symbol.equals("BNB")
                || symbol.equals("ADA") || symbol.equals("DOT") || symbol.equals("XRP");
    }

    private String extractRawPair(String symbol) {
        String clean = symbol.replace("BINANCE:", "").replace("COINBASE:", "").trim().toUpperCase();
        if (!clean.endsWith("USDT") && !clean.endsWith("BUSD") && !clean.endsWith("USD")) {
            clean = clean + "USDT";
        }
        return clean;
    }

    private void sendBatchSubscribe(WebSocket ws, Set<String> pairs) {
        if (pairs.isEmpty()) return;
        try {
            List<String> streams = new ArrayList<>();
            for (String pair : pairs) {
                String p = pair.toLowerCase();
                streams.add(p + "@trade");
                streams.add(p + "@miniTicker");
            }
            Map<String, Object> req = new HashMap<>();
            req.put("method", "SUBSCRIBE");
            req.put("params", streams);
            req.put("id", System.currentTimeMillis());

            String payload = objectMapper.writeValueAsString(req);
            ws.sendText(payload, true);
            log.info("[BINANCE] Souscriptions envoyées pour {} paires cryptos : {}", pairs.size(), pairs);
        } catch (Exception ex) {
            log.error("[BINANCE] Erreur envoi souscription batch : {}", ex.getMessage());
        }
    }

    private void sendSingleSubscribe(WebSocket ws, String rawPair) {
        try {
            String p = rawPair.toLowerCase();
            List<String> streams = List.of(p + "@trade", p + "@miniTicker");
            Map<String, Object> req = new HashMap<>();
            req.put("method", "SUBSCRIBE");
            req.put("params", streams);
            req.put("id", System.currentTimeMillis());

            String payload = objectMapper.writeValueAsString(req);
            ws.sendText(payload, true);
            log.info("[BINANCE] Souscription envoyée pour {}", rawPair);
        } catch (Exception ex) {
            log.error("[BINANCE] Erreur envoi souscription pour {} : {}", rawPair, ex.getMessage());
        }
    }

    private void sendSingleUnsubscribe(WebSocket ws, String rawPair) {
        try {
            String p = rawPair.toLowerCase();
            List<String> streams = List.of(p + "@trade", p + "@miniTicker");
            Map<String, Object> req = new HashMap<>();
            req.put("method", "UNSUBSCRIBE");
            req.put("params", streams);
            req.put("id", System.currentTimeMillis());

            String payload = objectMapper.writeValueAsString(req);
            ws.sendText(payload, true);
        } catch (Exception ex) {
            log.error("[BINANCE] Erreur désouscription pour {} : {}", rawPair, ex.getMessage());
        }
    }

    /**
     * Heartbeat & fallback haute résilience :
     * Interroge l'API REST officielle Binance toutes les 2.5 secondes.
     * Garantit des ticks frais 24/7 même pendant un saut de connexion WebSocket
     * ou pour des altcoins avec faible cadence de micro-trades.
     */
    @Scheduled(fixedDelay = 2500, initialDelay = 500)
    public void pollRestTickerFallback() {
        if (subscribedCryptoPairs.isEmpty() || quoteListener == null) {
            return;
        }

        try {
            List<String> pairs = new ArrayList<>(subscribedCryptoPairs);
            StringBuilder symbolsParam = new StringBuilder("[");
            for (int i = 0; i < pairs.size(); i++) {
                symbolsParam.append("\"").append(pairs.get(i)).append("\"");
                if (i < pairs.size() - 1) symbolsParam.append(",");
            }
            symbolsParam.append("]");

            String encoded = java.net.URLEncoder.encode(symbolsParam.toString(), StandardCharsets.UTF_8);
            String url = restBaseUrl + "/ticker/price?symbols=" + encoded;
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(4))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode array = objectMapper.readTree(response.body());
                if (array.isArray()) {
                    Instant now = Instant.now();
                    for (JsonNode item : array) {
                        String rawSymbol = item.path("symbol").asText().toUpperCase();
                        double price = item.path("price").asDouble();
                        if (price > 0) {
                            String appSymbol = pairToAppSymbol.getOrDefault(rawSymbol, "BINANCE:" + rawSymbol);
                            MarketQuoteDto quoteDto = MarketQuoteDto.builder()
                                    .symbol(appSymbol)
                                    .price(BigDecimal.valueOf(price))
                                    .ts(now)
                                    .source("BINANCE")
                                    .build();
                            quoteListener.accept(quoteDto);
                        }
                    }
                }
            } else {
                log.debug("[BINANCE REST] Réponse HTTP statut {}", response.statusCode());
            }
        } catch (Exception ex) {
            log.debug("[BINANCE REST] Poll ticker ignoré : {}", ex.getMessage());
        }
    }

    @PreDestroy
    public void cleanup() {
        disconnect();
        reconnectExecutor.shutdownNow();
    }

    private class BinanceWebSocketListener implements WebSocket.Listener {

        private final StringBuilder buffer = new StringBuilder();

        @Override
        public void onOpen(WebSocket webSocket) {
            log.info("[BINANCE] WebSocket ouvert et prêt pour la réception 24/7");
            WebSocket.Listener.super.onOpen(webSocket);
        }

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            buffer.append(data);

            if (last) {
                String completeMessage = buffer.toString();
                buffer.setLength(0);
                handleIncomingMessage(completeMessage);
            }

            return WebSocket.Listener.super.onText(webSocket, data, last);
        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            log.warn("[BINANCE] WebSocket fermé (code: {}, raison: {})", statusCode, reason);
            isConnected = false;
            scheduleReconnect();
            return WebSocket.Listener.super.onClose(webSocket, statusCode, reason);
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            log.warn("[BINANCE] Erreur WebSocket : {}", error.getMessage());
            isConnected = false;
            scheduleReconnect();
            WebSocket.Listener.super.onError(webSocket, error);
        }

        private void handleIncomingMessage(String json) {
            try {
                JsonNode root = objectMapper.readTree(json);
                String eventType = root.path("e").asText();

                if ("trade".equalsIgnoreCase(eventType)) {
                    String rawSymbol = root.path("s").asText().toUpperCase();
                    double price = root.path("p").asDouble();
                    long timestampMs = root.path("T").asLong();

                    emitQuote(rawSymbol, price, timestampMs);
                } else if ("24hrMiniTicker".equalsIgnoreCase(eventType)) {
                    String rawSymbol = root.path("s").asText().toUpperCase();
                    double price = root.path("c").asDouble();
                    long timestampMs = root.path("E").asLong();

                    emitQuote(rawSymbol, price, timestampMs);
                }
            } catch (Exception ex) {
                log.debug("[BINANCE] Message non parsé : {}", json);
            }
        }

        private void emitQuote(String rawSymbol, double price, long timestampMs) {
            if (price <= 0 || quoteListener == null) return;

            String appSymbol = pairToAppSymbol.getOrDefault(rawSymbol, "BINANCE:" + rawSymbol);
            MarketQuoteDto quoteDto = MarketQuoteDto.builder()
                    .symbol(appSymbol)
                    .price(BigDecimal.valueOf(price))
                    .ts(Instant.ofEpochMilli(timestampMs > 0 ? timestampMs : System.currentTimeMillis()))
                    .source("BINANCE")
                    .build();

            quoteListener.accept(quoteDto);
        }
    }
}
