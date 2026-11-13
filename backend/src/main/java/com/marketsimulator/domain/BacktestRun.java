package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "backtest_runs",
        indexes = @Index(name = "idx_backtest_user_created", columnList = "user_id, created_at"))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class BacktestRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 32)
    private String symbol;

    @Column(nullable = false, length = 8)
    private String resolution;

    @Column(name = "from_ts", nullable = false)
    private Instant fromTs;

    @Column(name = "to_ts", nullable = false)
    private Instant toTs;

    @Column(nullable = false, length = 64)
    @Builder.Default
    private String strategy = "SMA_CROSS";

    @Column(name = "params_json", nullable = false, columnDefinition = "TEXT")
    private String paramsJson;

    @Column(name = "initial_cash", nullable = false, precision = 18, scale = 2)
    private BigDecimal initialCash;

    @Column(nullable = false, length = 16)
    @Builder.Default
    private String status = "QUEUED"; // QUEUED, RUNNING, DONE, FAILED

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "total_return", precision = 18, scale = 4)
    private BigDecimal totalReturn;

    @Column(name = "max_drawdown", precision = 18, scale = 4)
    private BigDecimal maxDrawdown;

    @Column(name = "sharpe_ratio", precision = 18, scale = 4)
    private BigDecimal sharpeRatio;

    @Column(name = "trades_count")
    private Integer tradesCount;

    @Column(name = "win_rate", precision = 18, scale = 4)
    private BigDecimal winRate;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
