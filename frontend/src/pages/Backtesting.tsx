import React, { useState, useEffect, useCallback } from 'react';
import {
  launchBacktest,
  getBacktestRuns,
  getBacktestRun,
  getBacktestTrades,
  getBacktestEquity,
  BacktestRunResponse,
  BacktestTrade,
  BacktestEquityPoint,
} from '../api/backtest';
import { AppShell } from '../components/layout/AppShell';
import { EquityChart } from '../components/EquityChart';
import {
  StatCard,
  PageTransition,
  ChartSkeleton,
  SkeletonTable,
  EmptyState,
  MotionStagger,
  MotionItem,
  OrbitalSpinner,
  AnimatedMarketLoader,
  AnimatedNumber,
  useToast,
  AssetLogo,
} from '../components/ui';
import {
  TrendingUp,
  TrendingDown,
  Play,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  Layers,
  Percent,
  DollarSign,
  Activity,
  Calendar,
  ShieldAlert,
  Sliders,
} from 'lucide-react';

export const Backtesting: React.FC = () => {
  const toast = useToast();

  const [symbol, setSymbol] = useState('AAPL');
  const [resolution, setResolution] = useState('15');
  const [rangeDays, setRangeDays] = useState(14);
  const [fastSma, setFastSma] = useState(10);
  const [slowSma, setSlowSma] = useState(30);
  const [initialCash, setInitialCash] = useState(100000);

  const [runs, setRuns] = useState<BacktestRunResponse[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [compareRunId, setCompareRunId] = useState<number | null>(null);

  const [selectedRun, setSelectedRun] = useState<BacktestRunResponse | null>(null);
  const [compareRun, setCompareRun] = useState<BacktestRunResponse | null>(null);
  const [selectedEquity, setSelectedEquity] = useState<BacktestEquityPoint[]>([]);
  const [compareEquity, setCompareEquity] = useState<BacktestEquityPoint[]>([]);
  const [trades, setTrades] = useState<BacktestTrade[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      const data = await getBacktestRuns();
      setRuns(data);
      if (data.length > 0 && selectedRunId === null) {
        setSelectedRunId(data[0].id);
      }
    } catch (err) {
      console.error('Erreur chargement des runs:', err);
    }
  }, [selectedRunId]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const loadRunDetails = useCallback(async (runId: number) => {
    setLoadingDetails(true);
    try {
      const [runData, equityData, tradesData] = await Promise.all([
        getBacktestRun(runId),
        getBacktestEquity(runId),
        getBacktestTrades(runId),
      ]);
      setSelectedRun(runData);
      setSelectedEquity(equityData);
      setTrades(tradesData);
    } catch (err) {
      console.error('Erreur chargement détails du run:', err);
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    const hasPending = runs.some((r) => r.status === 'QUEUED' || r.status === 'RUNNING');
    if (!hasPending) return;

    const interval = setInterval(async () => {
      try {
        const updated = await getBacktestRuns();
        setRuns(updated);

        if (selectedRunId) {
          const sel = updated.find((r) => r.id === selectedRunId);
          if (sel && sel.status !== selectedRun?.status) {
            setSelectedRun(sel);
            if (sel.status === 'DONE') {
              loadRunDetails(sel.id);
              toast.success('Backtest terminé', `Run #${sel.id} (${sel.symbol}) calculé.`);
            }
          }
        }
      } catch (err) {
        console.error('Erreur polling:', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [runs, selectedRunId, selectedRun, loadRunDetails, toast]);

  useEffect(() => {
    if (!compareRunId) {
      setCompareRun(null);
      setCompareEquity([]);
      return;
    }
    const loadCompare = async () => {
      try {
        const [cRun, cEq] = await Promise.all([
          getBacktestRun(compareRunId),
          getBacktestEquity(compareRunId),
        ]);
        setCompareRun(cRun);
        setCompareEquity(cEq);
      } catch (e) {
        console.error('Erreur chargement comparaison:', e);
      }
    };
    loadCompare();
  }, [compareRunId]);

  useEffect(() => {
    if (selectedRunId) {
      loadRunDetails(selectedRunId);
    }
  }, [selectedRunId, loadRunDetails]);

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (fastSma >= slowSma) {
      setErrorMsg(
        `La SMA Rapide (${fastSma}) doit être strictement inférieure à la SMA Lente (${slowSma}).`
      );
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const fromSec = now - rangeDays * 24 * 3600;

    setSubmitting(true);
    try {
      const newRun = await launchBacktest({
        symbol: symbol.trim().toUpperCase(),
        resolution,
        fromEpochSec: fromSec,
        toEpochSec: now,
        strategy: 'SMA_CROSS',
        params: { fast: Number(fastSma), slow: Number(slowSma) },
        initialCash: Number(initialCash),
      });

      setRuns((prev) => [newRun, ...prev]);
      setSelectedRunId(newRun.id);
      setSelectedRun(newRun);
      setSelectedEquity([]);
      setTrades([]);
      toast.info('Simulation lancée', `Backtest #${newRun.id} sur ${newRun.symbol} démarré.`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Échec du lancement du backtest.';
      setErrorMsg(msg);
      toast.error('Erreur backtest', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const chartSeries = [];
  if (selectedRun && selectedEquity.length > 0) {
    chartSeries.push({
      label: `Run #${selectedRun.id} (${selectedRun.symbol} SMA ${selectedRun.params.fast}/${selectedRun.params.slow})`,
      color: '#38BDF8',
      points: selectedEquity,
    });
  }
  if (compareRun && compareEquity.length > 0) {
    chartSeries.push({
      label: `Run #${compareRun.id} (${compareRun.symbol} SMA ${compareRun.params.fast}/${compareRun.params.slow})`,
      color: '#8B5CF6',
      points: compareEquity,
    });
  }

  return (
    <AppShell
      section="Quantitative"
      title="Quantitative Backtesting"
      badge="Finnhub OHLCV · SMA Crossover"
    >
      <PageTransition className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left Column: Config + History */}
        <div className="xl:col-span-4 flex flex-col gap-5">
          <div className="workstation-panel rounded-xl p-5">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-subtle">
              <div className="w-6 h-6 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
                Configuration de Simulation
              </h2>
            </div>

            <form onSubmit={handleLaunch} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1.5">
                  Symbole Réel (US Stock ou Crypto)
                </label>
                <input
                  type="text"
                  required
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="AAPL, MSFT, BINANCE:BTCUSDT…"
                  className="w-full bg-[#070B14] border border-subtle text-white font-mono text-xs px-3 py-2.5 rounded-lg focus:outline-none focus:border-sky-400 uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1.5">
                    Résolution
                  </label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full bg-[#070B14] border border-subtle text-white font-mono text-xs px-3 py-2.5 rounded-lg focus:outline-none focus:border-sky-400"
                  >
                    <option value="1">1 minute</option>
                    <option value="5">5 minutes</option>
                    <option value="15">15 minutes</option>
                    <option value="60">1 heure</option>
                    <option value="D">1 jour (Daily)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1.5">
                    Fenêtre Historique
                  </label>
                  <select
                    value={rangeDays}
                    onChange={(e) => setRangeDays(Number(e.target.value))}
                    className="w-full bg-[#070B14] border border-subtle text-white font-mono text-xs px-3 py-2.5 rounded-lg focus:outline-none focus:border-sky-400"
                  >
                    <option value={3}>3 Jours</option>
                    <option value={7}>7 Jours</option>
                    <option value={14}>14 Jours</option>
                    <option value={30}>30 Jours</option>
                    <option value={60}>60 Jours</option>
                  </select>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#070B14]/70 border border-subtle space-y-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-semibold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Paramètres SMA Crossover
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">
                      SMA Rapide (fast)
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={100}
                      value={fastSma}
                      onChange={(e) => setFastSma(Number(e.target.value))}
                      className="w-full bg-[#101A2B] border border-subtle text-white font-mono tabular-nums text-xs px-2.5 py-2 rounded-lg focus:outline-none focus:border-sky-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">
                      SMA Lente (slow)
                    </label>
                    <input
                      type="number"
                      min={3}
                      max={200}
                      value={slowSma}
                      onChange={(e) => setSlowSma(Number(e.target.value))}
                      className="w-full bg-[#101A2B] border border-subtle text-white font-mono tabular-nums text-xs px-2.5 py-2 rounded-lg focus:outline-none focus:border-sky-400"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1.5">
                  Capital Initial ($)
                </label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={initialCash}
                  onChange={(e) => setInitialCash(Number(e.target.value))}
                  className="w-full bg-[#070B14] border border-subtle text-white font-mono tabular-nums text-xs px-3 py-2.5 rounded-lg focus:outline-none focus:border-sky-400"
                />
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 text-rose-300 text-xs bg-rose-500/10 border border-rose-500/25 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl btn-primary-cyan disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.985]"
              >
                {submitting ? (
                  <OrbitalSpinner size="xs" tone="slate" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                {submitting ? 'Lancement en cours…' : 'Démarrer le Backtest'}
              </button>
            </form>
          </div>

          {/* Runs History */}
          <div className="workstation-panel rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-3 border-b border-subtle">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-400" />
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Historique des Runs
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">{runs.length} runs</span>
            </div>

            {runs.length === 0 ? (
              <EmptyState
                compact
                icon={BarChart3}
                title="Aucune simulation"
                description="Vos exécutions de backtesting apparaîtront ici."
              />
            ) : (
              <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
                {runs.map((r) => {
                  const isSelected = selectedRunId === r.id;
                  const isCompare = compareRunId === r.id;
                  const isDone = r.status === 'DONE';
                  const ret = r.totalReturn ?? 0;

                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRunId(r.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition select-none flex flex-col gap-2 ${
                        isSelected
                          ? 'bg-[#142035] border-sky-400/60 shadow-sm'
                          : isCompare
                          ? 'bg-violet-950/30 border-violet-500/50'
                          : 'bg-[#070B14]/60 border-subtle hover:border-strong'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <AssetLogo symbol={r.symbol} size="xs" />
                          <span className="font-mono font-bold text-xs text-white truncate">
                            {r.symbol}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#101A2B] text-slate-300 border border-subtle">
                            {r.resolution}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {r.params.fast}/{r.params.slow}
                          </span>
                        </div>

                        {r.status === 'DONE' && (
                          <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1 shrink-0">
                            <CheckCircle className="w-3 h-3" /> Terminé
                          </span>
                        )}
                        {(r.status === 'QUEUED' || r.status === 'RUNNING') && (
                          <span className="text-[10px] font-medium text-amber-400 flex items-center gap-1 shrink-0">
                            <RefreshCw className="w-3 h-3 animate-spin" /> {r.status}
                          </span>
                        )}
                        {r.status === 'FAILED' && (
                          <span className="text-[10px] font-medium text-rose-400 flex items-center gap-1 shrink-0">
                            <AlertCircle className="w-3 h-3" /> Échec
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums pt-1.5 border-t border-subtle">
                        {isDone ? (
                          <span
                            className={`font-semibold ${
                              ret >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {ret >= 0 ? '+' : ''}
                            {ret.toFixed(2)}% · MDD {r.maxDrawdown?.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            {new Date(r.createdAt).toLocaleTimeString('fr-FR')}
                          </span>
                        )}

                        {isDone && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isCompare) setCompareRunId(null);
                              else if (r.id !== selectedRunId) setCompareRunId(r.id);
                            }}
                            disabled={isSelected}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition ${
                              isCompare
                                ? 'bg-violet-500/20 text-violet-200 border-violet-400/50'
                                : 'bg-[#101A2B] text-slate-400 hover:text-violet-300 border-subtle disabled:opacity-40'
                            }`}
                          >
                            {isCompare ? '✓ Comparé' : '+ Comparer'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Analytics */}
        <div className="xl:col-span-8 flex flex-col gap-5">
          {selectedRun ? (
            <>
              <div className="workstation-panel rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold font-mono text-white flex items-center gap-2">
                      <AssetLogo symbol={selectedRun.symbol} size="sm" />
                      Run #{selectedRun.id} — {selectedRun.symbol}
                      {loadingDetails && <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" />}
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/25">
                      {selectedRun.strategy} ({selectedRun.params.fast}/{selectedRun.params.slow})
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#070B14] text-slate-300 border border-subtle">
                      TF {selectedRun.resolution}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1.5 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      Du {new Date(selectedRun.fromTs).toLocaleDateString('fr-FR')} au{' '}
                      {new Date(selectedRun.toTs).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>

                {compareRun && (
                  <div className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/30 rounded-lg px-3 py-1.5 text-xs font-mono">
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-400" />
                    <span className="text-violet-200">
                      Overlay Run #{compareRun.id} ({compareRun.symbol})
                    </span>
                    <button
                      onClick={() => setCompareRunId(null)}
                      className="text-slate-400 hover:text-white ml-1"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {selectedRun.status !== 'DONE' &&
                (selectedRun.status === 'FAILED' ? (
                  <div className="p-8 rounded-xl border bg-rose-950/20 border-rose-500/30 text-rose-300 flex flex-col items-center justify-center gap-2.5 text-center">
                    <ShieldAlert className="w-8 h-8 text-rose-400" />
                    <div className="font-semibold text-sm">Le backtest n'a pas pu aboutir</div>
                    <div className="text-xs text-rose-300/80 max-w-md font-mono">
                      {selectedRun.errorMessage}
                    </div>
                  </div>
                ) : (
                  <AnimatedMarketLoader
                    mode="quant"
                    variant="centerpiece"
                    badge={`QUANT ENGINE · ${selectedRun.status}`}
                    title="Simulation quantitative en cours…"
                    subtitle="Récupération des chandeliers historiques et calcul des croisements SMA & ratio de Sharpe."
                  />
                ))}

              {selectedRun.status === 'DONE' && (
                <>
                  {/* KPI Grid */}
                  <MotionStagger className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <MotionItem>
                      <StatCard
                        label="Rendement Total"
                        value={
                          <span
                            className={
                              (selectedRun.totalReturn ?? 0) >= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }
                          >
                            <AnimatedNumber
                              value={selectedRun.totalReturn}
                              format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`}
                            />
                          </span>
                        }
                        icon={(selectedRun.totalReturn ?? 0) >= 0 ? TrendingUp : TrendingDown}
                        accent={(selectedRun.totalReturn ?? 0) >= 0 ? 'bullish' : 'bearish'}
                      />
                    </MotionItem>
                    <MotionItem>
                      <StatCard
                        label="Max Drawdown"
                        value={
                          <span className="text-amber-400">
                            <AnimatedNumber
                              value={selectedRun.maxDrawdown}
                              format={(v) => `${v.toFixed(2)}%`}
                            />
                          </span>
                        }
                        icon={Percent}
                        accent="warning"
                      />
                    </MotionItem>
                    <MotionItem>
                      <StatCard
                        label="Ratio de Sharpe"
                        value={
                          <AnimatedNumber
                            value={selectedRun.sharpeRatio}
                            format={(v) => v.toFixed(2)}
                          />
                        }
                        icon={Activity}
                        accent="cyan"
                      />
                    </MotionItem>
                    <MotionItem>
                      <StatCard
                        label="Trades / Win Rate"
                        value={
                          <span>
                            {selectedRun.tradesCount}{' '}
                            <span className="text-xs font-normal text-slate-400">
                              ({selectedRun.winRate?.toFixed(0)}% win)
                            </span>
                          </span>
                        }
                        icon={Layers}
                        accent="violet"
                      />
                    </MotionItem>
                  </MotionStagger>

                  {/* Equity Chart */}
                  {loadingDetails && selectedEquity.length === 0 ? (
                    <ChartSkeleton height={340} />
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-sky-400" />
                          Courbe d'Equity & Comparaison
                        </h3>
                        <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                          {selectedEquity.length} points temporels
                        </span>
                      </div>
                      <EquityChart series={chartSeries} height={340} />
                    </div>
                  )}

                  {/* Trades Table */}
                  {loadingDetails && trades.length === 0 ? (
                    <SkeletonTable rows={5} cols={7} />
                  ) : (
                    <div className="workstation-panel rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-emerald-400" />
                          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                            Ordres Simulés Exécutés
                          </h3>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                          {trades.length} ordres
                        </span>
                      </div>

                      {trades.length === 0 ? (
                        <EmptyState
                          compact
                          icon={Activity}
                          title="Aucun signal déclenché"
                          description="Aucun croisement SMA détecté sur cet intervalle temporel."
                        />
                      ) : (
                        <div className="max-h-80 overflow-y-auto overflow-x-auto">
                          <table className="w-full text-xs font-mono tabular-nums">
                            <thead className="sticky top-0 bg-[#0B1220] border-b border-subtle z-10">
                              <tr className="text-slate-400 uppercase text-[10px] tracking-wider">
                                <th className="px-4 py-2.5 text-left font-medium">Horodatage</th>
                                <th className="px-3 py-2.5 text-left font-medium">Symbole</th>
                                <th className="px-3 py-2.5 text-center font-medium">Côté</th>
                                <th className="px-3 py-2.5 text-right font-medium">Quantité</th>
                                <th className="px-3 py-2.5 text-right font-medium">Prix</th>
                                <th className="px-3 py-2.5 text-right font-medium">Frais</th>
                                <th className="px-4 py-2.5 text-right font-medium">Cash Après</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/40">
                              {trades.map((t) => (
                                <tr key={t.id} className="hover:bg-[#142035]/60 transition">
                                  <td className="px-4 py-2.5 text-slate-400">
                                    {new Date(t.ts).toLocaleString('fr-FR')}
                                  </td>
                                  <td className="px-3 py-2.5 text-white font-semibold">
                                    {t.symbol}
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
                                  <td className="px-3 py-2.5 text-right text-slate-300">
                                    {Number(t.qty).toFixed(4)}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-white font-semibold">
                                    ${Number(t.price).toFixed(4)}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-slate-400">
                                    ${Number(t.fee).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-slate-200 font-semibold">
                                    $
                                    {Number(t.cashAfter).toLocaleString('en-US', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="workstation-panel rounded-xl">
              <EmptyState
                icon={BarChart3}
                title="Aucun backtest sélectionné"
                description="Configurez les paramètres SMA et la fenêtre temporelle à gauche pour démarrer une simulation."
              />
            </div>
          )}
        </div>
      </PageTransition>
    </AppShell>
  );
};
