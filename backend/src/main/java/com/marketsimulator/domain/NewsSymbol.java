package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
    name = "news_symbols",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_article_symbol", columnNames = {"article_id", "symbol"})
    },
    indexes = {
        @Index(name = "idx_symbol_article", columnList = "symbol, article_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NewsSymbol {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "article_id", nullable = false)
    private NewsArticle article;

    @Column(nullable = false, length = 32)
    private String symbol;
}
