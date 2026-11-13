package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "risk_limits")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RiskLimit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Builder.Default
    @Column(name = "max_risk_per_trade_pct", nullable = false, precision = 5, scale = 2)
    private BigDecimal maxRiskPerTradePct = new BigDecimal("2.00");

    @Builder.Default
    @Column(name = "max_asset_exposure_pct", nullable = false, precision = 5, scale = 2)
    private BigDecimal maxAssetExposurePct = new BigDecimal("20.00");

    @Builder.Default
    @Column(name = "max_sector_exposure_pct", nullable = false, precision = 5, scale = 2)
    private BigDecimal maxSectorExposurePct = new BigDecimal("40.00");

    @Builder.Default
    @Column(name = "max_portfolio_exposure_pct", nullable = false, precision = 5, scale = 2)
    private BigDecimal maxPortfolioExposurePct = new BigDecimal("100.00");

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
