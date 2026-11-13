package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "portfolio_snapshots")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class PortfolioSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "portfolio_id", nullable = false)
    private Portfolio portfolio;

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal equity;

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal cash;

    @Column(nullable = false)
    @Builder.Default
    private Instant ts = Instant.now();
}
