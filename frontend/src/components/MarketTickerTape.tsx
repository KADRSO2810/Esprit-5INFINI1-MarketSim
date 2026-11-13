import React from 'react';
import { MarketQuote } from '../api/market';
import { LivePulseDot, AssetLogo } from './ui';

interface MarketTickerTapeProps {
  symbols: string[];
  quotes: Record<string, MarketQuote>;
  prevPrices?: Record<string, number>;
  selectedSymbol?: string;
  onSelectSymbol?: (symbol: string) => void;
  wsConnected?: boolean;
}

const fmtTapePrice = (sym: string, price: number) => {
  const decimals = sym.includes('BTC') || sym.includes('ETH') || price >= 100 ? 2 : 4;
  return price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const MarketTickerTape: React.FC<MarketTickerTapeProps> = ({
  symbols,
  quotes,
  prevPrices = {},
  selectedSymbol,
  onSelectSymbol,
  wsConnected = false,
}) => {
  if (!symbols || symbols.length === 0) return null;

  const renderTrack = (copyIndex: number) => (
    <div key={copyIndex} className="flex items-center gap-2.5 pr-2.5 shrink-0">
      {symbols.map((sym) => {
        const q = quotes[sym];
        const prev = prevPrices[sym];
        const hasDiff = Boolean(q && prev && prev > 0 && q.price !== prev);
        const pctDiff = hasDiff && q && prev ? ((q.price - prev) / prev) * 100 : null;
        const isUp = pctDiff !== null ? pctDiff >= 0 : true;
        const isSelected = selectedSymbol === sym;

        return (
          <button
            key={`${copyIndex}-${sym}`}
            type="button"
            onClick={() => onSelectSymbol?.(sym)}
            className={`relative z-0 group flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition shrink-0 ${
              isSelected
                ? 'bg-sky-500/15 border-sky-400/45 shadow-[0_0_16px_-4px_rgba(56,189,248,0.45)]'
                : 'bg-[#0B1220]/90 border-subtle hover:border-sky-400/30 hover:bg-[#111C31]'
            }`}
          >
            <LivePulseDot
              color={q ? (pctDiff !== null ? (isUp ? 'emerald' : 'rose') : 'cyan') : 'amber'}
              active={Boolean(q && wsConnected)}
              size="sm"
            />
            <AssetLogo symbol={sym} size="sm" />
            <span className="font-bold tracking-tight text-white group-hover:text-sky-300 transition-colors">
              {sym}
            </span>
            {q ? (
              <>
                <span className="font-mono tabular-nums font-semibold text-slate-200">
                  ${fmtTapePrice(sym, q.price)}
                </span>
                {pctDiff !== null ? (
                  <span
                    className={`font-mono tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isUp
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-rose-500/15 text-rose-400'
                    }`}
                  >
                    {isUp ? '+' : ''}
                    {pctDiff.toFixed(2)}%
                  </span>
                ) : (
                  <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 bg-[#070B14] px-1.5 py-0.5 rounded">
                    {q.source || 'LIVE'}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[10px] font-mono text-slate-500">Sync…</span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className="ticker-wrap relative w-full overflow-hidden rounded-xl border border-subtle bg-[#070B14]/80 backdrop-blur-md py-1.5"
      title="Flux de marché en direct — survolez pour mettre en pause"
    >
      {/* Edge Vignette Fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#070B14] to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#070B14] to-transparent z-10" />

      <div className="ticker-track flex w-max animate-marquee">
        {renderTrack(0)}
        {renderTrack(1)}
      </div>
    </div>
  );
};

export const AnimatedMarketTicker = MarketTickerTape;
