package com.marketsimulator.dto.learning;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserBadgeDto {
    private String badgeCode;
    private String title;
    private String description;
    private String category;
    private LocalDateTime unlockedAt;
}
