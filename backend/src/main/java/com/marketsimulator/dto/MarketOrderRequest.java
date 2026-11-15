package com.marketsimulator.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MarketOrderRequest {

    @NotBlank(message = "Symbol is required")
    private String symbol;

    @NotNull(message = "Side is required (BUY or SELL)")
    @Pattern(regexp = "^(BUY|SELL)$", message = "Side must be BUY or SELL")
    private String side;

    @NotNull(message = "Quantity is required")
    @DecimalMin(value = "0.000001", message = "Quantity must be positive")
    private BigDecimal quantity;

    @DecimalMin(value = "0.000001", message = "Stop-loss must be positive")
    private BigDecimal stopLoss;

    @DecimalMin(value = "0.000001", message = "Take-profit must be positive")
    private BigDecimal takeProfit;

    @Pattern(regexp = "^(MARKET|LIMIT)$", message = "Order type must be MARKET or LIMIT")
    private String orderType; // MARKET or LIMIT (defaults to MARKET)

    @DecimalMin(value = "0.000001", message = "Limit price must be positive")
    private BigDecimal limitPrice;
}
