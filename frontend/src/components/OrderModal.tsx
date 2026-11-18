import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { placeMarketOrder, OrderFill, assessPreTradeRisk, PreTradeRiskResponse } from '../api/trading';
import { useToast, AnimatedModal, OrbitalSpinner, AssetLogo, TradingScrollArea, TradingScrollSection } from './ui';
import { PreTradeRiskPanel } from './risk/PreTradeRiskPanel';

const ORDER_SECTIONS: TradingScrollSection[] = [
  { id: 'section-quote', label: 'Cours' },
  { id: 'section-side', label: 'Sens' },
  { id: 'section-qty', label: 'Quantité' },
  { id: 'section-protection', label: 'SL / TP' },
  { id: 'section-risk', label: 'Risque' },
];
import {
  X,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Shield,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface OrderModalProps {
  isOpen?: boolean;
  symbol: string;
  lastPrice: number | null;
  initialSide?: 'BUY' | 'SELL';
  initialOrderType?: 'MARKET' | 'LIMIT';
  initialLimitPrice?: number | null;
  initialQty?: number | null;
  initialStopLoss?: number | null;
  initialTakeProfit?: number | null;
  sessionId?: number;
  onClose: () => void;
  onFilled: (fill: OrderFill) => void;
}

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen = true,
  symbol,
  lastPrice,
  initialSide = 'BUY',
  initialOrderType = 'MARKET',
  initialLimitPrice = null,
  initialQty = null,
  initialStopLoss = null,
  initialTakeProfit = null,
  sessionId = 0,
  onClose,
  onFilled,
}) => {
  const [side, setSide] = useState<'BUY' | 'SELL'>(initialSide);
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>(initialOrderType);
  const [limitPrice, setLimitPrice] = useState<string>(initialLimitPrice ? String(initialLimitPrice) : '');
  const [qty, setQty] = useState<string>(initialQty ? String(initialQty) : '1');
  const [stopLoss, setStopLoss] = useState<string>(initialStopLoss ? String(initialStopLoss) : '');
  const [takeProfit, setTakeProfit] = useState<string>(initialTakeProfit ? String(initialTakeProfit) : '');
  const [showSlTp, setShowSlTp] = useState<boolean>(Boolean(initialStopLoss || initialTakeProfit));
  const [loading, setLoading] = useState(false);
  const [fill, setFill] = useState<OrderFill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [riskAssessment, setRiskAssessment] = useState<PreTradeRiskResponse | null>(null);
  const [evaluatingRisk, setEvaluatingRisk] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      setSide(initialSide);
      setOrderType(initialOrderType);
      setLimitPrice(initialLimitPrice ? String(initialLimitPrice) : '');
      setQty(initialQty ? String(initialQty) : '1');
      setFill(null);
      setError(null);
      setStopLoss(initialStopLoss ? String(initialStopLoss) : '');
      setTakeProfit(initialTakeProfit ? String(initialTakeProfit) : '');
      setShowSlTp(Boolean(initialStopLoss || initialTakeProfit));
      setRiskAssessment(null);
    }
  }, [isOpen, symbol, initialSide, initialOrderType, initialLimitPrice, initialQty, initialStopLoss, initialTakeProfit]);

  const numQty = Number(qty);
  const numSL = stopLoss ? parseFloat(stopLoss) : null;
  const numTP = takeProfit ? parseFloat(takeProfit) : null;

  useEffect(() => {
    if (!isOpen || !lastPrice || !numQty || numQty <= 0) {
      return;
    }

    let isMounted = true;
    setEvaluatingRisk(true);
    const timer = setTimeout(async () => {
      try {
        const res = await assessPreTradeRisk({
          symbol,
          side,
          quantity: numQty,
          price: lastPrice,
          stopLoss: side === 'BUY' ? numSL : null,
          takeProfit: side === 'BUY' ? numTP : null,
          sessionId,
        });
        if (isMounted) {
          setRiskAssessment(res);
        }
      } catch {
        // En cas d'erreur de réseau temporaire, on conserve l'évaluation précédente sans faire trembler la vue
      } finally {
        if (isMounted) {
          setEvaluatingRisk(false);
        }
      }
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, symbol, side, qty, stopLoss, takeProfit, sessionId]);

  // Calculs de risque
  const riskAmount =
    lastPrice != null && numSL != null && numQty > 0
      ? (lastPrice - numSL) * numQty
      : null;
  const rewardAmount =
    lastPrice != null && numTP != null && numQty > 0
      ? (numTP - lastPrice) * numQty
      : null;
  const rrRatio =
    riskAmount != null && rewardAmount != null && riskAmount > 0
      ? rewardAmount / riskAmount
      : null;

  const estCost =
    lastPrice != null && !isNaN(Number(qty)) && Number(qty) > 0
      ? (lastPrice * Number(qty)).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : '—';

  const applySlPreset = (pct: number) => {
    if (!lastPrice) return;
    setStopLoss((lastPrice * (1 - pct / 100)).toFixed(2));
    setError(null);
  };

  const applyTpPreset = (pct: number) => {
    if (!lastPrice) return;
    setTakeProfit((lastPrice * (1 + pct / 100)).toFixed(2));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lastPrice) {
      setError('Aucun cours live disponible pour ce symbole.');
      return;
    }
    const q = Number(qty);
    if (!q || q <= 0) {
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
          setError(`Le Stop-Loss ($${numSL.toFixed(2)}) doit être strictement inférieur au cours actuel ($${lastPrice.toFixed(2)}).`);
          return;
        }
      }
      if (numTP != null) {
        if (numTP <= 0) {
          setError('Le Take-Profit doit être strictement supérieur à 0.');
          return;
        }
        if (numTP <= lastPrice) {
          setError(`Le Take-Profit ($${numTP.toFixed(2)}) doit être strictement supérieur au cours actuel ($${lastPrice.toFixed(2)}).`);
          return;
        }
      }
      if (numSL != null && numTP != null && numSL >= numTP) {
        setError('Le Stop-Loss doit être strictement inférieur au Take-Profit.');
        return;
      }
    }

    if (riskAssessment?.decision === 'REJECTED') {
      const msg = riskAssessment.rejections && riskAssessment.rejections.length > 0
        ? riskAssessment.rejections.join(' | ')
        : "Ordre bloqué par les règles de risque pré-trade.";
      setError(msg);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const numLimit = orderType === 'LIMIT' ? parseFloat(limitPrice) : null;
      if (orderType === 'LIMIT' && (!numLimit || numLimit <= 0)) {
        setError('Le prix limite est obligatoire pour un ordre LIMIT.');
        setLoading(false);
        return;
      }

      const result = await placeMarketOrder(
        symbol,
        side,
        q,
        sessionId,
        side === 'BUY' ? numSL : null,
        side === 'BUY' ? numTP : null,
        orderType,
        numLimit
      );
      setFill(result);
      if (result.status === 'PENDING') {
        toast.info(
          `Ordre Limite inscrit au carnet`,
          `${result.side} ${result.quantity} ${result.symbol} @ $${Number(result.price).toFixed(4)}`
        );
      } else {
        toast.trade(
          `Ordre ${result.side} exécuté`,
          `${result.quantity} ${result.symbol} @ $${Number(result.price).toFixed(4)}${
            result.stopLoss ? ' | SL: $' + Number(result.stopLoss).toFixed(2) : ''
          }${result.takeProfit ? ' | TP: $' + Number(result.takeProfit).toFixed(2) : ''}`
        );
      }
      onFilled(result);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Échec de l'exécution de l'ordre.";
      setError(msg);
      toast.error('Ordre refusé', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidthClass="max-w-md">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-subtle bg-[#0B1220] z-10">
        <div className="flex items-center gap-2.5">
          <AssetLogo symbol={symbol} size="md" />
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
              Market Execution
            </span>
            <h2 className="font-bold text-white text-sm font-mono">{symbol}</h2>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#192841] transition"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {fill ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-400/45 flex items-center justify-center mx-auto mb-3 shadow-[0_0_24px_-4px_rgba(34,197,94,0.5)]">
              <svg viewBox="0 0 28 28" className="w-6 h-6">
                <motion.path
                  d="M6.5 14.5 L11.5 19.5 L21.5 8.5"
                  fill="none"
                  stroke="#34D399"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                />
              </svg>
            </div>
            <div className="text-emerald-400 font-bold text-base mb-1">Ordre exécuté</div>
            <div className="text-slate-400 text-xs font-mono tabular-nums mb-5">
              {fill.side} {fill.quantity} {fill.symbol} @ ${Number(fill.price).toFixed(4)}
            </div>
            <div className="bg-[#070B14] border border-subtle rounded-xl p-3.5 grid grid-cols-2 gap-y-2 text-xs font-mono tabular-nums mb-5 text-left">
              <span className="text-slate-500">Prix d'exécution</span>
              <span className="text-right text-white font-semibold">
                ${Number(fill.price).toFixed(4)}
              </span>
              <span className="text-slate-500">Cash restant</span>
              <span className="text-right text-white font-semibold">
                ${Number(fill.cashAfter).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              {fill.stopLoss != null && (
                <>
                  <span className="text-rose-400">Stop-Loss (SL)</span>
                  <span className="text-right text-rose-300 font-semibold">
                    ${Number(fill.stopLoss).toFixed(2)}
                  </span>
                </>
              )}
              {fill.takeProfit != null && (
                <>
                  <span className="text-emerald-400">Take-Profit (TP)</span>
                  <span className="text-right text-emerald-300 font-semibold">
                    ${Number(fill.takeProfit).toFixed(2)}
                  </span>
                </>
              )}
              {fill.realizedPnl != null && (
                <>
                  <span className="text-slate-500">PnL réalisé</span>
                  <span
                    className={`text-right font-bold ${
                      fill.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {fill.realizedPnl >= 0 ? '+' : ''}
                    ${Number(fill.realizedPnl).toFixed(2)}
                  </span>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-full bg-[#192841] hover:bg-[#1f3252] text-slate-100 text-xs font-semibold py-2.5 rounded-xl border border-strong transition"
            >
              Fermer
            </button>
          </motion.div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Animated Trading Candlestick Scroll Area */}
          <TradingScrollArea
            side={side}
            sections={ORDER_SECTIONS}
            scrollCueLabel="Défiler vers l'évaluation du Risque"
            targetCueSectionId="section-risk"
          >
            {/* Live Quote Banner */}
            <div id="section-quote" className="space-y-2">
              <div className="bg-[#070B14] border border-subtle rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400">Prix marché live</span>
                {lastPrice != null ? (
                  <span className="text-base font-bold font-mono tabular-nums text-white">
                    $
                    {lastPrice.toLocaleString('en-US', {
                      minimumFractionDigits: lastPrice < 1 ? 4 : 2,
                      maximumFractionDigits: 4,
                    })}
                  </span>
                ) : (
                  <span className="text-slate-500 text-xs font-mono">Indisponible</span>
                )}
              </div>

              {/* Multi-Asset Convention Badge */}
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg border border-slate-800 bg-[#0B1220] text-[11px]">
                <span className="font-semibold text-slate-400">
                  {symbol.includes('/') || (symbol.length === 6 && (symbol.endsWith('USD') || symbol.endsWith('JPY') || symbol.endsWith('EUR')))
                    ? 'FOREX'
                    : ['TLT', 'IEF', 'SHY', 'BND', 'LQD', 'HYG', 'TIP'].includes(symbol)
                    ? 'OBLIGATION'
                    : ['GLD', 'SLV', 'USO', 'BNO', 'UNG', 'CPER', 'DBA'].includes(symbol)
                    ? 'MATIÈRE PREM.'
                    : symbol.includes(':') || symbol.endsWith('USDT')
                    ? 'CRYPTO'
                    : 'ACTION'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {symbol.includes('/')
                    ? (side === 'BUY' ? 'Exécution Ask (Achat)' : 'Exécution Bid (Vente)')
                    : ['TLT', 'IEF', 'SHY', 'BND', 'LQD', 'HYG', 'TIP'].includes(symbol)
                    ? 'Clean Price ($100 Par)'
                    : 'Prix de marché direct'}
                </span>
              </div>
            </div>

              {/* Buy / Sell Tabs */}
              <div id="section-side" className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#070B14] border border-subtle">
                <button
                  type="button"
                  onClick={() => setSide('BUY')}
                  className={`relative z-0 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                    side === 'BUY'
                      ? 'text-slate-950'
                      : 'text-slate-400 hover:text-emerald-300'
                  }`}
                >
                  {side === 'BUY' && (
                    <motion.span
                      layoutId="order-side-pill"
                      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                      className="pointer-events-none absolute inset-0 rounded-lg bg-emerald-500 shadow-glow-bull -z-10"
                    />
                  )}
                  <TrendingUp className="w-3.5 h-3.5" /> Acheter (BUY)
                </button>
                <button
                  type="button"
                  onClick={() => setSide('SELL')}
                  className={`relative z-0 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                    side === 'SELL'
                      ? 'text-white'
                      : 'text-slate-400 hover:text-rose-300'
                  }`}
                >
                  {side === 'SELL' && (
                    <motion.span
                      layoutId="order-side-pill"
                      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                      className="pointer-events-none absolute inset-0 rounded-lg bg-rose-500 shadow-glow-bear -z-10"
                    />
                  )}
                  <TrendingDown className="w-3.5 h-3.5" /> Vendre (SELL)
                </button>
              </div>

              {/* Type d'ordre : Au Marché (Market) vs Cours Limité (Limit) */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#070B14] border border-subtle text-xs">
                <button
                  type="button"
                  onClick={() => setOrderType('MARKET')}
                  className={`py-1.5 rounded-lg font-bold transition ${
                    orderType === 'MARKET'
                      ? 'bg-sky-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Au Marché (Market)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrderType('LIMIT');
                    if (!limitPrice && lastPrice) setLimitPrice(String(lastPrice));
                  }}
                  className={`py-1.5 rounded-lg font-bold transition ${
                    orderType === 'LIMIT'
                      ? 'bg-sky-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cours Limité (Limit)
                </button>
              </div>

              {/* Si LIMIT, champ Prix Limite avec indicateur carnet d'ordres */}
              {orderType === 'LIMIT' && (
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-sky-300">Prix Limite ($)</label>
                    <span className="text-[10px] text-slate-400 font-mono">Inscrit au Carnet L2</span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    placeholder={lastPrice ? String(lastPrice) : '0.00'}
                    className="w-full bg-[#070B14] border border-slate-700 text-white font-mono tabular-nums text-sm px-3.5 py-2 rounded-lg focus:outline-none focus:border-sky-400 transition"
                    required
                  />
                  <p className="text-[10px] text-slate-400">
                    L'ordre sera exécuté automatiquement si le marché touche ou franchit votre cours limite.
                  </p>
                </div>
              )}

              {/* Quantity + Presets */}
              <div id="section-qty">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-medium text-slate-300">Quantité</label>
                  <div className="flex items-center gap-1">
                    {['0.1', '1', '5', '10'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setQty(preset)}
                        className="px-1.5 py-0.5 rounded bg-[#142035] hover:bg-[#192841] border border-subtle text-[10px] font-mono text-slate-300 transition"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  min="0.000001"
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full bg-[#070B14] border border-subtle text-white font-mono tabular-nums text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/30 transition"
                />
              </div>

              {/* Estimated Notional */}
              <div className="bg-[#070B14]/70 border border-subtle rounded-xl px-4 py-2.5 flex justify-between items-center text-xs font-mono tabular-nums">
                <span className="text-slate-400">
                  {side === 'BUY' ? 'Montant estimé' : 'Produit estimé'}
                </span>
                <span className="text-white font-bold">${estCost}</span>
              </div>

              {/* Stop-Loss & Take-Profit Toggle & Inputs (For BUY orders) */}
              {side === 'BUY' && (
                <div id="section-protection" className="rounded-xl border border-subtle bg-[#070B14]/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowSlTp(!showSlTp)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#142035]/60 transition"
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-sky-400" />
                      <span>Stop-Loss & Take-Profit (Optionnel)</span>
                      {(numSL != null || numTP != null) && (
                        <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                      )}
                    </div>
                    {showSlTp ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>

                  {showSlTp && (
                    <div className="p-3.5 border-t border-subtle space-y-3 bg-[#0B1220]/60">
                      {/* Stop-Loss */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-rose-300 font-medium flex items-center gap-1">
                            <TrendingDown className="w-3 h-3 text-rose-400" /> Stop-Loss
                          </span>
                          {lastPrice && numSL && (
                            <span className="font-mono text-rose-400 text-[10px]">
                              -{(((lastPrice - numSL) / lastPrice) * 100).toFixed(1)}%
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-slate-400 font-mono text-xs">$</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder={lastPrice ? (lastPrice * 0.95).toFixed(2) : '0.00'}
                            value={stopLoss}
                            onChange={(e) => {
                              setStopLoss(e.target.value);
                              setError(null);
                            }}
                            className="w-full bg-[#070B14] border border-rose-500/30 rounded-lg pl-7 pr-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-rose-400"
                          />
                        </div>
                        <div className="flex gap-1 pt-0.5">
                          {[2, 5, 10].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => applySlPreset(pct)}
                              className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#142035] hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 transition"
                            >
                              -{pct}%
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Take-Profit */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-emerald-300 font-medium flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-emerald-400" /> Take-Profit
                          </span>
                          {lastPrice && numTP && (
                            <span className="font-mono text-emerald-400 text-[10px]">
                              +{(((numTP - lastPrice) / lastPrice) * 100).toFixed(1)}%
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-slate-400 font-mono text-xs">$</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder={lastPrice ? (lastPrice * 1.1).toFixed(2) : '0.00'}
                            value={takeProfit}
                            onChange={(e) => {
                              setTakeProfit(e.target.value);
                              setError(null);
                            }}
                            className="w-full bg-[#070B14] border border-emerald-500/30 rounded-lg pl-7 pr-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                          />
                        </div>
                        <div className="flex gap-1 pt-0.5">
                          {[5, 10, 20].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => applyTpPreset(pct)}
                              className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#142035] hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/25 transition"
                            >
                              +{pct}%
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* R:R Ratio & Estimates */}
                      {(riskAmount != null || rewardAmount != null) && (
                        <div className="p-2.5 rounded-lg bg-[#070B14] border border-subtle text-[11px] font-mono space-y-1">
                          {riskAmount != null && (
                            <div className="flex justify-between text-rose-300">
                              <span>Risque estimé :</span>
                              <span>-${Math.abs(riskAmount).toFixed(2)}</span>
                            </div>
                          )}
                          {rewardAmount != null && (
                            <div className="flex justify-between text-emerald-300">
                              <span>Gain estimé :</span>
                              <span>+${rewardAmount.toFixed(2)}</span>
                            </div>
                          )}
                          {rrRatio != null && (
                            <div className="flex justify-between items-center pt-1 border-t border-slate-800 text-slate-300">
                              <span>Ratio Risque/Gain :</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  rrRatio >= 2
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : rrRatio >= 1
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                1:{rrRatio.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Pre-Trade Risk Engine Panel */}
              <div id="section-risk">
                <PreTradeRiskPanel
                  assessment={riskAssessment}
                  loading={evaluatingRisk}
                  entryPrice={lastPrice}
                  stopLoss={numSL}
                  symbol={symbol}
                  onApplyQuantity={(newQ) => setQty(newQ)}
                />
              </div>
          </TradingScrollArea>

            {/* Pinned / Sticky Footer Action Bar */}
            <div className="shrink-0 px-5 py-3.5 border-t border-subtle bg-[#070B14] space-y-2">
              {error && (
                <div className="flex items-start gap-2 text-rose-300 text-xs bg-rose-500/10 border border-rose-500/25 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !lastPrice || riskAssessment?.decision === 'REJECTED'}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.985] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                  riskAssessment?.decision === 'REJECTED'
                    ? 'bg-rose-950/60 border border-rose-500/40 text-rose-300 cursor-not-allowed'
                    : side === 'BUY'
                    ? 'btn-bullish text-slate-950'
                    : 'btn-bearish text-white'
                }`}
              >
                {loading && <OrbitalSpinner size="xs" tone={side === 'BUY' ? 'slate' : 'cyan'} />}
                {loading
                  ? 'Exécution en cours...'
                  : riskAssessment?.decision === 'REJECTED'
                  ? 'Transaction Bloquée par le Risque'
                  : `Confirmer ${side === 'BUY' ? "l'achat" : 'la vente'}`}
              </button>
            </div>
          </form>
        )}
    </AnimatedModal>
  );
};
