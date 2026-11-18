package com.marketsimulator.dto.arena;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ArenaBossDto {
    private String id;
    private String name;
    private String subtitle;
    private Integer year;
    private String difficulty; // "EXTRÊME", "HARDCORE", "LÉGENDAIRE", "ÉPIQUE"
    private String themeColor; // hex or tailwind class
    private Double initialEquity;
    private Integer durationSeconds;
    private String lore;
    private String mechanicsDescription;
    private Double historicalMaxDrawdown;
    private Double vixSpike;
    private String assetName; // e.g. "S&P 500 Index (SPX)", "Crude Oil & Inflation Index", "Global Banking Index"
    private Double initialPrice;
    private List<ArenaCrisisEventDto> events;
    private List<ArenaPricePointDto> priceTrajectory;
}
