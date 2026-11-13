package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "news_sentiments",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_article_model", columnNames = {"article_id", "model"})
    },
    indexes = {
        @Index(name = "idx_sentiment_label", columnList = "label")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NewsSentiment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "article_id", nullable = false)
    private NewsArticle article;

    @Column(nullable = false, length = 64)
    @Builder.Default
    private String model = "FINBERT";

    @Column(nullable = false, length = 16)
    private String label; // POSITIVE, NEGATIVE, NEUTRAL

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal score;

    @Column(name = "details_json", nullable = false, columnDefinition = "MEDIUMTEXT")
    private String detailsJson;

    @Column(name = "xai_json", columnDefinition = "MEDIUMTEXT")
    private String xaiJson;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
