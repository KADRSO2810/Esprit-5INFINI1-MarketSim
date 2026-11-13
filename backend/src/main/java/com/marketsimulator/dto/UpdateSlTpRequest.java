package com.marketsimulator.dto;

import jakarta.validation.constraints.DecimalMin;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateSlTpRequest {

    @DecimalMin(value = "0.000001", message = "Stop-loss must be strictly positive")
    private BigDecimal stopLoss;

    @DecimalMin(value = "0.000001", message = "Take-profit must be strictly positive")
    private BigDecimal takeProfit;
}
