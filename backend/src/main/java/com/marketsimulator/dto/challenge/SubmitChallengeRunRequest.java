package com.marketsimulator.dto.challenge;

import jakarta.validation.constraints.NotNull;
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
public class SubmitChallengeRunRequest {

    @NotNull(message = "L'identifiant du challenge est obligatoire")
    private Long challengeId;

    private String mode; // SOLO ou DUEL_1V1
    private Long opponentId;

    @NotNull(message = "Le capital final est obligatoire")
    private BigDecimal finalEquity;

    @NotNull(message = "Le PnL net est obligatoire")
    private BigDecimal netPnl;

    @NotNull(message = "Le ROI est obligatoire")
    private BigDecimal returnPct;

    private BigDecimal maxDrawdownPct;
    private Integer tradesCount;
    private List<BigDecimal> equityCurve;
}
