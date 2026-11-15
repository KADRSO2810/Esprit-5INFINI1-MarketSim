package com.marketsimulator.repository;

import com.marketsimulator.domain.QuizAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, Long> {
    List<QuizAttempt> findByUserIdOrderByAttemptedAtDesc(Long userId);
    List<QuizAttempt> findByUserIdAndQuizIdOrderByAttemptedAtDesc(Long userId, String quizId);
    Optional<QuizAttempt> findFirstByUserIdAndQuizIdOrderByPercentageDesc(Long userId, String quizId);
    long countByUserIdAndPassedTrue(Long userId);
}
