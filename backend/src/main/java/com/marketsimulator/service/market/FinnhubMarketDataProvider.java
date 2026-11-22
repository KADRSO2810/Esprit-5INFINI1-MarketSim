package com.marketsimulator.service.market;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.dto.MarketQuoteDto;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import java.util.concurrent.*;
import java.util.function.Consumer;

@Slf4j
@Component
public class FinnhubMarketDataProvider implements MarketDataProvider {

    private final String apiKey;
    private final String wsBaseUrl;
    private final ObjectMapper objectMapper;
    private final Set<String> subscribedSymbols = ConcurrentHashMap.newKeySet();
    private final ScheduledExecutorService reconnectExecutor = Executors.newSingleThreadScheduledExecutor();

    private volatile WebSocket webSocket;
    private volatile boolean isRunning = false;
    private volatile boolean isConnected = false;
    private Consumer<MarketQuoteDto> quoteListener;

    private int reconnectAttempts = 0;
    private static final int MAX_RECONNECT_DELAY_SECONDS = 30;

    public FinnhubMarketDataProvider(
            @Value("${app.finnhub.api-key:}") String apiKey,
            @Value("${app.finnhub.ws-url:wss://ws.finnhub.io}") String wsBaseUrl) {
        this.apiKey = apiKey != null ? apiKey.trim() : "";
        this.wsBaseUrl = wsBaseUrl;
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public void setQuoteListener(Consumer<MarketQuoteDto> listener) {
        this.quoteListener = listener;
    }

    @Override
    public synchronized void connect() {
        if (apiKey.isEmpty()) {
            log.warn("[FINNHUB] Aucune variable FINNHUB_API_KEY renseignée. Le provider restera inactif jusqu'à configuration de la clé.");
            return;
        }

        isRunning = true;
        establishConnection();
    }

    private synchronized void establishConnection() {
        if (!isRunning) return;

        try {
            String fullUri = wsBaseUrl + "?token=" + apiKey;
            log.info("[FINNHUB] Tentative de connexion WebSocket à {} (clé masquée)", wsBaseUrl);

            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();

            client.newWebSocketBuilder()
                    .buildAsync(URI.create(fullUri), new FinnhubWebSocketListener())
                    .thenAccept(ws -> {
                        this.webSocket = ws;
                        this.isConnected = true;
                        this.reconnectAttempts = 0;
                        log.info("[FINNHUB] Connexion WebSocket établie avec succès !");

                        // Réabonnement automatique à tous les symboles actifs de la watchlist
                        for (String symbol : subscribedSymbols) {
                            sendSubscribe(ws, symbol);
                        }
                    })
                    .exceptionally(ex -> {
                        log.error("[FINNHUB] Échec de connexion : {}", ex.getMessage());
                        scheduleReconnect();
                        return null;
                    });
        } catch (Exception ex) {
            log.error("[FINNHUB] Erreur lors de l'initialisation WebSocket : {}", ex.getMessage());
            scheduleReconnect();
        }
    }

    private void scheduleReconnect() {
        if (!isRunning) return;

        isConnected = false;
        reconnectAttempts++;
        long delay = Math.min((long) Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY_SECONDS);
        log.info("[FINNHUB] Reconnexion automatique planifiée dans {} secondes (tentative #{})", delay, reconnectAttempts);

        reconnectExecutor.schedule(this::establishConnection, delay, TimeUnit.SECONDS);
    }

    @Override
    public synchronized void disconnect() {
        isRunning = false;
        isConnected = false;
        if (webSocket != null) {
            try {
                webSocket.sendClose(WebSocket.NORMAL_CLOSURE, "Arrêt du service");
            } catch (Exception ignored) {
            }
        }
    }

    @Override
    public void subscribe(String symbol) {
        if (symbol == null || symbol.isBlank()) return;
        String normalized = symbol.trim().toUpperCase();
        if (isCrypto(normalized)) {
            log.debug("[FINNHUB] Symbole crypto {} ignoré (délégué au flux Binance 24/7)", normalized);
            return;
        }
        subscribedSymbols.add(normalized);

        if (isConnected && webSocket != null) {
            sendSubscribe(webSocket, normalized);
        }
    }

    @Override
    public void unsubscribe(String symbol) {
        if (symbol == null || symbol.isBlank()) return;
        String normalized = symbol.trim().toUpperCase();
        if (isCrypto(normalized)) {
            return;
        }
        subscribedSymbols.remove(normalized);

        if (isConnected && webSocket != null) {
            sendUnsubscribe(webSocket, normalized);
        }
    }

    private boolean isCrypto(String symbol) {
        return symbol.startsWith("BINANCE:") || symbol.contains("USDT") || symbol.contains("BUSD");
    }

    private void sendSubscribe(WebSocket ws, String symbol) {
        try {
            String payload = String.format("{\"type\":\"subscribe\",\"symbol\":\"%s\"}", symbol);
            ws.sendText(payload, true);
            log.info("[FINNHUB] Souscription envoyée pour {}", symbol);
        } catch (Exception ex) {
            log.error("[FINNHUB] Impossible d'envoyer la souscription pour {} : {}", symbol, ex.getMessage());
        }
    }

    private void sendUnsubscribe(WebSocket ws, String symbol) {
        try {
            String payload = String.format("{\"type\":\"unsubscribe\",\"symbol\":\"%s\"}", symbol);
            ws.sendText(payload, true);
            log.info("[FINNHUB] Désouscription envoyée pour {}", symbol);
        } catch (Exception ex) {
            log.error("[FINNHUB] Impossible d'envoyer la désouscription pour {} : {}", symbol, ex.getMessage());
        }
    }

    @Override
    public boolean isConnected() {
        return isConnected;
    }

    @PreDestroy
    public void cleanup() {
        disconnect();
        reconnectExecutor.shutdownNow();
    }

    private class FinnhubWebSocketListener implements WebSocket.Listener {

        private final StringBuilder buffer = new StringBuilder();

        @Override
        public void onOpen(WebSocket webSocket) {
            log.info("[FINNHUB] WebSocket ouvert et prêt pour la réception");
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
            log.warn("[FINNHUB] Connexion WebSocket fermée par le serveur (code: {}, raison: {})", statusCode, reason);
            isConnected = false;
            scheduleReconnect();
            return WebSocket.Listener.super.onClose(webSocket, statusCode, reason);
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            log.error("[FINNHUB] Erreur WebSocket survenue : {}", error.getMessage());
            isConnected = false;
            scheduleReconnect();
            WebSocket.Listener.super.onError(webSocket, error);
        }

        private void handleIncomingMessage(String json) {
            try {
                JsonNode root = objectMapper.readTree(json);
                String type = root.path("type").asText();

                if ("ping".equalsIgnoreCase(type)) {
                    return;
                }

                if ("trade".equalsIgnoreCase(type) && root.has("data") && root.get("data").isArray()) {
                    for (JsonNode trade : root.get("data")) {
                        String symbol = trade.path("s").asText();
                        double price = trade.path("p").asDouble();
                        long timestampMs = trade.path("t").asLong();

                        MarketQuoteDto quoteDto = MarketQuoteDto.builder()
                                .symbol(symbol.toUpperCase())
                                .price(BigDecimal.valueOf(price))
                                .ts(Instant.ofEpochMilli(timestampMs > 0 ? timestampMs : System.currentTimeMillis()))
                                .source("FINNHUB")
                                .build();

                        if (quoteListener != null) {
                            quoteListener.accept(quoteDto);
                        }
                    }
                }
            } catch (Exception ex) {
                log.debug("[FINNHUB] Message non parsé en trade : {}", json);
            }
        }
    }
}
