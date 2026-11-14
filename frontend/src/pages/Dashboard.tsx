import React, { useState, useEffect, useCallback, useRef, CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { getWatchlist, updateWatchlist, getLastQuotes } from '../api/market';
import {
  getPortfolioSummary,
  getPositions,
  getTrades,
  getRiskMetrics,
  PortfolioSummary,
  PositionItem,
  TradeItem,
  RiskMetrics,
} from '../api/trading';
import { useMarketWebSocket, LiveQuote } from '../hooks/useMarketWebSocket';
import { AppShell } from '../components/layout/AppShell';
import { TradingViewChart } from '../components/TradingViewChart';
import { OrderModal } from '../components/OrderModal';
import { PortfolioPanel } from '../components/PortfolioPanel';
import { RiskMeter } from '../components/RiskMeter';
import { MarketTickerTape } from '../components/MarketTickerTape';
import {
  StatCard,
  PageTransition,
  MetricCardSkeleton,
  SkeletonCard,
  EmptyState,
  MotionStagger,
  MotionItem,
  LivePulseDot,
  AnimatedPriceIndicator,
  useToast,
  AssetLogo,
} from '../components/ui';
import { useAuthTransition } from '../components/auth';
import {
  TrendingUp,
  TrendingDown,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
  SlidersHorizontal,
  Database,
  Zap,
  Clock,
  Activity,
  ShoppingCart,
  Minus,
  ShieldAlert,
  Newspaper,
  Bot,
  BarChart3,
  Briefcase,
  ArrowUpRight,
  Globe,
} from 'lucide-react';

function isUSMarketOpen(): boolean {
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return minutes >= 14 * 60 + 30 && minutes < 21 * 60;
}

function isCrypto(symbol: string): boolean {
  return symbol.includes(':');
}

function shortLabel(symbol: string): string {
  if (symbol.includes(':')) {
    const pair = symbol.replace(/^[^:]+:/, '');
    const match = pair.match(/^([A-Z]+?)(USDT|BUSD|BTC|ETH|BNB)$/);
    return match ? `${match[1]}/${match[2]}` : pair;
  }
  return symbol;
}

interface TickerCardProps {
  symbol: string;
  quote?: LiveQuote;
  isSelected: boolean;
  onClick: () => void;
  sparkPoints: { price: number; time: string }[];
  onBuy: () => void;
  onSell: () => void;
}

const TickerCard: React.FC<TickerCardProps> = ({
  symbol,
  quote,
  isSelected,
  onClick,
  sparkPoints,
  onBuy,
  onSell,
}) => {
  const crypto = isCrypto(symbol);
  const usOpen = isUSMarketOpen();
  const hasData = !!quote;
  const isUp = (quote?.change ?? 0) >= 0;

  const stateClass =
    quote?.flash === 'up'
      ? 'bg-emerald-950/50 border-emerald-500/50 shadow-glow-bull'
      : quote?.flash === 'down'
      ? 'bg-rose-950/50 border-rose-500/50 shadow-glow-bear'
      : isSelected
      ? 'bg-[#142035] border-sky-400/60 shadow-glow-cyan'
      : 'bg-[#101A2B]/90 border-subtle hover:border-strong';

  const mini = sparkPoints.slice(-15);
  let spark: React.ReactNode = null;
  if (mini.length >= 2) {
    const prices = mini.map((p) => p.price);
    const mn = Math.min(...prices);
    const mx = Math.max(...prices);
    const r = mx - mn || 1;
    const W = 72;
    const H = 22;
    const pts = mini
      .map((p, i) => {
        const x = (i / (mini.length - 1)) * W;
        const y = H - ((p.price - mn) / r) * H;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    const color = isUp ? '#22C55E' : '#EF4444';
    spark = (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-5" preserveAspectRatio="none">
        <polyline
          points={pts}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const price = quote?.price ?? 0;
  const priceFmt =
    price >= 1000
      ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : price.toFixed(price < 0.1 ? 4 : 2);

  return (
    <div
      className={`flex-shrink-0 w-48 border rounded-xl p-3 cursor-pointer transition-all duration-200 select-none ${stateClass}`}
    >
      <div className="flex items-center justify-between mb-2" onClick={onClick}>
        <div className="flex items-center gap-2 min-w-0">
          <AssetLogo symbol={symbol} size="md" />
          <span
            className={`text-xs font-bold font-mono truncate ${isSelected ? 'text-sky-300' : 'text-white'}`}
          >
            {shortLabel(symbol)}
          </span>
        </div>
        {crypto ? (
          <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/25 flex items-center gap-0.5">
            <Zap className="w-2.5 h-2.5" />
            24/7
          </span>
        ) : symbol.includes('/') ? (
          <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 flex items-center gap-0.5">
            FX 24/5
          </span>
        ) : ['TLT', 'IEF', 'SHY', 'BND', 'LQD', 'HYG', 'TIP'].includes(symbol) ? (
          <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 flex items-center gap-0.5">
            BOND
          </span>
        ) : ['GLD', 'SLV', 'USO', 'BNO', 'UNG', 'CPER', 'DBA'].includes(symbol) ? (
          <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-pink-500/15 text-pink-300 border border-pink-500/25 flex items-center gap-0.5">
            CMDTY
          </span>
        ) : usOpen ? (
          <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            NYSE
          </span>
        ) : (
          <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-[#070B14] text-slate-400 border border-subtle flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />
            Fermé
          </span>
        )}
      </div>

      <div onClick={onClick} className="flex items-baseline justify-between gap-2">
        {hasData ? (
          <>
            <div className="text-sm font-bold font-mono tabular-nums text-white">${priceFmt}</div>
            <div
              className={`text-[10px] font-mono tabular-nums font-semibold flex items-center gap-0.5 ${
                isUp ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isUp ? (
                <TrendingUp className="w-2.5 h-2.5" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5" />
              )}
              {quote!.changePercent !== undefined && quote!.changePercent !== 0
                ? `${quote!.changePercent >= 0 ? '+' : ''}${quote!.changePercent.toFixed(2)}%`
                : '0.00%'}
            </div>
          </>
        ) : (
          <div className="text-[11px] font-mono text-slate-500">
            {crypto || usOpen ? 'En attente…' : 'Hors séance'}
          </div>
        )}
      </div>

      <div className="mt-2 h-5 opacity-85" onClick={onClick}>
        {spark}
      </div>

      <div className="mt-2.5 flex gap-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBuy();
          }}
          disabled={!hasData}
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ShoppingCart className="w-2.5 h-2.5" /> Buy
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSell();
          }}
          disabled={!hasData}
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-semibold bg-rose-500/10 border border-rose-500/25 text-rose-300 hover:bg-rose-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <Minus className="w-2.5 h-2.5" /> Sell
        </button>
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const { revealKey, markDashboardReady } = useAuthTransition();

  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BINANCE:BTCUSDT');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showEditor, setShowEditor] = useState<boolean>(false);
  const [newSymbolInput, setNewSymbolInput] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const [orderModal, setOrderModal] = useState<{ symbol: string; side: 'BUY' | 'SELL' } | null>(
    null
  );
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [trades, setTrades] = useState<TradeItem[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [riskLoading, setRiskLoading] = useState(true);

  const refreshPortfolio = useCallback(async () => {
    try {
      const [summary, pos, trd] = await Promise.all([
        getPortfolioSummary(),
        getPositions(),
        getTrades(50),
      ]);
      setPortfolioSummary(summary);
      setPositions(pos);
      setTrades(trd);
    } catch (e) {
      console.error('Portfolio load error:', e);
    } finally {
      setPortfolioLoading(false);
    }
  }, []);

  const refreshRisk = useCallback(async () => {
    try {
      const metrics = await getRiskMetrics();
      setRiskMetrics(metrics);
    } catch (e) {
      console.error('Risk load error:', e);
    } finally {
      setRiskLoading(false);
    }
  }, []);

  const handleSlTpTrigger = useCallback(
    (event: {
      symbol: string;
      triggerType: 'STOP_LOSS' | 'TAKE_PROFIT';
      executionPrice: number;
      quantity: number;
      realizedPnl: number;
    }) => {
      if (event.triggerType === 'TAKE_PROFIT') {
        toast.trade(
          '🎯 Objectif Take-Profit Atteint !',
          `${event.symbol} : Vente de ${Number(event.quantity).toFixed(4)} @ $${Number(event.executionPrice).toFixed(4)} (+PnL: $${Number(event.realizedPnl).toFixed(2)})`
        );
      } else {
        toast.error(
          '🛑 Protection Stop-Loss Déclenchée',
          `${event.symbol} : Protection exécutée @ $${Number(event.executionPrice).toFixed(4)} (PnL: ${Number(event.realizedPnl) >= 0 ? '+' : ''}$${Number(event.realizedPnl).toFixed(2)})`
        );
      }
      refreshPortfolio();
      refreshRisk();
    },
    [toast, refreshPortfolio, refreshRisk]
  );

  const { quotes, history, isConnected, tickCount, initializeQuotes } = useMarketWebSocket({
    onSlTpTrigger: handleSlTpTrigger,
  });

  useEffect(() => {
    const init = async () => {
      setWatchlistLoading(true);
      try {
        const [symbols, lastQuotes] = await Promise.all([getWatchlist(), getLastQuotes()]);
        setWatchlist(symbols);
        const firstCrypto = symbols.find(isCrypto);
        setSelectedSymbol(firstCrypto ?? symbols[0] ?? 'BINANCE:BTCUSDT');
        initializeQuotes(lastQuotes);
      } catch (e) {
        console.error(e);
      } finally {
        setWatchlistLoading(false);
      }
    };
    init();
  }, [initializeQuotes]);

  useEffect(() => {
    refreshPortfolio();
    refreshRisk();
    const interval = setInterval(() => {
      refreshPortfolio();
      refreshRisk();
    }, 10_000);
    return () => clearInterval(interval);
  }, [refreshPortfolio, refreshRisk]);

  useEffect(() => {
    if (!watchlistLoading && !portfolioLoading) {
      markDashboardReady();
    }
  }, [watchlistLoading, portfolioLoading, markDashboardReady]);

  const filteredWatchlist = searchQuery.trim()
    ? watchlist.filter(
        (s) =>
          s.toLowerCase().includes(searchQuery.toLowerCase()) ||
          shortLabel(s).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : watchlist;

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left: dir === 'right' ? 340 : -340, behavior: 'smooth' });
  };

  const handleAddSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = newSymbolInput.trim().toUpperCase();
    if (sym && !watchlist.includes(sym)) setWatchlist((prev) => [...prev, sym]);
    setNewSymbolInput('');
  };

  const handleRemove = useCallback(
    (sym: string) => {
      setWatchlist((prev) => {
        const next = prev.filter((s) => s !== sym);
        if (sym === selectedSymbol && next.length > 0) setSelectedSymbol(next[0]);
        return next;
      });
    },
    [selectedSymbol]
  );

  const handleSave = async () => {
    setIsUpdating(true);
    try {
      const updated = await updateWatchlist(watchlist);
      setWatchlist(updated);
      toast.success('Watchlist synchronisée', `${updated.length} actifs actifs sur le flux STOMP.`);
      setShowEditor(false);
    } catch {
      toast.error('Échec de mise à jour', 'Impossible de mettre à jour la watchlist.');
    } finally {
      setIsUpdating(false);
    }
  };

  const openOrder = (symbol: string, side: 'BUY' | 'SELL') => {
    setOrderModal({ symbol, side });
  };

  const handleOrderFilled = () => {
    setTimeout(() => {
      refreshPortfolio();
      refreshRisk();
    }, 400);
  };

  const usOpen = isUSMarketOpen();
  const totalPnl =
    (portfolioSummary?.unrealizedPnl ?? 0) + (portfolioSummary?.realizedPnl ?? 0);
  const pnlPct = portfolioSummary?.equity
    ? (totalPnl / Math.max(portfolioSummary.equity - totalPnl, 1)) * 100
    : 0;

  const prevPricesMap: Record<string, number> = {};
  for (const sym of watchlist) {
    const pts = history[sym];
    if (pts && pts.length >= 2) {
      prevPricesMap[sym] = pts[pts.length - 2].price;
    }
  }

  return (
    <AppShell
      section="Overview & Trading"
      title="Terminal Live"
      badge="STOMP · Paper Desk"
      wsStatus={{
        connected: isConnected,
        label: isConnected ? `LIVE · ${tickCount} ticks` : 'OFFLINE',
      }}
      equityBadge={portfolioSummary?.equity}
      topbarSlot={
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
            placeholder="Filtrer un actif (BTC, AAPL)…"
            className="w-full bg-[#101A2B] border border-subtle text-xs text-slate-100 placeholder-slate-500 pl-8 pr-8 py-1.5 rounded-lg focus:outline-none focus:border-sky-400 font-mono uppercase transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      }
      topbarActions={
        <button
          onClick={() => setShowEditor((e) => !e)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
            showEditor
              ? 'bg-sky-500/15 border-sky-400/50 text-sky-300'
              : 'bg-[#101A2B] border-subtle text-slate-300 hover:border-strong hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Watchlist</span>
        </button>
      }
    >
      <OrderModal
        isOpen={Boolean(orderModal)}
        symbol={orderModal?.symbol ?? selectedSymbol}
        initialSide={orderModal?.side ?? 'BUY'}
        lastPrice={quotes[orderModal?.symbol ?? selectedSymbol]?.price ?? null}
        onClose={() => setOrderModal(null)}
        onFilled={() => {
          handleOrderFilled();
        }}
      />

      <PageTransition className="flex flex-col gap-5">
        <MarketTickerTape
          symbols={watchlist}
          quotes={quotes}
          prevPrices={prevPricesMap}
          selectedSymbol={selectedSymbol}
          onSelectSymbol={setSelectedSymbol}
          wsConnected={isConnected}
        />
        {/* Watchlist Editor Drawer */}
        {showEditor && (
          <div className="workstation-panel-elevated rounded-xl p-4 flex flex-wrap items-center gap-3 animate-fade-slide-up">
            <form onSubmit={handleAddSymbol} className="flex items-center gap-1.5">
              <input
                type="text"
                value={newSymbolInput}
                onChange={(e) => setNewSymbolInput(e.target.value.toUpperCase())}
                placeholder="TSLA, BINANCE:ETHUSDT…"
                className="bg-[#070B14] border border-subtle text-xs text-slate-100 placeholder-slate-500 px-3 py-1.5 rounded-lg focus:outline-none focus:border-sky-400 font-mono uppercase w-52"
              />
              <button
                type="submit"
                className="p-1.5 bg-[#192841] hover:bg-sky-500/20 rounded-lg border border-subtle hover:border-sky-400/40 transition text-slate-200"
                title="Ajouter à la watchlist"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            <div className="flex flex-wrap gap-1.5 flex-1">
              {watchlist.map((sym) => (
                <span
                  key={sym}
                  className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium px-2.5 py-1 rounded-md border bg-[#070B14] border-subtle text-slate-300"
                >
                  <AssetLogo symbol={sym} size="xs" />
                  {sym}
                  <button
                    onClick={() => handleRemove(sym)}
                    className="text-slate-500 hover:text-rose-400 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <button
              onClick={handleSave}
              disabled={isUpdating}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 disabled:opacity-50 px-3.5 py-1.5 rounded-lg transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
              Enregistrer
            </button>
          </div>
        )}

        {/* Top KPI Command Strip */}
        {portfolioLoading && !portfolioSummary ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </div>
        ) : (
          <MotionStagger key={`kpi-${revealKey}`} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MotionItem>
              <StatCard
                label="Equity Totale"
                value={
                  <AnimatedPriceIndicator
                    value={portfolioSummary ? portfolioSummary.equity : 100000}
                    className="text-white"
                  />
                }
                subValue={
                  portfolioSummary
                    ? `Cash libre : $${portfolioSummary.cash.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : 'Compte Paper Trading'
                }
                icon={Briefcase}
                accent="cyan"
              />
            </MotionItem>
            <MotionItem>
              <StatCard
                label="Performance Globale"
                value={
                  <AnimatedPriceIndicator
                    value={totalPnl}
                    showTrendBadge
                    formatValue={(val) =>
                      `${val >= 0 ? '+' : '-'}$${Math.abs(val).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    }
                    className={totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                  />
                }
                subValue={`Rendement : ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% · ${positions.length} pos.`}
                icon={totalPnl >= 0 ? TrendingUp : TrendingDown}
                accent={totalPnl >= 0 ? 'bullish' : 'bearish'}
              />
            </MotionItem>
            <MotionItem>
              <StatCard
                label="VaR 95% Portefeuille"
                value={
                  riskMetrics?.var95 != null
                    ? `$${riskMetrics.var95.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : '—'
                }
                subValue={
                  riskMetrics?.maxDrawdown != null
                    ? `Max Drawdown : ${(riskMetrics.maxDrawdown * 100).toFixed(2)}%`
                    : 'En attente de positions'
                }
                icon={ShieldAlert}
                accent="warning"
              />
            </MotionItem>
            <MotionItem>
              <StatCard
                label="Flux Marché & Ingestion"
                value={`${watchlist.length} Actifs`}
                subValue={`${tickCount.toLocaleString()} ticks reçus · Batch 2s`}
                icon={Activity}
                accent="violet"
              />
            </MotionItem>
          </MotionStagger>
        )}

        {/* Live Market Strip */}
        <section className="workstation-panel rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <LivePulseDot color={isConnected ? 'emerald' : 'amber'} active={isConnected} />
              <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
                Live Market Watchlist
              </h2>
              <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                {filteredWatchlist.length}/{watchlist.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/app/markets"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold transition"
              >
                <Globe className="w-3.5 h-3.5" />
                Multi-Actifs Hub
              </Link>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => scroll('left')}
                  className="p-1.5 rounded-lg bg-[#070B14] border border-subtle hover:border-strong text-slate-400 hover:text-white transition"
                  aria-label="Défiler à gauche"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => scroll('right')}
                  className="p-1.5 rounded-lg bg-[#070B14] border border-subtle hover:border-strong text-slate-400 hover:text-white transition"
                  aria-label="Défiler à droite"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto p-3.5"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as CSSProperties}
          >
            {watchlistLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} className="flex-shrink-0 w-48 h-[132px]" />
              ))
            ) : filteredWatchlist.length === 0 ? (
              <div className="w-full">
                <EmptyState
                  compact
                  icon={Search}
                  title="Aucun actif trouvé"
                  description={`Aucun symbole ne correspond à "${searchQuery}".`}
                />
              </div>
            ) : (
              filteredWatchlist.map((symbol) => (
                <TickerCard
                  key={symbol}
                  symbol={symbol}
                  quote={quotes[symbol]}
                  isSelected={selectedSymbol === symbol}
                  onClick={() => setSelectedSymbol(symbol)}
                  sparkPoints={history[symbol] || []}
                  onBuy={() => openOrder(symbol, 'BUY')}
                  onSell={() => openOrder(symbol, 'SELL')}
                />
              ))
            )}
          </div>
        </section>

        {/* Main Workstation Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Center Column: Chart + Portfolio */}
          <div className="lg:col-span-8 flex flex-col gap-5">
            <TradingViewChart
              symbol={selectedSymbol}
              currentQuote={quotes[selectedSymbol]}
              points={history[selectedSymbol] || []}
              onBuy={() => openOrder(selectedSymbol, 'BUY')}
              onSell={() => openOrder(selectedSymbol, 'SELL')}
              watchlist={watchlist}
              onSelectSymbol={setSelectedSymbol}
              portfolioCash={portfolioSummary?.cash ?? null}
              positions={positions}
              onOrderExecuted={handleOrderFilled}
            />

            <PortfolioPanel
              summary={portfolioSummary}
              positions={positions}
              trades={trades}
              loading={portfolioLoading}
              onBuy={(sym) => openOrder(sym, 'BUY')}
              onSell={(sym) => openOrder(sym, 'SELL')}
              onPositionUpdated={refreshPortfolio}
            />
          </div>

          {/* Right Column: Order Ticket + Risk + AI Intelligence */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            {/* Selected Asset Execution Card */}
            <div className="workstation-panel rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-subtle">
                <div className="flex items-center gap-2.5">
                  <AssetLogo symbol={selectedSymbol} size="lg" />
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400">
                      Ticket d'exécution
                    </span>
                    <div className="text-lg font-bold font-mono text-white mt-0.5 leading-tight">
                      {shortLabel(selectedSymbol)}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">{selectedSymbol}</div>
                  </div>
                </div>
                {isCrypto(selectedSymbol) ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-1 rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/25">
                    <Zap className="w-3 h-3" /> 24/7
                  </span>
                ) : usOpen ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    NYSE LIVE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-md bg-[#070B14] text-amber-300 border border-amber-500/25">
                    <Clock className="w-3 h-3" /> 15h30 Paris
                  </span>
                )}
              </div>

              {quotes[selectedSymbol] ? (
                <div className="py-3 grid grid-cols-2 gap-y-2 text-xs font-mono tabular-nums">
                  <span className="text-slate-400">Dernier cours</span>
                  <span className="text-right font-bold">
                    <AnimatedPriceIndicator
                      value={quotes[selectedSymbol]!.price}
                      showTrendBadge
                      formatValue={(val) => `$${val.toFixed(4)}`}
                      className="text-white"
                    />
                  </span>
                  <span className="text-slate-400">Variation</span>
                  <span
                    className={`text-right font-semibold ${
                      (quotes[selectedSymbol]?.change ?? 0) >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {(quotes[selectedSymbol]?.changePercent ?? 0) >= 0 ? '+' : ''}
                    {quotes[selectedSymbol]?.changePercent?.toFixed(2) ?? '0.00'}%
                  </span>
                  <span className="text-slate-400">Horodatage</span>
                  <span className="text-right text-slate-300">
                    {new Date(quotes[selectedSymbol]!.ts).toLocaleTimeString('fr-FR')}
                  </span>
                </div>
              ) : (
                <div className="py-4 text-center text-xs font-mono text-slate-500">
                  En attente du prochain tick marché…
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-subtle">
                <button
                  onClick={() => openOrder(selectedSymbol, 'BUY')}
                  disabled={!quotes[selectedSymbol]}
                  className="py-2.5 rounded-xl text-xs font-bold btn-bullish text-slate-950 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                >
                  BUY MARKET
                </button>
                <button
                  onClick={() => openOrder(selectedSymbol, 'SELL')}
                  disabled={!quotes[selectedSymbol]}
                  className="py-2.5 rounded-xl text-xs font-bold btn-bearish text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                >
                  SELL MARKET
                </button>
              </div>
            </div>

            {/* Risk Meter */}
            <RiskMeter metrics={riskMetrics} loading={riskLoading} />

            {/* Quant & AI Quick Modules */}
            <div className="ai-surface rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white uppercase tracking-wider">
                  Modules IA & Quant
                </span>
                <span className="text-[10px] font-mono text-violet-300">FastAPI :8090</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    to: '/app/stress-testing',
                    label: 'AI Stress Test',
                    sub: 'SHAP & Bâle III',
                    icon: ShieldAlert,
                    color: 'text-violet-400',
                  },
                  {
                    to: '/app/news',
                    label: 'FinBERT News',
                    sub: 'Sentiment NLP',
                    icon: Newspaper,
                    color: 'text-sky-400',
                  },
                  {
                    to: '/app/strategies',
                    label: 'Strategy Lab',
                    sub: 'Agents Auto',
                    icon: Bot,
                    color: 'text-emerald-400',
                  },
                  {
                    to: '/app/backtesting',
                    label: 'Backtesting',
                    sub: 'SMA & Sharpe',
                    icon: BarChart3,
                    color: 'text-blue-400',
                  },
                ].map((mod) => {
                  const Icon = mod.icon;
                  return (
                    <Link
                      key={mod.to}
                      to={mod.to}
                      className="group p-2.5 rounded-lg bg-[#070B14]/75 border border-subtle card-interactive flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <Icon className={`w-3.5 h-3.5 ${mod.color}`} />
                        <ArrowUpRight className="w-3 h-3 text-slate-600 group-hover:text-slate-300 transition" />
                      </div>
                      <div className="text-xs font-semibold text-slate-200">{mod.label}</div>
                      <div className="text-[10px] text-slate-500">{mod.sub}</div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* MariaDB Ingestion Telemetry */}
            <div className="workstation-panel rounded-xl p-4 text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 font-semibold text-slate-200">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  Pipeline MariaDB
                </span>
                <span className="text-[10px] font-mono text-emerald-400">ACTIF</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Ticks bufférisés avec flush batch toutes les{' '}
                <span className="text-slate-200 font-mono">2s</span> dans{' '}
                <code className="text-sky-300 font-mono">market_quotes</code>.
              </p>
            </div>
          </div>
        </section>
      </PageTransition>
    </AppShell>
  );
};
