package com.marketsimulator.dto.duel;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DuelScenarioDto {

    private String id;
    private String codeName;          // e.g. "ALPHA-DELTA 9" (Blind)
    private String category;          // e.g. "Crypto Volatility", "Equities Breakout"
    private String difficulty;        // "NORMAL", "HARD", "EXTREME"
    private String description;
    private Integer durationSeconds;  // 120
    private BigDecimal initialCapital;
    private List<DuelPricePointDto> priceTrajectory;

    // Dévoilement post-duel (The Big Reveal)
    private String realAssetSymbol;   // "BTC"
    private String realAssetName;     // "Bitcoin"
    private String realPeriod;        // "Sep - Dec 2017 Mania"
    private String historicalContext; // "Rally historique jusqu'à 20 000$..."
}
