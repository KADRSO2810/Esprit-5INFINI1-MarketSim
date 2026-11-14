package com.marketsimulator.service.multiasset;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.dto.multiasset.CommodityInstrumentDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class CommodityMarketService {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(6))
            .build();

    @Value("${app.finnhub.api-key:db6bck9r01qmd5lj8b6gdb6bck9r01qmd5lj8b70}")
    private String finnhubApiKey;

    private static final String FINNHUB_BASE = "https://finnhub.io/api/v1";
    private static final long CACHE_TTL_SECONDS = 900; // 15 minutes cache

    public static class CommodityMetadata {
        final String displayName;
        final String group;
        final String unit;
        final String contractType;
        final String physicalBacking;
        final BigDecimal fallbackPrice;

        public CommodityMetadata(String displayName, String group, String unit,
                                 String contractType, String physicalBacking, double fallbackPrice) {
            this.displayName = displayName;
            this.group = group;
            this.unit = unit;
            this.contractType = contractType;
            this.physicalBacking = physicalBacking;
            this.fallbackPrice = BigDecimal.valueOf(fallbackPrice);
        }
    }

    private static final Map<String, CommodityMetadata> COMMODITY_CATALOG = Map.of(
            "GLD", new CommodityMetadata("Or Physique / SPDR Gold Shares", "PRECIOUS_METALS", "Once Troy (oz)", "SPOT_PROXY", "Lingots d'or 400 oz certifiés LBMA en coffres sécurisés HSBC Londres", 355.45),
            "SLV", new CommodityMetadata("Argent Métal / iShares Silver Trust", "PRECIOUS_METALS", "Once Troy (oz)", "SPOT_PROXY", "Lingots d'argent 1000 oz stockés en coffres JPMorgan Londres & New York", 30.80),
            "USO", new CommodityMetadata("Pétrole WTI / United States Oil Fund", "ENERGY", "Baril (bbl)", "FUTURES_BENCHMARK", "Contrats à terme Light Sweet Crude Oil (WTI) négociés sur le NYMEX", 74.20),
            "BNO", new CommodityMetadata("Pétrole Brent / Brent Oil Fund", "ENERGY", "Baril (bbl)", "FUTURES_BENCHMARK", "Contrats à terme pétrole brut de mer du Nord cotés sur ICE Futures Europe", 78.60),
            "UNG", new CommodityMetadata("Gaz Naturel / US Natural Gas Fund", "ENERGY", "MMBtu", "FUTURES_BENCHMARK", "Contrats à terme Henry Hub Natural Gas cotés sur le NYMEX", 18.40),
            "CPER", new CommodityMetadata("Cuivre Métal / US Copper Index", "INDUSTRIAL_METALS", "Livre (lb)", "FUTURES_BENCHMARK", "Cathodes de cuivre Grade A négociées sur le COMEX (SummerHaven Copper)", 27.90),
            "DBA", new CommodityMetadata("Agriculture Diversifiée / Invesco Agriculture", "AGRICULTURE", "Panier Matières Premières", "FUTURES_BENCHMARK", "Indice diversifié de contrats à terme (Maïs, Blé, Soja, Sucre, Café)", 24.75)
    );

    private static class CachedCommodityQuote {
        final BigDecimal price;
        final BigDecimal changePct;
        final BigDecimal high;
        final BigDecimal low;
        final BigDecimal volume;
        final Instant timestamp;

        CachedCommodityQuote(BigDecimal price, BigDecimal changePct, BigDecimal high, BigDecimal low, BigDecimal volume) {
            this.price = price;
            this.changePct = changePct;
            this.high = high;
            this.low = low;
            this.volume = volume;
            this.timestamp = Instant.now();
        }

        boolean isExpired() {
            return Instant.now().isAfter(timestamp.plusSeconds(CACHE_TTL_SECONDS));
        }
    }

    private final Map<String, CachedCommodityQuote> quoteCache = new ConcurrentHashMap<>();

    public CommodityInstrumentDto getCommodityInstrument(String symbol) {
        String clean = symbol.trim().toUpperCase();
        CommodityMetadata meta = COMMODITY_CATALOG.get(clean);
        if (meta == null) {
            meta = new CommodityMetadata(clean + " Commodity", "COMMODITIES", "Unité Standard", "FUTURES_BENCHMARK", "Matière première benchmark de référence", 50.0);
        }

        CachedCommodityQuote quote = resolveFinnhubQuote(clean, meta.fallbackPrice);
        BigDecimal price = quote.price;

        // Spread standard matières premières (0.05% de valeur de marché)
        BigDecimal spread = price.multiply(new BigDecimal("0.0005")).setScale(4, RoundingMode.HALF_UP);
        BigDecimal halfSpread = spread.divide(new BigDecimal("2"), 4, RoundingMode.HALF_UP);
        BigDecimal bid = price.subtract(halfSpread).setScale(2, RoundingMode.HALF_UP);
        BigDecimal ask = price.add(halfSpread).setScale(2, RoundingMode.HALF_UP);

        return CommodityInstrumentDto.builder()
                .symbol(clean)
                .displayName(meta.displayName)
                .commodityGroup(meta.group)
                .unit(meta.unit)
                .contractType(meta.contractType)
                .physicalBacking(meta.physicalBacking)
                .currentPrice(price.setScale(2, RoundingMode.HALF_UP))
                .bid(bid)
                .ask(ask)
                .spreadPrice(spread)
                .change24hPct(quote.changePct.setScale(2, RoundingMode.HALF_UP))
                .high24h(quote.high.setScale(2, RoundingMode.HALF_UP))
                .low24h(quote.low.setScale(2, RoundingMode.HALF_UP))
                .volume(quote.volume.setScale(0, RoundingMode.HALF_UP))
                .tradingSession("NYMEX / COMEX / US Regular Session (09:30 - 16:00 EST)")
                .marketDataSource("Finnhub Market Data")
                .timestamp(Instant.now())
                .build();
    }

    public List<CommodityInstrumentDto> getAllCommodityInstruments() {
        List<String> symbols = List.of("GLD", "SLV", "USO", "BNO", "UNG", "CPER", "DBA");
        List<CommodityInstrumentDto> list = new ArrayList<>();
        for (String sym : symbols) {
            try {
                list.add(getCommodityInstrument(sym));
            } catch (Exception ex) {
                log.warn("[COMMODITY] Erreur pour {}: {}", sym, ex.getMessage());
            }
        }
        return list;
    }

    private CachedCommodityQuote resolveFinnhubQuote(String symbol, BigDecimal fallbackPrice) {
        CachedCommodityQuote cached = quoteCache.get(symbol);
        if (cached != null && !cached.isExpired()) {
            return cached;
        }

        if (finnhubApiKey != null && !finnhubApiKey.isBlank()) {
            try {
                String url = String.format("%s/quote?symbol=%s&token=%s", FINNHUB_BASE, symbol, finnhubApiKey);
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .GET()
                        .build();
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() == 200) {
                    JsonNode root = objectMapper.readTree(response.body());
                    double c = root.path("c").asDouble(0.0);
                    double dp = root.path("dp").asDouble(0.0);
                    double h = root.path("h").asDouble(c);
                    double l = root.path("l").asDouble(c);

                    if (c > 0.0) {
                        CachedCommodityQuote q = new CachedCommodityQuote(
                                BigDecimal.valueOf(c),
                                BigDecimal.valueOf(dp),
                                BigDecimal.valueOf(h),
                                BigDecimal.valueOf(l),
                                BigDecimal.valueOf(1450000)
                        );
                        quoteCache.put(symbol, q);
                        log.info("[COMMODITY] Cotation réelle Finnhub pour {}: {}", symbol, c);
                        return q;
                    }
                }
            } catch (Exception ex) {
                log.warn("[COMMODITY] Échec requête Finnhub pour {}: {}", symbol, ex.getMessage());
            }
        }

        CachedCommodityQuote fallback = new CachedCommodityQuote(
                fallbackPrice,
                new BigDecimal("0.45"),
                fallbackPrice.multiply(new BigDecimal("1.008")),
                fallbackPrice.multiply(new BigDecimal("0.992")),
                BigDecimal.valueOf(1250000)
        );
        quoteCache.put(symbol, fallback);
        return fallback;
    }
}
