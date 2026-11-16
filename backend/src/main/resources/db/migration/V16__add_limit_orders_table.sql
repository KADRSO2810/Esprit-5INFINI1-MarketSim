-- =========================================================================
-- V16: Table des Ordres Limites (Carnet d'Ordres Level 2 & Trading Virtuel)
-- =========================================================================

CREATE TABLE IF NOT EXISTS limit_orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    symbol VARCHAR(30) NOT NULL,
    side VARCHAR(10) NOT NULL,
    order_type VARCHAR(10) NOT NULL,
    quantity DECIMAL(19, 6) NOT NULL,
    limit_price DECIMAL(19, 6) NOT NULL,
    stop_loss DECIMAL(19, 6) DEFAULT NULL,
    take_profit DECIMAL(19, 6) DEFAULT NULL,
    status VARCHAR(20) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    filled_at DATETIME(6) DEFAULT NULL,
    INDEX idx_limit_orders_user (user_id),
    INDEX idx_limit_orders_status (status),
    INDEX idx_limit_orders_symbol (symbol),
    CONSTRAINT fk_limit_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
