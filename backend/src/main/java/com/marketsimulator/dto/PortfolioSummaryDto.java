package com.marketsimulator.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
public class PortfolioSummaryDto {
    private BigDecimal cash;
    private BigDecimal equity;
    private BigDecimal unrealizedPnl;
    private BigDecimal realizedPnl;
    private int positionsCount;
    private Instant updatedAt;
}
