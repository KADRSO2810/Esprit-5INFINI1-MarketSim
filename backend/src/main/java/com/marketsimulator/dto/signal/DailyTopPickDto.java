package com.marketsimulator.dto.signal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DailyTopPickDto {
    private int rank; // 1, 2, 3
    private String symbol; // ex: "BINANCE:SOLUSDT"
    private String cleanSymbol; // "SOL"
    private String assetName; // "Solana Parabolique"
    private String assetClass; // "CRYPTO", "EQUITY", "COMMODITY"
    private BigDecimal currentPrice;
    private BigDecimal previousClose; // Cours clôture J-1
    private double dailyChangePct; // Variation depuis J-1
    private double expectedReturnPct; // Ex: +3.95%
    private int confidenceScore; // Ex: 94%
    private String recommendation; // "ACHAT IMMÉDIAT"
    private String catalyst; // Catalyseur J-1 / Technique
    private String pattern; // Figure chandelier
    private String timeframe; // "SCALP 5 MIN (24/7)"
    private BigDecimal targetPrice; // TP1
    private BigDecimal stopLoss;
    private String periodOfDay; // Période précise de la séance (ex: "Séance Pleine Liquidité 12h00 - 18h00")
    private String periodAdvice; // Pourquoi cet actif est le meilleur à cette période
    private Boolean isBestSignalOfDay; // true pour le signal N°1 maître du jour
    private Integer guaranteedTpRate; // Ex: 96% probabilité Take-Profit
    private Double riskRewardRatio; // Ex: 1.60
}
