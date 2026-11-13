package com.marketsimulator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NewsArticleDto {
    private Long id;
    private String symbol;
    private List<String> symbols;
    private String headline;
    private String summary;
    private String url;
    private String source;
    private String imageUrl;
    private LocalDateTime publishedAt;
    private NewsSentimentDto sentiment;
}
