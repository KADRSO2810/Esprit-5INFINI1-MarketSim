package com.marketsimulator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PreTradeRiskResponse {

    private String decision; // "APPROVED", "WARNING", "REJECTED"

    private BigDecimal orderNotional;
    private BigDecimal currentCash;
    private BigDecimal cashAfter;
    private BigDecimal portfolioEquity;

    // Portfolio Exposure
    private BigDecimal currentPortfolioExposure;
    private BigDecimal currentPortfolioExposurePct;
    private BigDecimal newPortfolioExposure;
    private BigDecimal newPortfolioExposurePct;

    // Asset Exposure
    private BigDecimal currentAssetExposure;
    private BigDecimal currentAssetExposurePct;
    private BigDecimal newAssetExposure;
    private BigDecimal newAssetExposurePct;

    // Sector Exposure
    private String sector;
    private BigDecimal currentSectorExposurePct;
    private BigDecimal newSectorExposurePct;

    // Risk / Reward
    private BigDecimal potentialLoss;
    private BigDecimal riskPerTradePct;
    private BigDecimal potentialProfit;
    private BigDecimal riskRewardRatio;
    private BigDecimal positionSizePct;

    // Limits & Sizing
    private BigDecimal remainingAvailableExposure;
    private BigDecimal suggestedMaxQuantity;
    private RiskLimitsDto limits;

    // Messages
    private List<String> reasons;
    private List<String> warnings;
    private List<String> rejections;
}
