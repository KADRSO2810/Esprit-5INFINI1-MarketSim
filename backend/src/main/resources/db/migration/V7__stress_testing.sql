-- =========================================================================
-- V7: Stress Testing and Explainable AI (XAI) Schema Alignment
-- MariaDB 10.4+ / MySQL 8.0+ compatible
-- =========================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS xai_explanations;
DROP TABLE IF EXISTS stress_results;
DROP TABLE IF EXISTS stress_runs;
DROP TABLE IF EXISTS stress_scenarios;
DROP TABLE IF EXISTS stress_models;
DROP TABLE IF EXISTS bank_observations;
DROP TABLE IF EXISTS banks;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE banks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(64) NULL,
    bank_type VARCHAR(32) NOT NULL, -- CONVENTIONAL | NON_CONVENTIONAL
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bank_name_country (name, country)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bank_observations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    bank_id BIGINT NOT NULL,
    period_date DATE NOT NULL,
    features_json MEDIUMTEXT NOT NULL,
    target_json MEDIUMTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_obs_bank FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE,
    UNIQUE KEY uq_bank_period (bank_id, period_date),
    INDEX idx_bank_period (bank_id, period_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stress_models (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_user_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    target_key VARCHAR(64) NOT NULL,
    feature_keys_json MEDIUMTEXT NOT NULL,
    model_type VARCHAR(64) NOT NULL,
    model_artifact_b64 MEDIUMTEXT NOT NULL,
    metrics_json MEDIUMTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_model_user FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stress_scenarios (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_user_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    shocks_json MEDIUMTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_scen_user FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stress_runs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_user_id BIGINT NOT NULL,
    scenario_id BIGINT NOT NULL,
    model_id BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL, -- QUEUED/RUNNING/DONE/FAILED
    error_message MEDIUMTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL DEFAULT NULL,
    finished_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_run_user FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_run_scenario FOREIGN KEY (scenario_id) REFERENCES stress_scenarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_run_model FOREIGN KEY (model_id) REFERENCES stress_models(id) ON DELETE CASCADE,
    INDEX idx_run_owner_created (owner_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stress_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    run_id BIGINT NOT NULL,
    bank_id BIGINT NOT NULL,
    baseline_pred DECIMAL(18,6) NOT NULL,
    stressed_pred DECIMAL(18,6) NOT NULL,
    delta_pred DECIMAL(18,6) NOT NULL,
    risk_score DECIMAL(18,6) NULL,
    CONSTRAINT fk_res_run FOREIGN KEY (run_id) REFERENCES stress_runs(id) ON DELETE CASCADE,
    CONSTRAINT fk_res_bank FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE,
    UNIQUE KEY uq_run_bank (run_id, bank_id),
    INDEX idx_res_run_bank (run_id, bank_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE xai_explanations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    run_id BIGINT NOT NULL,
    bank_id BIGINT NULL,
    explanation_type VARCHAR(16) NOT NULL, -- GLOBAL | LOCAL
    content_json MEDIUMTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_xai_run FOREIGN KEY (run_id) REFERENCES stress_runs(id) ON DELETE CASCADE,
    CONSTRAINT fk_xai_bank FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE,
    INDEX idx_xai_run_type (run_id, explanation_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
