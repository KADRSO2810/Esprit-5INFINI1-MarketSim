package com.marketsimulator.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.dto.NewsArticleDto;
import com.marketsimulator.dto.NewsSentimentDto;
import com.marketsimulator.dto.SentimentRecomputeBatchRequest;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.security.CustomUserDetailsService;
import com.marketsimulator.security.JwtAuthenticationEntryPoint;
import com.marketsimulator.security.JwtTokenProvider;
import com.marketsimulator.security.SecurityConfig;
import com.marketsimulator.service.NewsService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(NewsController.class)
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class})
class NewsControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private NewsService newsService;
    @MockBean private UserRepository userRepository;
    @MockBean private JwtTokenProvider jwtTokenProvider;
    @MockBean private CustomUserDetailsService userDetailsService;

    @Test
    @DisplayName("GET /api/news without auth should return 401")
    void getNews_withoutAuth_shouldReturn401() throws Exception {
        mockMvc.perform(get("/api/news?symbol=AAPL"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/news with auth should return articles")
    @WithMockUser(username = "trader@test.com", roles = {"USER"})
    void getNews_withAuth_shouldReturn200() throws Exception {
        NewsArticleDto article = NewsArticleDto.builder()
                .id(1L)
                .symbol("AAPL")
                .headline("Apple announces emergency measures")
                .summary("Retail stores to temporarily shut down worldwide.")
                .url("https://news.example.com/aapl-1")
                .source("Bloomberg")
                .publishedAt(LocalDateTime.now())
                .sentiment(NewsSentimentDto.builder()
                        .model("FINBERT")
                        .label("NEGATIVE")
                        .score(BigDecimal.valueOf(0.88))
                        .details(Map.of("negative", 0.88, "neutral", 0.08, "positive", 0.04))
                        .xai(Map.of("topTokens", List.of(Map.of("token", "shut", "weight", 0.35))))
                        .build())
                .build();

        when(newsService.getNews(eq("AAPL"), any(LocalDate.class), any(LocalDate.class), eq(false)))
                .thenReturn(List.of(article));

        mockMvc.perform(get("/api/news?symbol=AAPL&from=2020-03-01&to=2020-03-20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].symbol").value("AAPL"))
                .andExpect(jsonPath("$[0].sentiment.label").value("NEGATIVE"));
    }

    @Test
    @DisplayName("POST /api/news/sentiment/recompute with auth should recompute and return article")
    @WithMockUser(username = "trader@test.com", roles = {"USER"})
    void recomputeSentiment_shouldReturnUpdatedArticle() throws Exception {
        NewsArticleDto article = NewsArticleDto.builder()
                .id(10L)
                .symbol("MSFT")
                .headline("Microsoft expands cloud services during crisis")
                .sentiment(NewsSentimentDto.builder()
                        .model("FINBERT")
                        .label("POSITIVE")
                        .score(BigDecimal.valueOf(0.92))
                        .build())
                .build();

        when(newsService.computeSentimentForArticle(10L)).thenReturn(article);

        mockMvc.perform(post("/api/news/sentiment/recompute?articleId=10").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(10))
                .andExpect(jsonPath("$.sentiment.label").value("POSITIVE"));
    }

    @Test
    @DisplayName("POST /api/news/sentiment/recompute-batch should process batch")
    @WithMockUser(username = "trader@test.com", roles = {"USER"})
    void recomputeSentimentBatch_shouldReturnList() throws Exception {
        SentimentRecomputeBatchRequest req = SentimentRecomputeBatchRequest.builder()
                .symbol("AAPL")
                .from(LocalDate.of(2020, 2, 1))
                .to(LocalDate.of(2020, 4, 1))
                .limit(50)
                .build();

        NewsArticleDto article = NewsArticleDto.builder()
                .id(1L)
                .symbol("AAPL")
                .headline("Tech stocks rally on stimulus hope")
                .build();

        when(newsService.computeSentimentBatch(eq("AAPL"), any(LocalDate.class), any(LocalDate.class), eq(50)))
                .thenReturn(List.of(article));

        mockMvc.perform(post("/api/news/sentiment/recompute-batch")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1));
    }
}
