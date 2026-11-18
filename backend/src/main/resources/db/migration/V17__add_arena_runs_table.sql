CREATE TABLE IF NOT EXISTS arena_runs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    boss_id VARCHAR(64) NOT NULL,
    initial_equity DECIMAL(15,2) NOT NULL,
    final_equity DECIMAL(15,2) NOT NULL,
    net_pnl DECIMAL(15,2) NOT NULL,
    return_pct DECIMAL(8,4) NOT NULL,
    max_drawdown_pct DECIMAL(8,4) NOT NULL,
    survival_seconds INT NOT NULL,
    survived BOOLEAN NOT NULL DEFAULT FALSE,
    rank_grade VARCHAR(8) NOT NULL,
    score INT NOT NULL,
    actions_taken INT NOT NULL DEFAULT 0,
    hedges_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_arena_runs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_arena_runs_user ON arena_runs(user_id);
CREATE INDEX idx_arena_runs_score ON arena_runs(score DESC);
CREATE INDEX idx_arena_runs_boss ON arena_runs(boss_id);
