package com.marketsimulator.dto.challenge;

import com.marketsimulator.dto.duel.DuelPricePointDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomChallengeDto {

    private Long id;
    private Long creatorId;
    private String creatorName;
    private String assetName;
    private String assetSymbol;
    private String category;
    private String description;
    private int durationMinutes;
    private BigDecimal initialPrice;
    private BigDecimal initialCapital;
    private int maxLeverage;
    private String status;
    private List<ChallengePhaseDto> phases;
    private List<DuelPricePointDto> trajectory;
    private int totalParticipants;
    private LocalDateTime createdAt;
}
