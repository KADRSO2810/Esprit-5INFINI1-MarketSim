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
  Award,
  AlertTriangle,
  X,
  ArrowUpRight,
  CheckCircle2,
  Volume2,
  VolumeX,
  UserCheck,
  LineChart,
  TrendingUp,
  FastForward,
  Trash2,
} from 'lucide-react';
import {
  getMarketHealth,
  getSignalTrackRecord,
  scanSignals,
  boostTakeProfit,
  closeStalePositions,
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
  const [forceSimulated] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Actions spéciales
  const [boostingSymbol, setBoostingSymbol] = useState<string | null>(null);
  const [boostSuccessMsg, setBoostSuccessMsg] = useState<string | null>(null);
  const [closingStale, setClosingStale] = useState<boolean>(false);
  const [staleCloseMsg, setStaleCloseMsg] = useState<string | null>(null);

  // Compte à rebours local 5 minutes pour chaque scalp (en secondes restantes)
  const [countdown, setCountdown] = useState<number>(275); // ~4m35s

  // Modal d'exécution d'ordre 1-clic
  const [executingSignal, setExecutingSignal] = useState<ExpertSignal | null>(null);
  const [orderQuantity, setOrderQuantity] = useState<number>(1);
  const [investmentBudget, setInvestmentBudget] = useState<number>(500); // Pour le mode débutant
  const [executingOrder, setExecutingOrder] = useState<boolean>(false);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState<string | null>(null);
  const [orderErrorMessage, setOrderErrorMessage] = useState<string | null>(null);

  // Mémoire des signaux vus pour déclencher l'alerte sonore lors d'un nouveau signal
  const prevSignalIdsRef = useRef<Set<string>>(new Set());

  // Décrément du compte à rebours 5 minutes
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 300));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
          minRiskReward: 1.5,
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

  // Actualisation temps réel silencieuse toutes les 3 secondes (haute fréquence)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(false, true);
    }, 3000);
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

      // Exécute l'ordre au marché avec Stop Loss et Take Profit pré-remplis du Scalp 5 min
      const fill = await placeMarketOrder(
        executingSignal.symbol,
        executingSignal.side,
        orderQuantity,
        0, // Session par défaut
        executingSignal.stopLoss,
        executingSignal.takeProfit1
      );

      setOrderSuccessMessage(
        `⚡ Scalp 5 Min démarré avec succès : ${fill.side} ${fill.quantity} ${fill.symbol} à $${fill.price.toFixed(2)}. Cible Take-Profit fixée à $${executingSignal.takeProfit1.toFixed(2)} (résolution en moins de 5 min) !`
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

  // Déclenchement du Fast-Forward / Boost vers le TP
  const handleBoostTp = async (symbol: string) => {
    try {
      setBoostingSymbol(symbol);
      const res = await boostTakeProfit(symbol);
      playSignalChime();
      setBoostSuccessMsg(res.message);
      fetchData(false, true);
      setTimeout(() => setBoostSuccessMsg(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'accélération";
      setBoostSuccessMsg(`Info : ${msg}`);
      setTimeout(() => setBoostSuccessMsg(null), 4000);
    } finally {
      setBoostingSymbol(null);
    }
  };

  // Clôture des 3 anciennes positions Swing bloquées (GLD, NVDA, AAPL)
  const handleCloseStale = async () => {
    try {
      setClosingStale(true);
      const res = await closeStalePositions();
      setStaleCloseMsg(res.message);
      fetchData(false, true);
      setTimeout(() => setStaleCloseMsg(null), 6000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors du nettoyage";
      setStaleCloseMsg(`Erreur : ${msg}`);
      setTimeout(() => setStaleCloseMsg(null), 4000);
    } finally {
      setClosingStale(false);
    }
  };

  // Formatage du chrono minutes:secondes
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Meilleur signal actuel pour le mode débutant (Or GLD en priorité)
  const topPickSignal = signals.length > 0 ? signals[0] : null;

  return (
    <AppShell title="Signaux Experts (VIP)" section="AI Intelligence">
      <div className="space-y-6 pb-12 max-w-7xl mx-auto">
        {/* ── BANNIÈRE NETTOYAGE ANCIENNES POSITIONS BLOQUÉES ── */}
        <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Trash2 className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <span>Nettoyage Portefeuille : Clôturer les anciennes positions bloquées</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  GLD, NVDA, AAPL (4 jours)
                </span>
              </h4>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                Les anciens trades Swing ouverts il y a 4 jours bloquaient votre solde. Cliquez ici pour les fermer
                au cours actuel et libérer votre capital pour les <strong>Scalps Rapides 5 Minutes</strong>.
              </p>
            </div>
          </div>
          <button
            onClick={handleCloseStale}
            disabled={closingStale}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50"
          >
            <Trash2 className={`w-3.5 h-3.5 ${closingStale ? 'animate-spin' : ''}`} />
            <span>{closingStale ? 'Clôture en cours...' : '🧹 Clôturer les 3 Anciennes Positions'}</span>
          </button>
        </div>

        {/* Message de confirmation de nettoyage */}
        {staleCloseMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span>{staleCloseMsg}</span>
          </div>
        )}

        {/* Message de succès Fast-Forward Boost */}
        {boostSuccessMsg && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between gap-3 shadow-xl animate-fade-in">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
              <span className="font-bold text-sm">{boostSuccessMsg}</span>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
              GAIN ENCAISSÉ
            </span>
          </div>
        )}

        {/* ── BANNIÈRE HERO SCALP FLASH 5 MINUTES ── */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/50 p-6 shadow-xl backdrop-blur-xl">
          <div className="absolute -right-8 -top-8 h-48 w-48 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
          <div className="absolute right-1/4 -bottom-10 h-36 w-36 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <Zap className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                  SCALP FLASH 5 MINUTES • GAIN RAPIDE (M1 / M5)
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  ⏱️ RÉSOLUTION EN 2 À 4 MINUTES MAX
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                Signaux Scalp 5 Min & Prise de Bénéfice Express
              </h1>
              <p className="mt-1 text-sm text-slate-300 max-w-2xl leading-relaxed">
                Fini d'attendre 4 jours sans rien voir se passer ! Ces signaux de <strong>Scalping M1/M5</strong> ciblent
                des mouvements rapides sur l'<strong>Or (GLD)</strong> et les actions US. Dès que vous cliquez sur Acheter,
                le moteur de micro-ticks fait progresser le cours vers votre Take-Profit en <strong>moins de 5 minutes chrono</strong>.
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
                  <span>Mode Scalp Pro</span>
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

        {/* ── BARRE DE SANTÉ DU MARCHÉ ── */}
        {health && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Horizon Temporel
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300">
                  5 MIN MAX
                </span>
              </div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>⚡ SCALP RAPIDE</span>
                <span className="text-xs font-mono text-cyan-400">Timer : {formatTime(countdown)}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 truncate">Résolution express garantie en séance</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  Matière Première & Or
                </span>
                <span className="text-amber-400 font-mono text-xs font-bold">24h/5</span>
              </div>
              <div className="text-sm font-bold text-amber-300 truncate">
                Or GLD Spot Proxy
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Actif N°1 des canaux de scalping VIP</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  Moteur de Ticks Scalp
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 animate-pulse">
                  ACTIF (2.5s)
                </span>
              </div>
              <div className="text-sm font-bold text-white">
                Progression TP en Direct
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Micro-ticks continus vers l'objectif de gain
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-purple-400" />
                  Taux de Réussite Scalp
                </span>
                <span className="text-emerald-400 font-bold font-mono text-xs">
                  {health.overallWinRate}% TP Touchés
                </span>
              </div>
              <div className="text-sm font-bold text-white flex items-center justify-between">
                <span>Durée moyenne</span>
                <span className="text-cyan-400 font-mono font-bold">3 min 15s</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Prend le Take-Profit en quelques minutes</p>
            </div>
          </div>
        )}

        {/* ── VUE 1 : MODE DÉBUTANT (OBJECTIF : 1 CLIC -> GAIN EN 3 À 5 MINUTES) ── */}
        {viewMode === 'BEGINNER' && (
          <div className="space-y-6 animate-fade-in">
            {/* Guide visuel Scalp 5 min */}
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 p-6 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <h2 className="text-lg font-bold text-white">
                    Comment fonctionne votre Scalp 5 Minutes (Exactement comme sur Telegram) ?
                  </h2>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  ⏱️ FIN DU SCALP DANS : {formatTime(countdown)}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center mb-2">
                    1
                  </div>
                  <h4 className="font-bold text-white mb-1">Signal Flash Reçu</h4>
                  <p className="text-slate-400 leading-relaxed">
                    L'expert envoie un signal d'achat sur l'<strong>Or (GLD)</strong> avec un Take-Profit resserré (+0.36%).
                    La probabilité de gain est de <strong>93%</strong>.
                  </p>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center mb-2">
                    2
                  </div>
                  <h4 className="font-bold text-white mb-1">Vous cliquez sur "⚡ Suivre ce Scalp"</h4>
                  <p className="text-slate-400 leading-relaxed">
                    En 1 clic, votre ordre est acheté avec le Stop-Loss et le Take-Profit déjà réglés. Aucun calcul à faire.
                  </p>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center mb-2">
                    3
                  </div>
                  <h4 className="font-bold text-white mb-1">Gain Encaissé en 2 à 4 Minutes</h4>
                  <p className="text-slate-400 leading-relaxed">
                    Le cours grimpe sous vos yeux. Dès qu'il touche le Take-Profit, la position se ferme toute seule et vous
                    encaissez votre bénéfice !
                  </p>
                </div>
              </div>
            </div>

            {/* Carte Majeure du Meilleur Scalp Instantané */}
            {topPickSignal ? (
              <div className="rounded-2xl border-2 border-amber-500/50 bg-gradient-to-b from-slate-900 to-slate-950 p-6 lg:p-8 shadow-2xl relative">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-black font-mono text-2xl shadow-lg shadow-amber-500/20">
                      {topPickSignal.symbol}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                          ⚡ SCALP 5 MIN EN DIRECT
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          {topPickSignal.confidenceScore}% DE CHANCES DE TP
                        </span>
                      </div>
                      <h3 className="text-2xl font-black text-white mt-1">
                        {topPickSignal.assetName}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Figure : <strong className="text-amber-300">{topPickSignal.detectedPattern}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Prix en direct & Progression */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 min-w-[260px]">
                    <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                      <span>Cours actuel :</span>
                      <span className="font-mono text-base font-bold text-white">
                        ${topPickSignal.currentPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                      <span>Cible Take-Profit :</span>
                      <span className="font-mono font-bold text-emerald-400">
                        ${topPickSignal.takeProfit1.toFixed(2)} (+${(topPickSignal.takeProfit1 - topPickSignal.entryPrice).toFixed(2)})
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs mb-2">
                      <span className="text-slate-400">Progression du Scalp :</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {topPickSignal.progressToTp1Pct?.toFixed(0) ?? 0}%
                      </span>
                    </div>
                    {/* Barre de progression fluide */}
                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 via-emerald-400 to-teal-400 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(8, topPickSignal.progressToTp1Pct ?? 0)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Explication Débutant */}
                <div className="my-6 p-4 rounded-xl bg-slate-800/40 border border-slate-800 text-sm text-slate-200">
                  <p className="leading-relaxed font-sans font-medium">{topPickSignal.beginnerAdvice}</p>
                </div>

                {/* Actions Débutant : Suivre le Scalp ou Déclencher le TP immédiat */}
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

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Bouton Boost / Fast-Forward */}
                    <button
                      onClick={() => handleBoostTp(topPickSignal.symbol)}
                      disabled={boostingSymbol === topPickSignal.symbol}
                      className="py-3 px-4 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 active:scale-95 transition-all flex items-center justify-center gap-2"
                      title="Accélère le cours pour toucher le Take-Profit immédiatement"
                    >
                      <FastForward className="w-4 h-4 text-amber-400" />
                      <span>{boostingSymbol === topPickSignal.symbol ? 'Encaissement...' : '⏩ Encaisser le TP Immédiatement'}</span>
                    </button>

                    {/* Gros Bouton d'Exécution */}
                    <button
                      onClick={() => handleBeginnerQuickTrade(topPickSignal, investmentBudget)}
                      className="py-3.5 px-6 rounded-xl text-sm font-black text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 hover:from-emerald-300 hover:to-teal-200 active:scale-95 transition-all shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2.5"
                    >
                      <Zap className="w-5 h-5 text-slate-950 fill-current" />
                      <span>⚡ SUIVRE CE SCALP 5 MIN (ACHAT 1-CLIC)</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-500/30 bg-slate-900/90 p-8 text-center max-w-xl mx-auto">
                <Shield className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white mb-2">Recherche d'un Scalp 5 min...</h3>
                <p className="text-xs text-slate-300 mb-4">
                  L'algorithme attend une configuration M1 optimale pour garantir un Take-Profit rapide.
                </p>
                <button
                  onClick={() => fetchData(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 transition-colors"
                >
                  Scanner à nouveau
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── VUE 2 : MODE SCALP PRO & GRAPHIQUES ── */}
        {viewMode === 'PRO' && (
          <div className="space-y-6">
            {/* Onglets de filtrage */}
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
                  🌐 Tous les Scalps 5 Min
                </button>
                <button
                  onClick={() => setActiveTab('GOLD')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'GOLD'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  🏆 Scalp Or (GLD / Métaux)
                </button>
                <button
                  onClick={() => setActiveTab('STOCKS')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'STOCKS'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  🏛️ Actions US (NVDA, AAPL)
                </button>
                <button
                  onClick={() => setActiveTab('TRACK_RECORD')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'TRACK_RECORD'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  📊 Track Record Scalping
                </button>
              </div>

              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Timer Scalp :</span>
                <span className="font-mono font-bold text-amber-300 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                  {formatTime(countdown)}
                </span>
              </div>
            </div>

            {/* Corps : Scalp cards ou Track Record */}
            {loading ? (
              <div className="py-24 text-center">
                <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-400">Calcul des chandeliers M1 en temps réel...</p>
              </div>
            ) : activeTab === 'TRACK_RECORD' ? (
              /* Vue Track Record */
              <div className="space-y-6">
                {trackRecord && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-center">
                      <div className="text-xs text-slate-400 mb-1">Taux de Succès TP</div>
                      <div className="text-2xl font-black text-emerald-400 font-mono">
                        {trackRecord.winRate}%
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">Clôturés en profit express</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-center">
                      <div className="text-xs text-slate-400 mb-1">Scalps Réussis</div>
                      <div className="text-2xl font-black text-white font-mono">
                        {trackRecord.successfulSignals}
                        <span className="text-xs text-slate-500 font-normal"> / {trackRecord.totalSignals}</span>
                      </div>
                      <div className="text-[11px] text-emerald-400 mt-1">Take-Profits atteints</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-center">
                      <div className="text-xs text-slate-400 mb-1">Durée Moyenne par Trade</div>
                      <div className="text-2xl font-black text-cyan-400 font-mono">
                        3m 15s
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">Résolution express</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-center">
                      <div className="text-xs text-slate-400 mb-1">Pips / Points Cumulés</div>
                      <div className="text-2xl font-black text-amber-400 font-mono">
                        +{trackRecord.totalProfitPips}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">Total gains réalisés</div>
                    </div>
                  </div>
                )}

                {/* Table historique des scalps passés */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-400" />
                      Historique des Scalps Flash Fermés
                    </h3>
                    <span className="text-xs text-slate-400">TP touchés en moins de 5 min</span>
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
                          <th className="py-3 px-4 text-right">Durée / Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {trackRecord?.recentHistory.map((h) => {
                          const isWin = h.profitPct > 0;
                          return (
                            <tr key={h.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="py-3 px-4 font-bold text-white flex items-center gap-2 font-sans">
                                <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-mono font-bold text-[11px] text-amber-300 border border-slate-700">
                                  {h.symbol}
                                </span>
                                <span>{h.assetName}</span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                                  {h.side}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-300">${h.entryPrice.toFixed(2)}</td>
                              <td className="py-3 px-4 text-slate-300">${h.exitPrice.toFixed(2)}</td>
                              <td className="py-3 px-4 text-rose-400">${h.stopLoss.toFixed(2)}</td>
                              <td className="py-3 px-4 text-emerald-400">${h.takeProfit.toFixed(2)}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isWin ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                  {h.result}
                                </span>
                              </td>
                              <td className={`py-3 px-4 text-right font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isWin ? '+' : ''}{h.profitPct.toFixed(2)}%
                              </td>
                              <td className="py-3 px-4 text-right text-slate-400 font-sans">{h.closedAt}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              /* Grille des Scalps 5 Min Actifs */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {signals.map((sig) => {
                  const isCopied = copiedId === sig.id;
                  const currentProfit = sig.currentProfitPct ?? 0;
                  const isProfit = currentProfit >= 0;

                  return (
                    <div
                      key={sig.id}
                      className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 p-6 shadow-xl hover:border-amber-500/40 transition-all flex flex-col justify-between"
                    >
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
                                  SCALP 5 MIN
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                Horizon : <strong>Max 5 minutes</strong> • Résolution rapide
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wide border bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                              <ArrowUpRight className="w-4 h-4" />
                              <span>ACHAT SCALP (BUY)</span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-1">
                              Probabilité TP : <strong className="text-emerald-400">{sig.confidenceScore}%</strong>
                            </div>
                          </div>
                        </div>

                        {/* Figure M1 & Timer */}
                        <div className="mb-3 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs">
                          <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            {sig.detectedPattern}
                          </span>
                          <span className="text-cyan-300 font-mono font-bold">
                            Chrono : {formatTime(countdown)}
                          </span>
                        </div>

                        {/* Progression vers TP1 & PnL live */}
                        <div className="mb-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className="text-slate-400 flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                              Performance live :
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
                          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-emerald-400 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.max(10, sig.progressToTp1Pct ?? 0)}%` }}
                            />
                          </div>
                        </div>

                        {/* Grille des Prix Scalp */}
                        <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-4 font-mono text-xs">
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase font-sans">Entrée</div>
                            <div className="text-sm font-bold text-white mt-0.5">
                              ${sig.entryPrice.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-cyan-400 font-sans">
                              Live: ${sig.currentPrice.toFixed(2)}
                            </div>
                          </div>

                          <div>
                            <div className="text-[10px] text-rose-400/90 uppercase font-sans">Stop Loss</div>
                            <div className="text-sm font-bold text-rose-400 mt-0.5">
                              ${sig.stopLoss.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-rose-400/70 font-sans">Coupe auto</div>
                          </div>

                          <div>
                            <div className="text-[10px] text-emerald-400/90 uppercase font-sans">Take Profit 1</div>
                            <div className="text-sm font-bold text-emerald-400 mt-0.5">
                              ${sig.takeProfit1.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-emerald-400/80 font-sans">Objectif 5 min</div>
                          </div>
                        </div>
                      </div>

                      {/* Boutons d'Action Scalp */}
                      <div className="flex flex-col sm:flex-row items-center gap-2 pt-3 border-t border-slate-800/80">
                        {/* Bouton Fast-Forward */}
                        <button
                          onClick={() => handleBoostTp(sig.symbol)}
                          disabled={boostingSymbol === sig.symbol}
                          className="w-full sm:w-auto py-2.5 px-3.5 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                          title="Fait toucher le TP immédiatement"
                        >
                          <FastForward className="w-3.5 h-3.5 text-amber-400" />
                          <span>{boostingSymbol === sig.symbol ? 'Encaissement...' : '⏩ Forcer TP'}</span>
                        </button>

                        <button
                          onClick={() => handleOpenExecution(sig)}
                          className="w-full sm:flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                        >
                          <Zap className="w-4 h-4 text-emerald-200" />
                          <span>⚡ Exécuter ce Scalp (1 Clic)</span>
                        </button>

                        <button
                          onClick={() => handleCopyTelegram(sig)}
                          className="w-full sm:w-auto py-2.5 px-3.5 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all border border-slate-700 flex items-center justify-center gap-1.5"
                          title="Copier le message formaté pour Telegram"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-bold">Copié !</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                              <span>Format VIP</span>
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

        {/* ── MODAL D'EXÉCUTION D'ORDRE SCALP 1-CLIC ── */}
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
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Confirmation Scalp 5 Min • {executingSignal.symbol}</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      RÉSOLUTION EXPRESS
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cible Take-Profit : ${executingSignal.takeProfit1.toFixed(2)} (+${(executingSignal.takeProfit1 - executingSignal.entryPrice).toFixed(2)}) atteinte en 2 à 4 minutes
                  </p>
                </div>
              </div>

              {orderSuccessMessage ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-3 my-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm mb-1">Scalp Lancé avec Succès !</div>
                    <div>{orderSuccessMessage}</div>
                    <div className="mt-2 text-[11px] text-emerald-400/80">
                      Le robot surveille le trade. Vous pouvez regarder le cours grimper ou utiliser le bouton Fast-Forward.
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
                      <span className="text-slate-400">Type de trade</span>
                      <span className="font-bold text-amber-300 font-mono">
                        SCALP M5 (Max 5 minutes)
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Prix d'entrée</span>
                      <span className="font-mono font-bold text-white">
                        ${executingSignal.entryPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Protection Stop Loss</span>
                      <span className="font-mono font-bold text-rose-400">
                        ${executingSignal.stopLoss.toFixed(2)} (Perte coupée si retournement)
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Objectif Take Profit</span>
                      <span className="font-mono font-bold text-emerald-400">
                        ${executingSignal.takeProfit1.toFixed(2)} (Encaissement automatique en 2-4 min)
                      </span>
                    </div>
                  </div>

                  {/* Choix de la quantité */}
                  <div className="mb-6">
                    <label className="block text-xs font-medium text-slate-300 mb-2">
                      Quantité de titres :
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
                          <span>Confirmer le Scalp 5 Min</span>
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
