package com.marketsimulator.repository;

import com.marketsimulator.domain.RiskAlert;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface RiskAlertRepository extends JpaRepository<RiskAlert, Long> {

    List<RiskAlert> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    List<RiskAlert> findByPortfolioIdOrderByCreatedAtDesc(Long portfolioId, Pageable pageable);

    List<RiskAlert> findByUserIdAndAcknowledgedFalseOrderByCreatedAtDesc(Long userId);

    Optional<RiskAlert> findFirstByUserIdAndAlertTypeAndAcknowledgedFalseOrderByCreatedAtDesc(
            Long userId, String alertType);

    Optional<RiskAlert> findFirstByUserIdAndAlertTypeAndCreatedAtAfterOrderByCreatedAtDesc(
            Long userId, String alertType, Instant after);

    Optional<RiskAlert> findByIdAndUserId(Long id, Long userId);
}
