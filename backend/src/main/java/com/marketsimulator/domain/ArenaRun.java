package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "arena_runs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ArenaRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "boss_id", nullable = false, length = 64)
    private String bossId;

    @Column(name = "initial_equity", nullable = false, precision = 15, scale = 2)
    private BigDecimal initialEquity;

    @Column(name = "final_equity", nullable = false, precision = 15, scale = 2)
    private BigDecimal finalEquity;

    @Column(name = "net_pnl", nullable = false, precision = 15, scale = 2)
    private BigDecimal netPnl;

    @Column(name = "return_pct", nullable = false, precision = 8, scale = 4)
    private BigDecimal returnPct;

    @Column(name = "max_drawdown_pct", nullable = false, precision = 8, scale = 4)
    private BigDecimal maxDrawdownPct;

    @Column(name = "survival_seconds", nullable = false)
    private Integer survivalSeconds;

    @Column(nullable = false)
    @Builder.Default
    private Boolean survived = false;

    @Column(name = "rank_grade", nullable = false, length = 8)
    private String rankGrade;

    @Column(nullable = false)
    private Integer score;

    @Column(name = "actions_taken", nullable = false)
    @Builder.Default
    private Integer actionsTaken = 0;

    @Column(name = "hedges_count", nullable = false)
    @Builder.Default
    private Integer hedgesCount = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
