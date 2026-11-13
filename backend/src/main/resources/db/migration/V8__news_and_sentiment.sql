-- =========================================================================
-- V8: News and Financial Sentiment Analysis (Étape 6)
-- MariaDB 10.4+ / MySQL 8.0+ compatible
-- =========================================================================

CREATE TABLE IF NOT EXISTS news_articles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    provider VARCHAR(32) NOT NULL DEFAULT 'FINNHUB',
    provider_id VARCHAR(128) NULL,
    headline TEXT NOT NULL,
    summary MEDIUMTEXT NULL,
    url VARCHAR(1024) NOT NULL,
    image_url VARCHAR(1024) NULL,
    source VARCHAR(128) NULL,
    published_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_news_url (url(255)),
    INDEX idx_news_published_at (published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS news_symbols (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    article_id BIGINT NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    CONSTRAINT fk_news_symbols_article FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE,
    UNIQUE KEY uk_article_symbol (article_id, symbol),
    INDEX idx_symbol_article (symbol, article_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS news_sentiments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    article_id BIGINT NOT NULL,
    model VARCHAR(64) NOT NULL,
    label VARCHAR(16) NOT NULL,
    score DECIMAL(18,6) NOT NULL,
    details_json MEDIUMTEXT NOT NULL,
    xai_json MEDIUMTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_news_sentiments_article FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE,
    UNIQUE KEY uk_article_model (article_id, model),
    INDEX idx_sentiment_label (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
