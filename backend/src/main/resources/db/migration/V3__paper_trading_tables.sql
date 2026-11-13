-- ============================================================
-- V3 : Paper Trading Tables (MariaDB compatible)
-- portfolios, positions, trades, portfolio_snapshots
-- ============================================================

-- Portefeuille virtuel par utilisateur
CREATE TABLE IF NOT EXISTS portfolios (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id       BIGINT         NOT NULL UNIQUE,
    cash_balance  DECIMAL(18,2)  NOT NULL DEFAULT 100000.00,
    created_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_portfolio_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Positions ouvertes : un enregistrement par (portfolio, symbole)
CREATE TABLE IF NOT EXISTS positions (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    portfolio_id BIGINT        NOT NULL,
    symbol       VARCHAR(32)   NOT NULL,
    quantity     DECIMAL(18,6) NOT NULL DEFAULT 0,
    avg_price    DECIMAL(18,6) NOT NULL DEFAULT 0,
    UNIQUE KEY uq_position (portfolio_id, symbol),
    CONSTRAINT fk_position_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Historique des ordres exécutés
CREATE TABLE IF NOT EXISTS trades (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    portfolio_id  BIGINT        NOT NULL,
    symbol        VARCHAR(32)   NOT NULL,
    side          VARCHAR(8)    NOT NULL COMMENT 'BUY or SELL',
    quantity      DECIMAL(18,6) NOT NULL,
    price         DECIMAL(18,6) NOT NULL,
    fee           DECIMAL(18,6) NOT NULL DEFAULT 0,
    realized_pnl  DECIMAL(18,6) NULL     COMMENT 'Only filled for SELL orders',
    ts            TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_trade_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolios (id) ON DELETE CASCADE,
    INDEX idx_trade_portfolio_ts (portfolio_id, ts),
    INDEX idx_trade_symbol_ts    (symbol, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Snapshots périodiques de la valeur du portefeuille (pour drawdown / equity chart)
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    portfolio_id BIGINT        NOT NULL,
    equity       DECIMAL(18,6) NOT NULL,
    cash         DECIMAL(18,6) NOT NULL,
    ts           TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_snapshot_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolios (id) ON DELETE CASCADE,
    INDEX idx_snapshot_portfolio_ts (portfolio_id, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
