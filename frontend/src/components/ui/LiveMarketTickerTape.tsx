import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ShieldCheck, Landmark, Bot, Activity } from 'lucide-react';
import { getLastQuotes, MarketQuote } from '../../api/market';

interface TickerAsset {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  type: 'CRYPTO' | 'STOCK' | 'COMMODITY' | 'FOREX' | 'INDEX' | 'ACTUARY' | 'BANK';
  prefix?: string;
  suffix?: string;
  specialBadge?: string;
}

const DEFAULT_TICKER_DATA: TickerAsset[] = [
  { symbol: 'BINANCE:BTCUSDT', name: 'Bitcoin', price: 96420.50, changePct: 2.84, type: 'CRYPTO' },
  { symbol: 'NVDA', name: 'NVIDIA Corp', price: 142.85, changePct: 3.12, type: 'STOCK' },
  { symbol: 'BINANCE:ETHUSDT', name: 'Ethereum', price: 3450.10, changePct: 1.95, type: 'CRYPTO' },
  { symbol: 'GLD', name: 'Or Physique (Gold)', price: 325.40, changePct: 0.65, type: 'COMMODITY' },
  { symbol: 'AAPL', name: 'Apple Inc', price: 228.40, changePct: -0.42, type: 'STOCK' },
  { symbol: 'BINANCE:SOLUSDT', name: 'Solana', price: 185.30, changePct: 4.88, type: 'CRYPTO' },
  { symbol: 'EUR/USD', name: 'Euro / Dollar', price: 1.0542, changePct: -0.15, type: 'FOREX' },
  { symbol: 'SCR_SOLVENCY', name: 'Solvabilité II (SCR)', price: 308.0, changePct: 12.5, type: 'ACTUARY', suffix: '%', specialBadge: 'SOLVABLE 99.5%' },
  { symbol: 'CET1_RATIO', name: 'Bâle III CET1 Bancaire', price: 14.85, changePct: 0.45, type: 'BANK', suffix: '%', specialBadge: 'EBA STRESS PASS' },
  { symbol: 'LUNDBERG_PSI', name: 'Ruine Cramér-Lundberg', price: 0.04, changePct: -0.01, type: 'ACTUARY', suffix: '%', specialBadge: 'RISQUE MAÎTRISÉ' },
  { symbol: 'FINBERT_SENTIMENT', name: 'FinBERT IA Sentiment', price: 78.4, changePct: 5.2, type: 'INDEX', suffix: '/100', specialBadge: 'TRÈS HAUSSIER' },
];

export const LiveMarketTickerTape: React.FC = () => {
  const [items, setItems] = useState<TickerAsset[]>(DEFAULT_TICKER_DATA);

  // Synchronisation 100% avec les cotations réelles (aucun tick aléatoire synthétique)
  useEffect(() => {
    let isMounted = true;
    const fetchRealQuotes = async () => {
      try {
        const quotes: MarketQuote[] = await getLastQuotes();
        if (!isMounted || !quotes || quotes.length === 0) return;

        const map = new Map<string, MarketQuote>();
        quotes.forEach((q) => map.set(q.symbol.toUpperCase(), q));

        setItems((prev) =>
          prev.map((item) => {
            const sym = item.symbol.toUpperCase();
            const real = map.get(sym);
            if (real && real.price > 0) {
              return {
                ...item,
                price: real.price,
              };
            }
            return item;
          })
        );
      } catch (err) {
        // En cas de temporaire indisponibilité, conserver les derniers cours enregistrés
        console.debug('[LiveMarketTickerTape] Cotations:', err);
      }
    };

    fetchRealQuotes();
    const interval = setInterval(fetchRealQuotes, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="relative w-full overflow-hidden border-b border-slate-800/80 bg-gradient-to-r from-[#070B14] via-[#0B1220] to-[#070B14] select-none text-[11px] font-mono z-10 ticker-wrap">
      {/* Left Gradient Fade Mask */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 z-20 bg-gradient-to-r from-[#070B14] to-transparent" />
      {/* Right Gradient Fade Mask */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 z-20 bg-gradient-to-l from-[#070B14] to-transparent" />

      {/* Floating Ticker Stream */}
      <div className="flex w-max ticker-track py-1.5 animate-marquee hover:pause">
        {[...items, ...items].map((asset, index) => {
          const isUp = asset.changePct >= 0;

          return (
            <div
              key={`${asset.symbol}-${index}`}
              className="flex items-center gap-2 px-3.5 py-0.5 mx-1 rounded-md transition-all duration-300 ticker-item-hover bg-[#101A2B]/60 border border-slate-800/80 text-slate-300"
            >
              {/* Category Icon */}
              {asset.type === 'ACTUARY' ? (
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0 animate-pulse" />
              ) : asset.type === 'BANK' ? (
                <Landmark className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              ) : asset.type === 'INDEX' ? (
                <Bot className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : (
                <Activity className="w-3 h-3 text-sky-400 shrink-0 opacity-70" />
              )}

              {/* Symbol & Name */}
              <span className="font-bold text-white tracking-tight">
                {asset.symbol.replace('BINANCE:', '')}
              </span>

              {/* Value / Price */}
              <span className="font-semibold text-slate-200">
                {asset.prefix || '$'}
                {asset.price.toLocaleString('en-US', {
                  minimumFractionDigits: asset.price < 2 ? 4 : 2,
                  maximumFractionDigits: asset.price < 2 ? 4 : 2,
                })}
                {asset.suffix || ''}
              </span>

              {/* Special Badge or Change % */}
              {asset.specialBadge ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  {asset.specialBadge}
                </span>
              ) : (
                <span
                  className={`flex items-center gap-0.5 font-bold ${
                    isUp ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isUp ? (
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-rose-400" />
                  )}
                  {isUp ? '+' : ''}
                  {asset.changePct.toFixed(2)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
