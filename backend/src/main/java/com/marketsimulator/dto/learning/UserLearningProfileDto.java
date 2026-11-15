package com.marketsimulator.dto.learning;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserLearningProfileDto {
    private Long userId;
    private Set<String> completedLessonIds;
    private Set<String> passedQuizIds;
    private Map<String, BigDecimal> quizBestScores;
    private List<UserBadgeDto> badges;
    private int completedLessonsCount;
    private int totalLessonsCount;
    private int passedQuizzesCount;
    private int totalQuizzesCount;
    private BigDecimal overallProgressPct;
    private String userTitle; // e.g. "Trader Débutant", "Analyste Confirmé", "Expert Financier Senior"
}
