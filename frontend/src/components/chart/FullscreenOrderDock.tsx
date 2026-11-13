import React, { useState, useEffect } from 'react';
import { placeMarketOrder, PositionItem } from '../../api/trading';
import { LiveQuote } from '../../hooks/useMarketWebSocket';
import { OrbitalSpinner, useToast, AssetLogo } from '../ui';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Activity,
  Shield,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface FullscreenOrderDockProps {
  symbol: string;
  watchlist?: string[];
  onSelectSymbol?: (symbol: string) => void;
  lastPrice: number | null;
  currentQuote?: LiveQuote;
  rsi14: number | null;
  portfolioCash?: number | null;
  position?: PositionItem;
  onOrderExecuted?: () => void;
}

const isCryptoSymbol = (sym: string) =>
  sym.includes('/') || sym.endsWith('USD') || sym.endsWith('USDT') || ['BTC', 'ETH', 'SOL'].includes(sym);

export const FullscreenOrderDock: React.FC<FullscreenOrderDockProps> = ({
  symbol,
  watchlist = [],
  onSelectSymbol,
  lastPrice,
  currentQuote,
  rsi14,
  portfolioCash,
  position,
  onOrderExecuted,
}) => {
  const toast = useToast();
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [qty, setQty] = useState<string>('1');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [showSlTp, setShowSlTp] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFillText, setLastFillText] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setLastFillText(null);
    setStopLoss('');
    setTakeProfit('');
    setShowSlTp(false);
    setQty(isCryptoSymbol(symbol) ? '0.1' : '1');
  }, [symbol]);

  const numericQty = Number(qty);
  const isValidQty = !Number.isNaN(numericQty) && numericQty > 0;
  const estNotional = lastPrice != null && isValidQty ? lastPrice * numericQty : null;

  const numSL = stopLoss ? parseFloat(stopLoss) : null;
  const numTP = takeProfit ? parseFloat(takeProfit) : null;

  const riskAmount =
    lastPrice != null && numSL != null && numericQty > 0
      ? (lastPrice - numSL) * numericQty
      : null;
  const rewardAmount =
    lastPrice != null && numTP != null && numericQty > 0
      ? (numTP - lastPrice) * numericQty
      : null;
  const rrRatio =
    riskAmount != null && rewardAmount != null && riskAmount > 0
      ? rewardAmount / riskAmount
      : null;

  const presets = isCryptoSymbol(symbol)
    ? ['0.05', '0.1', '0.5', '1', '2']
    : ['1', '5', '10', '25', '50'];

  const handleSetMaxBuy = () => {
    if (!portfolioCash || !lastPrice || lastPrice <= 0) return;
    const raw = (portfolioCash * 0.98) / lastPrice;
    const formatted = isCryptoSymbol(symbol) ? raw.toFixed(4) : String(Math.floor(raw));
    if (Number(formatted) > 0) {
      setSide('BUY');
      setQty(formatted);
      setError(null);
    }
  };

  const handleClosePosition = () => {
    if (!position || position.quantity <= 0) return;
    setSide('SELL');
    setQty(String(position.quantity));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lastPrice || lastPrice <= 0) {
      setError('Aucun cours live disponible pour ce symbole.');
      return;
    }
    if (!isValidQty) {
      setError('La quantité doit être strictement positive.');
      return;
    }

    if (side === 'BUY') {
      if (numSL != null) {
        if (numSL <= 0) {
          setError('Le Stop-Loss doit être strictement supérieur à 0.');
          return;
        }
        if (numSL >= lastPrice) {
          setError(`Le Stop-Loss ($${numSL.toFixed(2)}) doit être inférieur au cours ($${lastPrice.toFixed(2)}).`);
          return;
        }
      }
      if (numTP != null) {
        if (numTP <= 0) {
          setError('Le Take-Profit doit être strictement supérieur à 0.');
          return;
        }
        if (numTP <= lastPrice) {
          setError(`Le Take-Profit ($${numTP.toFixed(2)}) doit être supérieur au cours ($${lastPrice.toFixed(2)}).`);
          return;
        }
      }
      if (numSL != null && numTP != null && numSL >= numTP) {
        setError('Le Stop-Loss doit être inférieur au Take-Profit.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    setLastFillText(null);

    try {
      const result = await placeMarketOrder(
        symbol,
        side,
        numericQty,
        0,
        side === 'BUY' ? numSL : null,
        side === 'BUY' ? numTP : null
      );
      const fillSummary = `${result.side} ${result.quantity} ${result.symbol} @ $${Number(result.price).toFixed(4)}${
        result.stopLoss ? ' | SL: $' + Number(result.stopLoss).toFixed(2) : ''
      }${result.takeProfit ? ' | TP: $' + Number(result.takeProfit).toFixed(2) : ''}`;
      setLastFillText(fillSummary);
      toast.trade(`Ordre ${result.side} exécuté`, fillSummary);
      onOrderExecuted?.();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Échec de l'exécution de l'ordre.";
      setError(msg);
      toast.error('Ordre refusé', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const changePct = currentQuote?.changePercent;
  const isPositive = changePct != null ? changePct >= 0 : true;

  return (
    <aside className="w-full lg:w-[300px] xl:w-[320px] shrink-0 bg-[#0B1120]/95 border-t lg:border-t-0 lg:border-l border-subtle flex flex-col overflow-y-auto">
      {/* Quick Watchlist Switcher */}
      {watchlist.length > 0 && onSelectSymbol && (
        <div className="p-3 border-b border-subtle">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Watchlist Switcher
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              {watchlist.length} actifs
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-0.5">
            {watchlist.map((sym) => {
              const active = sym === symbol;
              return (
                <button
                  key={sym}
                  type="button"
                  onClick={() => onSelectSymbol(sym)}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono font-semibold transition-colors border ${
                    active
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                      : 'bg-[#070B14] text-slate-400 border-subtle hover:text-white hover:border-slate-600'
                  }`}
                >
                  <AssetLogo symbol={sym} size="xs" />
                  <span>{sym}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Quote & Technical Snapshot */}
      <div className="p-3.5 border-b border-subtle space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <AssetLogo symbol={symbol} size="lg" />
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Prix Marché Live
              </div>
              <div className="text-xl font-bold font-mono text-white tabular-nums mt-0.5">
                {lastPrice != null
                  ? `$${lastPrice.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: lastPrice < 10 ? 4 : 2,
                    })}`
                  : '—'}
              </div>
            </div>
          </div>
          {changePct != null && (
            <span
              className={`px-2 py-0.5 rounded text-xs font-mono font-semibold tabular-nums ${
                isPositive
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}
            >
              {isPositive ? '+' : ''}
              {changePct.toFixed(2)}%
            </span>
          )}
        </div>

        {/* RSI(14) + Session Metadata */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-[#070B14] border border-subtle px-2.5 py-2">
            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
              <Activity className="w-3 h-3 text-violet-400" />
              RSI (14)
            </div>
            <div
              className={`text-xs font-mono font-semibold tabular-nums mt-0.5 ${
                rsi14 == null
                  ? 'text-slate-500'
                  : rsi14 >= 70
                    ? 'text-rose-400'
                    : rsi14 <= 30
                      ? 'text-emerald-400'
                      : 'text-slate-200'
              }`}
            >
              {rsi14 != null ? rsi14.toFixed(1) : '—'}
              {rsi14 != null && (
                <span className="ml-1 text-[10px] font-normal text-slate-400">
                  {rsi14 >= 70 ? 'Surachat' : rsi14 <= 30 ? 'Survente' : 'Neutre'}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-[#070B14] border border-subtle px-2.5 py-2">
            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
              <Wallet className="w-3 h-3 text-sky-400" />
              Cash Dispo
            </div>
            <div className="text-xs font-mono font-semibold text-white tabular-nums mt-0.5 truncate">
              {portfolioCash != null
                ? `$${portfolioCash.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Market Execution Form */}
      <form onSubmit={handleSubmit} className="p-3.5 space-y-3 border-b border-subtle">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-300 font-semibold">
            Ticket d&apos;ordre rapide
          </span>
          <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
            MARKET
          </span>
        </div>

        {/* Side Selector */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#070B14] rounded-lg border border-subtle">
          <button
            type="button"
            onClick={() => setSide('BUY')}
            className={`py-2 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              side === 'BUY'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            BUY
          </button>
          <button
            type="button"
            onClick={() => setSide('SELL')}
            className={`py-2 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              side === 'SELL'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            SELL
          </button>
        </div>

        {/* Quantity Input + Quick Presets */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] text-slate-400 font-medium">
              Quantité ({symbol})
            </label>
            <div className="flex items-center gap-2">
              {portfolioCash != null && lastPrice != null && side === 'BUY' && (
                <button
                  type="button"
                  onClick={handleSetMaxBuy}
                  className="text-[10px] font-mono text-sky-400 hover:text-sky-300 underline"
                >
                  Max Cash
                </button>
              )}
              {position && position.quantity > 0 && (
                <button
                  type="button"
                  onClick={handleClosePosition}
                  className="text-[10px] font-mono text-amber-400 hover:text-amber-300 underline"
                >
                  Fermer ({position.quantity})
                </button>
              )}
            </div>
          </div>
          <input
            type="number"
            step="any"
            min="0.0001"
            value={qty}
            onChange={(e) => {
              setQty(e.target.value);
              setError(null);
            }}
            className="w-full px-3 py-2 rounded-lg bg-[#070B14] border border-subtle text-sm font-mono text-white focus:outline-none focus:border-sky-500 tabular-nums"
          />
          <div className="grid grid-cols-5 gap-1 mt-1.5">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setQty(preset);
                  setError(null);
                }}
                className={`py-1 rounded text-[11px] font-mono transition-colors border ${
                  qty === preset
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : 'bg-[#070B14] text-slate-400 border-subtle hover:text-white'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Estimated Notional */}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#070B14] border border-subtle text-xs">
          <span className="text-slate-400">Montant estimé</span>
          <span className="font-mono font-semibold text-white tabular-nums">
            {estNotional != null
              ? `$${estNotional.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : '—'}
          </span>
        </div>

        {/* Stop-Loss & Take-Profit Toggle & Inputs (For BUY orders) */}
        {side === 'BUY' && (
          <div className="rounded-lg border border-subtle bg-[#070B14]/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSlTp(!showSlTp)}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#142035]/60 transition"
            >
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-sky-400" />
                <span>Protection SL & TP</span>
                {(numSL != null || numTP != null) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                )}
              </div>
              {showSlTp ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {showSlTp && (
              <div className="p-2.5 border-t border-subtle space-y-2 bg-[#0B1220]/70 text-xs">
                {/* Stop-Loss */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-rose-300 font-medium">Stop-Loss</span>
                    {lastPrice && numSL && (
                      <span className="font-mono text-rose-400 text-[10px]">
                        -{(((lastPrice - numSL) / lastPrice) * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={lastPrice ? (lastPrice * 0.95).toFixed(2) : '0.00'}
                    value={stopLoss}
                    onChange={(e) => {
                      setStopLoss(e.target.value);
                      setError(null);
                    }}
                    className="w-full bg-[#070B14] border border-rose-500/30 rounded px-2.5 py-1 text-white font-mono text-xs focus:outline-none focus:border-rose-400"
                  />
                  <div className="flex gap-1 mt-1">
                    {[2, 5, 10].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          if (lastPrice) setStopLoss((lastPrice * (1 - pct / 100)).toFixed(2));
                        }}
                        className="px-1 py-0.5 rounded text-[9px] font-mono bg-[#142035] hover:bg-rose-500/20 text-rose-300 border border-rose-500/20"
                      >
                        -{pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Take-Profit */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-emerald-300 font-medium">Take-Profit</span>
                    {lastPrice && numTP && (
                      <span className="font-mono text-emerald-400 text-[10px]">
                        +{(((numTP - lastPrice) / lastPrice) * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={lastPrice ? (lastPrice * 1.1).toFixed(2) : '0.00'}
                    value={takeProfit}
                    onChange={(e) => {
                      setTakeProfit(e.target.value);
                      setError(null);
                    }}
                    className="w-full bg-[#070B14] border border-emerald-500/30 rounded px-2.5 py-1 text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                  />
                  <div className="flex gap-1 mt-1">
                    {[5, 10, 20].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          if (lastPrice) setTakeProfit((lastPrice * (1 + pct / 100)).toFixed(2));
                        }}
                        className="px-1 py-0.5 rounded text-[9px] font-mono bg-[#142035] hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20"
                      >
                        +{pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Risk Metrics */}
                {(riskAmount != null || rewardAmount != null) && (
                  <div className="p-2 rounded bg-[#070B14] border border-subtle text-[10px] font-mono space-y-0.5">
                    {riskAmount != null && (
                      <div className="flex justify-between text-rose-300">
                        <span>Risque :</span>
                        <span>-${Math.abs(riskAmount).toFixed(2)}</span>
                      </div>
                    )}
                    {rewardAmount != null && (
                      <div className="flex justify-between text-emerald-300">
                        <span>Gain :</span>
                        <span>+${rewardAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {rrRatio != null && (
                      <div className="flex justify-between text-slate-300 pt-0.5 border-t border-slate-800">
                        <span>Ratio R:R :</span>
                        <span className="font-bold text-sky-400">1:{rrRatio.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5 text-[11px] text-rose-300">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {lastFillText && (
          <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-[11px] text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="font-mono">{lastFillText}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !lastPrice}
          className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
            side === 'BUY'
              ? 'bg-emerald-500 hover:bg-emerald-400 text-[#070B14] shadow-[0_0_20px_rgba(16,185,129,0.25)]'
              : 'bg-rose-500 hover:bg-rose-400 text-white shadow-[0_0_20px_rgba(244,63,94,0.25)]'
          }`}
        >
          {submitting ? (
            <>
              <OrbitalSpinner size="xs" />
              Exécution...
            </>
          ) : (
            `${side === 'BUY' ? 'Acheter' : 'Vendre'} ${symbol}`
          )}
        </button>
      </form>

      {/* Current Open Position for Selected Symbol */}
      <div className="p-3.5 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2">
          <Briefcase className="w-3.5 h-3.5 text-sky-400" />
          Position Ouverte ({symbol})
        </div>
        {position && position.quantity > 0 ? (
          <div className="rounded-lg bg-[#070B14] border border-subtle p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Quantité</span>
              <span className="font-mono font-semibold text-white tabular-nums">
                {position.quantity}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">PRU (Avg)</span>
              <span className="font-mono text-slate-200 tabular-nums">
                ${position.avgPrice.toFixed(position.avgPrice < 10 ? 4 : 2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Valeur Marché</span>
              <span className="font-mono text-slate-200 tabular-nums">
                ${position.marketValue.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            {position.stopLoss != null && (
              <div className="flex items-center justify-between text-rose-300">
                <span>Stop-Loss</span>
                <span className="font-mono font-semibold">
                  ${Number(position.stopLoss).toFixed(2)}
                  {position.slDistancePercent != null && ` (-${Number(position.slDistancePercent).toFixed(1)}%)`}
                </span>
              </div>
            )}
            {position.takeProfit != null && (
              <div className="flex items-center justify-between text-emerald-300">
                <span>Take-Profit</span>
                <span className="font-mono font-semibold">
                  ${Number(position.takeProfit).toFixed(2)}
                  {position.tpDistancePercent != null && ` (+${Number(position.tpDistancePercent).toFixed(1)}%)`}
                </span>
              </div>
            )}
            {position.riskRewardRatio != null && (
              <div className="flex items-center justify-between text-sky-300">
                <span>Ratio R:R</span>
                <span className="font-mono font-bold">
                  1:{Number(position.riskRewardRatio).toFixed(1)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1.5 border-t border-subtle">
              <span className="text-slate-400">PnL Latent</span>
              <span
                className={`font-mono font-bold tabular-nums ${
                  position.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {position.unrealizedPnl >= 0 ? '+' : ''}$
                {position.unrealizedPnl.toFixed(2)} (
                {position.unrealizedPnlPercent >= 0 ? '+' : ''}
                {position.unrealizedPnlPercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-[#070B14]/60 border border-dashed border-subtle p-3 text-xs text-slate-500 text-center">
            Aucune position ouverte sur {symbol}.
          </div>
        )}
      </div>
    </aside>
  );
};
