package com.marketsimulator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SectorConcentrationDto {
    private String sector;
    private BigDecimal marketValue;
    private BigDecimal weightPct;
    private int assetsCount;
    private List<String> symbols;
}
