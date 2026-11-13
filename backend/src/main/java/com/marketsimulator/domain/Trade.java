package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "trades")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Trade {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "portfolio_id", nullable = false)
    private Portfolio portfolio;

    @Column(nullable = false, length = 32)
    private String symbol;

    @Column(nullable = false, length = 8)
    private String side;  // BUY | SELL

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal quantity;

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal price;

    @Column(nullable = false, precision = 18, scale = 6)
    @Builder.Default
    private BigDecimal fee = BigDecimal.ZERO;

    @Column(name = "realized_pnl", precision = 18, scale = 6)
    private BigDecimal realizedPnl;  // null for BUY

    @Column(name = "trade_reason", length = 64)
    private String tradeReason;

    @Column(nullable = false)
    @Builder.Default
    private Instant ts = Instant.now();
}
