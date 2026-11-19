package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "custom_challenge_runs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomChallengeRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "challenge_id", nullable = false)
    private CustomChallenge challenge;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 32)
    @Builder.Default
    private String mode = "SOLO"; // SOLO ou DUEL_1V1

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "opponent_id")
    private User opponent;

    @Column(name = "final_equity", nullable = false, precision = 15, scale = 2)
    private BigDecimal finalEquity;

    @Column(name = "net_pnl", nullable = false, precision = 15, scale = 2)
    private BigDecimal netPnl;

    @Column(name = "return_pct", nullable = false, precision = 8, scale = 4)
    private BigDecimal returnPct;

    @Column(name = "max_drawdown_pct", nullable = false, precision = 8, scale = 4)
    private BigDecimal maxDrawdownPct;

    @Column(name = "trades_count", nullable = false)
    @Builder.Default
    private Integer tradesCount = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer score = 0;

    @Lob
    @Column(name = "equity_curve", columnDefinition = "LONGTEXT")
    private String equityCurve;

    @CreationTimestamp
    @Column(name = "completed_at", updatable = false)
    private LocalDateTime completedAt;
}
