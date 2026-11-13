package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(
    name = "strategy_signals",
    indexes = {
        @Index(name = "idx_signal_strat_ts", columnList = "strategy_id, ts"),
        @Index(name = "idx_signal_symbol_ts", columnList = "symbol, ts")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StrategySignal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "strategy_id", nullable = false)
    private Strategy strategy;

    @Column(nullable = false)
    private Instant ts;

    @Column(nullable = false, length = 32)
    private String symbol;

    @Enumerated(EnumType.STRING)
    @Column(name = "signal_type", nullable = false, length = 8)
    private SignalType signal; // BUY, SELL, HOLD

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal price;

    @Column(name = "explanation_json", nullable = false, columnDefinition = "MEDIUMTEXT")
    private String explanationJson;
}
