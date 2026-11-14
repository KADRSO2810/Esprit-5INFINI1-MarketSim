package com.marketsimulator.dto.multiasset;

import com.marketsimulator.domain.AssetClass;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetAllocationBreakdownDto {
    private BigDecimal totalPortfolioValue;
    private BigDecimal cashBalance;
    private BigDecimal cashWeightPct;

    private Map<AssetClass, BigDecimal> valuesByAssetClass;
    private Map<AssetClass, BigDecimal> weightsByAssetClass;

    private List<AssetClassSliceDto> slices;

    private boolean isDiversified;
    private String riskCommentary;
    private List<String> concentrationAlerts;
    private Instant calculatedAt;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AssetClassSliceDto {
        private AssetClass assetClass;
        private String label;
        private BigDecimal marketValue;
        private BigDecimal weightPct;
        private int positionsCount;
        private String colorCode;
    }
}
