package com.marketsimulator.repository;

import com.marketsimulator.domain.CustomChallengeRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CustomChallengeRunRepository extends JpaRepository<CustomChallengeRun, Long> {

    List<CustomChallengeRun> findTop25ByChallengeIdOrderByScoreDesc(Long challengeId);

    List<CustomChallengeRun> findByUserIdOrderByCompletedAtDesc(Long userId);
}
