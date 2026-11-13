package com.marketsimulator.repository;

import com.marketsimulator.domain.BacktestRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BacktestRunRepository extends JpaRepository<BacktestRun, Long> {

    List<BacktestRun> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<BacktestRun> findByIdAndUserId(Long id, Long userId);
}
