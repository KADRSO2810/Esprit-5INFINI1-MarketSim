-- Migration V13: Portfolio Risk Intelligence & Post-Trade Analytics
-- Tables: risk_alerts, post_trade_risk_evaluations

CREATE TABLE IF NOT EXISTS risk_alerts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    portfolio_id BIGINT NOT NULL,
    alert_type VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    metric_name VARCHAR(64),
    metric_value DECIMAL(18,6),
    threshold_value DECIMAL(18,6),
    affected_symbols VARCHAR(255),
    suggestion TEXT,
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_risk_alerts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_risk_alerts_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
);

CREATE INDEX idx_risk_alerts_user_time ON risk_alerts(user_id, created_at DESC);
CREATE INDEX idx_risk_alerts_type ON risk_alerts(user_id, alert_type, acknowledged);

CREATE TABLE IF NOT EXISTS post_trade_risk_evaluations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    portfolio_id BIGINT NOT NULL,
    trade_id BIGINT,
    symbol VARCHAR(32) NOT NULL,
    side VARCHAR(8) NOT NULL,
    quantity DECIMAL(18,6) NOT NULL,
    price DECIMAL(18,6) NOT NULL,
    equity_before DECIMAL(18,2) NOT NULL,
    equity_after DECIMAL(18,2) NOT NULL,
    exposure_pct_before DECIMAL(8,4) NOT NULL,
    exposure_pct_after DECIMAL(8,4) NOT NULL,
    var95_before DECIMAL(18,2),
    var95_after DECIMAL(18,2),
    delta_exposure_pct DECIMAL(8,4),
    delta_var95 DECIMAL(18,2),
    concentration_hhi_before DECIMAL(10,2),
    concentration_hhi_after DECIMAL(10,2),
    warnings_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_post_trade_risk_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
);

CREATE INDEX idx_post_trade_risk_portfolio ON post_trade_risk_evaluations(portfolio_id, created_at DESC);
