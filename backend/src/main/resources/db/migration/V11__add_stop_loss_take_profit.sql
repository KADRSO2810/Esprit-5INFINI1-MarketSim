-- =========================================================================
-- V11: Add Stop-Loss and Take-Profit support to positions and trades
-- =========================================================================

ALTER TABLE positions 
    ADD COLUMN stop_loss DECIMAL(18, 6) NULL DEFAULT NULL,
    ADD COLUMN take_profit DECIMAL(18, 6) NULL DEFAULT NULL;

ALTER TABLE trades
    ADD COLUMN trade_reason VARCHAR(64) NULL DEFAULT NULL;
