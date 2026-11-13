package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "backtest_trades",
        indexes = @Index(name = "idx_trade_run_ts", columnList = "run_id, ts"))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class BacktestTrade {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "run_id", nullable = false)
    private BacktestRun run;

    @Column(nullable = false)
    private Instant ts;

    @Column(nullable = false, length = 32)
    private String symbol;

    @Column(nullable = false, length = 8)
    private String side; // BUY or SELL

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal qty;

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal price;

    @Column(nullable = false, precision = 18, scale = 6)
    @Builder.Default
    private BigDecimal fee = BigDecimal.ZERO;

    @Column(name = "cash_after", nullable = false, precision = 18, scale = 6)
    private BigDecimal cashAfter;
}
