package com.marketsimulator.repository;

import com.marketsimulator.domain.Strategy;
import com.marketsimulator.domain.StrategySignal;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StrategySignalRepository extends JpaRepository<StrategySignal, Long> {

    List<StrategySignal> findByStrategyOrderByTsDesc(Strategy strategy, Pageable pageable);

    List<StrategySignal> findByStrategyIdOrderByTsDesc(Long strategyId, Pageable pageable);

    Optional<StrategySignal> findTopByStrategyAndSymbolOrderByTsDesc(Strategy strategy, String symbol);
}
