package com.marketsimulator.dto.arena;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ArenaLeaderboardEntryDto {
    private Integer rank;
    private Long runId;
    private String traderName;
    private String bossId;
    private String bossName;
    private Double finalEquity;
    private Double netPnl;
    private Double returnPct;
    private Double maxDrawdownPct;
    private Integer survivalSeconds;
    private Boolean survived;
    private String rankGrade;
    private Integer score;
    private LocalDateTime date;
}
