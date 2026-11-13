package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "post_trade_risk_evaluations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PostTradeRiskEvaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "portfolio_id", nullable = false)
    private Portfolio portfolio;

    @Column(name = "trade_id")
    private Long tradeId;

    @Column(nullable = false, length = 32)
    private String symbol;

    @Column(nullable = false, length = 8)
    private String side; // BUY, SELL

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal quantity;

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal price;

    @Column(name = "equity_before", nullable = false, precision = 18, scale = 2)
    private BigDecimal equityBefore;

    @Column(name = "equity_after", nullable = false, precision = 18, scale = 2)
    private BigDecimal equityAfter;

    @Column(name = "exposure_pct_before", nullable = false, precision = 8, scale = 4)
    private BigDecimal exposurePctBefore;

    @Column(name = "exposure_pct_after", nullable = false, precision = 8, scale = 4)
    private BigDecimal exposurePctAfter;

    @Column(name = "var95_before", precision = 18, scale = 2)
    private BigDecimal var95Before;

    @Column(name = "var95_after", precision = 18, scale = 2)
    private BigDecimal var95After;

    @Column(name = "delta_exposure_pct", precision = 8, scale = 4)
    private BigDecimal deltaExposurePct;

    @Column(name = "delta_var95", precision = 18, scale = 2)
    private BigDecimal deltaVar95;

    @Column(name = "concentration_hhi_before", precision = 10, scale = 2)
    private BigDecimal concentrationHhiBefore;

    @Column(name = "concentration_hhi_after", precision = 10, scale = 2)
    private BigDecimal concentrationHhiAfter;

    @Column(name = "warnings_json", columnDefinition = "TEXT")
    private String warningsJson;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
