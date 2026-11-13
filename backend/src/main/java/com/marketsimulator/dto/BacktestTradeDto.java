package com.marketsimulator.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
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
public class BacktestTradeDto {

    private Long id;

    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private Instant ts;

    private String symbol;
    private String side; // BUY / SELL
    private BigDecimal qty;
    private BigDecimal price;
    private BigDecimal fee;
    private BigDecimal cashAfter;
}
