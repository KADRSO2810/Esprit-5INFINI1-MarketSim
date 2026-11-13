import React, { useEffect, useState, useMemo } from 'react';
import {
  Bot,
  Play,
  Square,
  Plus,
  Trash2,
  Activity,
  BarChart2,
  Cpu,
  TrendingUp,
  TrendingDown,
  Minus,
  Radio,
  Layers,
  RefreshCw,
  X,
  Check,
  ShieldCheck,
  DollarSign,
} from 'lucide-react';
import {
  Strategy,
  StrategySignal,
  StrategyExecution,
  StrategyPerformance,
  StrategyType,
  listStrategies,
  createStrategy,
  deleteStrategy,
  startStrategy,
  stopStrategy,
  getSignals,
  getExecutions,
  getPerformance,
} from '../api/strategies';
import { useStrategyWebSocket } from '../hooks/useStrategyWebSocket';
import { SignalExplanationModal } from '../components/SignalExplanationModal';
import { AppShell } from '../components/layout/AppShell';
import {
  PageTransition,
  StatCard,
  StrategySkeleton,
  SkeletonTable,
  AnimatedTabs,
  AnimatedModal,
  LivePulseDot,
  AnimatedMarketLoader,
  OrbitalSpinner,
  EmptyState,
  useToast,
  AssetLogo,
} from '../components/ui';

const STRATEGY_TYPE_LABELS: Record<StrategyType, string> = {
  SMA_CROSS: 'SMA Crossover',
  RSI: 'RSI Swing',
  SMA_SENTIMENT: 'SMA + FinBERT',
};

export const StrategyLab: React.FC = () => {
  const toast = useToast();

  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'SIGNALS' | 'EXECUTIONS' | 'PERFORMANCE'>('SIGNALS');
  const [apiSignals, setApiSignals] = useState<StrategySignal[]>([]);
  const [executions, setExecutions] = useState<StrategyExecution[]>([]);
  const [performance, setPerformance] = useState<StrategyPerformance | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSignalForXai, setSelectedSignalForXai] = useState<StrategySignal | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // STOMP live signal subscription for active strategy
  const { signalsHistory, isConnected, clearHistory } = useStrategyWebSocket(
    selectedStrategy?.id ?? null
  );

  const loadStrategies = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await listStrategies();
      setStrategies(data);
      if (data.length > 0 && !selectedStrategy) {
        setSelectedStrategy(data[0]);
      } else if (selectedStrategy) {
        const updated = data.find((s) => s.id === selectedStrategy.id);
        if (updated) setSelectedStrategy(updated);
      }
    } catch (err) {
      console.error('Error loading strategies:', err);
      toast.error('Impossible de charger les stratégies.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadStrategies();
  }, []);

  const loadStrategyDetails = async (strategyId: number) => {
    setDetailsLoading(true);
    try {
      const [sigs, execs, perf] = await Promise.all([
        getSignals(strategyId, 100),
        getExecutions(strategyId, 100),
        getPerformance(strategyId),
      ]);
      setApiSignals(sigs);
      setExecutions(execs);
      setPerformance(perf);
    } catch (err) {
      console.error('Error loading strategy details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedStrategy) return;
    clearHistory();
    setConfirmDeleteId(null);
    loadStrategyDetails(selectedStrategy.id);
  }, [selectedStrategy?.id]);

  // Merge live STOMP signals with fetched REST signals without duplicates
  const signals = useMemo(() => {
    const liveForCurrent = signalsHistory.filter(
      (s) => !selectedStrategy || s.strategyId === selectedStrategy.id
    );
    const seenIds = new Set<number>();
    const merged: StrategySignal[] = [];
    for (const item of [...liveForCurrent, ...apiSignals]) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        merged.push(item);
      }
    }
    return merged;
  }, [signalsHistory, apiSignals, selectedStrategy?.id]);

  // Refresh executions & performance cleanly whenever new live signal arrives
  useEffect(() => {
    if (signalsHistory.length > 0 && selectedStrategy) {
      getExecutions(selectedStrategy.id, 100).then(setExecutions).catch(() => {});
      getPerformance(selectedStrategy.id).then(setPerformance).catch(() => {});
    }
  }, [signalsHistory.length]);

  const handleToggleStartStop = async (strat: Strategy) => {
    setTogglingId(strat.id);
    try {
      const updated =
        strat.status === 'RUNNING'
          ? await stopStrategy(strat.id)
          : await startStrategy(strat.id);
      setStrategies((prev) => prev.map((s) => (s.id === strat.id ? updated : s)));
      if (selectedStrategy?.id === strat.id) {
        setSelectedStrategy(updated);
      }
      toast.success(
        updated.status === 'RUNNING'
          ? `Agent "${strat.name}" démarré en temps réel.`
          : `Agent "${strat.name}" mis en pause.`
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur lors du changement de statut.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    try {
      await deleteStrategy(id);
      const remaining = strategies.filter((s) => s.id !== id);
      setStrategies(remaining);
      if (selectedStrategy?.id === id) {
        setSelectedStrategy(remaining[0] || null);
      }
      setConfirmDeleteId(null);
      toast.success(`Stratégie "${name}" supprimée.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Impossible de supprimer cette stratégie.');
    }
  };

  const runningCount = useMemo(
    () => strategies.filter((s) => s.status === 'RUNNING').length,
    [strategies]
  );

  return (
    <AppShell
      title="Strategy Lab & Agents"
      section="Quantitative"
      badge="Auto-Trading"
      wsStatus={
        selectedStrategy
          ? {
              connected: isConnected,
              label: isConnected ? 'STOMP Signals Live' : 'STOMP Offline',
            }
          : undefined
      }
      topbarActions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadStrategies(true);
              if (selectedStrategy) loadStrategyDetails(selectedStrategy.id);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#101A2B] hover:bg-[#192841] border border-subtle text-xs text-slate-300 hover:text-white transition-colors"
            title="Actualiser"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle Stratégie</span>
          </button>
        </div>
      }
    >
      <PageTransition className="space-y-5">
        {/* Top Context Header Strip */}
        <div className="workstation-panel rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Agents de Trading Algorithmique
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                  {runningCount} actif{runningCount > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Orchestration de signaux techniques (<strong className="text-slate-200">SMA Cross</strong>,{' '}
                <strong className="text-slate-200">RSI Swing</strong>) et hybrides NLP (<strong className="text-slate-200">SMA + FinBERT</strong>) avec exécution Paper Trading automatisée.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono shrink-0">
            <div className="px-3 py-2 rounded-xl bg-[#0B1220] border border-subtle">
              <span className="text-[10px] text-slate-500 block uppercase">Total Agents</span>
              <span className="text-sm font-bold text-white tabular-nums">{strategies.length}</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-[#0B1220] border border-subtle">
              <span className="text-[10px] text-slate-500 block uppercase">Cycle Éval.</span>
              <span className="text-sm font-bold text-sky-400 tabular-nums">15s</span>
            </div>
          </div>
        </div>

        {/* Master-Detail Workstation */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT: Strategies Roster */}
          <div className="lg:col-span-4 workstation-panel rounded-2xl overflow-hidden flex flex-col max-h-[760px]">
            <div className="px-4 py-3.5 border-b border-subtle bg-[#0B1220]/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Stratégies ({strategies.length})
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Créer
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {loading ? (
                <StrategySkeleton />
              ) : strategies.length === 0 ? (
                <EmptyState
                  icon={Bot}
                  title="Aucune stratégie configurée"
                  description="Créez votre premier agent algorithmique pour générer des signaux en direct et exécuter vos ordres."
                  compact
                  action={
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Créer un agent
                    </button>
                  }
                />
              ) : (
                strategies.map((strat) => {
                  const isSelected = selectedStrategy?.id === strat.id;
                  const isRunning = strat.status === 'RUNNING';

                  return (
                    <div
                      key={strat.id}
                      onClick={() => setSelectedStrategy(strat)}
                      className={`p-3.5 rounded-xl border cursor-pointer card-interactive transition-all space-y-2.5 ${
                        isSelected
                          ? 'bg-[#142035] border-sky-500/45 shadow-glow-cyan'
                          : 'bg-[#0B1220]/80 border-subtle'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <LivePulseDot color="emerald" active={isRunning} size="sm" />
                          <span className="font-semibold text-sm text-white truncate">
                            {strat.name}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${
                            isRunning
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-800/80 text-slate-400 border-subtle'
                          }`}
                        >
                          {strat.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                        <span className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">
                          {STRATEGY_TYPE_LABELS[strat.strategyType] || strat.strategyType}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#101A2B] text-slate-300 border border-subtle">
                          {strat.mode}
                        </span>
                        {strat.autoTrade && (
                          <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                            AUTO
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-subtle text-[11px]">
                        <div className="flex items-center gap-1 font-mono text-slate-400 truncate">
                          {strat.symbols.slice(0, 3).map((sym) => (
                            <span
                              key={sym}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#070B14] text-slate-200 text-[10px]"
                            >
                              <AssetLogo symbol={sym} size="xs" />
                              {sym}
                            </span>
                          ))}
                          {strat.symbols.length > 3 && (
                            <span className="text-[10px] text-slate-500">
                              +{strat.symbols.length - 3}
                            </span>
                          )}
                        </div>

                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleToggleStartStop(strat)}
                            disabled={togglingId === strat.id}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold inline-flex items-center gap-1 transition-colors ${
                              isRunning
                                ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30'
                            }`}
                          >
                            {isRunning ? (
                              <>
                                <Square className="w-2.5 h-2.5 fill-current" /> Stop
                              </>
                            ) : (
                              <>
                                <Play className="w-2.5 h-2.5 fill-current" /> Run
                              </>
                            )}
                          </button>

                          {confirmDeleteId === strat.id ? (
                            <button
                              onClick={() => handleDelete(strat.id, strat.name)}
                              className="px-2 py-1 rounded-md bg-rose-500 text-white text-[10px] font-bold inline-flex items-center gap-1"
                              title="Confirmer la suppression"
                            >
                              <Check className="w-3 h-3" /> OK
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(strat.id)}
                              className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: Workspace Details */}
          <div className="lg:col-span-8 workstation-panel rounded-2xl overflow-hidden flex flex-col min-h-[640px]">
            {selectedStrategy ? (
              <>
                {/* Workspace Header */}
                <div className="p-5 border-b border-subtle bg-[#0B1220]/70 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-lg font-bold text-white tracking-tight">
                          {selectedStrategy.name}
                        </h3>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            selectedStrategy.status === 'RUNNING'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-subtle'
                          }`}
                        >
                          {selectedStrategy.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] font-mono text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-[#101A2B] border border-subtle text-slate-200">
                          {selectedStrategy.strategyType}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#101A2B] border border-subtle">
                          {selectedStrategy.mode} ({selectedStrategy.resolution}m)
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#101A2B] border border-subtle">
                          <DollarSign className="w-3 h-3 text-sky-400" />
                          {Number(selectedStrategy.sizingValue ?? 0).toLocaleString()} / ordre
                        </span>
                        {selectedStrategy.riskRules?.maxExposurePct != null && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#101A2B] border border-subtle">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            Max Exp. {(Number(selectedStrategy.riskRules.maxExposurePct) * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleStartStop(selectedStrategy)}
                        disabled={togglingId === selectedStrategy.id}
                        className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                          selectedStrategy.status === 'RUNNING'
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                        }`}
                      >
                        {selectedStrategy.status === 'RUNNING' ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current" /> Arrêter l’Agent
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" /> Démarrer l’Agent
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Parameter Pills + Sub-Tabs */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-subtle">
                    <AnimatedTabs
                      layoutId="strategy-lab-tabs"
                      activeId={activeTab}
                      onChange={setActiveTab}
                      accent="cyan"
                      tabs={[
                        { id: 'SIGNALS', label: 'Signaux', icon: Activity, badge: signals.length },
                        { id: 'EXECUTIONS', label: 'Ordres Exécutés', icon: Layers, badge: executions.length },
                        { id: 'PERFORMANCE', label: 'Performance', icon: BarChart2 },
                      ]}
                    />

                    <div className="flex items-center gap-2 text-[11px] font-mono">
                      <Radio
                        className={`w-3.5 h-3.5 ${
                          isConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-600'
                        }`}
                      />
                      <span className={isConnected ? 'text-emerald-400' : 'text-slate-500'}>
                        {isConnected ? 'STOMP LIVE' : 'OFFLINE'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tab Body */}
                <div className="flex-1 p-5 overflow-y-auto">
                  {detailsLoading ? (
                    <SkeletonTable rows={5} cols={5} />
                  ) : (
                    <>
                      {/* SIGNALS TAB */}
                      {activeTab === 'SIGNALS' && (
                        <div className="space-y-3">
                          {selectedStrategy.status === 'RUNNING' && signals.length === 0 && (
                            <AnimatedMarketLoader
                              mode="ai"
                              variant="inline"
                              badge="AGENT LIVE · CYCLE 15s"
                              title={`Agent "${selectedStrategy.name}" en surveillance temps réel…`}
                              subtitle="Évaluation automatique des indicateurs et diffusion instantanée sur le canal STOMP."
                            />
                          )}
                          {signals.length === 0 ? (
                            <EmptyState
                              icon={Cpu}
                              title="Aucun signal enregistré"
                              description={
                                selectedStrategy.status === 'RUNNING'
                                  ? "L'agent est actif et attend le prochain cycle d'évaluation (toutes les 15 secondes)."
                                  : 'Démarrez cet agent pour évaluer les indicateurs sur vos symboles suivis.'
                              }
                            />
                          ) : (
                            <div className="border border-subtle rounded-xl overflow-x-auto bg-[#0B1220]/50">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-[#0B1220] text-[10px] uppercase tracking-wider text-slate-400 border-b border-subtle">
                                  <tr>
                                    <th className="px-4 py-3">Heure</th>
                                    <th className="px-4 py-3">Symbole</th>
                                    <th className="px-4 py-3">Signal</th>
                                    <th className="px-4 py-3 text-right">Prix</th>
                                    <th className="px-4 py-3">Règle Déclenchée</th>
                                    <th className="px-4 py-3 text-right">XAI</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/40 font-mono tabular-nums">
                                  {signals.map((sig) => {
                                    const isBuy = sig.signal === 'BUY';
                                    const isSell = sig.signal === 'SELL';
                                    const rule = sig.explanation?.rule || sig.explanation?.reason || '—';

                                    return (
                                      <tr
                                        key={sig.id}
                                        className="hover:bg-[#142035]/60 transition-colors"
                                      >
                                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                                          {new Date(sig.ts).toLocaleTimeString('fr-FR')}
                                        </td>
                                        <td className="px-4 py-3 font-bold text-white">
                                          <div className="flex items-center gap-2">
                                            <AssetLogo symbol={sig.symbol} size="xs" />
                                            <span>{sig.symbol}</span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3">
                                          <span
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${
                                              isBuy
                                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                                : isSell
                                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                                : 'bg-slate-800 text-slate-400 border-subtle'
                                            }`}
                                          >
                                            {isBuy ? (
                                              <TrendingUp className="w-3 h-3" />
                                            ) : isSell ? (
                                              <TrendingDown className="w-3 h-3" />
                                            ) : (
                                              <Minus className="w-3 h-3" />
                                            )}
                                            {sig.signal}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-200 font-semibold">
                                          ${Number(sig.price ?? 0).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-slate-300 font-sans max-w-[260px] truncate">
                                          {rule}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                          <button
                                            onClick={() => setSelectedSignalForXai(sig)}
                                            className="px-2.5 py-1 text-[11px] font-sans font-semibold text-sky-300 hover:text-white bg-sky-500/10 hover:bg-sky-500/25 rounded-lg border border-sky-500/25 transition-colors"
                                          >
                                            Expliquer
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}

                      {/* EXECUTIONS TAB */}
                      {activeTab === 'EXECUTIONS' && (
                        <div className="space-y-3">
                          {executions.length === 0 ? (
                            <EmptyState
                              icon={Layers}
                              title="Aucun ordre exécuté"
                              description="Les ordres automatiques apparaîtront ici dès qu'un signal BUY ou SELL sera déclenché avec Auto-Trading activé."
                            />
                          ) : (
                            <div className="border border-subtle rounded-xl overflow-x-auto bg-[#0B1220]/50">
                              <table className="w-full text-left text-xs font-mono tabular-nums">
                                <thead className="bg-[#0B1220] text-[10px] uppercase tracking-wider text-slate-400 border-b border-subtle font-sans">
                                  <tr>
                                    <th className="px-4 py-3">Heure</th>
                                    <th className="px-4 py-3">Symbole</th>
                                    <th className="px-4 py-3">Côté</th>
                                    <th className="px-4 py-3 text-right">Quantité</th>
                                    <th className="px-4 py-3 text-right">Prix</th>
                                    <th className="px-4 py-3 text-right">Notionnel</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/40">
                                  {executions.map((ex) => (
                                    <tr
                                      key={ex.id}
                                      className="hover:bg-[#142035]/60 transition-colors"
                                    >
                                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                                        {new Date(ex.ts).toLocaleTimeString('fr-FR')}
                                      </td>
                                      <td className="px-4 py-3 font-bold text-white">
                                        <div className="flex items-center gap-2">
                                          <AssetLogo symbol={ex.symbol} size="xs" />
                                          <span>{ex.symbol}</span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <span
                                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                            ex.side === 'BUY'
                                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                          }`}
                                        >
                                          {ex.side}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-right text-slate-200">
                                        {Number(ex.quantity).toFixed(4)}
                                      </td>
                                      <td className="px-4 py-3 text-right text-slate-200">
                                        ${Number(ex.price).toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-right font-semibold text-white">
                                        ${(Number(ex.quantity) * Number(ex.price)).toFixed(2)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}

                      {/* PERFORMANCE TAB */}
                      {activeTab === 'PERFORMANCE' && (
                        <div className="space-y-4">
                          {performance ? (
                            <>
                              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
                                <StatCard
                                  label="Signaux Émis"
                                  value={performance.totalSignals}
                                  subValue={`${performance.buySignals} BUY / ${performance.sellSignals} SELL`}
                                  icon={Activity}
                                  accent="cyan"
                                />
                                <StatCard
                                  label="Ordres Exécutés"
                                  value={performance.totalExecutions}
                                  subValue={`Vol: $${Number(performance.totalVolume ?? 0).toLocaleString()}`}
                                  icon={Layers}
                                  accent="violet"
                                />
                                <StatCard
                                  label="PnL Réalisé"
                                  value={
                                    <span
                                      className={
                                        Number(performance.realizedPnl) >= 0
                                          ? 'text-emerald-400'
                                          : 'text-rose-400'
                                      }
                                    >
                                      {Number(performance.realizedPnl) >= 0 ? '+' : ''}$
                                      {Number(performance.realizedPnl ?? 0).toFixed(2)}
                                    </span>
                                  }
                                  subValue={`Session #${selectedStrategy.sessionId}`}
                                  icon={DollarSign}
                                  accent={Number(performance.realizedPnl) >= 0 ? 'bullish' : 'bearish'}
                                />
                                <StatCard
                                  label="Rendement Global"
                                  value={
                                    <span
                                      className={
                                        Number(performance.returnPct) >= 0
                                          ? 'text-emerald-400'
                                          : 'text-rose-400'
                                      }
                                    >
                                      {Number(performance.returnPct) >= 0 ? '+' : ''}
                                      {Number(performance.returnPct ?? 0).toFixed(2)}%
                                    </span>
                                  }
                                  subValue={
                                    performance.winRatePct != null
                                      ? `Win Rate: ${Number(performance.winRatePct).toFixed(1)}%`
                                      : 'Latent + réalisé'
                                  }
                                  icon={TrendingUp}
                                  accent={Number(performance.returnPct) >= 0 ? 'bullish' : 'bearish'}
                                />
                              </div>

                              {/* Configuration Snapshot */}
                              <div className="p-4 rounded-xl bg-[#0B1220] border border-subtle space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  Paramètres Actifs de l’Agent
                                </span>
                                <div className="flex flex-wrap gap-2 pt-1 font-mono text-xs">
                                  {Object.entries(selectedStrategy.params || {}).map(([k, v]) => (
                                    <span
                                      key={k}
                                      className="px-2.5 py-1 rounded-lg bg-[#101A2B] border border-subtle text-slate-200"
                                    >
                                      <span className="text-slate-400">{k}:</span> {String(v)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </>
                          ) : (
                            <EmptyState
                              icon={BarChart2}
                              title="Métriques indisponibles"
                              description="Les statistiques de performance seront calculées dès les premiers signaux."
                            />
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  icon={Bot}
                  title="Aucune stratégie sélectionnée"
                  description="Choisissez un agent dans la liste à gauche ou créez une nouvelle stratégie algorithmique."
                />
              </div>
            )}
          </div>
        </div>
      </PageTransition>

      {/* Signal Explanation XAI Modal */}
      <SignalExplanationModal
        signal={selectedSignalForXai}
        onClose={() => setSelectedSignalForXai(null)}
      />

      {/* Create Strategy Modal */}
      <CreateStrategyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(newStrat) => {
          setStrategies((prev) => [newStrat, ...prev]);
          setSelectedStrategy(newStrat);
          setShowCreateModal(false);
          toast.success(`Stratégie "${newStrat.name}" créée avec succès.`);
        }}
      />
    </AppShell>
  );
};

// =========================================================================
// CREATE STRATEGY MODAL
// =========================================================================
interface CreateStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (strategy: Strategy) => void;
}

const CreateStrategyModal: React.FC<CreateStrategyModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [strategyType, setStrategyType] = useState<StrategyType>('SMA_CROSS');
  const [symbolsText, setSymbolsText] = useState('AAPL, MSFT');
  const resolution = '1';

  const [autoTrade, setAutoTrade] = useState(true);
  const [sizingValue, setSizingValue] = useState(1000);
  const [maxExposurePct, setMaxExposurePct] = useState(0.4);

  const [fast, setFast] = useState(10);
  const [slow, setSlow] = useState(30);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [oversold, setOversold] = useState(30);
  const [overbought, setOverbought] = useState(70);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedSymbols = symbolsText
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    if (!name.trim()) {
      setError('Veuillez saisir un nom pour la stratégie.');
      return;
    }
    if (parsedSymbols.length === 0) {
      setError('Veuillez renseigner au moins un symbole boursier.');
      return;
    }

    let params: Record<string, any> = {};
    if (strategyType === 'SMA_CROSS' || strategyType === 'SMA_SENTIMENT') {
      if (fast >= slow) {
        setError('La période rapide (fast) doit être inférieure à la période lente (slow).');
        return;
      }
      params = { fast, slow };
    } else if (strategyType === 'RSI') {
      if (oversold >= overbought) {
        setError('Le seuil de survente (oversold) doit être inférieur au seuil de surachat (overbought).');
        return;
      }
      params = { rsiPeriod, oversold, overbought };
    }

    setSaving(true);
    try {
      const created = await createStrategy({
        name: name.trim(),
        strategyType,
        symbols: parsedSymbols,
        resolution,
        params,
        mode: 'LIVE',
        sessionId: 0,
        autoTrade,
        positionSizing: 'FIXED_NOTIONAL',
        sizingValue,
        riskRules: { maxExposurePct },
      });
      onCreated(created);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erreur lors de la création de la stratégie.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidthClass="max-w-lg">
      <div className="px-6 py-4 border-b border-subtle bg-[#0B1220]/90 flex items-center justify-between">
          <h3 className="font-bold text-white flex items-center gap-2 text-sm">
            <Cpu className="w-4 h-4 text-sky-400" />
            <span>Nouvelle Stratégie de Trading</span>
          </h3>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#192841] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="text-slate-400 font-medium block mb-1.5">Nom de la stratégie</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: SMA Golden Cross 10/30"
              className="w-full bg-[#0B1220] border border-subtle focus:border-sky-500 text-white rounded-xl px-3.5 py-2.5 focus:outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 font-medium block mb-1.5">Type d’Algorithme</label>
              <select
                value={strategyType}
                onChange={(e) => setStrategyType(e.target.value as StrategyType)}
                className="w-full bg-[#0B1220] border border-subtle focus:border-sky-500 text-white rounded-xl px-3 py-2.5 focus:outline-none"
              >
                <option value="SMA_CROSS">Moyennes Mobiles (SMA Cross)</option>
                <option value="RSI">Oscillateur RSI (Mean Reversion)</option>
                <option value="SMA_SENTIMENT">SMA + Filtre Sentiment FinBERT</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 font-medium block mb-1.5">Mode d’Exécution</label>
              <div className="w-full bg-[#070B14] border border-subtle text-slate-300 rounded-xl px-3 py-2.5 font-mono">
                LIVE (Temps réel)
              </div>
            </div>
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1.5">
              Symboles boursiers suivis (séparés par des virgules)
            </label>
            <input
              type="text"
              value={symbolsText}
              onChange={(e) => setSymbolsText(e.target.value)}
              placeholder="AAPL, MSFT, NVDA"
              className="w-full bg-[#0B1220] border border-subtle focus:border-sky-500 text-white rounded-xl px-3.5 py-2.5 font-mono uppercase focus:outline-none"
            />
          </div>

          {/* Dynamic Parameters */}
          <div className="p-3.5 bg-[#0B1220] rounded-xl border border-subtle space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">
              Paramètres d’Indicateurs
            </span>

            {(strategyType === 'SMA_CROSS' || strategyType === 'SMA_SENTIMENT') && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">SMA Rapide (bougies)</label>
                  <input
                    type="number"
                    min={2}
                    max={200}
                    value={fast}
                    onChange={(e) => setFast(Number(e.target.value))}
                    className="w-full bg-[#101A2B] border border-subtle focus:border-sky-500 text-white rounded-lg px-3 py-1.5 font-mono tabular-nums focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">SMA Lente (bougies)</label>
                  <input
                    type="number"
                    min={5}
                    max={500}
                    value={slow}
                    onChange={(e) => setSlow(Number(e.target.value))}
                    className="w-full bg-[#101A2B] border border-subtle focus:border-sky-500 text-white rounded-lg px-3 py-1.5 font-mono tabular-nums focus:outline-none"
                  />
                </div>
              </div>
            )}

            {strategyType === 'RSI' && (
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-slate-400 block mb-1">Période RSI</label>
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={rsiPeriod}
                    onChange={(e) => setRsiPeriod(Number(e.target.value))}
                    className="w-full bg-[#101A2B] border border-subtle focus:border-sky-500 text-white rounded-lg px-2.5 py-1.5 font-mono tabular-nums focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Survente (&lt;)</label>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={oversold}
                    onChange={(e) => setOversold(Number(e.target.value))}
                    className="w-full bg-[#101A2B] border border-subtle focus:border-sky-500 text-white rounded-lg px-2.5 py-1.5 font-mono tabular-nums focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Surachat (&gt;)</label>
                  <input
                    type="number"
                    min={50}
                    max={95}
                    value={overbought}
                    onChange={(e) => setOverbought(Number(e.target.value))}
                    className="w-full bg-[#101A2B] border border-subtle focus:border-sky-500 text-white rounded-lg px-2.5 py-1.5 font-mono tabular-nums focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Auto-Trading Settings */}
          <div className="p-3.5 bg-[#0B1220] rounded-xl border border-subtle space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Auto-Trading Paper</span>
                <span className="text-[11px] text-slate-400">
                  Exécuter automatiquement les ordres sur signal BUY/SELL
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoTrade}
                onChange={(e) => setAutoTrade(e.target.checked)}
                className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
              />
            </div>

            {autoTrade && (
              <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-subtle">
                <div>
                  <label className="text-slate-400 block mb-1">Montant par Ordre ($)</label>
                  <input
                    type="number"
                    min={50}
                    step={50}
                    value={sizingValue}
                    onChange={(e) => setSizingValue(Number(e.target.value))}
                    className="w-full bg-[#101A2B] border border-subtle focus:border-sky-500 text-white rounded-lg px-3 py-1.5 font-mono tabular-nums focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Exposition Max (0-1)</label>
                  <input
                    type="number"
                    min={0.05}
                    max={1.0}
                    step={0.05}
                    value={maxExposurePct}
                    onChange={(e) => setMaxExposurePct(Number(e.target.value))}
                    className="w-full bg-[#101A2B] border border-subtle focus:border-sky-500 text-white rounded-lg px-3 py-1.5 font-mono tabular-nums focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#142035] hover:bg-[#192841] text-slate-300 hover:text-white rounded-xl border border-subtle transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 btn-primary-cyan font-bold text-slate-950 rounded-xl transition-all active:scale-[0.985] disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving && <OrbitalSpinner size="xs" tone="slate" />}
              {saving ? 'Création...' : 'Créer & Enregistrer'}
            </button>
          </div>
        </form>
    </AnimatedModal>
  );
};
