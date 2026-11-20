package com.marketsimulator.dto.signal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SignalTrackRecordDto {
    private double winRate;
    private int totalSignals;
    private int successfulSignals;
    private int failedSignals;
    private double totalProfitPips;
    private double avgRiskReward;
    private double maxDrawdownPct;
    private List<PastSignalResultDto> recentHistory;
}
