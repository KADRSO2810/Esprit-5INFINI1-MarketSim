package com.marketsimulator.dto.signal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScanSignalsRequest {
    private String assetFilter; // "ALL", "GOLD", "STOCKS"
    private boolean forceSimulatedScan;
    private Double minRiskReward;
}
