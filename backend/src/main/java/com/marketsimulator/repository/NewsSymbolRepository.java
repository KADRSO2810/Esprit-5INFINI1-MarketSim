package com.marketsimulator.repository;

import com.marketsimulator.domain.NewsArticle;
import com.marketsimulator.domain.NewsSymbol;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NewsSymbolRepository extends JpaRepository<NewsSymbol, Long> {

    List<NewsSymbol> findByArticle(NewsArticle article);

    Optional<NewsSymbol> findByArticleAndSymbol(NewsArticle article, String symbol);

    boolean existsByArticleAndSymbol(NewsArticle article, String symbol);
}
