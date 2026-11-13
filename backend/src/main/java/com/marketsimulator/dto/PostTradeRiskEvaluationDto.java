package com.marketsimulator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PostTradeRiskEvaluationDto {
    private Long id;
    private Long tradeId;
    private String symbol;
    private String side;
    private BigDecimal quantity;
    private BigDecimal price;
    private BigDecimal equityBefore;
    private BigDecimal equityAfter;
    private BigDecimal exposurePctBefore;
    private BigDecimal exposurePctAfter;
    private BigDecimal deltaExposurePct;
    private BigDecimal var95Before;
    private BigDecimal var95After;
    private BigDecimal deltaVar95;
    private BigDecimal concentrationHhiBefore;
    private BigDecimal concentrationHhiAfter;
    private List<String> warnings;
    private Instant createdAt;
}
