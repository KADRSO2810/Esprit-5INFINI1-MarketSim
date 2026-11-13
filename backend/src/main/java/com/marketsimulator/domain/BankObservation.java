package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "bank_observations",
    uniqueConstraints = @UniqueConstraint(name = "uq_bank_period", columnNames = {"bank_id", "period_date"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BankObservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bank_id", nullable = false)
    private Bank bank;

    @Column(name = "period_date", nullable = false)
    private LocalDate periodDate;

    @Column(name = "features_json", nullable = false, columnDefinition = "TEXT")
    private String featuresJson;

    @Column(name = "target_json", nullable = false, columnDefinition = "TEXT")
    private String targetJson;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
