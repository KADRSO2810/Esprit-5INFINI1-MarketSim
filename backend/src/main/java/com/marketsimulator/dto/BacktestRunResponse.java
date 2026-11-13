package com.marketsimulator.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BacktestRunResponse {

    private Long id;
    private String symbol;
    private String resolution;

    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private Instant fromTs;

    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private Instant toTs;

    private String strategy;
    private Map<String, Object> params;
    private BigDecimal initialCash;
    private String status; // QUEUED, RUNNING, DONE, FAILED
    private String errorMessage;

    private BigDecimal totalReturn;
    private BigDecimal maxDrawdown;
    private BigDecimal sharpeRatio;
    private Integer tradesCount;
    private BigDecimal winRate;

    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private Instant createdAt;
}
