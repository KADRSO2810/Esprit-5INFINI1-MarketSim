package com.marketsimulator.repository;

import com.marketsimulator.domain.LearningProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LearningProgressRepository extends JpaRepository<LearningProgress, Long> {
    List<LearningProgress> findByUserId(Long userId);
    Optional<LearningProgress> findByUserIdAndLessonId(Long userId, String lessonId);
    long countByUserId(Long userId);
    long countByUserIdAndModuleId(Long userId, String moduleId);
}
