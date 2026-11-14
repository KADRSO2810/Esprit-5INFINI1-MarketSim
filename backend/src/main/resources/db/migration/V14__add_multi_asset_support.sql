-- Migration V14: Multi-Asset Expansion (Forex, Fixed Income, Commodities)
-- Met à jour market_assets et insère le catalogue multi-actifs institutionnel

ALTER TABLE market_assets ADD COLUMN IF NOT EXISTS asset_class VARCHAR(32) NOT NULL DEFAULT 'EQUITY';
ALTER TABLE market_assets ADD COLUMN IF NOT EXISTS quote_currency VARCHAR(16) DEFAULT 'USD';
ALTER TABLE market_assets ADD COLUMN IF NOT EXISTS price_precision INT DEFAULT 2;
ALTER TABLE market_assets ADD COLUMN IF NOT EXISTS min_quantity DECIMAL(18,6) DEFAULT 0.0001;
ALTER TABLE market_assets ADD COLUMN IF NOT EXISTS unit VARCHAR(32) DEFAULT 'UNIT';
ALTER TABLE market_assets ADD COLUMN IF NOT EXISTS data_source VARCHAR(32) DEFAULT 'FINNHUB';
ALTER TABLE market_assets ADD COLUMN IF NOT EXISTS metadata_json TEXT NULL;

-- Mise à jour des actifs crypto existants
UPDATE market_assets SET asset_class = 'CRYPTO', quote_currency = 'USDT', price_precision = 4, data_source = 'BINANCE'
WHERE symbol LIKE 'BINANCE:%';

-- Insertion / Initialisation du catalogue FOREX
INSERT INTO market_assets (symbol, name, exchange, currency, asset_class, quote_currency, price_precision, min_quantity, unit, data_source)
VALUES
('EUR/USD', 'Euro / US Dollar', 'FOREX', 'USD', 'FOREX', 'USD', 5, 1000.000000, 'Devise (EUR)', 'ECB_FRANKFURTER'),
('GBP/USD', 'British Pound / US Dollar', 'FOREX', 'USD', 'FOREX', 'USD', 5, 1000.000000, 'Devise (GBP)', 'ECB_FRANKFURTER'),
('USD/JPY', 'US Dollar / Japanese Yen', 'FOREX', 'JPY', 'FOREX', 'JPY', 3, 1000.000000, 'Devise (USD)', 'ECB_FRANKFURTER'),
('USD/CHF', 'US Dollar / Swiss Franc', 'FOREX', 'CHF', 'FOREX', 'CHF', 5, 1000.000000, 'Devise (USD)', 'ECB_FRANKFURTER'),
('AUD/USD', 'Australian Dollar / US Dollar', 'FOREX', 'USD', 'FOREX', 'USD', 5, 1000.000000, 'Devise (AUD)', 'ECB_FRANKFURTER'),
('USD/CAD', 'US Dollar / Canadian Dollar', 'FOREX', 'CAD', 'FOREX', 'CAD', 5, 1000.000000, 'Devise (USD)', 'ECB_FRANKFURTER'),
('EUR/GBP', 'Euro / British Pound', 'FOREX', 'GBP', 'FOREX', 'GBP', 5, 1000.000000, 'Devise (EUR)', 'ECB_FRANKFURTER'),
('EUR/JPY', 'Euro / Japanese Yen', 'FOREX', 'JPY', 'FOREX', 'JPY', 3, 1000.000000, 'Devise (EUR)', 'ECB_FRANKFURTER')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    asset_class = VALUES(asset_class),
    quote_currency = VALUES(quote_currency),
    price_precision = VALUES(price_precision),
    data_source = VALUES(data_source);

-- Insertion / Initialisation du catalogue FIXED INCOME / OBLIGATIONS
INSERT INTO market_assets (symbol, name, exchange, currency, asset_class, quote_currency, price_precision, min_quantity, unit, data_source)
VALUES
('IEF', 'iShares 7-10 Year Treasury Bond (Benchmark 10Y US)', 'NASDAQ', 'USD', 'BOND', 'USD', 2, 1.000000, 'Obligation ($100 Par)', 'FINNHUB'),
('TLT', 'iShares 20+ Year Treasury Bond (Dette Long Terme US)', 'NASDAQ', 'USD', 'BOND', 'USD', 2, 1.000000, 'Obligation ($100 Par)', 'FINNHUB'),
('SHY', 'iShares 1-3 Year Treasury Bond (Dette Court Terme US)', 'NASDAQ', 'USD', 'BOND', 'USD', 2, 1.000000, 'Obligation ($100 Par)', 'FINNHUB'),
('BND', 'Vanguard Total Bond Market (Indice Global Obligataire)', 'NASDAQ', 'USD', 'BOND', 'USD', 2, 1.000000, 'Obligation ($100 Par)', 'FINNHUB'),
('LQD', 'iShares Investment Grade Corporate Bond (Crédit Entreprise A/BBB)', 'NYSE Arca', 'USD', 'BOND', 'USD', 2, 1.000000, 'Obligation ($100 Par)', 'FINNHUB'),
('HYG', 'iShares High Yield Corporate Bond (Haut Rendement / Spéculatif)', 'NYSE Arca', 'USD', 'BOND', 'USD', 2, 1.000000, 'Obligation ($100 Par)', 'FINNHUB'),
('TIP', 'iShares TIPS Bond (Obligations US Protégées contre l''Inflation)', 'NYSE Arca', 'USD', 'BOND', 'USD', 2, 1.000000, 'Obligation ($100 Par)', 'FINNHUB')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    asset_class = VALUES(asset_class),
    quote_currency = VALUES(quote_currency),
    price_precision = VALUES(price_precision),
    data_source = VALUES(data_source);

-- Insertion / Initialisation du catalogue MATIÈRES PREMIÈRES (COMMODITIES)
INSERT INTO market_assets (symbol, name, exchange, currency, asset_class, quote_currency, price_precision, min_quantity, unit, data_source)
VALUES
('GLD', 'SPDR Gold Shares (Or Physique Benchmark)', 'NYSE Arca', 'USD', 'COMMODITY', 'USD', 2, 1.000000, 'Once Troy (1/10 oz)', 'FINNHUB'),
('SLV', 'iShares Silver Trust (Argent Physique Benchmark)', 'NYSE Arca', 'USD', 'COMMODITY', 'USD', 2, 1.000000, 'Once d''Argent (1 oz)', 'FINNHUB'),
('USO', 'United States Oil Fund (Pétrole Brut WTI)', 'NYSE Arca', 'USD', 'COMMODITY', 'USD', 2, 1.000000, 'Baril de WTI (42 gal)', 'FINNHUB'),
('BNO', 'United States Brent Oil Fund (Pétrole Brent Mer du Nord)', 'NYSE Arca', 'USD', 'COMMODITY', 'USD', 2, 1.000000, 'Baril de Brent', 'FINNHUB'),
('UNG', 'United States Natural Gas Fund (Gaz Naturel Henry Hub)', 'NYSE Arca', 'USD', 'COMMODITY', 'USD', 2, 1.000000, 'MMBtu (Gaz)', 'FINNHUB'),
('CPER', 'United States Copper Index Fund (Cuivre Industriel)', 'NYSE Arca', 'USD', 'COMMODITY', 'USD', 2, 1.000000, 'Livre de Cuivre', 'FINNHUB'),
('DBA', 'Invesco DB Agriculture Fund (Agriculture & Céréales)', 'NYSE Arca', 'USD', 'COMMODITY', 'USD', 2, 1.000000, 'Panier Agricole', 'FINNHUB')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    asset_class = VALUES(asset_class),
    quote_currency = VALUES(quote_currency),
    price_precision = VALUES(price_precision),
    data_source = VALUES(data_source);
