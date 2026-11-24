import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ShieldCheck, Landmark, Bot, Activity } from 'lucide-react';

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
  const [lastUpdatedSymbol, setLastUpdatedSymbol] = useState<string | null>(null);
  const [lastDirection, setLastDirection] = useState<'UP' | 'DOWN'>('UP');

  // Realistic micro-tick simulation on ticker to make it look alive like a high-frequency desk
  useEffect(() => {
    const interval = setInterval(() => {
      setItems((prev) => {
        const randomIndex = Math.floor(Math.random() * prev.length);
        const item = prev[randomIndex];
        // Only tick stocks, crypto, commodities, forex
        if (item.type === 'ACTUARY' || item.type === 'BANK') return prev;

        const isPositiveTick = Math.random() > 0.42;
        const tickPct = (Math.random() * 0.12 + 0.02) * (isPositiveTick ? 1 : -1);
        const newPrice = Math.max(0.0001, item.price * (1 + tickPct / 100));
        const newChangePct = item.changePct + (isPositiveTick ? 0.03 : -0.03);

        setLastUpdatedSymbol(item.symbol);
        setLastDirection(isPositiveTick ? 'UP' : 'DOWN');

        const next = [...prev];
        next[randomIndex] = {
          ...item,
          price: newPrice,
          changePct: Number(newChangePct.toFixed(2)),
        };
        return next;
      });
    }, 2400);

    return () => clearInterval(interval);
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
          const isJustTicked = asset.symbol === lastUpdatedSymbol;

          return (
            <div
              key={`${asset.symbol}-${index}`}
              className={`flex items-center gap-2 px-3.5 py-0.5 mx-1 rounded-md transition-all duration-300 ticker-item-hover ${
                isJustTicked
                  ? lastDirection === 'UP'
                    ? 'bg-emerald-500/15 ring-1 ring-emerald-500/40 text-emerald-300'
                    : 'bg-rose-500/15 ring-1 ring-rose-500/40 text-rose-300'
                  : 'bg-[#101A2B]/60 border border-slate-800/80 text-slate-300'
              }`}
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
