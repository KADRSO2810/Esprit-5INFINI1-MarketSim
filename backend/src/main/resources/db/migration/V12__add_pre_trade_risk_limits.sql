-- Migration V12: Configuration des limites de gestion du risque pré-trade (Pre-Trade Risk Limits)

CREATE TABLE IF NOT EXISTS risk_limits (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    max_risk_per_trade_pct DECIMAL(5,2) NOT NULL DEFAULT 2.00,
    max_asset_exposure_pct DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    max_sector_exposure_pct DECIMAL(5,2) NOT NULL DEFAULT 40.00,
    max_portfolio_exposure_pct DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_risk_limits_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
