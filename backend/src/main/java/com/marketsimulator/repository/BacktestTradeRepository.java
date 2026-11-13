package com.marketsimulator.repository;

import com.marketsimulator.domain.BacktestTrade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BacktestTradeRepository extends JpaRepository<BacktestTrade, Long> {

    List<BacktestTrade> findByRunIdOrderByTsAsc(Long runId);
}
