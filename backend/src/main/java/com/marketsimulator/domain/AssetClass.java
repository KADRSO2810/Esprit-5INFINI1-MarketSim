package com.marketsimulator.domain;

/**
 * Classes d'actifs supportées par le simulateur multi-marchés.
 */
public enum AssetClass {
    EQUITY("Actions & Mégacaps", "Action"),
    CRYPTO("Cryptomonnaies Décentralisées", "Jeton / Token"),
    FOREX("Devises & Paires de Devises", "Paire FX"),
    BOND("Fixed Income & Emprunts d'État", "Obligation"),
    COMMODITY("Matières Premières & Énergie", "Contrat / Métal");

    private final String label;
    private final String defaultUnit;

    AssetClass(String label, String defaultUnit) {
        this.label = label;
        this.defaultUnit = defaultUnit;
    }

    public String getLabel() {
        return label;
    }

    public String getFrenchLabel() {
        return label;
    }

    public String getDefaultUnit() {
        return defaultUnit;
    }

    /**
     * Détection heuristique d'une classe d'actif à partir d'un symbole boursier.
     */
    public static AssetClass fromSymbol(String rawSymbol) {
        if (rawSymbol == null || rawSymbol.trim().isEmpty()) {
            return EQUITY;
        }
        String s = rawSymbol.trim().toUpperCase();

        if (s.startsWith("BINANCE:") || s.contains("USDT") || s.contains("BUSD") || s.equals("BTC") || s.equals("ETH") || s.equals("SOL")) {
            return CRYPTO;
        }

        if (s.contains("/") || s.endsWith("=X") || s.startsWith("OANDA:") ||
                s.equals("EURUSD") || s.equals("GBPUSD") || s.equals("USDJPY") || s.equals("USDCHF") ||
                s.equals("AUDUSD") || s.equals("USDCAD") || s.equals("EURGBP") || s.equals("EURJPY")) {
            return FOREX;
        }

        if (s.equals("IEF") || s.equals("TLT") || s.equals("SHY") || s.equals("BND") ||
                s.equals("LQD") || s.equals("HYG") || s.equals("TIP") || s.startsWith("USB") || s.contains("BOND") || s.contains("10Y")) {
            return BOND;
        }

        if (s.equals("GLD") || s.equals("SLV") || s.equals("USO") || s.equals("BNO") ||
                s.equals("UNG") || s.equals("CPER") || s.equals("DBA") || s.equals("XAU") || s.equals("XAG") || s.equals("WTI") || s.equals("BRENT")) {
            return COMMODITY;
        }

        return EQUITY;
    }
}
