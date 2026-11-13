package com.marketsimulator.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.domain.NewsArticle;
import com.marketsimulator.domain.NewsSentiment;
import com.marketsimulator.domain.NewsSymbol;
import com.marketsimulator.dto.*;
import com.marketsimulator.repository.NewsArticleRepository;
import com.marketsimulator.repository.NewsSentimentRepository;
import com.marketsimulator.repository.NewsSymbolRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class NewsService {

    private final NewsArticleRepository newsArticleRepository;
    private final NewsSymbolRepository newsSymbolRepository;
    private final NewsSentimentRepository newsSentimentRepository;
    private final FinnhubNewsClient finnhubNewsClient;
    private final AiServiceClient aiServiceClient;
    private final ObjectMapper objectMapper;

    // Cache des derniers refresh pour éviter d'appeler inutilement l'API Finnhub (5 minutes TTL)
    private final Map<String, Instant> refreshCache = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_SECONDS = 300; // 5 minutes

    /**
     * Rafraîchit les articles de presse réels depuis Finnhub et les stocke en DB.
     */
    @Transactional
    public int refreshCompanyNews(String rawSymbol, LocalDate from, LocalDate to) {
        String symbol = rawSymbol.trim().toUpperCase();
        String cacheKey = symbol + ":" + from + ":" + to;
        Instant lastFetched = refreshCache.get(cacheKey);

        if (lastFetched != null && Instant.now().isBefore(lastFetched.plusSeconds(CACHE_TTL_SECONDS))) {
            log.info("[NEWS CACHE] Période déjà rafraîchie récemment pour {}", cacheKey);
            return 0;
        }

        List<FinnhubNewsItemDto> remoteItems = finnhubNewsClient.fetchCompanyNews(symbol, from, to);
        if (remoteItems == null || remoteItems.isEmpty()) {
            refreshCache.put(cacheKey, Instant.now());
            return 0;
        }

        int insertedCount = 0;
        for (FinnhubNewsItemDto item : remoteItems) {
            if (item.getUrl() == null || item.getUrl().isBlank() || item.getHeadline() == null) {
                continue;
            }

            // Vérifie si l'article existe déjà par son URL
            Optional<NewsArticle> existingOpt = newsArticleRepository.findByUrl(item.getUrl());
            NewsArticle article;

            if (existingOpt.isPresent()) {
                article = existingOpt.get();
            } else {
                LocalDateTime publishedAt = item.getDatetime() != null
                        ? LocalDateTime.ofInstant(Instant.ofEpochSecond(item.getDatetime()), ZoneOffset.UTC)
                        : LocalDateTime.now(ZoneOffset.UTC);

                article = NewsArticle.builder()
                        .provider("FINNHUB")
                        .providerId(item.getId() != null ? String.valueOf(item.getId()) : null)
                        .headline(item.getHeadline().trim())
                        .summary(item.getSummary() != null ? item.getSummary().trim() : "")
                        .url(item.getUrl().trim())
                        .imageUrl(item.getImage() != null ? item.getImage().trim() : null)
                        .source(item.getSource() != null ? item.getSource().trim() : "Finnhub")
                        .publishedAt(publishedAt)
                        .build();

                article = newsArticleRepository.save(article);
                insertedCount++;
            }

            // Associer le symbole si non présent
            if (!newsSymbolRepository.existsByArticleAndSymbol(article, symbol)) {
                NewsSymbol newsSymbol = NewsSymbol.builder()
                        .article(article)
                        .symbol(symbol)
                        .build();
                newsSymbolRepository.save(newsSymbol);
            }
        }

        refreshCache.put(cacheKey, Instant.now());
        log.info("[NEWS INGEST] {} articles sauvegardés pour {} (total items reçus: {})",
                insertedCount, symbol, remoteItems.size());
        return insertedCount;
    }

    /**
     * Récupère les actualités pour un symbole et une plage de dates.
     */
    @Transactional
    public List<NewsArticleDto> getNews(String rawSymbol, LocalDate from, LocalDate to, boolean forceRefresh) {
        String symbol = rawSymbol.trim().toUpperCase();

        if (forceRefresh) {
            refreshCompanyNews(symbol, from, to);
        } else {
            // Si la base ne contient aucun article sur cette période, tenter un rafraîchissement initial
            LocalDateTime fromDt = from.atStartOfDay();
            LocalDateTime toDt = to.atTime(23, 59, 59);
            List<NewsArticle> existing = newsArticleRepository
                    .findBySymbolAndPublishedAtBetweenOrderByPublishedAtDesc(symbol, fromDt, toDt);
            if (existing.isEmpty()) {
                refreshCompanyNews(symbol, from, to);
            }
        }

        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(23, 59, 59);
        List<NewsArticle> articles = newsArticleRepository
                .findBySymbolAndPublishedAtBetweenOrderByPublishedAtDesc(symbol, fromDt, toDt);

        return articles.stream().map(a -> toDto(a, symbol)).collect(Collectors.toList());
    }

    /**
     * Calcule ou recalcule le sentiment IA pour un article unique.
     */
    @Transactional
    public NewsArticleDto computeSentimentForArticle(Long articleId) {
        NewsArticle article = newsArticleRepository.findById(articleId)
                .orElseThrow(() -> new IllegalArgumentException("Article introuvable id=" + articleId));

        String text = buildTextForAnalysis(article);

        SentimentAnalyzeRequest request = SentimentAnalyzeRequest.builder()
                .model("FINBERT")
                .items(List.of(new SentimentAnalyzeRequest.SentimentItem(String.valueOf(article.getId()), text)))
                .withExplanation(true)
                .topK(8)
                .build();

        SentimentAnalyzeResponse response = aiServiceClient.analyzeSentiment(request);
        if (response.getResults() != null && !response.getResults().isEmpty()) {
            SentimentAnalyzeResponse.SentimentResultItem res = response.getResults().get(0);
            saveSentiment(article, res);
        }

        // Recharger avec sentiment
        return toDto(article, null);
    }

    /**
     * Calcule en lot le sentiment IA pour les articles d'un symbole sur une période.
     */
    @Transactional
    public List<NewsArticleDto> computeSentimentBatch(String rawSymbol, LocalDate from, LocalDate to, int limit) {
        String symbol = rawSymbol != null ? rawSymbol.trim().toUpperCase() : null;
        LocalDateTime fromDt = from != null ? from.atStartOfDay() : LocalDate.of(2020, 1, 1).atStartOfDay();
        LocalDateTime toDt = to != null ? to.atTime(23, 59, 59) : LocalDate.now().atTime(23, 59, 59);

        int maxLimit = limit > 0 ? Math.min(limit, 200) : 100;
        List<NewsArticle> candidates;

        if (symbol != null && !symbol.isBlank()) {
            candidates = newsArticleRepository.findUnanalyzedBySymbolAndDateRange(
                    symbol, fromDt, toDt, PageRequest.of(0, maxLimit));
        } else {
            // Tous les articles récents sans sentiment
            List<NewsArticle> all = newsArticleRepository.findByPublishedAtBetweenOrderByPublishedAtDesc(fromDt, toDt);
            candidates = all.stream()
                    .filter(a -> newsSentimentRepository.findByArticle(a).isEmpty())
                    .limit(maxLimit)
                    .collect(Collectors.toList());
        }

        if (candidates.isEmpty()) {
            log.info("[NEWS SENTIMENT BATCH] Aucun article en attente d'analyse de sentiment pour {}", symbol);
            return Collections.emptyList();
        }

        log.info("[NEWS SENTIMENT BATCH] Analyse de {} articles via AI service...", candidates.size());

        List<SentimentAnalyzeRequest.SentimentItem> items = candidates.stream()
                .map(a -> new SentimentAnalyzeRequest.SentimentItem(String.valueOf(a.getId()), buildTextForAnalysis(a)))
                .collect(Collectors.toList());

        SentimentAnalyzeRequest request = SentimentAnalyzeRequest.builder()
                .model("FINBERT")
                .items(items)
                .withExplanation(true)
                .topK(8)
                .build();

        SentimentAnalyzeResponse response = aiServiceClient.analyzeSentiment(request);
        Map<String, SentimentAnalyzeResponse.SentimentResultItem> resultMap = new HashMap<>();
        if (response.getResults() != null) {
            for (SentimentAnalyzeResponse.SentimentResultItem item : response.getResults()) {
                resultMap.put(item.getId(), item);
            }
        }

        for (NewsArticle article : candidates) {
            SentimentAnalyzeResponse.SentimentResultItem res = resultMap.get(String.valueOf(article.getId()));
            if (res != null) {
                saveSentiment(article, res);
            }
        }

        return candidates.stream().map(a -> toDto(a, symbol)).collect(Collectors.toList());
    }

    private void saveSentiment(NewsArticle article, SentimentAnalyzeResponse.SentimentResultItem res) {
        String label = res.getLabel() != null ? res.getLabel().toUpperCase() : "NEUTRAL";
        Double scoreVal = 0.5;
        if (res.getScores() != null && res.getScores().containsKey(label.toLowerCase())) {
            scoreVal = res.getScores().get(label.toLowerCase());
        } else if (res.getScores() != null && !res.getScores().isEmpty()) {
            scoreVal = res.getScores().values().iterator().next();
        }

        BigDecimal score = BigDecimal.valueOf(scoreVal).setScale(6, RoundingMode.HALF_UP);
        String detailsJson = "{}";
        String xaiJson = "{}";

        try {
            if (res.getScores() != null) {
                detailsJson = objectMapper.writeValueAsString(res.getScores());
            }
            if (res.getExplanation() != null) {
                xaiJson = objectMapper.writeValueAsString(res.getExplanation());
            }
        } catch (Exception e) {
            log.warn("Erreur sérialisation json sentiment: {}", e.getMessage());
        }

        Optional<NewsSentiment> existing = newsSentimentRepository.findByArticleAndModel(article, "FINBERT");
        NewsSentiment sentiment;
        if (existing.isPresent()) {
            sentiment = existing.get();
            sentiment.setLabel(label);
            sentiment.setScore(score);
            sentiment.setDetailsJson(detailsJson);
            sentiment.setXaiJson(xaiJson);
        } else {
            sentiment = NewsSentiment.builder()
                    .article(article)
                    .model("FINBERT")
                    .label(label)
                    .score(score)
                    .detailsJson(detailsJson)
                    .xaiJson(xaiJson)
                    .build();
        }
        newsSentimentRepository.save(sentiment);
    }

    private String buildTextForAnalysis(NewsArticle article) {
        StringBuilder sb = new StringBuilder();
        if (article.getHeadline() != null) {
            sb.append(article.getHeadline().trim());
        }
        if (article.getSummary() != null && !article.getSummary().isBlank()) {
            if (sb.length() > 0 && !sb.toString().endsWith(".")) {
                sb.append(". ");
            } else {
                sb.append(" ");
            }
            sb.append(article.getSummary().trim());
        }
        return sb.toString();
    }

    private NewsArticleDto toDto(NewsArticle a, String preferredSymbol) {
        List<String> symbols = a.getSymbols() != null
                ? a.getSymbols().stream().map(NewsSymbol::getSymbol).collect(Collectors.toList())
                : Collections.emptyList();

        String sym = preferredSymbol != null && !preferredSymbol.isBlank()
                ? preferredSymbol
                : (!symbols.isEmpty() ? symbols.get(0) : "MARKET");

        NewsSentimentDto sentimentDto = null;
        List<NewsSentiment> sentiments = newsSentimentRepository.findByArticle(a);
        if (!sentiments.isEmpty()) {
            NewsSentiment ns = sentiments.get(0);
            Map<String, Object> details = parseJsonMap(ns.getDetailsJson());
            Map<String, Object> xai = parseJsonMap(ns.getXaiJson());
            sentimentDto = NewsSentimentDto.builder()
                    .model(ns.getModel())
                    .label(ns.getLabel())
                    .score(ns.getScore())
                    .details(details)
                    .xai(xai)
                    .build();
        }

        return NewsArticleDto.builder()
                .id(a.getId())
                .symbol(sym)
                .symbols(symbols)
                .headline(a.getHeadline())
                .summary(a.getSummary())
                .url(a.getUrl())
                .source(a.getSource())
                .imageUrl(a.getImageUrl())
                .publishedAt(a.getPublishedAt())
                .sentiment(sentimentDto)
                .build();
    }

    private Map<String, Object> parseJsonMap(String json) {
        if (json == null || json.isBlank() || json.equals("{}")) {
            return Collections.emptyMap();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }

    private List<String> parseSymbolsJson(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}
