package com.marketsimulator.repository;

import com.marketsimulator.domain.UserBadge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserBadgeRepository extends JpaRepository<UserBadge, Long> {
    List<UserBadge> findByUserIdOrderByUnlockedAtDesc(Long userId);
    boolean existsByUserIdAndBadgeCode(Long userId, String badgeCode);
    Optional<UserBadge> findByUserIdAndBadgeCode(Long userId, String badgeCode);
}
