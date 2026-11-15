package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "limit_orders")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LimitOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(nullable = false, length = 30)
    private String symbol;

    @Column(nullable = false, length = 10)
    private String side; // BUY or SELL

    @Column(name = "order_type", nullable = false, length = 10)
    private String orderType; // LIMIT

    @Column(nullable = false, precision = 19, scale = 6)
    private BigDecimal quantity;

    @Column(name = "limit_price", nullable = false, precision = 19, scale = 6)
    private BigDecimal limitPrice;

    @Column(name = "stop_loss", precision = 19, scale = 6)
    private BigDecimal stopLoss;

    @Column(name = "take_profit", precision = 19, scale = 6)
    private BigDecimal takeProfit;

    @Column(nullable = false, length = 20)
    private String status; // PENDING, FILLED, CANCELLED

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "filled_at")
    private Instant filledAt;
}
