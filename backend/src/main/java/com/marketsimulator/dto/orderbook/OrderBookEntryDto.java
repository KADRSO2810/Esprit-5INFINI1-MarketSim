package com.marketsimulator.dto.orderbook;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderBookEntryDto {
    private BigDecimal price;
    private BigDecimal quantity;
    private BigDecimal total;
    private double depthPercentage; // 0 to 100% for visual depth bar
    private int orderCount;
}
