package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(
    name = "stress_results",
    uniqueConstraints = @UniqueConstraint(name = "uq_run_bank", columnNames = {"run_id", "bank_id"}),
    indexes = @Index(name = "idx_res_run_bank", columnList = "run_id, bank_id")
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StressResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id", nullable = false)
    private StressRun run;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bank_id", nullable = false)
    private Bank bank;

    @Column(name = "baseline_pred", nullable = false, precision = 18, scale = 6)
    private BigDecimal baselinePred;

    @Column(name = "stressed_pred", nullable = false, precision = 18, scale = 6)
    private BigDecimal stressedPred;

    @Column(name = "delta_pred", nullable = false, precision = 18, scale = 6)
    private BigDecimal deltaPred;

    @Column(name = "risk_score", precision = 18, scale = 6)
    private BigDecimal riskScore;
}
