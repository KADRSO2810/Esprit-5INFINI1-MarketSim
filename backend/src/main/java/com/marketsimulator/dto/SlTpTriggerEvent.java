package com.marketsimulator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SlTpTriggerEvent {
    private Long userId;
    private Long sessionId;
    private String symbol;
    private String triggerType; // "STOP_LOSS" or "TAKE_PROFIT"
    private BigDecimal triggerPrice;
    private BigDecimal executionPrice;
    private BigDecimal quantity;
    private BigDecimal realizedPnl;
    private BigDecimal cashAfter;
    private String message;
    private Instant timestamp;
}
