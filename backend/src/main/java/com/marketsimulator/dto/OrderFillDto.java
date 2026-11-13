package com.marketsimulator.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class OrderFillDto {
    private String status;       // "FILLED"
    private String symbol;
    private String side;
    private BigDecimal quantity;
    private BigDecimal price;
    private BigDecimal fee;
    private BigDecimal realizedPnl;  // null for BUY
    private BigDecimal cashAfter;
    private BigDecimal stopLoss;
    private BigDecimal takeProfit;
    private String tradeReason;
}
