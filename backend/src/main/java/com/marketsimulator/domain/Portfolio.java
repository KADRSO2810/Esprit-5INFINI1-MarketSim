package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "portfolios",
    uniqueConstraints = @UniqueConstraint(name = "uq_portfolio_user_session", columnNames = {"user_id", "session_id"})
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Portfolio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "session_id", nullable = false)
    @Builder.Default
    private Long sessionId = 0L;

    @Column(name = "cash_balance", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal cashBalance = BigDecimal.valueOf(100_000);

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
