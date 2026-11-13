package com.marketsimulator.repository;

import com.marketsimulator.domain.MarketCandle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface MarketCandleRepository extends JpaRepository<MarketCandle, Long> {

    List<MarketCandle> findBySymbolAndResolutionAndTsBetweenOrderByTsAsc(
            String symbol, String resolution, Instant from, Instant to);

    long countBySymbolAndResolutionAndTsBetween(
            String symbol, String resolution, Instant from, Instant to);

    boolean existsBySymbolAndResolutionAndTs(String symbol, String resolution, Instant ts);

    Optional<MarketCandle> findBySymbolAndResolutionAndTs(String symbol, String resolution, Instant ts);

    Optional<MarketCandle> findTopBySymbolAndResolutionOrderByTsDesc(String symbol, String resolution);

    List<MarketCandle> findBySymbolAndResolutionOrderByTsDesc(
            String symbol, String resolution, org.springframework.data.domain.Pageable pageable);

    List<MarketCandle> findBySymbolAndResolutionAndTsLessThanEqualOrderByTsDesc(
            String symbol, String resolution, Instant ts, org.springframework.data.domain.Pageable pageable);
}
