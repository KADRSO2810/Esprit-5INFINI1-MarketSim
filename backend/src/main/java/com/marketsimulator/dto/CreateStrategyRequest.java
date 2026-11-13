package com.marketsimulator.dto;

import com.marketsimulator.domain.PositionSizingType;
import com.marketsimulator.domain.StrategyMode;
import com.marketsimulator.domain.StrategyType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateStrategyRequest {

    @NotBlank(message = "Le nom de la stratégie est requis")
    private String name;

    @NotNull(message = "Le type de stratégie est requis")
    private StrategyType strategyType;

    @NotEmpty(message = "Au moins un symbole est requis")
    private List<String> symbols;

    @Builder.Default
    private String resolution = "1";

    @NotNull(message = "Les paramètres d'indicateurs sont requis")
    private Map<String, Object> params;

    @Builder.Default
    private StrategyMode mode = StrategyMode.LIVE;

    @Builder.Default
    private Long sessionId = 0L;

    @Builder.Default
    private Boolean autoTrade = false;

    @Builder.Default
    private PositionSizingType positionSizing = PositionSizingType.FIXED_NOTIONAL;

    @Builder.Default
    private BigDecimal sizingValue = BigDecimal.valueOf(1000);

    private Map<String, Object> riskRules;
}
