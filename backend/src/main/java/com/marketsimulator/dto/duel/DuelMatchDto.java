package com.marketsimulator.dto.duel;

import com.marketsimulator.domain.DuelBotProfile;
import com.marketsimulator.domain.DuelOpponentType;
import com.marketsimulator.domain.DuelStatus;
import com.marketsimulator.domain.DuelWinnerRole;
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
public class DuelMatchDto {

    private Long id;
    private Long challengerId;
    private String challengerName;
    private DuelOpponentType opponentType;
    private Long opponentId;
    private String opponentName;
    private String opponentEmail;
    private DuelBotProfile botProfile;
    private String scenarioId;
    private String scenarioTitle;
    private DuelStatus status;
    private String inviteToken;
    private String inviteUrl;
    private BigDecimal initialCapital;

    // Challenger stats
    private BigDecimal challengerPnl;
    private BigDecimal challengerRoi;
    private Integer challengerScore;
    private Integer challengerTrades;
    private List<BigDecimal> challengerEquityCurve;

    // Opponent stats
    private BigDecimal opponentPnl;
    private BigDecimal opponentRoi;
    private Integer opponentScore;
    private Integer opponentTrades;
    private List<BigDecimal> opponentEquityCurve;

    // Winner & reveal
    private Long winnerId;
    private DuelWinnerRole winnerRole;
    private String winnerName;
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;

    // The Big Reveal (included if match is completed)
    private String realAssetSymbol;
    private String realAssetName;
    private String realPeriod;
    private String historicalContext;
}
