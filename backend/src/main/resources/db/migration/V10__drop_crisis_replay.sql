-- =========================================================================
-- V10: Remove Crisis Replay Mode tables and isolated replay session state
-- =========================================================================

DELETE FROM portfolios WHERE session_id > 0;
DELETE FROM strategies WHERE mode = 'REPLAY' OR session_id > 0;

DROP TABLE IF EXISTS replay_sessions;
DROP TABLE IF EXISTS replay_scenarios;
