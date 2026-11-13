-- =========================================================================
-- V6: Crisis Replay Mode (COVID-19 2020) and Isolated Replay Portfolios
-- Compatible with MariaDB 10.4+ / MySQL 8.0+
-- =========================================================================

-- 1. Table des scénarios de crise
CREATE TABLE IF NOT EXISTS replay_scenarios (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    default_from_epoch BIGINT NOT NULL,
    default_to_epoch BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed du scénario COVID-19 2020 (01/02/2020 au 01/11/2020 UTC)
INSERT INTO replay_scenarios (code, name, description, default_from_epoch, default_to_epoch)
VALUES (
    'COVID_2020',
    'Krach & Reprise COVID-19 (2020)',
    'Revivez le krach boursier historique de février-mars 2020 et la reprise spectaculaire sous injections massives de liquidités des banques centrales (février à novembre 2020).',
    1580515200, -- 2020-02-01 00:00:00 UTC
    1604188800  -- 2020-11-01 00:00:00 UTC
) ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 2. Table des sessions de replay utilisateur
CREATE TABLE IF NOT EXISTS replay_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    scenario_id BIGINT NOT NULL,
    resolution VARCHAR(8) NOT NULL DEFAULT '15',
    speed INT NOT NULL DEFAULT 20,
    status VARCHAR(16) NOT NULL DEFAULT 'PAUSED', -- CREATED | PLAYING | PAUSED | DONE | FAILED
    from_epoch BIGINT NOT NULL,
    to_epoch BIGINT NOT NULL,
    current_epoch BIGINT NOT NULL,
    symbols_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_replay_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_replay_scenario FOREIGN KEY (scenario_id) REFERENCES replay_scenarios(id) ON DELETE CASCADE,
    INDEX idx_replay_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Isolation du portefeuille REPLAY vs LIVE
-- Ajouter session_id à la table portfolios (0 = LIVE, >0 = replay session)
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS session_id BIGINT NOT NULL DEFAULT 0;
ALTER TABLE portfolios DROP FOREIGN KEY IF EXISTS fk_portfolio_user;
ALTER TABLE portfolios DROP INDEX IF EXISTS user_id;
ALTER TABLE portfolios DROP INDEX IF EXISTS uq_portfolio_user_session;
ALTER TABLE portfolios ADD UNIQUE KEY uq_portfolio_user_session (user_id, session_id);
ALTER TABLE portfolios ADD CONSTRAINT fk_portfolio_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
