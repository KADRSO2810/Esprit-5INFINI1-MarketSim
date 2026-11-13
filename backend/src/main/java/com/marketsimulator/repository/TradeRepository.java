package com.marketsimulator.repository;

import com.marketsimulator.domain.Trade;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TradeRepository extends JpaRepository<Trade, Long> {

    List<Trade> findByPortfolioIdOrderByTsDesc(Long portfolioId, Pageable pageable);

    @Query("SELECT COALESCE(SUM(t.realizedPnl), 0) FROM Trade t WHERE t.portfolio.id = :portfolioId AND t.side = 'SELL'")
    java.math.BigDecimal sumRealizedPnlByPortfolioId(@Param("portfolioId") Long portfolioId);
}
