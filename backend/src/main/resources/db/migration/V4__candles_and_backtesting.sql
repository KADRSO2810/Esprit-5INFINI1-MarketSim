-- ============================================================
-- V4 : Candles and Backtesting Tables (MariaDB compatible)
-- market_candles, backtest_runs, backtest_trades, backtest_equity_points
-- ============================================================

-- Table pour stocker les bougies OHLCV réelles issues de Finnhub REST
CREATE TABLE IF NOT EXISTS market_candles (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol      VARCHAR(32)    NOT NULL,
    resolution  VARCHAR(8)     NOT NULL COMMENT '1, 5, 15, 60, D',
    ts          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Heure de début de la bougie',
    open        DECIMAL(18,6)  NOT NULL,
    high        DECIMAL(18,6)  NOT NULL,
    low         DECIMAL(18,6)  NOT NULL,
    close       DECIMAL(18,6)  NOT NULL,
    volume      DECIMAL(18,6)  NOT NULL,
    UNIQUE KEY uq_candle (symbol, resolution, ts),
    INDEX idx_candle_search (symbol, resolution, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table des exécutions de backtest
CREATE TABLE IF NOT EXISTS backtest_runs (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id        BIGINT         NOT NULL,
    symbol         VARCHAR(32)    NOT NULL,
    resolution     VARCHAR(8)     NOT NULL,
    from_ts        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    to_ts          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    strategy       VARCHAR(64)    NOT NULL DEFAULT 'SMA_CROSS',
    params_json    TEXT           NOT NULL,
    initial_cash   DECIMAL(18,2)  NOT NULL,
    status         VARCHAR(16)    NOT NULL COMMENT 'QUEUED, RUNNING, DONE, FAILED',
    error_message  TEXT           NULL,
    total_return   DECIMAL(18,4)  NULL COMMENT 'Rendement total en %',
    max_drawdown   DECIMAL(18,4)  NULL COMMENT 'Drawdown maximal en %',
    sharpe_ratio   DECIMAL(18,4)  NULL COMMENT 'Ratio de Sharpe annualisé approx.',
    trades_count   INT            NULL,
    win_rate       DECIMAL(18,4)  NULL COMMENT 'Taux de trades gagnants en %',
    created_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_backtest_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_backtest_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Trades générés pendant la simulation de backtest
CREATE TABLE IF NOT EXISTS backtest_trades (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    run_id      BIGINT         NOT NULL,
    ts          TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    symbol      VARCHAR(32)    NOT NULL,
    side        VARCHAR(8)     NOT NULL COMMENT 'BUY ou SELL',
    qty         DECIMAL(18,6)  NOT NULL,
    price       DECIMAL(18,6)  NOT NULL,
    fee         DECIMAL(18,6)  NOT NULL DEFAULT 0,
    cash_after  DECIMAL(18,6)  NOT NULL,
    CONSTRAINT fk_trade_run FOREIGN KEY (run_id) REFERENCES backtest_runs (id) ON DELETE CASCADE,
    INDEX idx_trade_run_ts (run_id, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Courbe d'equity temporelle de la simulation
CREATE TABLE IF NOT EXISTS backtest_equity_points (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    run_id      BIGINT         NOT NULL,
    ts          TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    equity      DECIMAL(18,6)  NOT NULL,
    CONSTRAINT fk_equity_run FOREIGN KEY (run_id) REFERENCES backtest_runs (id) ON DELETE CASCADE,
    INDEX idx_equity_run_ts (run_id, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
