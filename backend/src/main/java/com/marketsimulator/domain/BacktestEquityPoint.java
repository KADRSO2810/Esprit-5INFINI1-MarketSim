package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "backtest_equity_points",
        indexes = @Index(name = "idx_equity_run_ts", columnList = "run_id, ts"))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class BacktestEquityPoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "run_id", nullable = false)
    private BacktestRun run;

    @Column(nullable = false)
    private Instant ts;

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal equity;
}
