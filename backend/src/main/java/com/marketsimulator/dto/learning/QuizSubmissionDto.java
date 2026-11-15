package com.marketsimulator.dto.learning;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuizSubmissionDto {
    private String quizId;
    /**
     * Map of questionId -> selectedOptionIndex (0-based)
     */
    private Map<String, Integer> answers;
}
