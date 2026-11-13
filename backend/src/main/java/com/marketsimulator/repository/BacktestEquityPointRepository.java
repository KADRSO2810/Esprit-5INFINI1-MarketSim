package com.marketsimulator.repository;

import com.marketsimulator.domain.BacktestEquityPoint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BacktestEquityPointRepository extends JpaRepository<BacktestEquityPoint, Long> {

    List<BacktestEquityPoint> findByRunIdOrderByTsAsc(Long runId);
}
