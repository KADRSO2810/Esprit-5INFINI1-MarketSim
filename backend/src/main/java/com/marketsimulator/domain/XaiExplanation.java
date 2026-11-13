package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
    name = "xai_explanations",
    indexes = @Index(name = "idx_xai_run_bank_type", columnList = "run_id, bank_id, explanation_type")
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class XaiExplanation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id", nullable = false)
    private StressRun run;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bank_id")
    private Bank bank; // null for GLOBAL explanation

    @Column(name = "explanation_type", nullable = false, length = 32)
    private String explanationType; // "GLOBAL" or "LOCAL"

    @Column(name = "content_json", nullable = false, columnDefinition = "MEDIUMTEXT")
    private String contentJson;
}
