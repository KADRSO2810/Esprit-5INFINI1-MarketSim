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
public class ArenaRunResponse {
    private Long id;
    private String bossId;
    private String bossName;
    private Double initialEquity;
    private Double finalEquity;
    private Double netPnl;
    private Double returnPct;
    private Double maxDrawdownPct;
    private Integer survivalSeconds;
    private Boolean survived;
    private String rankGrade; // "SSS", "S", "A", "B", "C", "F"
    private Integer score;
    private Integer xpEarned;
    private String titleEarned; // e.g. "Maître du Risque Systémique", "Surveillant du VIX"
    private String auditFeedback;
    private LocalDateTime createdAt;
}
