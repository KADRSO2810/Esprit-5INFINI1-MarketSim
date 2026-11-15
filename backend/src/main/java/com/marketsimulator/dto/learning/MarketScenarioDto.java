package com.marketsimulator.dto.learning;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MarketScenarioDto {
    private String id;
    private String title;
    private String category;
    private String difficulty; // NOVICE, INTERMEDIATE, EXPERT
    private String context;
    private String eventTrigger;
    private Map<String, String> assetImpacts;
    private String targetObjective;
    private String recommendedAction;
    private List<String> educationalTakeaways;
    private String primarySymbol;
}
