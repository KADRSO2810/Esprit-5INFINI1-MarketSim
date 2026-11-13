package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "risk_alerts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RiskAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "portfolio_id", nullable = false)
    private Portfolio portfolio;

    @Column(name = "alert_type", nullable = false, length = 64)
    private String alertType;

    @Column(nullable = false, length = 16)
    private String severity; // INFO, WARNING, CRITICAL

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "metric_name", length = 64)
    private String metricName;

    @Column(name = "metric_value", precision = 18, scale = 6)
    private BigDecimal metricValue;

    @Column(name = "threshold_value", precision = 18, scale = 6)
    private BigDecimal thresholdValue;

    @Column(name = "affected_symbols", length = 255)
    private String affectedSymbols;

    @Column(columnDefinition = "TEXT")
    private String suggestion;

    @Column(nullable = false)
    @Builder.Default
    private boolean acknowledged = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
