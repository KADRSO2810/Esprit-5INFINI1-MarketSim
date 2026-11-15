package com.marketsimulator.dto.learning;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuizResultDto {
    private String quizId;
    private int score;
    private int totalQuestions;
    private BigDecimal percentage;
    private boolean passed;
    private String feedback;
    private Map<String, Integer> correctAnswers;
    private Map<String, String> explanations;
    private List<UserBadgeDto> newlyUnlockedBadges;
}
