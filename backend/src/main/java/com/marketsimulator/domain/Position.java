package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "positions",
        uniqueConstraints = @UniqueConstraint(columnNames = {"portfolio_id", "symbol"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Position {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "portfolio_id", nullable = false)
    private Portfolio portfolio;

    @Column(nullable = false, length = 32)
    private String symbol;

    @Column(nullable = false, precision = 18, scale = 6)
    @Builder.Default
    private BigDecimal quantity = BigDecimal.ZERO;

    @Column(name = "avg_price", nullable = false, precision = 18, scale = 6)
    @Builder.Default
    private BigDecimal avgPrice = BigDecimal.ZERO;

    @Column(name = "stop_loss", precision = 18, scale = 6)
    private BigDecimal stopLoss;

    @Column(name = "take_profit", precision = 18, scale = 6)
    private BigDecimal takeProfit;
}
