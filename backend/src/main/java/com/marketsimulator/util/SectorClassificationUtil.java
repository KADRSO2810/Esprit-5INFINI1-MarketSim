package com.marketsimulator.util;

import java.util.Locale;
import java.util.Map;

public final class SectorClassificationUtil {

    private SectorClassificationUtil() {}

    private static final Map<String, String> SYMBOL_TO_SECTOR = Map.ofEntries(
            // Technology
            Map.entry("AAPL", "Technology"),
            Map.entry("MSFT", "Technology"),
            Map.entry("NVDA", "Technology"),
            Map.entry("AMD", "Technology"),
            Map.entry("INTC", "Technology"),

            // Communication Services
            Map.entry("GOOGL", "Communication Services"),
            Map.entry("META", "Communication Services"),
            Map.entry("NFLX", "Communication Services"),
            Map.entry("DIS", "Communication Services"),

            // Consumer Discretionary
            Map.entry("AMZN", "Consumer Discretionary"),
            Map.entry("TSLA", "Consumer Discretionary"),
            Map.entry("BABA", "Consumer Discretionary"),

            // Financials
            Map.entry("JPM", "Financials")
    );

    public static String getSector(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            return "Other";
        }
        String clean = symbol.trim().toUpperCase(Locale.ROOT);

        if (clean.startsWith("BINANCE:") || clean.endsWith("USDT") || clean.contains("BTC") || clean.contains("ETH") || clean.contains("SOL")) {
            return "Cryptocurrency";
        }

        return SYMBOL_TO_SECTOR.getOrDefault(clean, "Equities (General)");
    }
}
