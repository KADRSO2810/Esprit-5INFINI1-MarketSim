package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "custom_challenges")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomChallenge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creator_id", nullable = false)
    private User creator;

    @Column(name = "asset_name", nullable = false, length = 128)
    private String assetName;

    @Column(name = "asset_symbol", nullable = false, length = 32)
    private String assetSymbol;

    @Column(nullable = false, length = 64)
    private String category;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;

    @Column(name = "duration_minutes", nullable = false)
    @Builder.Default
    private Integer durationMinutes = 10;

    @Column(name = "initial_price", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal initialPrice = new BigDecimal("100.00");

    @Column(name = "initial_capital", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal initialCapital = new BigDecimal("50000.00");

    @Column(name = "max_leverage", nullable = false)
    @Builder.Default
    private Integer maxLeverage = 5;

    @Column(nullable = false, length = 32)
    @Builder.Default
    private String status = "ACTIVE";

    @Lob
    @Column(name = "timeline_events", columnDefinition = "LONGTEXT", nullable = false)
    private String timelineEvents;

    @Lob
    @Column(name = "generated_trajectory", columnDefinition = "LONGTEXT", nullable = false)
    private String generatedTrajectory;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
