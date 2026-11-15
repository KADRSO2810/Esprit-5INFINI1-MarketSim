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
public class LearningModuleDto {
    private String id;
    private String title;
    private String description;
    private String category;
    private String level; // BEGINNER, INTERMEDIATE, ADVANCED
    private String icon;
    private int durationMinutes;
    private int lessonsCount;
    private String quizId;
    private List<LearningLessonDto> lessons;
}
