-- Migration V2: Tables de stockage des actifs et des cotations temps réel

CREATE TABLE market_assets (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(255) NULL,
    exchange VARCHAR(64) NULL,
    currency VARCHAR(16) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE market_quotes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL,
    price DECIMAL(18,6) NOT NULL,
    ts TIMESTAMP(3) NOT NULL,
    source VARCHAR(32) NOT NULL DEFAULT 'FINNHUB',
    INDEX idx_symbol_ts (symbol, ts)
);
