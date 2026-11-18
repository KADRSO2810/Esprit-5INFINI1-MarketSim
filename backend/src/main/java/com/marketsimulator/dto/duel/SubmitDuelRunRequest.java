package com.marketsimulator.dto.duel;

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
public class SubmitDuelRunRequest {

    private Long matchId;
    private String inviteToken;

    @NotNull(message = "Le PnL net est obligatoire")
    private BigDecimal netPnl;

    @NotNull(message = "Le ROI est obligatoire")
    private BigDecimal returnPct;

    private BigDecimal maxDrawdownPct;
    private Integer tradesCount;

    // Snapshot de la courbe d'equity sous forme de liste de valeurs
    private List<BigDecimal> equityCurve;
}
