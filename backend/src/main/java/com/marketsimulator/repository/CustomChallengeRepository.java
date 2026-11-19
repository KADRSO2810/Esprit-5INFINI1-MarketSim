package com.marketsimulator.repository;

import com.marketsimulator.domain.CustomChallenge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CustomChallengeRepository extends JpaRepository<CustomChallenge, Long> {

    List<CustomChallenge> findByStatusOrderByCreatedAtDesc(String status);

    List<CustomChallenge> findByCreatorIdOrderByCreatedAtDesc(Long creatorId);
}
