package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
    name = "strategies",
    indexes = {
        @Index(name = "idx_strat_user_created", columnList = "owner_user_id, created_at")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Strategy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private User ownerUser;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "strategy_type", nullable = false, length = 64)
    private StrategyType strategyType;

    @Column(name = "symbols_json", nullable = false, columnDefinition = "MEDIUMTEXT")
    private String symbolsJson;

    @Column(nullable = false, length = 8)
    @Builder.Default
    private String resolution = "1";

    @Column(name = "params_json", nullable = false, columnDefinition = "MEDIUMTEXT")
    private String paramsJson;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private StrategyMode mode = StrategyMode.LIVE;

    @Column(name = "session_id", nullable = false)
    @Builder.Default
    private Long sessionId = 0L;

    @Column(name = "auto_trade", nullable = false)
    @Builder.Default
    private Boolean autoTrade = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "position_sizing", nullable = false, length = 32)
    @Builder.Default
    private PositionSizingType positionSizing = PositionSizingType.FIXED_NOTIONAL;

    @Column(name = "sizing_value", nullable = false, precision = 18, scale = 6)
    @Builder.Default
    private BigDecimal sizingValue = BigDecimal.valueOf(1000);

    @Column(name = "risk_rules_json", columnDefinition = "MEDIUMTEXT")
    private String riskRulesJson;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private StrategyStatus status = StrategyStatus.STOPPED;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "strategy", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<StrategySignal> signals = new ArrayList<>();

    @OneToMany(mappedBy = "strategy", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<StrategyExecution> executions = new ArrayList<>();
}
