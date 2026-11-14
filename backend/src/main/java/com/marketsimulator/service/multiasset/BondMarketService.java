package com.marketsimulator.service.multiasset;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.dto.multiasset.BondInstrumentDto;
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
public class BondMarketService {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(6))
            .build();

    @Value("${app.finnhub.api-key:db6bck9r01qmd5lj8b6gdb6bck9r01qmd5lj8b70}")
    private String finnhubApiKey;

    private static final String FINNHUB_BASE = "https://finnhub.io/api/v1";
    private static final long CACHE_TTL_SECONDS = 900; // 15 minutes cache

    public static class BondMetadata {
        final String displayName;
        final String issuerType;
        final String issuerName;
        final BigDecimal couponRate;
        final String paymentFreq;
        final BigDecimal maturityYears;
        final BigDecimal macaulayDuration;
        final BigDecimal fallbackPrice;

        public BondMetadata(String displayName, String issuerType, String issuerName,
                            double couponRate, String paymentFreq, double maturityYears,
                            double macaulayDuration, double fallbackPrice) {
            this.displayName = displayName;
            this.issuerType = issuerType;
            this.issuerName = issuerName;
            this.couponRate = BigDecimal.valueOf(couponRate);
            this.paymentFreq = paymentFreq;
            this.maturityYears = BigDecimal.valueOf(maturityYears);
            this.macaulayDuration = BigDecimal.valueOf(macaulayDuration);
            this.fallbackPrice = BigDecimal.valueOf(fallbackPrice);
        }
    }

    private static final Map<String, BondMetadata> BOND_CATALOG = Map.of(
            "TLT", new BondMetadata("iShares 20+ Year Treasury Bond ETF", "US_TREASURY", "US Department of the Treasury", 4.25, "SEMI_ANNUAL", 20.0, 16.8, 79.38),
            "IEF", new BondMetadata("iShares 7-10 Year Treasury Bond ETF", "US_TREASURY", "US Department of the Treasury", 3.85, "SEMI_ANNUAL", 8.5, 7.3, 95.50),
            "SHY", new BondMetadata("iShares 1-3 Year Treasury Bond ETF", "US_TREASURY", "US Department of the Treasury", 4.40, "SEMI_ANNUAL", 2.0, 1.85, 82.40),
            "BND", new BondMetadata("Vanguard Total Bond Market ETF", "AGGREGATE_BOND", "US Investment-Grade Aggregate Index", 3.90, "MONTHLY", 8.7, 6.5, 72.10),
            "LQD", new BondMetadata("iShares iBoxx $ Inv Grade Corporate Bond ETF", "CORPORATE_IG", "US Blue-Chip Corporations", 5.15, "MONTHLY", 13.0, 8.4, 108.50),
            "HYG", new BondMetadata("iShares iBoxx $ High Yield Corporate Bond ETF", "HIGH_YIELD", "US High Yield Corporate Debt", 6.85, "MONTHLY", 5.0, 3.8, 78.20),
            "TIP", new BondMetadata("iShares TIPS Bond ETF", "TIPS_INFLATION", "US Inflation-Protected Securities", 2.25, "SEMI_ANNUAL", 7.0, 6.7, 106.30)
    );

    private static class CachedBondQuote {
        final BigDecimal price;
        final BigDecimal changePct;
        final BigDecimal high;
        final BigDecimal low;
        final Instant timestamp;

        CachedBondQuote(BigDecimal price, BigDecimal changePct, BigDecimal high, BigDecimal low) {
            this.price = price;
            this.changePct = changePct;
            this.high = high;
            this.low = low;
            this.timestamp = Instant.now();
        }

        boolean isExpired() {
            return Instant.now().isAfter(timestamp.plusSeconds(CACHE_TTL_SECONDS));
        }
    }

    private final Map<String, CachedBondQuote> quoteCache = new ConcurrentHashMap<>();

    public BondInstrumentDto getBondInstrument(String symbol) {
        String clean = symbol.trim().toUpperCase();
        BondMetadata meta = BOND_CATALOG.get(clean);
        if (meta == null) {
            meta = new BondMetadata(clean + " Debt Instrument", "US_TREASURY", "Treasury / Corporate Benchmark", 4.00, "SEMI_ANNUAL", 10.0, 8.0, 100.0);
        }

        CachedBondQuote quote = resolveFinnhubQuote(clean, meta.fallbackPrice);
        BigDecimal cleanPrice = quote.price;
        BigDecimal parValue = new BigDecimal("100.00");

        // Accrued Interest calculation: 60 days accrued in standard 180-day cycle
        BigDecimal annualCouponDollars = meta.couponRate.multiply(parValue).divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP);
        BigDecimal accruedInterest = "SEMI_ANNUAL".equalsIgnoreCase(meta.paymentFreq)
                ? annualCouponDollars.multiply(new BigDecimal("60")).divide(new BigDecimal("360"), 4, RoundingMode.HALF_UP)
                : annualCouponDollars.multiply(new BigDecimal("15")).divide(new BigDecimal("360"), 4, RoundingMode.HALF_UP);

        BigDecimal dirtyPrice = cleanPrice.add(accruedInterest).setScale(4, RoundingMode.HALF_UP);

        // Current Yield = (Annual Coupon / Clean Price) * 100
        BigDecimal currentYield = cleanPrice.compareTo(BigDecimal.ZERO) > 0
                ? annualCouponDollars.divide(cleanPrice, 6, RoundingMode.HALF_UP).multiply(new BigDecimal("100")).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // YTM approximation formula: [C + (F - P)/n] / [(F + P)/2]
        BigDecimal yieldToMaturity = calculateYtmApproximation(annualCouponDollars, parValue, cleanPrice, meta.maturityYears);

        // Modified Duration = Macaulay Duration / (1 + YTM/m)
        int paymentsPerYear = "MONTHLY".equalsIgnoreCase(meta.paymentFreq) ? 12 : 2;
        BigDecimal modifiedDuration = calculateModifiedDuration(meta.macaulayDuration, yieldToMaturity, paymentsPerYear);

        return BondInstrumentDto.builder()
                .symbol(clean)
                .displayName(meta.displayName)
                .issuerType(meta.issuerType)
                .issuerName(meta.issuerName)
                .parValue(parValue)
                .cleanPrice(cleanPrice.setScale(2, RoundingMode.HALF_UP))
                .dirtyPrice(dirtyPrice.setScale(2, RoundingMode.HALF_UP))
                .accruedInterest(accruedInterest.setScale(2, RoundingMode.HALF_UP))
                .couponRate(meta.couponRate.setScale(2, RoundingMode.HALF_UP))
                .paymentFrequency(meta.paymentFreq)
                .maturityYears(meta.maturityYears.setScale(1, RoundingMode.HALF_UP))
                .currentYield(currentYield)
                .yieldToMaturity(yieldToMaturity.setScale(2, RoundingMode.HALF_UP))
                .macaulayDuration(meta.macaulayDuration.setScale(2, RoundingMode.HALF_UP))
                .modifiedDuration(modifiedDuration.setScale(2, RoundingMode.HALF_UP))
                .change24hPct(quote.changePct.setScale(2, RoundingMode.HALF_UP))
                .high24h(quote.high.setScale(2, RoundingMode.HALF_UP))
                .low24h(quote.low.setScale(2, RoundingMode.HALF_UP))
                .tradingSession("US Debt Markets (09:30 - 16:00 EST)")
                .marketDataSource("Finnhub Market Data")
                .timestamp(Instant.now())
                .build();
    }

    public List<BondInstrumentDto> getAllBondInstruments() {
        List<String> symbols = List.of("IEF", "TLT", "SHY", "BND", "LQD", "HYG", "TIP");
        List<BondInstrumentDto> list = new ArrayList<>();
        for (String sym : symbols) {
            try {
                list.add(getBondInstrument(sym));
            } catch (Exception ex) {
                log.warn("[BONDS] Erreur pour {}: {}", sym, ex.getMessage());
            }
        }
        return list;
    }

    private CachedBondQuote resolveFinnhubQuote(String symbol, BigDecimal fallbackPrice) {
        CachedBondQuote cached = quoteCache.get(symbol);
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
                        CachedBondQuote q = new CachedBondQuote(
                                BigDecimal.valueOf(c),
                                BigDecimal.valueOf(dp),
                                BigDecimal.valueOf(h),
                                BigDecimal.valueOf(l)
                        );
                        quoteCache.put(symbol, q);
                        log.info("[BONDS] Cotation réelle Finnhub pour {}: {}", symbol, c);
                        return q;
                    }
                }
            } catch (Exception ex) {
                log.warn("[BONDS] Échec requête Finnhub pour {}: {}", symbol, ex.getMessage());
            }
        }

        CachedBondQuote fallback = new CachedBondQuote(fallbackPrice, new BigDecimal("0.12"), fallbackPrice.multiply(new BigDecimal("1.005")), fallbackPrice.multiply(new BigDecimal("0.995")));
        quoteCache.put(symbol, fallback);
        return fallback;
    }

    public static BigDecimal calculateYtmApproximation(BigDecimal couponDollars, BigDecimal parValue, BigDecimal cleanPrice, BigDecimal maturityYears) {
        if (maturityYears.compareTo(BigDecimal.ZERO) <= 0 || cleanPrice.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        // [C + (F - P)/n] / [(F + P)/2]
        BigDecimal priceDiff = parValue.subtract(cleanPrice);
        BigDecimal capitalGainPerYear = priceDiff.divide(maturityYears, 6, RoundingMode.HALF_UP);
        BigDecimal numerator = couponDollars.add(capitalGainPerYear);
        BigDecimal denominator = parValue.add(cleanPrice).divide(new BigDecimal("2"), 6, RoundingMode.HALF_UP);

        if (denominator.compareTo(BigDecimal.ZERO) == 0) return BigDecimal.ZERO;
        return numerator.divide(denominator, 6, RoundingMode.HALF_UP).multiply(new BigDecimal("100"));
    }

    public static BigDecimal calculateModifiedDuration(BigDecimal macaulayDuration, BigDecimal ytmPct, int paymentsPerYear) {
        BigDecimal ytmDecimal = ytmPct.divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP);
        BigDecimal periodicRate = ytmDecimal.divide(BigDecimal.valueOf(paymentsPerYear), 6, RoundingMode.HALF_UP);
        BigDecimal divisor = BigDecimal.ONE.add(periodicRate);
        if (divisor.compareTo(BigDecimal.ZERO) <= 0) return macaulayDuration;
        return macaulayDuration.divide(divisor, 4, RoundingMode.HALF_UP);
    }
}
