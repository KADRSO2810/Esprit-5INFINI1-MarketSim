package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "duel_matches")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DuelMatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "challenger_id", nullable = false)
    private User challenger;

    @Enumerated(EnumType.STRING)
    @Column(name = "opponent_type", nullable = false, length = 32)
    @Builder.Default
    private DuelOpponentType opponentType = DuelOpponentType.AI_QUANT;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "opponent_id")
    private User opponent;

    @Column(name = "opponent_email", length = 255)
    private String opponentEmail;

    @Enumerated(EnumType.STRING)
    @Column(name = "bot_profile", length = 64)
    private DuelBotProfile botProfile;

    @Column(name = "scenario_id", nullable = false, length = 64)
    private String scenarioId;

    @Column(name = "scenario_title", nullable = false, length = 128)
    private String scenarioTitle;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    @Builder.Default
    private DuelStatus status = DuelStatus.ACTIVE;

    @Column(name = "invite_token", nullable = false, unique = true, length = 64)
    private String inviteToken;

    @Column(name = "initial_capital", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal initialCapital = new BigDecimal("50000.00");

    @Column(name = "challenger_pnl", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal challengerPnl = BigDecimal.ZERO;

    @Column(name = "challenger_roi", precision = 8, scale = 4)
    @Builder.Default
    private BigDecimal challengerRoi = BigDecimal.ZERO;

    @Column(name = "challenger_score")
    @Builder.Default
    private Integer challengerScore = 0;

    @Column(name = "challenger_trades")
    @Builder.Default
    private Integer challengerTrades = 0;

    @Lob
    @Column(name = "challenger_equity_curve", columnDefinition = "LONGTEXT")
    private String challengerEquityCurve;

    @Column(name = "opponent_pnl", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal opponentPnl = BigDecimal.ZERO;

    @Column(name = "opponent_roi", precision = 8, scale = 4)
    @Builder.Default
    private BigDecimal opponentRoi = BigDecimal.ZERO;

    @Column(name = "opponent_score")
    @Builder.Default
    private Integer opponentScore = 0;

    @Column(name = "opponent_trades")
    @Builder.Default
    private Integer opponentTrades = 0;

    @Lob
    @Column(name = "opponent_equity_curve", columnDefinition = "LONGTEXT")
    private String opponentEquityCurve;

    @Column(name = "winner_id")
    private Long winnerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "winner_role", length = 32)
    private DuelWinnerRole winnerRole;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
