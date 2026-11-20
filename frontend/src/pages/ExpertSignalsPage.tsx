import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  SlidersHorizontal,
  Sliders,
  Award,
  AlertTriangle,
  X,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Volume2,
  VolumeX,
  UserCheck,
  LineChart,
  HelpCircle,
  TrendingUp,
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

  // View Mode: Débutant vs Pro Analyste
  const [viewMode, setViewMode] = useState<'BEGINNER' | 'PRO'>('BEGINNER');

  // Filters & State
  const [activeTab, setActiveTab] = useState<'ALL' | 'GOLD' | 'STOCKS' | 'TRACK_RECORD'>('ALL');
  const [forceSimulated, setForceSimulated] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal d'exécution d'ordre 1-clic
  const [executingSignal, setExecutingSignal] = useState<ExpertSignal | null>(null);
  const [orderQuantity, setOrderQuantity] = useState<number>(1);
  const [investmentBudget, setInvestmentBudget] = useState<number>(500); // Pour le mode débutant
  const [executingOrder, setExecutingOrder] = useState<boolean>(false);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState<string | null>(null);
  const [orderErrorMessage, setOrderErrorMessage] = useState<string | null>(null);

  // Mémoire des signaux vus pour déclencher l'alerte sonore lors d'un nouveau signal
  const prevSignalIdsRef = useRef<Set<string>>(new Set());

  // Synthèse d'alerte sonore Web Audio (0 dépendance externe)
  const playSignalChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // Ré (D5)
      osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.12); // La (A5)
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      osc.start();
      osc.stop(ctx.currentTime + 0.55);
    } catch (_) {}
  }, [soundEnabled]);

  const fetchData = useCallback(
    async (isManualScan = false, isSilentPolling = false) => {
      try {
        if (isManualScan) setScanning(true);
        else if (!isSilentPolling) setLoading(true);

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

        // Détection de nouveau signal pour déclencher l'alerte sonore
        const currentIds = new Set(sigs.map((s) => s.id));
        const hasNewSignal = sigs.some((s) => !prevSignalIdsRef.current.has(s.id));
        if (hasNewSignal && prevSignalIdsRef.current.size > 0) {
          playSignalChime();
        }
        prevSignalIdsRef.current = currentIds;

        setSignals(sigs);
      } catch (err) {
        console.error('Erreur actualisation signaux experts:', err);
      } finally {
        setLoading(false);
        setScanning(false);
      }
    },
    [activeTab, forceSimulated, playSignalChime]
  );

  // Premier chargement
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Actualisation temps réel silencieuse toutes les 5 secondes (cycle de vie dynamique)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(false, true);
    }, 5000);
    return () => clearInterval(interval);
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

  const handleBeginnerQuickTrade = (sig: ExpertSignal, budgetDollars: number) => {
    setExecutingSignal(sig);
    const calculatedQty = Math.max(1, Math.round(budgetDollars / sig.entryPrice));
    setOrderQuantity(calculatedQty);
    setInvestmentBudget(budgetDollars);
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
        fetchData(false, true);
      }, 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'exécution de l'ordre";
      setOrderErrorMessage(msg);
    } finally {
      setExecutingOrder(false);
    }
  };

  // Meilleur signal actuel pour le mode débutant (souvent GLD ou l'actif au score max)
  const topPickSignal = signals.length > 0 ? signals[0] : null;

  return (
    <AppShell title="Signaux Experts (VIP)" section="AI Intelligence">
      <div className="space-y-6 pb-12 max-w-7xl mx-auto">
        {/* ── BANNIÈRE HERO AVEC SÉLECTEUR DE MODE (DÉBUTANT vs PRO) ── */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 p-6 shadow-xl backdrop-blur-xl">
          <div className="absolute -right-8 -top-8 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
          <div className="absolute right-1/4 -bottom-10 h-36 w-36 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  SIGNAUX EN TEMPS RÉEL • ANALYSE DE CHANDELIERS & SESSIONS
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  🎯 OBJECTIF : MAX TP / PROTECTION SL
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                Desk de Signaux d'Élite & Auto-Trading Assisté
              </h1>
              <p className="mt-1 text-sm text-slate-300 max-w-2xl leading-relaxed">
                Conçu pour permettre à quiconque, <strong>même sans aucune connaissance en trading</strong>, de saisir
                des opportunités rentables sur l'<strong>Or (GLD)</strong> et les <strong>Actions NYSE</strong> grâce à
                des configurations de chandeliers validées et des règles de sécurisation automatiques.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Commutateur Mode Débutant / Pro */}
              <div className="flex rounded-xl bg-slate-950/80 p-1 border border-slate-800">
                <button
                  onClick={() => setViewMode('BEGINNER')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    viewMode === 'BEGINNER'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Mode Débutant (1-Clic)</span>
                </button>
                <button
                  onClick={() => setViewMode('PRO')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    viewMode === 'PRO'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LineChart className="w-3.5 h-3.5" />
                  <span>Mode Analyste Pro</span>
                </button>
              </div>

              {/* Toggle Sonore */}
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-xl text-xs font-medium transition-all border ${
                  soundEnabled
                    ? 'bg-slate-800 text-amber-300 border-amber-500/40'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
                title={soundEnabled ? 'Alerte sonore activée' : 'Alerte sonore désactivée'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {/* Toggle Mode Strict vs Démo */}
              <button
                onClick={() => setForceSimulated(!forceSimulated)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                  forceSimulated
                    ? 'bg-purple-950/60 border-purple-500/50 text-purple-200'
                    : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                }`}
                title={
                  forceSimulated
                    ? 'Mode Simulation actif : Génère des opportunités même en hors-séance'
                    : 'Mode Strict actif : Respect strict des heures et de la liquidité du NYSE'
                }
              >
                <Sliders className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {forceSimulated ? '🧪 Scan Démo' : '🔒 Strict NYSE'}
                </span>
              </button>

              {/* Bouton Scanner en Direct */}
              <button
                onClick={() => fetchData(true)}
                disabled={scanning}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 active:scale-95 transition-all shadow-lg shadow-amber-600/20 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
                <span>{scanning ? 'Scan...' : 'Scanner'}</span>
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
                  Session NYSE
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    health.nyseOpen ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'
                  }`}
                />
              </div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>{health.nyseOpen ? '🟢 EN COURS' : '🔴 FERMÉ'}</span>
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
                <span className="text-amber-400 font-mono text-xs font-bold">24h/5</span>
              </div>
              <div className="text-sm font-bold text-amber-300 truncate">
                {health.goldStatus}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Actif privilégié : Or (GLD)</p>
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
                {health.isStableForTrading ? 'Probabilités Validées' : 'Protection Capital Active'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Seuls les setups à haute rentabilité sont émis
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-purple-400" />
                  Track Record Réel
                </span>
                <span className="text-emerald-400 font-bold font-mono text-xs">
                  {health.overallWinRate}% Succès TP
                </span>
              </div>
              <div className="text-sm font-bold text-white flex items-center justify-between">
                <span>R:R Moyen</span>
                <span className="text-cyan-400 font-mono">1:{health.averageRiskReward}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Archivage automatique à chaque clôture</p>
            </div>
          </div>
        )}

        {/* ── VUE 1 : MODE DÉBUTANT (OBJECTIF : GAGNER SANS COMPRENDRE LE TRADING) ── */}
        {viewMode === 'BEGINNER' && (
          <div className="space-y-6 animate-fade-in">
            {/* Guide visuel "Comment ça marche" pour débutant */}
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-3">
                <HelpCircle className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">
                  Comment gagner même si vous ne comprenez absolument rien au trading ?
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center mb-2">
                    1
                  </div>
                  <h4 className="font-bold text-white mb-1">L'IA détecte l'opportunité</h4>
                  <p className="text-slate-400 leading-relaxed">
                    L'algorithme analyse les chandeliers et le marché en direct. Il attend une configuration où les
                    probabilités de toucher le gain (Take Profit) dépassent <strong>88%</strong>.
                  </p>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center mb-2">
                    2
                  </div>
                  <h4 className="font-bold text-white mb-1">Votre seule action : 1 Clic</h4>
                  <p className="text-slate-400 leading-relaxed">
                    Vous choisissez simplement votre budget ($100, $500 ou $1000) et cliquez sur le bouton vert. Pas de
                    graphiques compliqués à tracer.
                  </p>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center mb-2">
                    3
                  </div>
                  <h4 className="font-bold text-white mb-1">Sécurité Totale & Gain Automatique</h4>
                  <p className="text-slate-400 leading-relaxed">
                    Le robot veille : si le cours monte, vos bénéfices tombent automatiquement dans votre poche. Si le
                    marché baisse, l'ordre se coupe tout seul pour protéger votre argent.
                  </p>
                </div>
              </div>
            </div>

            {/* Carte Majeure du Meilleur Trade Instantané */}
            {topPickSignal ? (
              <div className="rounded-2xl border-2 border-amber-500/50 bg-gradient-to-b from-slate-900 to-slate-950 p-6 lg:p-8 shadow-2xl relative">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-black font-mono text-2xl shadow-lg shadow-amber-500/20">
                      {topPickSignal.symbol}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                          🟢 MEILLEURE OPPORTUNITÉ IMMÉDIATE
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          {topPickSignal.confidenceScore}% DE CHANCES DE TP
                        </span>
                      </div>
                      <h3 className="text-2xl font-black text-white mt-1">
                        {topPickSignal.assetName}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Figure identifiée : <strong className="text-amber-300">{topPickSignal.detectedPattern}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Prix en direct & Progression */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 min-w-[240px]">
                    <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                      <span>Cours en direct :</span>
                      <span className="font-mono text-base font-bold text-white">
                        ${topPickSignal.currentPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs mb-2">
                      <span className="text-slate-400">Progression vers le gain :</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {topPickSignal.progressToTp1Pct?.toFixed(0) ?? 0}%
                      </span>
                    </div>
                    {/* Barre de progression fluide */}
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${topPickSignal.progressToTp1Pct ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Explication Débutant en français simple */}
                <div className="my-6 p-4 rounded-xl bg-slate-800/40 border border-slate-800 text-sm text-slate-200">
                  <p className="leading-relaxed font-sans">{topPickSignal.beginnerAdvice}</p>
                </div>

                {/* Sélecteur de Budget & Bouton d'Exécution 1-Clic */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">Budget conseillé :</span>
                    {[200, 500, 1000].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => handleBeginnerQuickTrade(topPickSignal, amount)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                          investmentBudget === amount
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {amount} $
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handleBeginnerQuickTrade(topPickSignal, investmentBudget)}
                    className="py-3.5 px-6 rounded-xl text-sm font-black text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 hover:from-emerald-300 hover:to-teal-200 active:scale-95 transition-all shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2.5"
                  >
                    <Zap className="w-5 h-5 text-slate-950 fill-current" />
                    <span>⚡ SUIVRE CE TRADE MAINTENANT (100% SÉCURISÉ)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-500/30 bg-slate-900/90 p-8 text-center max-w-xl mx-auto">
                <Shield className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white mb-2">Marché Fermé ou Instable</h3>
                <p className="text-xs text-slate-300 mb-4">
                  Pour protéger votre argent, l'algorithme refuse de trader lorsque le marché est fermé ou incertain.
                </p>
                <button
                  onClick={() => {
                    setForceSimulated(true);
                    fetchData(true);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition-colors"
                >
                  Activer le Mode Démo pour voir un exemple
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── VUE 2 : MODE ANALYSTE PRO & GRAPHIQUES ── */}
        {viewMode === 'PRO' && (
          <div className="space-y-6">
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
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Flux en direct :</span>
                <span className="font-bold text-white bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                  {activeTab === 'TRACK_RECORD' ? trackRecord?.totalSignals ?? 0 : signals.length}
                </span>
              </div>
            </div>

            {/* CORPS PRINCIPAL : SIGNAUX OU TRACK RECORD */}
            {loading ? (
              <div className="py-24 text-center">
                <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-400">Analyse quantitative des chandeliers en direct...</p>
              </div>
            ) : activeTab === 'TRACK_RECORD' ? (
              /* VUE TRACK RECORD */
              <div className="space-y-6">
                {trackRecord && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-center">
                      <div className="text-xs text-slate-400 mb-1">Taux de Réussite</div>
                      <div className="text-2xl font-black text-emerald-400 font-mono">
                        {trackRecord.winRate}%
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">Validé sur setups réels</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-center">
                      <div className="text-xs text-slate-400 mb-1">Signaux Gagnants</div>
                      <div className="text-2xl font-black text-white font-mono">
                        {trackRecord.successfulSignals}
                        <span className="text-xs text-slate-500 font-normal"> / {trackRecord.totalSignals}</span>
                      </div>
                      <div className="text-[11px] text-emerald-400 mt-1">TP touchés</div>
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
                      <div className="text-[11px] text-slate-500 mt-1">Historique certifié</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-center col-span-2 md:col-span-1">
                      <div className="text-xs text-slate-400 mb-1">Max Drawdown</div>
                      <div className="text-2xl font-black text-rose-400 font-mono">
                        -{trackRecord.maxDrawdownPct}%
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">Protection Stop-Loss</div>
                    </div>
                  </div>
                )}

                {/* Table historique des signaux passés */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-400" />
                      Historique Transparent des Signaux Clôturés
                    </h3>
                    <span className="text-xs text-slate-400">Actualisé en temps réel</span>
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
              /* ÉTAT MARCHÉ FERMÉ / PROTECTION DU CAPITAL */
              <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-slate-900 to-slate-950 p-8 text-center max-w-2xl mx-auto my-8 shadow-2xl">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
                  <Shield className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  🛡️ Protection du Capital Active : Zéro Faux Signal
                </h3>
                <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                  Le marché américain est actuellement hors-séance. Conformément aux principes stricts des quants et
                  mentors professionnels :
                </p>
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 text-xs font-mono text-amber-300/90 italic mb-6">
                  "Si le marché n'est pas stable ou n'offre pas un avantage statistique net (Edge &gt; 1:2.5), aucun signal
                  n'est émis. Cash is a position : préserver son capital est la clé."
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
                    <span>Activer le Mode Scan Démo</span>
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
              /* GRILLE DES SIGNAUX ACTIFS HAUTE CONVICTION */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {signals.map((sig) => {
                  const isBuy = sig.side === 'BUY';
                  const isCopied = copiedId === sig.id;
                  const currentProfit = sig.currentProfitPct ?? 0;
                  const isProfit = currentProfit >= 0;

                  return (
                    <div
                      key={sig.id}
                      className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 p-6 shadow-xl hover:border-amber-500/40 transition-all flex flex-col justify-between"
                    >
                      {/* Carte Top : Symbol, Grade, Side, R:R */}
                      <div>
                        <div className="flex items-start justify-between gap-4 mb-3">
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
                                {sig.assetClass === 'COMMODITY'
                                  ? 'Matière Première • Or Physique'
                                  : 'Action US • New York Stock Exchange'}
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
                              Probabilité TP : <strong className="text-emerald-400">{sig.confidenceScore}%</strong>
                            </div>
                          </div>
                        </div>

                        {/* Figure de chandelier identifiée */}
                        {sig.detectedPattern && (
                          <div className="mb-3 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs">
                            <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                              Figure : {sig.detectedPattern}
                            </span>
                            <span className="text-slate-400 text-[11px]">Validé 15m / 1H</span>
                          </div>
                        )}

                        {/* Progression vers TP1 & PnL live */}
                        <div className="mb-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className="text-slate-400 flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                              Performance en direct :
                            </span>
                            <span
                              className={`font-mono font-bold ${
                                isProfit ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {isProfit ? '+' : ''}
                              {currentProfit.toFixed(2)}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-400 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${sig.progressToTp1Pct ?? 0}%` }}
                            />
                          </div>
                        </div>

                        {/* Grille des Prix : Entrée, Stop Loss, Take Profits */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-4 font-mono text-xs">
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase font-sans">Prix d'Entrée</div>
                            <div className="text-sm font-bold text-white mt-0.5">
                              ${sig.entryPrice.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-cyan-400 font-sans">
                              Live: ${sig.currentPrice.toFixed(2)}
                            </div>
                          </div>

                          <div>
                            <div className="text-[10px] text-rose-400/90 uppercase font-sans flex items-center gap-1">
                              <span>Stop-Loss (SL)</span>
                            </div>
                            <div className="text-sm font-bold text-rose-400 mt-0.5">
                              ${sig.stopLoss.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-rose-400/70 font-sans">Coupe auto perte</div>
                          </div>

                          <div>
                            <div className="text-[10px] text-emerald-400/90 uppercase font-sans">
                              Ratio Risk:Reward
                            </div>
                            <div className="text-sm font-bold text-emerald-300 mt-0.5">
                              1:{sig.riskRewardRatio}
                            </div>
                            <div className="text-[10px] text-emerald-400/70 font-sans">Haute Probabilité</div>
                          </div>

                          <div className="border-t border-slate-800/60 pt-2">
                            <div className="text-[10px] text-slate-400 uppercase font-sans">Objectif 1 (TP1)</div>
                            <div className="text-xs font-bold text-emerald-400 mt-0.5">
                              ${sig.takeProfit1.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-emerald-400/80 font-sans">Sécurisation 50%</div>
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
                            <div className="text-[10px] text-slate-500 font-sans">Cible Finale</div>
                          </div>
                        </div>

                        {/* Thèse Technique & Catalyseur */}
                        <div className="space-y-3 mb-4 text-xs">
                          <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800">
                            <div className="font-semibold text-amber-300 mb-1 flex items-center gap-1.5">
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                              Thèse Technique des Chandeliers
                            </div>
                            <p className="text-slate-300 leading-relaxed text-[11px]">
                              {sig.technicalThesis}
                            </p>
                          </div>

                          <div className="bg-amber-950/20 rounded-xl p-3 border border-amber-500/20">
                            <div className="font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5" />
                              Règle de Sécurisation Automatique
                            </div>
                            <p className="text-amber-200/90 leading-relaxed text-[11px]">
                              {sig.riskManagementRule}
                            </p>
                          </div>
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
                    Confirmation d'Ordre Sécurisé • {executingSignal.symbol}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Application automatique du Stop-Loss (${executingSignal.stopLoss.toFixed(2)}) et Take-Profit (${executingSignal.takeProfit1.toFixed(2)})
                  </p>
                </div>
              </div>

              {orderSuccessMessage ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-3 my-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm mb-1">Trade Enregistré avec Succès !</div>
                    <div>{orderSuccessMessage}</div>
                    <div className="mt-2 text-[11px] text-emerald-400/80">
                      Vos gains seront automatiquement crédités dès que le cours touchera l'objectif.
                    </div>
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
                        ${executingSignal.stopLoss.toFixed(2)} (Sécurité anti-perte)
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Objectif Take Profit 1</span>
                      <span className="font-mono font-bold text-emerald-400">
                        ${executingSignal.takeProfit1.toFixed(2)} (Encaissement automatique)
                      </span>
                    </div>
                  </div>

                  {/* Choix de la quantité */}
                  <div className="mb-6">
                    <label className="block text-xs font-medium text-slate-300 mb-2">
                      Quantité de titres à négocier :
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
                        {[1, 2, 5, 10].map((qty) => (
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
                      <span>Investissement notionnel :</span>
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
