package com.marketsimulator.dto.arena;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ArenaPricePointDto {
    private Integer timeSec;
    private Double price;
    private Double vix;
    private Double marketReturnPct;
    private Double liquidityIndex; // 0.0 (frozen) to 1.0 (liquid)
}
