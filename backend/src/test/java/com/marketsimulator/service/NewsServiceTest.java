package com.marketsimulator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.domain.NewsArticle;
import com.marketsimulator.domain.NewsSentiment;
import com.marketsimulator.domain.NewsSymbol;
import com.marketsimulator.dto.*;
import com.marketsimulator.repository.NewsArticleRepository;
import com.marketsimulator.repository.NewsSentimentRepository;
import com.marketsimulator.repository.NewsSymbolRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NewsServiceTest {

    @Mock private NewsArticleRepository newsArticleRepository;
    @Mock private NewsSymbolRepository newsSymbolRepository;
    @Mock private NewsSentimentRepository newsSentimentRepository;
    @Mock private FinnhubNewsClient finnhubNewsClient;
    @Mock private AiServiceClient aiServiceClient;

    private ObjectMapper objectMapper;
    private NewsService newsService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        newsService = new NewsService(
                newsArticleRepository,
                newsSymbolRepository,
                newsSentimentRepository,
                finnhubNewsClient,
                aiServiceClient,
                objectMapper
        );
    }

    @Test
    @DisplayName("getNews should return existing articles when already present in DB")
    void getNews_whenArticlesPresent_shouldReturnDtos() {
        NewsArticle article = NewsArticle.builder()
                .id(1L)
                .headline("Tech Sector Rallies")
                .summary("Major indexes rebound sharply.")
                .url("https://example.com/tech-rally")
                .source("Reuters")
                .publishedAt(LocalDateTime.of(2020, 3, 24, 14, 0))
                .build();

        NewsSymbol symbol = NewsSymbol.builder().id(10L).article(article).symbol("AAPL").build();
        article.setSymbols(List.of(symbol));

        when(newsArticleRepository.findBySymbolAndPublishedAtBetweenOrderByPublishedAtDesc(
                eq("AAPL"), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(article));

        List<NewsArticleDto> result = newsService.getNews("AAPL", LocalDate.of(2020, 3, 1), LocalDate.of(2020, 3, 31), false);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getHeadline()).isEqualTo("Tech Sector Rallies");
        assertThat(result.get(0).getSymbol()).isEqualTo("AAPL");
    }

    @Test
    @DisplayName("computeSentimentForArticle should call AI service and persist sentiment")
    void computeSentimentForArticle_shouldPersistSentiment() {
        NewsArticle article = NewsArticle.builder()
                .id(7L)
                .headline("Global markets slump on virus fears")
                .summary("Equities fall across the globe as economic activity halts.")
                .url("https://example.com/slump")
                .source("WSJ")
                .publishedAt(LocalDateTime.of(2020, 3, 9, 10, 0))
                .build();

        when(newsArticleRepository.findById(7L)).thenReturn(Optional.of(article));

        SentimentAnalyzeResponse.SentimentResultItem item = SentimentAnalyzeResponse.SentimentResultItem.builder()
                .id("7")
                .label("NEGATIVE")
                .scores(Map.of("negative", 0.94, "neutral", 0.04, "positive", 0.02))
                .explanation(Map.of("topTokens", List.of(Map.of("token", "slump", "weight", 0.45))))
                .build();

        when(aiServiceClient.analyzeSentiment(any())).thenReturn(
                SentimentAnalyzeResponse.builder().results(List.of(item)).build()
        );

        when(newsSentimentRepository.findByArticleAndModel(article, "FINBERT")).thenReturn(Optional.empty());
        when(newsSentimentRepository.save(any(NewsSentiment.class))).thenAnswer(inv -> inv.getArgument(0));

        NewsArticleDto dto = newsService.computeSentimentForArticle(7L);

        verify(newsSentimentRepository, times(1)).save(any(NewsSentiment.class));
        assertThat(dto).isNotNull();
        assertThat(dto.getId()).isEqualTo(7L);
    }
}
