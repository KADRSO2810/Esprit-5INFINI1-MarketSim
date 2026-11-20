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
    private Integer confidenceScore; // 0-100%
    private String qualityGrade; // A+, A, B+
    private String status; // ACTIVE, TARGET_HIT, STOPPED_OUT, CANCELLED
    private Double potentialGainPct;
    private Double potentialLossPct;
    private String technicalThesis;
    private String fundamentalCatalyst;
    private String riskManagementRule;
    private List<String> indicatorsUsed;
    private LocalDateTime issuedAt;
    private LocalDateTime expiresAt;
    private String telegramFormattedText;
    private Boolean isMarketOpen;
    private Boolean isHighProbability;
}
