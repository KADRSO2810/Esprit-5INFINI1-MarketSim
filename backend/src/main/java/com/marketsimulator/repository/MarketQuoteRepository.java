package com.marketsimulator.repository;

import com.marketsimulator.domain.MarketQuote;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MarketQuoteRepository extends JpaRepository<MarketQuote, Long> {

    List<MarketQuote> findBySymbolOrderByTsDesc(String symbol, Pageable pageable);

    Optional<MarketQuote> findFirstBySymbolOrderByTsDesc(String symbol);

    @Query("SELECT q FROM MarketQuote q WHERE q.symbol = :symbol ORDER BY q.ts DESC")
    List<MarketQuote> findRecentQuotes(@Param("symbol") String symbol, Pageable pageable);

    List<MarketQuote> findBySymbolAndTsBetweenOrderByTsAsc(
            String symbol, java.time.Instant from, java.time.Instant to);
}
