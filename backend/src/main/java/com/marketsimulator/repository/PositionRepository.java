package com.marketsimulator.repository;

import com.marketsimulator.domain.Position;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

public interface PositionRepository extends JpaRepository<Position, Long> {

    List<Position> findByPortfolioId(Long portfolioId);

    Optional<Position> findByPortfolioIdAndSymbol(Long portfolioId, String symbol);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Position p WHERE p.portfolio.id = :portfolioId AND p.symbol = :symbol")
    Optional<Position> findByPortfolioIdAndSymbolWithLock(@Param("portfolioId") Long portfolioId,
                                                           @Param("symbol") String symbol);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Position p WHERE p.id = :id")
    Optional<Position> findByIdWithLock(@Param("id") Long id);

    @Query("SELECT p FROM Position p JOIN FETCH p.portfolio pf JOIN FETCH pf.user WHERE p.symbol = :symbol AND p.quantity > 0 AND (p.stopLoss IS NOT NULL OR p.takeProfit IS NOT NULL)")
    List<Position> findActiveWithSlTpBySymbol(@Param("symbol") String symbol);
}
