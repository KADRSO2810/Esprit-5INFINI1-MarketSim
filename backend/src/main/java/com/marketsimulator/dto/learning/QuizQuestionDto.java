package com.marketsimulator.dto.learning;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuizQuestionDto {
    private String id;
    private String question;
    private List<String> options;
    private Integer correctOptionIndex; // Cache when returning to client before submission, or reveal on answer
    private String explanation;
}
