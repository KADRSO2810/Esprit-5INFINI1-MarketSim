package com.marketsimulator.repository;

import com.marketsimulator.domain.Portfolio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.Optional;

public interface PortfolioRepository extends JpaRepository<Portfolio, Long> {

    default Optional<Portfolio> findByUserId(Long userId) {
        return findByUserIdAndSessionId(userId, 0L);
    }

    default Optional<Portfolio> findByUserIdWithLock(Long userId) {
        return findByUserIdAndSessionIdWithLock(userId, 0L);
    }

    Optional<Portfolio> findByUserIdAndSessionId(Long userId, Long sessionId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Portfolio p WHERE p.user.id = :userId AND p.sessionId = :sessionId")
    Optional<Portfolio> findByUserIdAndSessionIdWithLock(@Param("userId") Long userId, @Param("sessionId") Long sessionId);
}
