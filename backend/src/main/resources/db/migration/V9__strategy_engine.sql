-- =========================================================================
-- V9: Automated Trading Agent, Strategy Lab & Explainability (Étape 7)
-- MariaDB 10.4+ / MySQL 8.0+ compatible
-- =========================================================================

CREATE TABLE IF NOT EXISTS strategies (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_user_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    strategy_type VARCHAR(64) NOT NULL, -- SMA_CROSS | RSI | SMA_SENTIMENT
    symbols_json MEDIUMTEXT NOT NULL,
    resolution VARCHAR(8) NOT NULL DEFAULT '1',
    params_json MEDIUMTEXT NOT NULL,
    mode VARCHAR(16) NOT NULL DEFAULT 'LIVE', -- LIVE | REPLAY
    session_id BIGINT NOT NULL DEFAULT 0,
    auto_trade BOOLEAN NOT NULL DEFAULT FALSE,
    position_sizing VARCHAR(32) NOT NULL DEFAULT 'FIXED_NOTIONAL', -- FIXED_NOTIONAL | PCT_EQUITY
    sizing_value DECIMAL(18,6) NOT NULL DEFAULT 1000.000000,
    risk_rules_json MEDIUMTEXT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'STOPPED', -- RUNNING | STOPPED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_strategies_user FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_strat_user_created (owner_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS strategy_signals (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    strategy_id BIGINT NOT NULL,
    ts TIMESTAMP(3) NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    signal_type VARCHAR(8) NOT NULL, -- BUY | SELL | HOLD
    price DECIMAL(18,6) NOT NULL,
    explanation_json MEDIUMTEXT NOT NULL,
    CONSTRAINT fk_signals_strategy FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE,
    INDEX idx_signal_strat_ts (strategy_id, ts),
    INDEX idx_signal_symbol_ts (symbol, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS strategy_executions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    strategy_id BIGINT NOT NULL,
    ts TIMESTAMP(3) NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    side VARCHAR(8) NOT NULL, -- BUY | SELL
    quantity DECIMAL(18,6) NOT NULL,
    price DECIMAL(18,6) NOT NULL,
    order_result_json MEDIUMTEXT NOT NULL,
    CONSTRAINT fk_executions_strategy FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE,
    INDEX idx_exec_strat_ts (strategy_id, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
