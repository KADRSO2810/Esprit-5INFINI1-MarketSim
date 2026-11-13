-- =========================================================================
-- V5: Stress Testing and Explainable AI (XAI) Tables
-- Compatible with MariaDB 10.4+ / MySQL 8.0+
-- =========================================================================

CREATE TABLE IF NOT EXISTS banks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(64) NULL,
    bank_type VARCHAR(32) NOT NULL, -- CONVENTIONAL | NON_CONVENTIONAL
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bank_observations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    bank_id BIGINT NOT NULL,
    period_date DATE NOT NULL,
    features_json TEXT NOT NULL,
    target_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_obs_bank FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE,
    UNIQUE KEY uq_bank_period (bank_id, period_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stress_models (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    model_uuid VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    model_type VARCHAR(64) NOT NULL,
    target_key VARCHAR(64) NOT NULL,
    feature_keys_json TEXT NOT NULL,
    metrics_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stress_scenarios (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    shocks_json TEXT NOT NULL,
    created_by BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_scen_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stress_runs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    scenario_id BIGINT NOT NULL,
    model_id BIGINT NULL,
    status VARCHAR(16) NOT NULL, -- QUEUED | RUNNING | DONE | FAILED
    error_message TEXT NULL,
    started_at TIMESTAMP NULL DEFAULT NULL,
    finished_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_run_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_run_scenario FOREIGN KEY (scenario_id) REFERENCES stress_scenarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_run_model FOREIGN KEY (model_id) REFERENCES stress_models(id) ON DELETE SET NULL,
    INDEX idx_run_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stress_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    run_id BIGINT NOT NULL,
    bank_id BIGINT NOT NULL,
    baseline_json TEXT NOT NULL,
    stressed_json TEXT NOT NULL,
    delta_json TEXT NOT NULL,
    risk_score DECIMAL(18,6) NULL,
    CONSTRAINT fk_res_run FOREIGN KEY (run_id) REFERENCES stress_runs(id) ON DELETE CASCADE,
    CONSTRAINT fk_res_bank FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE,
    INDEX idx_res_run_bank (run_id, bank_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS xai_explanations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    run_id BIGINT NOT NULL,
    bank_id BIGINT NULL,
    explanation_type VARCHAR(32) NOT NULL, -- GLOBAL | LOCAL
    content_json MEDIUMTEXT NOT NULL,
    CONSTRAINT fk_xai_run FOREIGN KEY (run_id) REFERENCES stress_runs(id) ON DELETE CASCADE,
    CONSTRAINT fk_xai_bank FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE,
    INDEX idx_xai_run_bank_type (run_id, bank_id, explanation_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
