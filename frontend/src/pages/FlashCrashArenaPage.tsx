import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppShell } from '../components/layout/AppShell';
import { useToast, PageTransition, QuantOrbitalLoader } from '../components/ui';
import {
  ArenaBoss,
  ArenaCrisisEvent,
  ArenaRunResponse,
  ArenaLeaderboardEntry,
  getArenaBosses,
  recordArenaRun,
  getArenaLeaderboard,
  getMyArenaHistory,
} from '../api/arena';
import {
  Flame,
  Zap,
  Shield,
  ShieldAlert,
  Trophy,
  RotateCcw,
  Play,
  Volume2,
  VolumeX,
  Sparkles,
  Info,
  History,
  ArrowDownRight,
  ArrowUpRight,
  Radio,
} from 'lucide-react';

type StanceType = 'NEUTRAL' | 'HEDGE_GOLD' | 'SHORT' | 'CASH' | 'BUY_THE_DIP';

interface PortfolioSimulationState {
  equity: number;
  initialEquity: number;
  cashPct: number;
  equityLongPct: number;
  equityShortPct: number;
  goldPct: number;
  stance: StanceType;
  hedgesCount: number;
  actionsTaken: number;
  peakEquity: number;
  maxDrawdownPct: number;
  equityHistory: number[];
  activeNews: ArenaCrisisEvent | null;
}

export const FlashCrashArenaPage: React.FC = () => {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'arena' | 'leaderboard' | 'history'>('arena');
  const [loading, setLoading] = useState<boolean>(true);
  const [bosses, setBosses] = useState<ArenaBoss[]>([]);
  const [selectedBoss, setSelectedBoss] = useState<ArenaBoss | null>(null);
  const [leaderboard, setLeaderboard] = useState<ArenaLeaderboardEntry[]>([]);
  const [myHistory, setMyHistory] = useState<ArenaRunResponse[]>([]);

  // Simulation State
  const [gameActive, setGameActive] = useState<boolean>(false);
  const [gameTime, setGameTime] = useState<number>(0);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [portfolio, setPortfolio] = useState<PortfolioSimulationState>({
    equity: 100000,
    initialEquity: 100000,
    cashPct: 0.1,
    equityLongPct: 0.9,
    equityShortPct: 0.0,
    goldPct: 0.0,
    stance: 'NEUTRAL',
    hedgesCount: 0,
    actionsTaken: 0,
    peakEquity: 100000,
    maxDrawdownPct: 0.0,
    equityHistory: [100000],
    activeNews: null,
  });

  const [runResult, setRunResult] = useState<ArenaRunResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Audio Context Ref for synthetic procedural sounds
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play synthetic tone without external audio files
  const playSfx = useCallback((type: 'news' | 'hedge' | 'warning' | 'win' | 'loss') => {
    if (!audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'news') {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'hedge') {
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'warning') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(180, now + 0.2);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.15);
        osc.frequency.setValueAtTime(783.99, now + 0.3);
        osc.frequency.setValueAtTime(1046.5, now + 0.45);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
        osc.start(now);
        osc.stop(now + 0.7);
      } else if (type === 'loss') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.6);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
        osc.start(now);
        osc.stop(now + 0.65);
      }
    } catch {
      // Audio might be blocked by autoplay policies
    }
  }, [audioEnabled]);

  // Load initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [bossesData, leaderboardData, historyData] = await Promise.all([
          getArenaBosses(),
          getArenaLeaderboard(),
          getMyArenaHistory(),
        ]);
        setBosses(bossesData);
        if (bossesData.length > 0) {
          setSelectedBoss(bossesData[0]);
        }
        setLeaderboard(leaderboardData);
        setMyHistory(historyData);
      } catch (err) {
        console.error('Erreur chargement Flash Crash Arena:', err);
        toast.error('Impossible de charger les données de Flash Crash Arena');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toast]);

  // Start Simulation
  const handleStartRun = (boss: ArenaBoss) => {
    setSelectedBoss(boss);
    setGameTime(0);
    setRunResult(null);
    setPortfolio({
      equity: boss.initialEquity,
      initialEquity: boss.initialEquity,
      cashPct: 0.1,
      equityLongPct: 0.9,
      equityShortPct: 0.0,
      goldPct: 0.0,
      stance: 'NEUTRAL',
      hedgesCount: 0,
      actionsTaken: 0,
      peakEquity: boss.initialEquity,
      maxDrawdownPct: 0.0,
      equityHistory: [boss.initialEquity],
      activeNews: null,
    });
    setGameActive(true);
    playSfx('news');
    toast.info(`Combat engagé contre ${boss.name} ! Tenez 180 secondes.`);
  };

  // Switch Stance Tactics
  const handleSetStance = (newStance: StanceType) => {
    if (!gameActive || portfolio.stance === newStance) return;

    playSfx('hedge');
    setPortfolio((prev) => {
      let cash = 0.1;
      let long = 0.9;
      let short = 0.0;
      let gold = 0.0;
      let newHedges = prev.hedgesCount;

      if (newStance === 'HEDGE_GOLD') {
        cash = 0.1;
        long = 0.45;
        gold = 0.45;
        short = 0.0;
        newHedges += 1;
        toast.success('🛡️ Couverture Or Physique & Safe-Havens activée (45% GLD)');
      } else if (newStance === 'SHORT') {
        cash = 0.2;
        long = 0.0;
        short = 0.8;
        gold = 0.0;
        newHedges += 1;
        toast.warning('📉 Panic Short activé : Position baissière nette (Bêta Inversé)');
      } else if (newStance === 'CASH') {
        cash = 1.0;
        long = 0.0;
        short = 0.0;
        gold = 0.0;
        newHedges += 1;
        toast.info('💵 Flight to Cash : 100% Liquidités sécurisées');
      } else if (newStance === 'BUY_THE_DIP') {
        cash = 0.0;
        long = 1.8; // Levier x1.8
        short = 0.0;
        gold = 0.0;
        toast.warning('🚀 Buy the Dip : Levier agressif x1.8 au rebond !');
      } else {
        // NEUTRAL
        cash = 0.1;
        long = 0.9;
        short = 0.0;
        gold = 0.0;
        toast.info('🔄 Exposition normale rétablie');
      }

      return {
        ...prev,
        stance: newStance,
        cashPct: cash,
        equityLongPct: long,
        equityShortPct: short,
        goldPct: gold,
        hedgesCount: newHedges,
        actionsTaken: prev.actionsTaken + 1,
      };
    });
  };

  // End of Run Handler (Victory or Liquidation)
  const finishRun = useCallback(
    async (finalEquity: number, maxDd: number, survived: boolean, timeSpent: number) => {
      if (!selectedBoss || isSubmitting) return;

      setGameActive(false);
      setIsSubmitting(true);

      if (survived) {
        playSfx('win');
      } else {
        playSfx('loss');
      }

      try {
        const response = await recordArenaRun({
          bossId: selectedBoss.id,
          initialEquity: selectedBoss.initialEquity,
          finalEquity: Math.round(finalEquity * 100) / 100,
          maxDrawdownPct: Math.round(maxDd * 100) / 100,
          survivalSeconds: timeSpent,
          survived: survived,
          actionsTaken: portfolio.actionsTaken,
          hedgesCount: portfolio.hedgesCount,
        });

        setRunResult(response);
        // Refresh history & leaderboard
        const [updatedLb, updatedHist] = await Promise.all([
          getArenaLeaderboard(),
          getMyArenaHistory(),
        ]);
        setLeaderboard(updatedLb);
        setMyHistory(updatedHist);

        if (survived) {
          toast.success(`VICTOIRE ! Rang ${response.rankGrade} obtenu (+${response.score} pts)`);
        } else {
          toast.error(`LIQUIDATION ! Votre desk a été englouti. Rang F.`);
        }
      } catch (err) {
        console.error('Erreur enregistrement run:', err);
        toast.error("Erreur lors de l'enregistrement du score");
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedBoss, isSubmitting, portfolio.actionsTaken, portfolio.hedgesCount, playSfx, toast]
  );

  // Simulation Game Tick (1 second = 1 game step)
  useEffect(() => {
    if (!gameActive || !selectedBoss) return;

    const timer = setInterval(() => {
      setGameTime((prevTime) => {
        const nextTime = prevTime + 1;
        const totalDuration = selectedBoss.durationSeconds || 180;

        // Check if finished by time
        if (nextTime >= totalDuration) {
          clearInterval(timer);
          finishRun(portfolio.equity, portfolio.maxDrawdownPct, true, totalDuration);
          return totalDuration;
        }

        // Current trajectory step
        const trajectory = selectedBoss.priceTrajectory || [];
        const currentTick = trajectory[nextTime] || trajectory[trajectory.length - 1];
        const prevTick = trajectory[prevTime] || trajectory[0];

        // Market tick return
        const marketStepReturn =
          prevTick && prevTick.price > 0
            ? (currentTick.price - prevTick.price) / prevTick.price
            : 0;

        // Gold return during stress (tends to appreciate during big drops)
        const goldStepReturn =
          marketStepReturn < 0
            ? Math.abs(marketStepReturn) * 0.45
            : marketStepReturn * -0.15;

        // Calculate portfolio PnL impact based on active stance
        setPortfolio((prev) => {
          const longImpact = prev.equityLongPct * marketStepReturn;
          const shortImpact = prev.equityShortPct * -marketStepReturn; // Inverse return
          const goldImpact = prev.goldPct * goldStepReturn;
          const totalPortfolioStepReturn = longImpact + shortImpact + goldImpact;

          const updatedEquity = Math.max(0, prev.equity * (1.0 + totalPortfolioStepReturn));
          const updatedPeak = Math.max(prev.peakEquity, updatedEquity);
          const currentDd =
            updatedPeak > 0 ? ((updatedPeak - updatedEquity) / updatedPeak) * 100 : 0;
          const updatedMaxDd = Math.max(prev.maxDrawdownPct, currentDd);

          // Check Liquidation Condition (< $10,000 Equity or 90% loss)
          if (updatedEquity <= 8000) {
            clearInterval(timer);
            setTimeout(() => {
              finishRun(updatedEquity, updatedMaxDd, false, nextTime);
            }, 100);
          }

          // Heartbeat warning audio when equity is low
          if (updatedEquity < 30000 && nextTime % 3 === 0) {
            playSfx('warning');
          }

          // Check if a breaking news event triggers at this second
          const triggeredEvent = selectedBoss.events.find((e) => e.timeSec === nextTime);
          if (triggeredEvent) {
            playSfx('news');
          }

          return {
            ...prev,
            equity: updatedEquity,
            peakEquity: updatedPeak,
            maxDrawdownPct: updatedMaxDd,
            equityHistory: [...prev.equityHistory, updatedEquity],
            activeNews: triggeredEvent || prev.activeNews,
          };
        });

        return nextTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameActive, selectedBoss, finishRun, playSfx, portfolio.equity, portfolio.maxDrawdownPct]);

  // Current Boss Trajectory Price & VIX
  const currentTick =
    selectedBoss && selectedBoss.priceTrajectory
      ? selectedBoss.priceTrajectory[Math.min(gameTime, selectedBoss.priceTrajectory.length - 1)]
      : null;

  const currentPrice = currentTick ? currentTick.price : selectedBoss?.initialPrice || 0;
  const currentVix = currentTick ? currentTick.vix : 20;
  const marketReturnPct = currentTick ? currentTick.marketReturnPct : 0;

  // Health Bar % (Equity / Initial Equity)
  const healthPct = Math.max(
    0,
    Math.min(100, (portfolio.equity / (selectedBoss?.initialEquity || 100000)) * 100)
  );

  return (
    <AppShell
      title="Flash Crash Arena"
      section="E-Sport & Survie Macro"
      badge="LIVE ARENA 2026"
      equityBadge={portfolio.equity}
    >
      <PageTransition>
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-rose-500/30 p-6 shadow-2xl backdrop-blur-xl">
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                    Mode Survie Macro · 1s = 1h Marché
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    Rang SSS Élite
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
                  Flash Crash Arena <span className="text-rose-400">Boss Fights</span>
                </h1>
                <p className="text-sm text-slate-300 max-w-2xl">
                  Survivez aux 4 pires chocs de l'histoire financière mondiale. Votre capital ($100 000)
                  est votre barre de vie. Exécutez des couvertures au millimètre pour contrer les cascades
                  de liquidation.
                </p>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/60 self-start md:self-auto">
                <button
                  onClick={() => {
                    if (gameActive && !window.confirm('Quitter le combat en cours ?')) return;
                    setGameActive(false);
                    setActiveTab('arena');
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'arena'
                      ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  L'Arène
                </button>
                <button
                  onClick={() => {
                    if (gameActive && !window.confirm('Quitter le combat en cours ?')) return;
                    setGameActive(false);
                    setActiveTab('leaderboard');
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'leaderboard'
                      ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  Podium Mondial
                </button>
                <button
                  onClick={() => {
                    if (gameActive && !window.confirm('Quitter le combat en cours ?')) return;
                    setGameActive(false);
                    setActiveTab('history');
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'history'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  Mes Runs ({myHistory.length})
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[350px]">
              <QuantOrbitalLoader
                title="Flash Crash Arena"
                subtitle="Initialisation des moteurs de volatilité macroéconomique..."
                tone="rose"
              />
            </div>
          ) : (
            <>
              {/* TAB 1: ARENA */}
              {activeTab === 'arena' && (
                <div className="space-y-6">
                  {/* ACTIVE BATTLE VIEW */}
                  {gameActive && selectedBoss ? (
                    <div className="space-y-5">
                      {/* Top HUD Card */}
                      <div className="rounded-2xl bg-slate-900/90 border border-slate-700/80 p-5 shadow-2xl relative overflow-hidden">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          {/* Boss Info */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                BOSS : {selectedBoss.name} ({selectedBoss.year})
                              </span>
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300">
                                Actif : {selectedBoss.assetName}
                              </span>
                            </div>
                            <div className="flex items-baseline gap-3">
                              <span className="text-3xl font-extrabold text-white tracking-tight">
                                ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span
                                className={`text-base font-bold flex items-center gap-0.5 ${
                                  marketReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {marketReturnPct >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                {marketReturnPct >= 0 ? `+${marketReturnPct.toFixed(2)}%` : `${marketReturnPct.toFixed(2)}%`}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-semibold">
                                VIX : {currentVix.toFixed(1)}
                              </span>
                            </div>
                          </div>

                          {/* Timer & Controls */}
                          <div className="flex items-center gap-4">
                            {/* Audio toggle */}
                            <button
                              onClick={() => setAudioEnabled(!audioEnabled)}
                              className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                              title={audioEnabled ? 'Couper les sons SFX' : 'Activer les sons SFX'}
                            >
                              {audioEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                            </button>

                            {/* Circular/Box Timer */}
                            <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700/80">
                              <div className="text-right">
                                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                                  Temps Écoulé
                                </div>
                                <div className="text-xl font-black font-mono text-white">
                                  {Math.floor(gameTime / 60)
                                    .toString()
                                    .padStart(2, '0')}
                                  :{(gameTime % 60).toString().padStart(2, '0')}{' '}
                                  <span className="text-xs text-slate-500">/ 03:00</span>
                                </div>
                              </div>
                              <div className="w-10 h-10 rounded-full border-2 border-rose-500/40 flex items-center justify-center font-bold text-xs text-rose-300 font-mono">
                                {180 - gameTime}s
                              </div>
                            </div>

                            {/* Emergency Abandon */}
                            <button
                              onClick={() => {
                                if (window.confirm('Voulez-vous capituler et arrêter ce run ?')) {
                                  finishRun(portfolio.equity, portfolio.maxDrawdownPct, false, gameTime);
                                }
                              }}
                              className="px-3 py-2 text-xs font-semibold rounded-xl bg-red-950/60 text-red-300 border border-red-800/40 hover:bg-red-900/80 transition-colors"
                            >
                              Capituler
                            </button>
                          </div>
                        </div>

                        {/* Health Bar (Equity HP) */}
                        <div className="mt-5 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold flex items-center gap-1.5 text-slate-300">
                              <Shield className="w-3.5 h-3.5 text-rose-400" />
                              CAPITAL RESIDUAL (HP) :{' '}
                              <span className="text-white font-mono text-sm">
                                ${portfolio.equity.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                            </span>
                            <div className="flex items-center gap-3 font-mono">
                              <span
                                className={`font-semibold ${
                                  portfolio.equity >= portfolio.initialEquity ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                PnL Net :{' '}
                                {portfolio.equity >= portfolio.initialEquity
                                  ? `+$${(portfolio.equity - portfolio.initialEquity).toFixed(0)}`
                                  : `-$${Math.abs(portfolio.equity - portfolio.initialEquity).toFixed(0)}`}
                              </span>
                              <span className="text-slate-400">
                                Max DD :{' '}
                                <span className="text-rose-400 font-bold">-{portfolio.maxDrawdownPct.toFixed(1)}%</span>
                              </span>
                            </div>
                          </div>

                          {/* Dynamic Color Progress Bar */}
                          <div className="h-4 w-full bg-slate-800/90 rounded-full overflow-hidden p-0.5 border border-slate-700/80 relative">
                            <motion.div
                              className={`h-full rounded-full transition-all duration-300 ${
                                healthPct > 60
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/30'
                                  : healthPct > 30
                                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400 shadow-lg shadow-amber-500/30'
                                  : 'bg-gradient-to-r from-red-600 via-rose-500 to-red-600 animate-pulse shadow-lg shadow-red-500/50'
                              }`}
                              style={{ width: `${healthPct}%` }}
                            />
                            {healthPct <= 25 && (
                              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-white drop-shadow">
                                ⚠️ MARGE CRITIQUE - RISQUE DE LIQUIDATION TOTALE ⚠️
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Live Breaking News Flash */}
                      {portfolio.activeNews && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-xl bg-gradient-to-r from-red-950/80 via-slate-900 to-red-950/80 border border-red-500/50 p-4 shadow-xl flex items-start gap-3.5"
                        >
                          <div className="p-2 rounded-lg bg-red-600/30 text-red-300 border border-red-500/40 shrink-0 mt-0.5 animate-pulse">
                            <Radio className="w-4 h-4" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-red-600 text-white">
                                {portfolio.activeNews.source}
                              </span>
                              <span className="text-xs font-semibold text-red-300">
                                T+{portfolio.activeNews.timeSec}s
                              </span>
                            </div>
                            <p className="text-sm font-bold text-white tracking-wide">
                              {portfolio.activeNews.headline}
                            </p>
                            <p className="text-xs text-amber-300/90 flex items-center gap-1.5 font-medium">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              {portfolio.activeNews.hint}
                            </p>
                          </div>
                        </motion.div>
                      )}

                      {/* Real-time Interactive Tactical Chart */}
                      <div className="rounded-2xl bg-slate-900/90 border border-slate-700/80 p-5 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                          <div className="space-y-0.5">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                              <Zap className="w-4 h-4 text-rose-400" />
                              Trajectoire du Choc Macro & Courbe de Survie
                            </h3>
                            <p className="text-xs text-slate-400">
                              En rouge : l'effondrement du marché de crise. En bleu/vert : l'évolution de votre capital après couverture.
                            </p>
                          </div>
                          <div className="flex items-center gap-4 text-xs font-semibold">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                              <span className="text-slate-300">{selectedBoss.assetName}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                              <span className="text-slate-300">Votre Capital ($)</span>
                            </div>
                          </div>
                        </div>

                        {/* Chart Render Canvas */}
                        <div className="h-56 w-full bg-slate-950/80 rounded-xl border border-slate-800 p-2 relative flex items-end">
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 200" preserveAspectRatio="none">
                            {/* Grid Lines */}
                            <line x1="0" y1="50" x2="1000" y2="50" stroke="#334155" strokeDasharray="3,3" strokeWidth="0.5" />
                            <line x1="0" y1="100" x2="1000" y2="100" stroke="#334155" strokeDasharray="3,3" strokeWidth="0.5" />
                            <line x1="0" y1="150" x2="1000" y2="150" stroke="#334155" strokeDasharray="3,3" strokeWidth="0.5" />

                            {/* Market Drop Path */}
                            {selectedBoss.priceTrajectory && selectedBoss.priceTrajectory.length > 1 && (
                              <polyline
                                fill="none"
                                stroke="#f43f5e"
                                strokeWidth="2.5"
                                strokeOpacity="0.8"
                                points={selectedBoss.priceTrajectory
                                  .slice(0, gameTime + 1)
                                  .map((pt, idx) => {
                                    const x = (idx / 180) * 1000;
                                    const dropRatio = Math.max(0, -pt.marketReturnPct / 60);
                                    const y = 30 + dropRatio * 150;
                                    return `${x},${y}`;
                                  })
                                  .join(' ')}
                              />
                            )}

                            {/* User Equity Path */}
                            {portfolio.equityHistory.length > 1 && (
                              <polyline
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="3"
                                points={portfolio.equityHistory
                                  .map((eq, idx) => {
                                    const x = (idx / 180) * 1000;
                                    const eqRatio = (eq - 50000) / 100000; // 50k to 150k
                                    const y = 180 - Math.max(10, Math.min(180, eqRatio * 140 + 40));
                                    return `${x},${y}`;
                                  })
                                  .join(' ')}
                              />
                            )}
                          </svg>

                          {/* Live Position Badge on Bottom Right */}
                          <div className="absolute top-3 left-3 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 backdrop-blur-md">
                            <span className="text-slate-400">Posture Actuelle :</span>
                            <span className="font-bold text-white">
                              {portfolio.stance === 'NEUTRAL' && 'Exposition Marché 90%'}
                              {portfolio.stance === 'HEDGE_GOLD' && '🛡️ Hedge Or (45% GLD)'}
                              {portfolio.stance === 'SHORT' && '📉 Panic Short (Bêta Vendeur)'}
                              {portfolio.stance === 'CASH' && '💵 Refuge 100% Cash'}
                              {portfolio.stance === 'BUY_THE_DIP' && '🚀 Rebond Levier x1.8'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tactical Emergency Action Console */}
                      <div className="rounded-2xl bg-slate-900/90 border border-slate-700/80 p-5 shadow-2xl">
                        <div className="mb-4">
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-amber-400" />
                            Console Tactique d'Intervention d'Urgence
                          </h3>
                          <p className="text-xs text-slate-400">
                            Activez vos ordres de défense institutionnelle pour contrer la chute ou exploiter le creux.
                          </p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          {/* 1. Hedge Gold */}
                          <button
                            onClick={() => handleSetStance('HEDGE_GOLD')}
                            className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                              portfolio.stance === 'HEDGE_GOLD'
                                ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg shadow-amber-500/20'
                                : 'bg-slate-800/80 border-slate-700 hover:border-amber-500/50 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-lg">🛡️</span>
                              {portfolio.stance === 'HEDGE_GOLD' && (
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">Hedge Or & Safe-Havens</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">Alloue 45% sur GLD & Bons du Trésor</div>
                            </div>
                          </button>

                          {/* 2. Panic Short */}
                          <button
                            onClick={() => handleSetStance('SHORT')}
                            className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                              portfolio.stance === 'SHORT'
                                ? 'bg-rose-500/20 border-rose-500 text-white shadow-lg shadow-rose-500/20'
                                : 'bg-slate-800/80 border-slate-700 hover:border-rose-500/50 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-lg">📉</span>
                              {portfolio.stance === 'SHORT' && (
                                <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">Panic Short (Vente)</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">Capture le cash sur les cascades baissières</div>
                            </div>
                          </button>

                          {/* 3. Flight to Cash */}
                          <button
                            onClick={() => handleSetStance('CASH')}
                            className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                              portfolio.stance === 'CASH'
                                ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                : 'bg-slate-800/80 border-slate-700 hover:border-emerald-500/50 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-lg">💵</span>
                              {portfolio.stance === 'CASH' && (
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">Flight to Cash (100%)</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">Fige le capital, zéro risque supplémentaire</div>
                            </div>
                          </button>

                          {/* 4. Buy The Dip */}
                          <button
                            onClick={() => handleSetStance('BUY_THE_DIP')}
                            className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                              portfolio.stance === 'BUY_THE_DIP'
                                ? 'bg-indigo-500/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                : 'bg-slate-800/80 border-slate-700 hover:border-indigo-500/50 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-lg">🚀</span>
                              {portfolio.stance === 'BUY_THE_DIP' && (
                                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">Buy The Dip (Levier x1.8)</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">Pari contrariant au creux pour le rang SSS</div>
                            </div>
                          </button>

                          {/* 5. Neutral Balance */}
                          <button
                            onClick={() => handleSetStance('NEUTRAL')}
                            className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                              portfolio.stance === 'NEUTRAL'
                                ? 'bg-sky-500/20 border-sky-500 text-white shadow-lg shadow-sky-500/20'
                                : 'bg-slate-800/80 border-slate-700 hover:border-sky-500/50 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-lg">🔄</span>
                              {portfolio.stance === 'NEUTRAL' && (
                                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">Exposition Normale</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">Rétablit un portefeuille 90/10 actions</div>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* LOBBY / BOSS SELECTION VIEW */
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Flame className="w-5 h-5 text-rose-400" />
                            Sélectionnez votre Boss de Crise Macroéconomique
                          </h2>
                          <p className="text-xs text-slate-400">
                            Chaque Boss possède sa propre dynamique de volatilité, ses breaking news et ses pièges institutionnels.
                          </p>
                        </div>
                      </div>

                      {/* Boss Cards Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {bosses.map((boss) => {
                          const isSelected = selectedBoss?.id === boss.id;
                          return (
                            <div
                              key={boss.id}
                              onClick={() => setSelectedBoss(boss)}
                              className={`cursor-pointer rounded-2xl border p-5 transition-all relative overflow-hidden group ${
                                isSelected
                                  ? 'bg-slate-800/90 border-rose-500 shadow-xl shadow-rose-500/20 scale-[1.02]'
                                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                  {boss.year}
                                </span>
                                <span
                                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                    boss.difficulty === 'LÉGENDAIRE'
                                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                      : boss.difficulty === 'EXTRÊME'
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                      : boss.difficulty === 'HARDCORE'
                                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  }`}
                                >
                                  {boss.difficulty}
                                </span>
                              </div>

                              <h3 className="text-base font-bold text-white mb-1 group-hover:text-rose-300 transition-colors">
                                {boss.name}
                              </h3>
                              <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                                {boss.subtitle}
                              </p>

                              {/* Key Stats */}
                              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800 text-xs">
                                <div>
                                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Max Chute</div>
                                  <div className="font-bold text-rose-400 font-mono">
                                    -{boss.historicalMaxDrawdown}%
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Pic VIX</div>
                                  <div className="font-bold text-amber-400 font-mono">
                                    {boss.vixSpike} pts
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Selected Boss Detailed Dossier & Launch Button */}
                      {selectedBoss && (
                        <div className="rounded-2xl bg-slate-900/90 border border-slate-700/80 p-6 shadow-2xl relative overflow-hidden">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                    DOSSIER DE MISSION : {selectedBoss.difficulty}
                                  </span>
                                  <span className="text-xs text-slate-400 font-mono">
                                    Durée de l'Épreuve : 180 secondes (3 min)
                                  </span>
                                </div>
                                <h3 className="text-xl font-black text-white">
                                  {selectedBoss.name} ({selectedBoss.year})
                                </h3>
                                <p className="text-sm text-slate-300 leading-relaxed">
                                  {selectedBoss.lore}
                                </p>
                              </div>

                              <div className="rounded-xl bg-slate-800/60 p-4 border border-slate-700/60 space-y-2">
                                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                  <Info className="w-3.5 h-3.5" />
                                  Mécaniques du Choc & Vulnérabilités Institutionnelles
                                </h4>
                                <p className="text-xs text-slate-300">
                                  {selectedBoss.mechanicsDescription}
                                </p>
                              </div>

                              {/* Timeline Preview */}
                              <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                  Alertes Chronométrées Antérieures
                                </h4>
                                <div className="space-y-2">
                                  {selectedBoss.events.map((evt, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-3 text-xs bg-slate-950/60 p-2.5 rounded-lg border border-slate-800"
                                    >
                                      <span className="font-mono font-bold text-rose-400 shrink-0">
                                        T+{evt.timeSec}s
                                      </span>
                                      <span className="text-slate-300 truncate font-medium">
                                        {evt.headline}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Launch Side Column */}
                            <div className="rounded-xl bg-gradient-to-b from-slate-800/80 to-slate-900 border border-slate-700/80 p-5 flex flex-col justify-between space-y-4">
                              <div className="space-y-3">
                                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                                  Paramètres d'Engagement
                                </h4>
                                <div className="space-y-2 text-xs">
                                  <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                                    <span>Capital Initial (HP) :</span>
                                    <span className="font-mono font-bold text-white">$100 000</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                                    <span>Seuil de Liquidation :</span>
                                    <span className="font-mono font-bold text-rose-400">&lt; $8 000</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                                    <span>Vitesse d'Écoulement :</span>
                                    <span className="font-mono font-bold text-sky-400">1s = 1h Marché</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                                    <span>Score Maximal Visé :</span>
                                    <span className="font-mono font-bold text-amber-400">5 000 pts</span>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => handleStartRun(selectedBoss)}
                                className="w-full py-4 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white font-black text-sm tracking-wide shadow-xl shadow-rose-600/30 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                              >
                                <Play className="w-4 h-4 fill-white" />
                                LANCER LE COMBAT DE SURVIE
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: GLOBAL LEADERBOARD */}
              {activeTab === 'leaderboard' && (
                <div className="space-y-6">
                  {/* Top 3 Podium */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {leaderboard.slice(0, 3).map((entry, idx) => (
                      <div
                        key={entry.runId || idx}
                        className={`rounded-2xl p-5 border relative overflow-hidden ${
                          idx === 0
                            ? 'bg-gradient-to-b from-amber-950/40 to-slate-900 border-amber-500/50 shadow-2xl shadow-amber-500/10'
                            : idx === 1
                            ? 'bg-gradient-to-b from-slate-800/80 to-slate-900 border-slate-500/40 shadow-xl'
                            : 'bg-gradient-to-b from-amber-950/20 to-slate-900 border-amber-700/40 shadow-xl'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                              idx === 0
                                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/40'
                                : idx === 1
                                ? 'bg-slate-300 text-slate-950'
                                : 'bg-amber-700 text-white'
                            }`}
                          >
                            #{entry.rank}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            {entry.rankGrade}
                          </span>
                        </div>

                        <div className="space-y-1 mb-3">
                          <h4 className="text-base font-bold text-white truncate">
                            {entry.traderName}
                          </h4>
                          <p className="text-xs text-slate-400 truncate">
                            {entry.bossName}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-800">
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase font-semibold">Score Total</div>
                            <div className="font-extrabold text-amber-400 font-mono text-sm">
                              {entry.score.toLocaleString()} pts
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase font-semibold">Capital Final</div>
                            <div className="font-bold text-emerald-400 font-mono">
                              ${entry.finalEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Leaderboard Table */}
                  <div className="rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        Classement Général des Survivants de Volatilité
                      </h3>
                      <span className="text-xs text-slate-400">
                        Top {leaderboard.length} performances enregistrées
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                          <tr>
                            <th className="py-3 px-4">Rang</th>
                            <th className="py-3 px-4">Trader</th>
                            <th className="py-3 px-4">Boss Affronté</th>
                            <th className="py-3 px-4 text-right">Capital Final</th>
                            <th className="py-3 px-4 text-right">PnL Net</th>
                            <th className="py-3 px-4 text-right">Max Drawdown</th>
                            <th className="py-3 px-4 text-center">Rang</th>
                            <th className="py-3 px-4 text-right">Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {leaderboard.map((row) => (
                            <tr key={row.runId} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-white">
                                #{row.rank}
                              </td>
                              <td className="py-3 px-4 font-semibold text-white">
                                {row.traderName}
                              </td>
                              <td className="py-3 px-4 text-slate-400">
                                {row.bossName}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                                ${row.finalEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </td>
                              <td
                                className={`py-3 px-4 text-right font-mono font-bold ${
                                  row.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {row.netPnl >= 0 ? `+$${row.netPnl.toLocaleString()}` : `-$${Math.abs(row.netPnl).toLocaleString()}`}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-rose-400">
                                -{row.maxDrawdownPct.toFixed(1)}%
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                    row.rankGrade === 'SSS'
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                      : row.rankGrade === 'S'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                      : row.rankGrade === 'A'
                                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                      : 'bg-slate-700 text-slate-300'
                                  }`}
                                >
                                  {row.rankGrade}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-extrabold text-amber-400">
                                {row.score.toLocaleString()} pts
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: USER HISTORY */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  {myHistory.length === 0 ? (
                    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-12 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                        <History className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-bold text-white">Aucun run enregistré</h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Lancez votre premier combat de survie contre Lehman Brothers ou Covid-19 pour débloquer votre premier rapport d'audit.
                      </p>
                      <button
                        onClick={() => setActiveTab('arena')}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                      >
                        Rejoindre l'Arène
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myHistory.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl bg-slate-900/90 border border-slate-700/80 p-5 shadow-xl space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`px-2.5 py-1 rounded text-xs font-black ${
                                  item.rankGrade === 'SSS'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : item.rankGrade === 'S'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : item.rankGrade === 'A'
                                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                }`}
                              >
                                RANG {item.rankGrade}
                              </span>
                              <h4 className="text-sm font-bold text-white">{item.bossName}</h4>
                              <span className="text-xs text-slate-500 font-mono">
                                ({new Date(item.createdAt).toLocaleDateString()})
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold font-mono text-amber-400">
                                {item.score.toLocaleString()} pts (+{item.xpEarned} XP)
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded font-semibold ${
                                  item.survived
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-red-500/20 text-red-300'
                                }`}
                              >
                                {item.survived ? 'Survécu (180s)' : 'Liquidé'}
                              </span>
                            </div>
                          </div>

                          {/* Stats Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                              <span className="text-slate-500">Capital Final :</span>
                              <div className="font-mono font-bold text-white text-sm">
                                ${item.finalEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </div>
                            </div>
                            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                              <span className="text-slate-500">PnL Net :</span>
                              <div
                                className={`font-mono font-bold text-sm ${
                                  item.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {item.netPnl >= 0 ? `+$${item.netPnl.toLocaleString()}` : `-$${Math.abs(item.netPnl).toLocaleString()}`}
                              </div>
                            </div>
                            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                              <span className="text-slate-500">Drawdown Max :</span>
                              <div className="font-mono font-bold text-rose-400 text-sm">
                                -{item.maxDrawdownPct.toFixed(1)}%
                              </div>
                            </div>
                            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                              <span className="text-slate-500">Titre Obtenu :</span>
                              <div className="font-semibold text-indigo-300 text-xs truncate">
                                {item.titleEarned}
                              </div>
                            </div>
                          </div>

                          {/* Audit Feedback */}
                          <div className="rounded-xl bg-slate-800/60 p-3 border border-slate-700/60 text-xs text-slate-300">
                            <span className="font-bold text-amber-300 flex items-center gap-1 mb-1">
                              <Sparkles className="w-3.5 h-3.5" />
                              Audit Algorithmique ESPRIT :
                            </span>
                            {item.auditFeedback}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* GAME OVER / VICTORY DEBRIEF MODAL */}
          <AnimatePresence>
            {runResult && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="rounded-3xl bg-slate-900 border border-slate-700/80 p-6 md:p-8 max-w-xl w-full shadow-2xl relative overflow-hidden space-y-6"
                >
                  <div className="text-center space-y-2">
                    <span
                      className={`inline-block text-5xl md:text-6xl font-black tracking-widest px-6 py-2 rounded-2xl border ${
                        runResult.rankGrade === 'SSS'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-2xl shadow-amber-500/40 animate-pulse'
                          : runResult.rankGrade === 'S'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-xl'
                          : runResult.rankGrade === 'A'
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                          : runResult.rankGrade === 'B'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                      }`}
                    >
                      {runResult.rankGrade}
                    </span>

                    <h2 className="text-2xl font-black text-white mt-2">
                      {runResult.survived ? 'SURVIE MACRO TRIOMPHALE 🏅' : 'LIQUIDATION TOTALE (GAME OVER) 💀'}
                    </h2>
                    <p className="text-xs text-slate-400">
                      Boss affronté : <span className="text-white font-semibold">{runResult.bossName}</span>
                    </p>
                  </div>

                  {/* Score & Rewards */}
                  <div className="rounded-2xl bg-gradient-to-r from-amber-950/30 via-slate-800 to-amber-950/30 p-4 border border-amber-500/30 text-center space-y-1">
                    <div className="text-xs uppercase tracking-wider text-amber-300 font-bold">
                      Score Institutionnel E-Sport
                    </div>
                    <div className="text-3xl font-black font-mono text-amber-400">
                      {runResult.score.toLocaleString()} <span className="text-sm">pts</span>
                    </div>
                    <div className="text-xs text-slate-300">
                      +{runResult.xpEarned} XP Débloqués · Titre :{' '}
                      <span className="font-bold text-white">{runResult.titleEarned}</span>
                    </div>
                  </div>

                  {/* Financial Stats Summary */}
                  <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                      <span className="text-slate-500 text-[10px] uppercase font-semibold">Capital Final</span>
                      <div className="font-mono font-bold text-white text-sm mt-0.5">
                        ${runResult.finalEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                      <span className="text-slate-500 text-[10px] uppercase font-semibold">PnL Net</span>
                      <div
                        className={`font-mono font-bold text-sm mt-0.5 ${
                          runResult.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {runResult.netPnl >= 0 ? `+$${runResult.netPnl.toLocaleString()}` : `-$${Math.abs(runResult.netPnl).toLocaleString()}`}
                      </div>
                    </div>
                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                      <span className="text-slate-500 text-[10px] uppercase font-semibold">Max Drawdown</span>
                      <div className="font-mono font-bold text-rose-400 text-sm mt-0.5">
                        -{runResult.maxDrawdownPct.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Detailed Institutional Audit Feedback */}
                  <div className="rounded-2xl bg-slate-800/80 p-4 border border-slate-700 text-xs text-slate-300 leading-relaxed space-y-1.5">
                    <div className="font-bold text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Rapport d'Audit du Desk de Risque ESPRIT :
                    </div>
                    <p>{runResult.auditFeedback}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setRunResult(null);
                        if (selectedBoss) handleStartRun(selectedBoss);
                      }}
                      className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Rejouer ce Boss
                    </button>
                    <button
                      onClick={() => {
                        setRunResult(null);
                        setGameActive(false);
                      }}
                      className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
                    >
                      Retour au Salon
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </PageTransition>
    </AppShell>
  );
};

export default FlashCrashArenaPage;
