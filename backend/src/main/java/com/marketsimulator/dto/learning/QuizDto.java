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
public class QuizDto {
    private String id;
    private String moduleId;
    private String title;
    private String description;
    private int passingScorePct;
    private List<QuizQuestionDto> questions;
}
