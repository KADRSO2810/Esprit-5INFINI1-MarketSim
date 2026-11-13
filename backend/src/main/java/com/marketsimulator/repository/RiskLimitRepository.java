package com.marketsimulator.repository;

import com.marketsimulator.domain.RiskLimit;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface RiskLimitRepository extends JpaRepository<RiskLimit, Long> {

    Optional<RiskLimit> findByUserId(Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM RiskLimit r WHERE r.user.id = :userId")
    Optional<RiskLimit> findByUserIdWithLock(@Param("userId") Long userId);
}
