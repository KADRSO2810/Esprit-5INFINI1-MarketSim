import React, { useState } from 'react';
import { PortfolioSummary, PositionItem, TradeItem } from '../api/trading';
import { PortfolioSkeleton, EmptyState, AnimatedTabs, AssetLogo } from './ui';
import { SlTpConfigModal } from './SlTpConfigModal';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Briefcase,
  BarChart3,
  Clock,
  ChevronDown,
  ChevronUp,
  Activity,
  Shield,
  SlidersHorizontal,
} from 'lucide-react';

interface PortfolioPanelProps {
  summary: PortfolioSummary | null;
  positions: PositionItem[];
  trades: TradeItem[];
  loading: boolean;
  onBuy: (symbol: string) => void;
  onSell: (symbol: string) => void;
  onPositionUpdated?: () => void;
}

const fmt = (n: number, decimals = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const PnLBadge: React.FC<{ value: number; showSign?: boolean }> = ({ value, showSign = true }) => (
  <span
    className={`font-semibold font-mono tabular-nums ${
      value >= 0 ? 'text-emerald-400' : 'text-rose-400'
    }`}
  >
    {showSign && value >= 0 ? '+' : value < 0 ? '-' : ''}$
    {fmt(Math.abs(value))}
  </span>
);

export const PortfolioPanel: React.FC<PortfolioPanelProps> = ({
  summary,
  positions,
  trades,
  loading,
  onBuy,
  onSell,
  onPositionUpdated,
}) => {
  const [tab, setTab] = useState<'positions' | 'trades'>('positions');
  const [expanded, setExpanded] = useState(true);
  const [selectedSlTpPos, setSelectedSlTpPos] = useState<PositionItem | null>(null);
  const [isSlTpOpen, setIsSlTpOpen] = useState<boolean>(false);

  const openSlTp = (pos: PositionItem) => {
    setSelectedSlTpPos(pos);
    setIsSlTpOpen(true);
  };

  const handleSlTpUpdated = () => {
    onPositionUpdated?.();
  };

  if (loading && !summary) {
    return <PortfolioSkeleton />;
  }

  return (
    <div className="workstation-panel rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-3 border-b border-subtle flex items-center justify-between cursor-pointer hover:bg-[#142035]/60 transition"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <Briefcase className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
            Portefeuille & Exécutions
          </h3>
          {summary && (
            <span className="hidden sm:inline text-[11px] font-mono tabular-nums text-slate-400">
              · {positions.length} position{positions.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </div>

      {expanded && (
        <>
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-subtle bg-[#070B14]/40">
              <div className="rounded-lg bg-[#101A2B] border border-subtle p-3 card-interactive">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
                    Cash Disponible
                  </span>
                </div>
                <div className="text-sm font-bold font-mono tabular-nums text-white">
                  ${fmt(summary.cash)}
                </div>
              </div>

              <div className="rounded-lg bg-[#101A2B] border border-subtle p-3 card-interactive">
                <div className="flex items-center gap-1.5 mb-1">
                  <BarChart3 className="w-3 h-3 text-sky-400" />
                  <span className="text-[10px] text-sky-300 uppercase tracking-wider font-medium">
                    Equity Totale
                  </span>
                </div>
                <div className="text-sm font-bold font-mono tabular-nums text-white">
                  ${fmt(summary.equity)}
                </div>
              </div>

              <div className="rounded-lg bg-[#101A2B] border border-subtle p-3 card-interactive">
                <div className="flex items-center gap-1.5 mb-1">
                  {summary.unrealizedPnl >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-rose-400" />
                  )}
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
                    PnL Latent
                  </span>
                </div>
                <div className="text-sm">
                  <PnLBadge value={summary.unrealizedPnl} />
                </div>
              </div>

              <div className="rounded-lg bg-[#101A2B] border border-subtle p-3 card-interactive">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-3 h-3 text-violet-400" />
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
                    PnL Réalisé
                  </span>
                </div>
                <div className="text-sm">
                  <PnLBadge value={summary.realizedPnl} />
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="px-4 py-2 border-b border-subtle bg-[#0B1220]">
            <AnimatedTabs
              layoutId="portfolio-panel-tabs"
              activeId={tab}
              onChange={setTab}
              accent="cyan"
              tabs={[
                { id: 'positions', label: 'Positions Ouvertes', badge: positions.length },
                { id: 'trades', label: 'Historique Trades', badge: trades.length },
              ]}
            />
          </div>

          {/* Tables */}
          <div className="max-h-72 overflow-y-auto overflow-x-auto">
            {tab === 'positions' ? (
              positions.length === 0 ? (
                <EmptyState
                  compact
                  icon={Briefcase}
                  title="Aucune position ouverte"
                  description="Passez un ordre d'achat sur un actif crypto ou action pour ouvrir votre première ligne."
                />
              ) : (
                <table className="w-full text-xs font-mono tabular-nums">
                  <thead className="sticky top-0 bg-[#0B1220] border-b border-subtle z-10">
                    <tr className="text-slate-400 uppercase text-[10px] tracking-wider">
                      <th className="px-4 py-2.5 text-left font-medium">Symbole</th>
                      <th className="px-3 py-2.5 text-right font-medium">Quantité</th>
                      <th className="px-3 py-2.5 text-right font-medium">PRU Moy.</th>
                      <th className="px-3 py-2.5 text-right font-medium">Dernier</th>
                      <th className="px-3 py-2.5 text-right font-medium">PnL Latent</th>
                      <th className="px-3 py-2.5 text-center font-medium">Protection SL / TP</th>
                      <th className="px-4 py-2.5 text-center font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {positions.map((pos) => (
                      <tr key={pos.symbol} className="hover:bg-[#142035]/60 transition">
                        <td className="px-4 py-2.5 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <AssetLogo symbol={pos.symbol} size="xs" />
                            <span>{pos.symbol}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-300">
                          {Number(pos.quantity).toFixed(4)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-400">
                          ${Number(pos.avgPrice).toFixed(4)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-white font-medium">
                          ${Number(pos.lastPrice).toFixed(4)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <PnLBadge value={pos.unrealizedPnl} />
                          <div
                            className={`text-[10px] ${
                              pos.unrealizedPnlPercent >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'
                            }`}
                          >
                            {pos.unrealizedPnlPercent >= 0 ? '+' : ''}
                            {Number(pos.unrealizedPnlPercent).toFixed(2)}%
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {pos.stopLoss != null || pos.takeProfit != null ? (
                            <div className="inline-flex flex-col gap-1 items-center">
                              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                                {pos.stopLoss != null && (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-300 border border-rose-500/25 font-mono cursor-pointer hover:bg-rose-500/20"
                                    onClick={() => openSlTp(pos)}
                                    title={`Stop-Loss à $${Number(pos.stopLoss).toFixed(2)}${
                                      pos.slDistancePercent != null ? ' (-' + Number(pos.slDistancePercent).toFixed(1) + '%)' : ''
                                    }`}
                                  >
                                    SL ${Number(pos.stopLoss).toFixed(2)}
                                  </span>
                                )}
                                {pos.takeProfit != null && (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 font-mono cursor-pointer hover:bg-emerald-500/20"
                                    onClick={() => openSlTp(pos)}
                                    title={`Take-Profit à $${Number(pos.takeProfit).toFixed(2)}${
                                      pos.tpDistancePercent != null ? ' (+' + Number(pos.tpDistancePercent).toFixed(1) + '%)' : ''
                                    }`}
                                  >
                                    TP ${Number(pos.takeProfit).toFixed(2)}
                                  </span>
                                )}
                              </div>
                              {pos.riskRewardRatio != null && (
                                <span className="text-[9px] text-slate-400 font-mono">
                                  R:R 1:{Number(pos.riskRewardRatio).toFixed(1)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => openSlTp(pos)}
                              className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 hover:text-sky-300 bg-[#101A2B] hover:bg-sky-500/10 border border-subtle transition flex items-center gap-1 mx-auto"
                            >
                              <Shield className="w-3 h-3 text-slate-400" />
                              <span>+ Définir</span>
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1.5 justify-center items-center">
                            <button
                              onClick={() => openSlTp(pos)}
                              className="p-1 rounded-md bg-sky-500/10 border border-sky-500/25 text-sky-400 hover:bg-sky-500/25 transition text-[10px]"
                              title="Gérer Stop-Loss et Take-Profit"
                            >
                              <SlidersHorizontal className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => onBuy(pos.symbol)}
                              className="px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 transition text-[10px] font-bold"
                              title="Renforcer"
                            >
                              +
                            </button>
                            <button
                              onClick={() => onSell(pos.symbol)}
                              className="px-2 py-1 rounded-md bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/25 transition text-[10px] font-bold"
                              title="Alléger / Vendre"
                            >
                              −
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : trades.length === 0 ? (
              <EmptyState
                compact
                icon={Activity}
                title="Aucun trade exécuté"
                description="Vos exécutions BUY et SELL s'afficheront ici en temps réel."
              />
            ) : (
              <table className="w-full text-xs font-mono tabular-nums">
                <thead className="sticky top-0 bg-[#0B1220] border-b border-subtle z-10">
                  <tr className="text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="px-4 py-2.5 text-left font-medium">Heure</th>
                    <th className="px-3 py-2.5 text-left font-medium">Symbole</th>
                    <th className="px-3 py-2.5 text-center font-medium">Côté</th>
                    <th className="px-3 py-2.5 text-center font-medium">Déclencheur</th>
                    <th className="px-3 py-2.5 text-right font-medium">Quantité</th>
                    <th className="px-3 py-2.5 text-right font-medium">Prix</th>
                    <th className="px-4 py-2.5 text-right font-medium">PnL Réalisé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {trades.slice(0, 50).map((t) => (
                    <tr key={t.id} className="hover:bg-[#142035]/60 transition">
                      <td className="px-4 py-2.5 text-slate-400">
                        {new Date(t.ts).toLocaleTimeString('fr-FR')}
                      </td>
                      <td className="px-3 py-2.5 text-white font-semibold">
                        <div className="flex items-center gap-1.5">
                          <AssetLogo symbol={t.symbol} size="xs" />
                          <span>{t.symbol}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.side === 'BUY'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                              : 'bg-rose-500/15 text-rose-300 border border-rose-500/25'
                          }`}
                        >
                          {t.side}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {t.tradeReason === 'STOP_LOSS' ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            🛑 Stop-Loss
                          </span>
                        ) : t.tradeReason === 'TAKE_PROFIT' ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            🎯 Take-Profit
                          </span>
                        ) : t.tradeReason === 'STRATEGY' ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-violet-500/20 text-violet-300 border border-violet-500/30">
                            🤖 Auto Bot
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">Manuel</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-300">
                        {Number(t.quantity).toFixed(4)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-white">
                        ${Number(t.price).toFixed(4)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {t.realizedPnl != null ? (
                          <PnLBadge value={t.realizedPnl} />
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Modal de configuration SL/TP */}
      <SlTpConfigModal
        isOpen={isSlTpOpen}
        position={selectedSlTpPos}
        currentPrice={selectedSlTpPos?.lastPrice ?? null}
        onClose={() => setIsSlTpOpen(false)}
        onUpdated={handleSlTpUpdated}
      />
    </div>
  );
};
