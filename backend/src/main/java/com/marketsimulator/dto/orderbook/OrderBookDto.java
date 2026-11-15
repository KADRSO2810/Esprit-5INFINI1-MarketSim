package com.marketsimulator.dto.orderbook;

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
public class OrderBookDto {
    private String symbol;
    private BigDecimal lastPrice;
    private BigDecimal bestBid;
    private BigDecimal bestAsk;
    private BigDecimal spread;
    private BigDecimal spreadPercentage;
    private List<OrderBookEntryDto> bids; // Highest price to lowest (green)
    private List<OrderBookEntryDto> asks; // Lowest price to highest (red)
    private BigDecimal totalBidVolume;
    private BigDecimal totalAskVolume;
    private Instant timestamp;
    private String assetClass;
}
