package com.marketsimulator.repository;

import com.marketsimulator.domain.NewsArticle;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface NewsArticleRepository extends JpaRepository<NewsArticle, Long> {

    Optional<NewsArticle> findByUrl(String url);

    boolean existsByUrl(String url);

    @Query("SELECT DISTINCT a FROM NewsArticle a JOIN a.symbols s " +
           "WHERE s.symbol = :symbol AND a.publishedAt BETWEEN :from AND :to " +
           "ORDER BY a.publishedAt DESC")
    List<NewsArticle> findBySymbolAndPublishedAtBetweenOrderByPublishedAtDesc(
            @Param("symbol") String symbol,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to
    );

    @Query("SELECT DISTINCT a FROM NewsArticle a JOIN a.symbols s " +
           "WHERE s.symbol IN :symbols AND a.publishedAt BETWEEN :from AND :to " +
           "ORDER BY a.publishedAt DESC")
    List<NewsArticle> findBySymbolsInAndPublishedAtBetweenOrderByPublishedAtDesc(
            @Param("symbols") Collection<String> symbols,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to
    );

    @Query("SELECT DISTINCT a FROM NewsArticle a JOIN a.symbols s " +
           "WHERE s.symbol = :symbol AND a.publishedAt BETWEEN :from AND :to " +
           "AND NOT EXISTS (SELECT ns FROM NewsSentiment ns WHERE ns.article = a) " +
           "ORDER BY a.publishedAt DESC")
    List<NewsArticle> findUnanalyzedBySymbolAndDateRange(
            @Param("symbol") String symbol,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            Pageable pageable
    );

    @Query("SELECT DISTINCT a FROM NewsArticle a " +
           "WHERE a.publishedAt BETWEEN :from AND :to " +
           "ORDER BY a.publishedAt DESC")
    List<NewsArticle> findByPublishedAtBetweenOrderByPublishedAtDesc(
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to
    );
}
