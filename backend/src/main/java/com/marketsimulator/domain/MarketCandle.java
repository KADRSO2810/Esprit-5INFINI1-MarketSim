package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "market_candles",
        uniqueConstraints = @UniqueConstraint(name = "uq_candle", columnNames = {"symbol", "resolution", "ts"}),
        indexes = @Index(name = "idx_candle_search", columnList = "symbol, resolution, ts"))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MarketCandle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 32)
    private String symbol;

    @Column(nullable = false, length = 8)
    private String resolution;

    @Column(nullable = false)
    private Instant ts;

    @Column(name = "open", nullable = false, precision = 18, scale = 6)
    private BigDecimal open;

    @Column(name = "high", nullable = false, precision = 18, scale = 6)
    private BigDecimal high;

    @Column(name = "low", nullable = false, precision = 18, scale = 6)
    private BigDecimal low;

    @Column(name = "close", nullable = false, precision = 18, scale = 6)
    private BigDecimal close;

    @Column(name = "volume", nullable = false, precision = 18, scale = 6)
    private BigDecimal volume;
}
