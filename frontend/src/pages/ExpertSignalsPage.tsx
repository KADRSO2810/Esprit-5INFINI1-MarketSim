import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../components/layout/AppShell';
import {
  Shield,
  Target,
  Zap,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Sparkles,
  Info,
  SlidersHorizontal,
  Sliders,
  Award,
  AlertTriangle,
  X,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
} from 'lucide-react';
import {
  getMarketHealth,
  getSignalTrackRecord,
  scanSignals,
} from '../api/signals';
import { placeMarketOrder } from '../api/trading';
import { ExpertSignal, MarketHealth, SignalTrackRecord } from '../types/signal';

export const ExpertSignalsPage: React.FC = () => {
  const [health, setHealth] = useState<MarketHealth | null>(null);
  const [signals, setSignals] = useState<ExpertSignal[]>([]);
  const [trackRecord, setTrackRecord] = useState<SignalTrackRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);

  // Filters & State
  const [activeTab, setActiveTab] = useState<'ALL' | 'GOLD' | 'STOCKS' | 'TRACK_RECORD'>('ALL');
  const [forceSimulated, setForceSimulated] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal d'exécution d'ordre 1-clic
  const [executingSignal, setExecutingSignal] = useState<ExpertSignal | null>(null);
  const [orderQuantity, setOrderQuantity] = useState<number>(1);
  const [executingOrder, setExecutingOrder] = useState<boolean>(false);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState<string | null>(null);
  const [orderErrorMessage, setOrderErrorMessage] = useState<string | null>(null);

  const fetchData = useCallback(async (isScan = false) => {
    try {
      if (isScan) setScanning(true);
      else setLoading(true);

      const [healthData, trackData] = await Promise.all([
        getMarketHealth(),
        getSignalTrackRecord(),
      ]);
      setHealth(healthData);
      setTrackRecord(trackData);

      const filterCategory = activeTab === 'TRACK_RECORD' ? 'ALL' : activeTab;
      const sigs = await scanSignals({
        assetFilter: filterCategory,
        forceSimulatedScan: forceSimulated,
        minRiskReward: 2.0,
      });
      setSignals(sigs);
    } catch (err) {
      console.error('Erreur chargement signaux experts:', err);
    } finally {
      setLoading(false);
      setScanning(false);
    }
  }, [activeTab, forceSimulated]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCopyTelegram = (sig: ExpertSignal) => {
    navigator.clipboard.writeText(sig.telegramFormattedText);
    setCopiedId(sig.id);
    setTimeout(() => setCopiedId(null), 3000);
  };

  const handleOpenExecution = (sig: ExpertSignal) => {
    setExecutingSignal(sig);
    setOrderQuantity(1);
    setOrderSuccessMessage(null);
    setOrderErrorMessage(null);
  };

  const handleConfirmOrder = async () => {
    if (!executingSignal) return;
    try {
      setExecutingOrder(true);
      setOrderErrorMessage(null);

      // Exécute l'ordre au marché avec Stop Loss et Take Profit pré-remplis de l'expert
      const fill = await placeMarketOrder(
        executingSignal.symbol,
        executingSignal.side,
        orderQuantity,
        0, // Session par défaut
        executingSignal.stopLoss,
        executingSignal.takeProfit1
      );

      setOrderSuccessMessage(
        `Ordre exécuté avec succès : ${fill.side} ${fill.quantity} ${fill.symbol} à $${fill.price.toFixed(2)} (SL: $${executingSignal.stopLoss.toFixed(2)}, TP: $${executingSignal.takeProfit1.toFixed(2)})`
      );
      setTimeout(() => {
        setExecutingSignal(null);
        setOrderSuccessMessage(null);
      }, 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'exécution de l'ordre";
      setOrderErrorMessage(msg);
    } finally {
      setExecutingOrder(false);
    }
  };

  return (
    <AppShell title="Signaux Experts (VIP)" section="AI Intelligence">
      <div className="space-y-6 pb-12 max-w-7xl mx-auto">
        {/* ── HEADER HERO ── */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 p-6 shadow-xl backdrop-blur-xl">
          <div className="absolute -right-8 -top-8 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
          <div className="absolute right-1/4 -bottom-10 h-36 w-36 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  VIP SIGNAL DESK • COMMUNITY EXPERT
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  QUANT RATIO &gt; 1:2.5
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                Signaux de Trading d'Élite & Analyse d'Expert
              </h1>
              <p className="mt-1 text-sm text-slate-300 max-w-2xl leading-relaxed">
                Setups haute conviction sur l'<strong>Or physique (GLD)</strong> et les <strong>Actions NYSE</strong>.
                Filtrage strict par la liquidité et la volatilité : si les probabilités ne sont pas optimales, le système
                préserve votre capital en refusant d'émettre des faux signaux.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Toggle Mode Strict vs Démo */}
              <button
                onClick={() => setForceSimulated(!forceSimulated)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all border ${
                  forceSimulated
                    ? 'bg-purple-950/60 border-purple-500/50 text-purple-200 hover:bg-purple-900/60'
                    : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200 hover:bg-emerald-900/60'
                }`}
                title={
                  forceSimulated
                    ? 'Mode Simulation actif : Les signaux sont générés même si le NYSE est fermé'
                    : 'Mode Strict actif : Respect rigoureux des horaires et de la liquidité du marché'
                }
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>
                  {forceSimulated ? '🧪 Mode Scan Démo (Simulation)' : '🔒 Mode Strict (Marché Réel)'}
                </span>
              </button>

              {/* Bouton Scanner en Direct */}
              <button
                onClick={() => fetchData(true)}
                disabled={scanning}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 active:scale-95 transition-all shadow-lg shadow-amber-600/20 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
                <span>{scanning ? 'Scan en cours...' : 'Scanner les Marchés'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── BARRE DE SANTÉ DU MARCHÉ & PRÉSERVATION DU CAPITAL ── */}
        {health && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Statut Session NYSE
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    health.nyseOpen ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'
                  }`}
                />
              </div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>{health.nyseOpen ? '🟢 OUVERT' : '🔴 FERMÉ'}</span>
                <span className="text-xs font-normal text-slate-400">09:30 - 16:00 EST</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 truncate">{health.nyseStatusLabel}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  Matières Premières & Or
                </span>
                <span className="text-amber-400 font-mono text-xs">24h/5</span>
              </div>
              <div className="text-sm font-bold text-amber-300 truncate">
                {health.goldStatus}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Actif de référence : SPDR Gold (GLD)</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  Stabilité & Règle du Mentor
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    health.isStableForTrading
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {health.isStableForTrading ? 'PRÊT' : 'PRUDENCE'}
                </span>
              </div>
              <div className="text-sm font-bold text-white">
                {health.isStableForTrading ? 'Conditions Validées' : 'Protection Capital Active'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Qualité &gt; Quantité (Cash is a position)
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-purple-400" />
                  Performance Track Record
                </span>
                <span className="text-emerald-400 font-bold font-mono text-xs">
                  {health.overallWinRate}% Win
                </span>
              </div>
              <div className="text-sm font-bold text-white flex items-center justify-between">
                <span>R:R Moyen</span>
                <span className="text-cyan-400 font-mono">1:{health.averageRiskReward}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Sur 28 signaux certifiés récents</p>
            </div>
          </div>
        )}

        {/* ── BANNIÈRE D'AVERTISSEMENT MENTOR (SI ADVISORY) ── */}
        {health?.advisoryMessage && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300 flex items-start gap-3">
            <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold text-amber-300 mr-2">Note de l'Analyste en Chef :</span>
              {health.advisoryMessage}
            </div>
          </div>
        )}

        {/* ── ONGLET DE NAVIGATION / FILTRE ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'ALL'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              🌐 Tous les Signaux
            </button>
            <button
              onClick={() => setActiveTab('GOLD')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'GOLD'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              🏆 Focus Or (GLD / Métaux)
            </button>
            <button
              onClick={() => setActiveTab('STOCKS')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'STOCKS'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              🏛️ Actions NYSE / US Stocks
            </button>
            <button
              onClick={() => setActiveTab('TRACK_RECORD')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'TRACK_RECORD'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              📊 Track Record Transparent
            </button>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>Signaux actifs :</span>
            <span className="font-bold text-white bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
              {activeTab === 'TRACK_RECORD' ? trackRecord?.totalSignals ?? 0 : signals.length}
            </span>
          </div>
        </div>

        {/* ── CORPS PRINCIPAL : SIGNAUX OU TRACK RECORD ── */}
        {loading ? (
          <div className="py-24 text-center">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-400">Analyse quantitative du carnet d'ordres en cours...</p>
          </div>
        ) : activeTab === 'TRACK_RECORD' ? (
          /* ── VUE TRACK RECORD & WINRATE ── */
          <div className="space-y-6">
            {trackRecord && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-center">
                  <div className="text-xs text-slate-400 mb-1">Taux de Réussite</div>
                  <div className="text-2xl font-black text-emerald-400 font-mono">
                    {trackRecord.winRate}%
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Validé sur 28 trades</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-center">
                  <div className="text-xs text-slate-400 mb-1">Signaux Gagnants</div>
                  <div className="text-2xl font-black text-white font-mono">
                    {trackRecord.successfulSignals}
                    <span className="text-xs text-slate-500 font-normal"> / {trackRecord.totalSignals}</span>
                  </div>
                  <div className="text-[11px] text-emerald-400 mt-1">22 TP touchés</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-center">
                  <div className="text-xs text-slate-400 mb-1">R:R Moyen</div>
                  <div className="text-2xl font-black text-cyan-400 font-mono">
                    1:{trackRecord.avgRiskReward}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Asymétrie positive</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-center">
                  <div className="text-xs text-slate-400 mb-1">Pips / Points Cumulés</div>
                  <div className="text-2xl font-black text-amber-400 font-mono">
                    +{trackRecord.totalProfitPips}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Sur 30 derniers jours</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-center col-span-2 md:col-span-1">
                  <div className="text-xs text-slate-400 mb-1">Max Drawdown</div>
                  <div className="text-2xl font-black text-rose-400 font-mono">
                    -{trackRecord.maxDrawdownPct}%
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Gestion stricte du risque</div>
                </div>
              </div>
            )}

            {/* Table historique des signaux passés */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  Historique Transparent des Derniers Signaux Fermés
                </h3>
                <span className="text-xs text-slate-400">Audité & Vérifiable</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">Actif</th>
                      <th className="py-3 px-4">Direction</th>
                      <th className="py-3 px-4">Prix Entrée</th>
                      <th className="py-3 px-4">Prix Sortie</th>
                      <th className="py-3 px-4">Stop Loss</th>
                      <th className="py-3 px-4">Take Profit</th>
                      <th className="py-3 px-4">Résultat</th>
                      <th className="py-3 px-4 text-right">Performance</th>
                      <th className="py-3 px-4 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {trackRecord?.recentHistory.map((h) => {
                      const isProfit = h.profitPct > 0;
                      return (
                        <tr key={h.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-bold text-white flex items-center gap-2 font-sans">
                            <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-mono font-bold text-[11px] text-amber-300 border border-slate-700">
                              {h.symbol}
                            </span>
                            <span>{h.assetName}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                h.side === 'BUY'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {h.side}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-300">${h.entryPrice.toFixed(2)}</td>
                          <td className="py-3 px-4 text-slate-300">${h.exitPrice.toFixed(2)}</td>
                          <td className="py-3 px-4 text-rose-400">${h.stopLoss.toFixed(2)}</td>
                          <td className="py-3 px-4 text-emerald-400">${h.takeProfit.toFixed(2)}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isProfit
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {h.result}
                            </span>
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-bold ${
                              isProfit ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isProfit ? '+' : ''}
                            {h.profitPct.toFixed(2)}%
                          </td>
                          <td className="py-3 px-4 text-right text-slate-500 font-sans">{h.closedAt}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : signals.length === 0 ? (
          /* ── ÉTAT MARCHÉ FERMÉ / PROTECTION DU CAPITAL ── */
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-slate-900 to-slate-950 p-8 text-center max-w-2xl mx-auto my-8 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
              <Shield className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              🛡️ Protection du Capital Active : Aucun Signal à Risque Inutile
            </h3>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              Le marché américain (NYSE) est actuellement hors-séance ou présente une profondeur de liquidité insuffisante.
              Conformément à la règle d'or des traders de haut niveau :
            </p>
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 text-xs font-mono text-amber-300/90 italic mb-6">
              "Si le marché n'est pas stable ou n'offre pas un avantage statistique net (Edge &gt; 1:2.5), aucun signal
              n'est émis. Cash is a position : préserver son capital est la première condition de la richesse en trading."
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => {
                  setForceSimulated(true);
                  fetchData(true);
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Sliders className="w-4 h-4" />
                <span>Activer le Mode Scan Démo (Simuler Setups)</span>
              </button>
              <button
                onClick={() => fetchData(true)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Vérifier à Nouveau</span>
              </button>
            </div>
          </div>
        ) : (
          /* ── GRILLE DES SIGNAUX ACTIFS HAUTE CONVICTION ── */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {signals.map((sig) => {
              const isBuy = sig.side === 'BUY';
              const isCopied = copiedId === sig.id;
              const potProfitPct = (((sig.takeProfit1 - sig.entryPrice) / sig.entryPrice) * 100);
              const potLossPct = (((sig.entryPrice - sig.stopLoss) / sig.entryPrice) * 100);

              return (
                <div
                  key={sig.id}
                  className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 p-6 shadow-xl hover:border-amber-500/40 transition-all flex flex-col justify-between"
                >
                  {/* Carte Top : Symbol, Grade, Side, R:R */}
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black font-mono text-base text-amber-300 shadow-inner">
                          {sig.symbol}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-white tracking-tight">
                              {sig.assetName}
                            </h3>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              GRADE {sig.qualityGrade}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {sig.assetClass === 'COMMODITY' ? 'Matière Première • Or Physique' : 'Action US • New York Stock Exchange'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wide border ${
                            isBuy
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          }`}
                        >
                          {isBuy ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          <span>{isBuy ? 'ACHAT FORT (BUY)' : 'VENTE (SELL)'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-1">
                          Conviction : <strong className="text-white">{sig.confidenceScore}%</strong>
                        </div>
                      </div>
                    </div>

                    {/* Grille des Prix : Entrée, Stop Loss, Take Profits */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-4 font-mono text-xs">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-sans">Prix d'Entrée</div>
                        <div className="text-sm font-bold text-white mt-0.5">
                          ${sig.entryPrice.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-cyan-400 font-sans">Direct Marché</div>
                      </div>

                      <div>
                        <div className="text-[10px] text-rose-400/90 uppercase font-sans flex items-center gap-1">
                          <span>Stop-Loss (SL)</span>
                        </div>
                        <div className="text-sm font-bold text-rose-400 mt-0.5">
                          ${sig.stopLoss.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-rose-400/70 font-sans">
                          -{Math.abs(potLossPct).toFixed(2)}%
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-emerald-400/90 uppercase font-sans">
                          Ratio Risk:Reward
                        </div>
                        <div className="text-sm font-bold text-emerald-300 mt-0.5">
                          1:{sig.riskRewardRatio}
                        </div>
                        <div className="text-[10px] text-emerald-400/70 font-sans">Asymétrie VIP</div>
                      </div>

                      <div className="border-t border-slate-800/60 pt-2">
                        <div className="text-[10px] text-slate-400 uppercase font-sans">Objectif 1 (TP1)</div>
                        <div className="text-xs font-bold text-emerald-400 mt-0.5">
                          ${sig.takeProfit1.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-emerald-400/80 font-sans">
                          +{potProfitPct.toFixed(2)}% (50%)
                        </div>
                      </div>

                      <div className="border-t border-slate-800/60 pt-2">
                        <div className="text-[10px] text-slate-400 uppercase font-sans">Objectif 2 (TP2)</div>
                        <div className="text-xs font-bold text-emerald-400 mt-0.5">
                          ${sig.takeProfit2.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans">Extension Trend</div>
                      </div>

                      <div className="border-t border-slate-800/60 pt-2">
                        <div className="text-[10px] text-slate-400 uppercase font-sans">Objectif 3 (TP3)</div>
                        <div className="text-xs font-bold text-emerald-400 mt-0.5">
                          ${sig.takeProfit3.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans">Cible Institutionnelle</div>
                      </div>
                    </div>

                    {/* Analyse & Thèse de l'Expert */}
                    <div className="space-y-3 mb-4 text-xs">
                      <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800">
                        <div className="font-semibold text-amber-300 mb-1 flex items-center gap-1.5">
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          Thèse Technique de l'Expert
                        </div>
                        <p className="text-slate-300 leading-relaxed text-[11px]">
                          {sig.technicalThesis}
                        </p>
                      </div>

                      <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800">
                        <div className="font-semibold text-cyan-300 mb-1 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5" />
                          Catalyseur Macro / Fondamental
                        </div>
                        <p className="text-slate-300 leading-relaxed text-[11px]">
                          {sig.fundamentalCatalyst}
                        </p>
                      </div>

                      <div className="bg-amber-950/20 rounded-xl p-3 border border-amber-500/20">
                        <div className="font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5" />
                          Règle de Money Management
                        </div>
                        <p className="text-amber-200/90 leading-relaxed text-[11px]">
                          {sig.riskManagementRule}
                        </p>
                      </div>
                    </div>

                    {/* Indicateurs Utilisés */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-5">
                      {sig.indicatorsUsed.map((ind, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-800/80 text-slate-300 border border-slate-700/60"
                        >
                          {ind}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Boutons d'Action : Exécuter 1-Clic et Copier Format Telegram */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-3 border-t border-slate-800/80">
                    <button
                      onClick={() => handleOpenExecution(sig)}
                      className="w-full sm:flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                    >
                      <Zap className="w-4 h-4 text-emerald-200" />
                      <span>⚡ Exécuter l'Ordre en 1 Clic</span>
                    </button>

                    <button
                      onClick={() => handleCopyTelegram(sig)}
                      className="w-full sm:w-auto py-2.5 px-4 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all border border-slate-700 flex items-center justify-center gap-2"
                      title="Copier le message formaté pour Telegram / Discord"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copié !</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-slate-400" />
                          <span>Format Telegram VIP</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── MODAL D'EXÉCUTION D'ORDRE EN 1 CLIC ── */}
        {executingSignal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl relative text-left">
              <button
                onClick={() => setExecutingSignal(null)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold font-mono">
                  {executingSignal.symbol}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Cockpit d'Exécution Directe • {executingSignal.symbol}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Application automatique du Stop-Loss et Take-Profit de l'Expert
                  </p>
                </div>
              </div>

              {orderSuccessMessage ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-3 my-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm mb-1">Confirmation d'Ordre</div>
                    <div>{orderSuccessMessage}</div>
                  </div>
                </div>
              ) : (
                <>
                  {orderErrorMessage && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>{orderErrorMessage}</span>
                    </div>
                  )}

                  {/* Paramètres récapitulatifs */}
                  <div className="space-y-3 text-xs mb-4">
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Sens de la position</span>
                      <span
                        className={`font-bold ${
                          executingSignal.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {executingSignal.side === 'BUY' ? 'ACHAT AU MARCHÉ (LONG)' : 'VENTE AU MARCHÉ (SHORT)'}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Cours estimé d'exécution</span>
                      <span className="font-mono font-bold text-white">
                        ${executingSignal.entryPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Protection Stop Loss</span>
                      <span className="font-mono font-bold text-rose-400">
                        ${executingSignal.stopLoss.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Objectif Take Profit 1</span>
                      <span className="font-mono font-bold text-emerald-400">
                        ${executingSignal.takeProfit1.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Choix de la quantité */}
                  <div className="mb-6">
                    <label className="block text-xs font-medium text-slate-300 mb-2">
                      Quantité d'actions / contrats à négocier :
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={orderQuantity}
                        onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                      <div className="flex items-center gap-1">
                        {[1, 5, 10, 50].map((qty) => (
                          <button
                            key={qty}
                            type="button"
                            onClick={() => setOrderQuantity(qty)}
                            className={`px-2.5 py-2 rounded-lg text-xs font-mono transition-colors ${
                              orderQuantity === qty
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {qty}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-2 flex justify-between">
                      <span>Valeur notionnelle estimée :</span>
                      <span className="font-mono font-bold text-white">
                        ${(executingSignal.entryPrice * orderQuantity).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setExecutingSignal(null)}
                      className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmOrder}
                      disabled={executingOrder}
                      className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {executingOrder ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Exécution...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          <span>Confirmer l'Exécution</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
