package com.marketsimulator.repository;

import com.marketsimulator.domain.Strategy;
import com.marketsimulator.domain.StrategyExecution;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StrategyExecutionRepository extends JpaRepository<StrategyExecution, Long> {

    List<StrategyExecution> findByStrategyOrderByTsDesc(Strategy strategy, Pageable pageable);

    List<StrategyExecution> findByStrategyIdOrderByTsDesc(Long strategyId, Pageable pageable);

    List<StrategyExecution> findByStrategyOrderByTsAsc(Strategy strategy);
}
