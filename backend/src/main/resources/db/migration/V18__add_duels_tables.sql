CREATE TABLE IF NOT EXISTS duel_matches (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    challenger_id BIGINT NOT NULL,
    opponent_type VARCHAR(32) NOT NULL DEFAULT 'AI_QUANT',
    opponent_id BIGINT NULL,
    opponent_email VARCHAR(255) NULL,
    bot_profile VARCHAR(64) NULL,
    scenario_id VARCHAR(64) NOT NULL,
    scenario_title VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    invite_token VARCHAR(64) NOT NULL UNIQUE,
    initial_capital DECIMAL(15,2) NOT NULL DEFAULT 50000.00,
    challenger_pnl DECIMAL(15,2) DEFAULT 0.00,
    challenger_roi DECIMAL(8,4) DEFAULT 0.0000,
    challenger_score INT DEFAULT 0,
    challenger_trades INT DEFAULT 0,
    challenger_equity_curve LONGTEXT NULL,
    opponent_pnl DECIMAL(15,2) DEFAULT 0.00,
    opponent_roi DECIMAL(8,4) DEFAULT 0.0000,
    opponent_score INT DEFAULT 0,
    opponent_trades INT DEFAULT 0,
    opponent_equity_curve LONGTEXT NULL,
    winner_id BIGINT NULL,
    winner_role VARCHAR(32) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    CONSTRAINT fk_duel_challenger FOREIGN KEY (challenger_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_duel_opponent FOREIGN KEY (opponent_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_duel_challenger ON duel_matches(challenger_id);
CREATE INDEX idx_duel_opponent ON duel_matches(opponent_id);
CREATE INDEX idx_duel_opponent_email ON duel_matches(opponent_email);
CREATE INDEX idx_duel_invite_token ON duel_matches(invite_token);
CREATE INDEX idx_duel_status ON duel_matches(status);
