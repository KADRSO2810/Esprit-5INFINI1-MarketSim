package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
    name = "news_articles",
    indexes = {
        @Index(name = "idx_news_published_at", columnList = "published_at")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NewsArticle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 32)
    @Builder.Default
    private String provider = "FINNHUB";

    @Column(name = "provider_id", length = 128)
    private String providerId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String headline;

    @Column(columnDefinition = "MEDIUMTEXT")
    private String summary;

    @Column(nullable = false, length = 1024)
    private String url;

    @Column(name = "image_url", length = 1024)
    private String imageUrl;

    @Column(length = 128)
    private String source;

    @Column(name = "published_at", nullable = false)
    private LocalDateTime publishedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "article", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<NewsSymbol> symbols = new ArrayList<>();

    @OneToMany(mappedBy = "article", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<NewsSentiment> sentiments = new ArrayList<>();
}
