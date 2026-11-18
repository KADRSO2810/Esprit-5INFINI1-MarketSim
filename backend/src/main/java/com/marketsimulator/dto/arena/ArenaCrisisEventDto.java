package com.marketsimulator.dto.arena;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ArenaCrisisEventDto {
    private Integer timeSec; // When it triggers during the 180s run
    private String headline;
    private String severity; // "CRITICAL", "PANIC", "INTERVENTION", "COLLAPSE"
    private String source; // e.g. "BLOOMBERG TERMINAL", "REUTERS EMERGENCY", "FED WIRES"
    private Double shockMultiplier; // Impact on remaining price volatility
    private String hint; // Pedagogical/tactical hint
}
