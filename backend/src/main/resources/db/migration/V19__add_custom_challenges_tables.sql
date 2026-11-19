CREATE TABLE IF NOT EXISTS custom_challenges (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    creator_id BIGINT NOT NULL,
    asset_name VARCHAR(128) NOT NULL,
    asset_symbol VARCHAR(32) NOT NULL,
    category VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 10,
    initial_price DECIMAL(15,2) NOT NULL DEFAULT 100.00,
    initial_capital DECIMAL(15,2) NOT NULL DEFAULT 50000.00,
    max_leverage INT NOT NULL DEFAULT 5,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    timeline_events LONGTEXT NOT NULL,
    generated_trajectory LONGTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL,
    CONSTRAINT fk_challenge_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS custom_challenge_runs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    challenge_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    mode VARCHAR(32) NOT NULL DEFAULT 'SOLO',
    opponent_id BIGINT NULL,
    final_equity DECIMAL(15,2) NOT NULL,
    net_pnl DECIMAL(15,2) NOT NULL,
    return_pct DECIMAL(8,4) NOT NULL,
    max_drawdown_pct DECIMAL(8,4) NOT NULL,
    trades_count INT NOT NULL DEFAULT 0,
    score INT NOT NULL DEFAULT 0,
    equity_curve LONGTEXT NULL,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_run_challenge FOREIGN KEY (challenge_id) REFERENCES custom_challenges(id) ON DELETE CASCADE,
    CONSTRAINT fk_run_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_run_opponent FOREIGN KEY (opponent_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_challenge_status ON custom_challenges(status);
CREATE INDEX idx_challenge_creator ON custom_challenges(creator_id);
CREATE INDEX idx_run_challenge ON custom_challenge_runs(challenge_id);
CREATE INDEX idx_run_user ON custom_challenge_runs(user_id);
CREATE INDEX idx_run_score ON custom_challenge_runs(score DESC);
