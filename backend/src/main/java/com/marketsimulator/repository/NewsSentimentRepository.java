package com.marketsimulator.repository;

import com.marketsimulator.domain.NewsArticle;
import com.marketsimulator.domain.NewsSentiment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NewsSentimentRepository extends JpaRepository<NewsSentiment, Long> {

    List<NewsSentiment> findByArticle(NewsArticle article);

    Optional<NewsSentiment> findByArticleAndModel(NewsArticle article, String model);

    void deleteByArticle(NewsArticle article);
}
