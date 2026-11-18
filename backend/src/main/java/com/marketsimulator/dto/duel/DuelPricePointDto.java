package com.marketsimulator.dto.duel;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DuelPricePointDto {
    private int step;
    private BigDecimal open;
    private BigDecimal high;
    private BigDecimal low;
    private BigDecimal close;
    private long volume;
    private String hint; // Micro-indice technique (ex: "Breakout de résistance", "Spike de volume")
}
