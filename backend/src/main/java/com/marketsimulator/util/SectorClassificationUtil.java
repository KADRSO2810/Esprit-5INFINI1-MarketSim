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
            Map.entry("JPM", "Financials"),

            // Fixed Income / Bonds
            Map.entry("TLT", "Fixed Income (US Long Treasury)"),
            Map.entry("IEF", "Fixed Income (US Intermediate Treasury)"),
            Map.entry("SHY", "Fixed Income (US Short Treasury)"),
            Map.entry("BND", "Fixed Income (Total Aggregate Bond)"),
            Map.entry("LQD", "Fixed Income (Corporate Investment Grade)"),
            Map.entry("HYG", "Fixed Income (High Yield Corporate)"),
            Map.entry("TIP", "Fixed Income (TIPS Inflation-Protected)"),

            // Commodities
            Map.entry("GLD", "Commodities (Precious Metals - Gold)"),
            Map.entry("SLV", "Commodities (Precious Metals - Silver)"),
            Map.entry("USO", "Commodities (Energy - WTI Oil)"),
            Map.entry("BNO", "Commodities (Energy - Brent Oil)"),
            Map.entry("UNG", "Commodities (Energy - Natural Gas)"),
            Map.entry("CPER", "Commodities (Industrial Metals - Copper)"),
            Map.entry("DBA", "Commodities (Agriculture)")
    );

    public static String getSector(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            return "Other";
        }
        String clean = symbol.trim().toUpperCase(Locale.ROOT);

        if (clean.contains("/") || clean.matches("^[A-Z]{3}/[A-Z]{3}$") || clean.startsWith("EUR") || clean.startsWith("USD") || clean.startsWith("GBP") || clean.startsWith("JPY")) {
            if (clean.contains("/") || clean.length() == 6 && (clean.endsWith("USD") || clean.endsWith("JPY") || clean.endsWith("EUR") || clean.endsWith("GBP") || clean.endsWith("CHF") || clean.endsWith("CAD"))) {
                return "Foreign Exchange (Forex)";
            }
        }

        if (clean.startsWith("BINANCE:") || clean.endsWith("USDT") || clean.contains("BTC") || clean.contains("ETH") || clean.contains("SOL")) {
            return "Cryptocurrency";
        }

        return SYMBOL_TO_SECTOR.getOrDefault(clean, "Equities (General)");
    }
}
