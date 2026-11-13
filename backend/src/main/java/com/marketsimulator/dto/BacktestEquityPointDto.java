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
public class BacktestEquityPointDto {

    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private Instant ts;

    private BigDecimal equity;
}
