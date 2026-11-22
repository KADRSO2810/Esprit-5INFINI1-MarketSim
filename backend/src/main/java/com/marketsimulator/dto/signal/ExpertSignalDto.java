package com.marketsimulator.dto.signal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExpertSignalDto {
    private String id;
    private String symbol;
    private String assetName;
    private String assetClass; // COMMODITY, EQUITY
    private String side; // BUY, SELL
    private String timeframe; // 15M, 1H, 4H, DAILY
    private BigDecimal entryPrice;
    private BigDecimal currentPrice;
    private BigDecimal stopLoss;
    private BigDecimal takeProfit1;
    private BigDecimal takeProfit2;
    private BigDecimal takeProfit3;
    private Double riskRewardRatio;
    private Integer confidenceScore; // 0-100% (ex: 91%)
    private String qualityGrade; // AAA, A+, A, B+
    private String status; // ACTIVE, TP1_HIT, TP2_HIT, TP3_HIT, SL_HIT, EXPIRED
    private Double potentialGainPct;
    private Double potentialLossPct;
    private Double currentProfitPct; // Profit / perte latent en direct (%)
    private Double progressToTp1Pct; // 0 à 100% vers le premier objectif
    private String detectedPattern; // ex: "Marteau Haussier (Hammer) + Rebond SMA 50"
    private String beginnerAdvice; // Phrase ultra claire pour le mode débutant
    private String technicalThesis;
    private String fundamentalCatalyst;
    private String riskManagementRule;
    private List<String> indicatorsUsed;
    private LocalDateTime issuedAt;
    private LocalDateTime expiresAt;
    private String telegramFormattedText;
    private Boolean isMarketOpen;
    private Boolean isHighProbability;
    private Boolean isInstantAlert;
    private Integer durationSeconds; // Durée max du scalp (ex: 300 = 5 minutes)
    private Boolean isScalp5Min; // true pour les signaux turbo 5 minutes
}
