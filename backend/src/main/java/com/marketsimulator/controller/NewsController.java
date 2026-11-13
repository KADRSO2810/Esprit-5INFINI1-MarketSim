package com.marketsimulator.controller;

import com.marketsimulator.dto.NewsArticleDto;
import com.marketsimulator.dto.SentimentRecomputeBatchRequest;
import com.marketsimulator.service.NewsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping({"/api/news", "/news"})
@RequiredArgsConstructor
@Tag(name = "News & Sentiment", description = "Actualités réelles Finnhub et analyse de sentiment FinBERT/XAI")
@SecurityRequirement(name = "bearerAuth")
public class NewsController {

    private final NewsService newsService;

    @Operation(summary = "Obtenir les actualités d'un symbole sur une période (avec sentiments)")
    @GetMapping
    public ResponseEntity<List<NewsArticleDto>> getNews(
            @RequestParam(defaultValue = "AAPL") String symbol,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "false") boolean refresh
    ) {
        LocalDate fromDate = from != null ? from : LocalDate.now().minusDays(30);
        LocalDate toDate = to != null ? to : LocalDate.now();

        List<NewsArticleDto> articles = newsService.getNews(symbol, fromDate, toDate, refresh);
        return ResponseEntity.ok(articles);
    }

    @Operation(summary = "Recalculer le sentiment et les explications XAI pour un article")
    @PostMapping("/sentiment/recompute")
    public ResponseEntity<NewsArticleDto> recomputeSentiment(@RequestParam Long articleId) {
        NewsArticleDto updated = newsService.computeSentimentForArticle(articleId);
        return ResponseEntity.ok(updated);
    }

    @Operation(summary = "Calculer le sentiment en lot pour les articles d'un symbole")
    @PostMapping("/sentiment/recompute-batch")
    public ResponseEntity<List<NewsArticleDto>> recomputeSentimentBatch(
            @RequestBody(required = false) SentimentRecomputeBatchRequest request
    ) {
        String symbol = request != null ? request.getSymbol() : "AAPL";
        LocalDate from = request != null ? request.getFrom() : null;
        LocalDate to = request != null ? request.getTo() : null;
        int limit = request != null && request.getLimit() != null ? request.getLimit() : 100;

        List<NewsArticleDto> results = newsService.computeSentimentBatch(symbol, from, to, limit);
        return ResponseEntity.ok(results);
    }
}
