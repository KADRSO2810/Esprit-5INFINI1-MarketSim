import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Swords,
  Bot,
  UserPlus,
  Trophy,
  History,
  Volume2,
  VolumeX,
  Play,
  Share2,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RotateCcw,
  Zap,
  Sparkles,
  Shield,
  Target,
  X,
  Link,
  Users,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../context/AuthContext';
import {
  DuelBotProfile,
  DuelLeaderboardEntry,
  DuelMatch,
  DuelPricePoint,
  DuelScenario,
} from '../types/duel';
import { CustomChallenge } from '../types/challenge';
import {
  getDuelScenarios,
  createAiDuel,
  createFriendDuel,
  submitDuelRun,
  getMyDuels,
  getDuelLeaderboard,
  getDuelInvite,
} from '../api/duel';
import { getActiveCustomChallenges } from '../api/challenge';
import { playDuelSfx } from '../utils/duelAudio';

type LobbyTab = 'lobby' | 'admin_challenges' | 'leaderboard' | 'history';
type OpponentMode = 'AI' | 'FRIEND';
type PositionSide = 'FLAT' | 'LONG' | 'SHORT';

export const DuelArenaPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const inviteTokenParam = searchParams.get('token');

  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<LobbyTab>('lobby');
  const [opponentMode, setOpponentMode] = useState<OpponentMode>('AI');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);

  // Scenarios & Lobby Configuration
  const [scenarios, setScenarios] = useState<DuelScenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<DuelScenario | null>(null);
  const [selectedBotProfile, setSelectedBotProfile] = useState<DuelBotProfile>('ALPHA_MEAN_REVERSION');
  const [friendEmail, setFriendEmail] = useState<string>('');
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Leaderboard & History
  const [leaderboard, setLeaderboard] = useState<DuelLeaderboardEntry[]>([]);
  const [myDuels, setMyDuels] = useState<DuelMatch[]>([]);
  const [customChallenges, setCustomChallenges] = useState<CustomChallenge[]>([]);

  // ── IN-GAME COMBAT ENGINE STATE ─────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentMatch, setCurrentMatch] = useState<DuelMatch | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(120);

  // Player Trading State
  const [cash, setCash] = useState<number>(50000);
  const [positionSide, setPositionSide] = useState<PositionSide>('FLAT');
  const [positionUnits, setPositionUnits] = useState<number>(0);
  const [entryPrice, setEntryPrice] = useState<number>(0);
  const [leverage, setLeverage] = useState<number>(1);
  const [playerTradesCount, setPlayerTradesCount] = useState<number>(0);
  const [playerEquityCurve, setPlayerEquityCurve] = useState<number[]>([50000]);
  const [playerPeakEquity, setPlayerPeakEquity] = useState<number>(50000);
  const [playerMaxDrawdown, setPlayerMaxDrawdown] = useState<number>(0);

  // Stop-Loss & Take-Profit State
  const [stopLossPrice, setStopLossPrice] = useState<number | null>(null);
  const [takeProfitPrice, setTakeProfitPrice] = useState<number | null>(null);
  const [lastAutoExitMessage, setLastAutoExitMessage] = useState<string | null>(null);

  // Chart Rendering Mode ('CANDLESTICKS' | 'LINE')
  const [gameplayChartView, setGameplayChartView] = useState<'CANDLESTICKS' | 'LINE'>('CANDLESTICKS');

  // 1v1 Launch Modal State for Challenges
  const [selected1v1Challenge, setSelected1v1Challenge] = useState<CustomChallenge | null>(null);
  const [custom1v1FriendEmail, setCustom1v1FriendEmail] = useState<string>('');
  const [custom1v1InviteUrl, setCustom1v1InviteUrl] = useState<string | null>(null);
  const [copiedCustom1v1, setCopiedCustom1v1] = useState<boolean>(false);
  const [isCreating1v1, setIsCreating1v1] = useState<boolean>(false);

  // Opponent Live Simulation State
  const [botEquityCurve, setBotEquityCurve] = useState<number[]>([50000]);
  const [botMessage, setBotMessage] = useState<string>("🤖 En attente de l'ouverture du marché...");

  // Post-Game Big Reveal Modal
  const [showRevealModal, setShowRevealModal] = useState<boolean>(false);
  const [completedMatchResult, setCompletedMatchResult] = useState<DuelMatch | null>(null);
  const [copiedShareText, setCopiedShareText] = useState<boolean>(false);

  const gameLoopRef = useRef<number | null>(null);

  // ── LOAD INITIAL DATA ───────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const scList = await getDuelScenarios();
        if (isMounted) {
          setScenarios(scList);
          if (scList.length > 0) {
            setSelectedScenario(scList[0]);
          }
        }

        // Si l'utilisateur est arrivé via un lien d'invitation
        if (inviteTokenParam && isMounted) {
          try {
            const inviteMatch = await getDuelInvite(inviteTokenParam);
            setCurrentMatch(inviteMatch);
            const foundScenario = scList.find((s) => s.id === inviteMatch.scenarioId) || scList[0];
            setSelectedScenario(foundScenario);
          } catch (e) {
            console.warn('[DUELS] Défi introuvable avec ce token:', e);
          }
        }

        const [lb, my, cChs] = await Promise.all([
          getDuelLeaderboard(),
          getMyDuels(),
          getActiveCustomChallenges(),
        ]);
        if (isMounted) {
          setLeaderboard(lb);
          setMyDuels(my);
          setCustomChallenges(cChs);
        }
      } catch (err) {
        console.error('[DUELS] Erreur chargement initial:', err);
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [inviteTokenParam]);

  // Current Price and Trajectory
  const priceTrajectory: DuelPricePoint[] = useMemo(() => {
    return selectedScenario?.priceTrajectory || [];
  }, [selectedScenario]);

  const currentPricePoint: DuelPricePoint | null = useMemo(() => {
    if (!priceTrajectory.length) return null;
    return priceTrajectory[Math.min(currentStepIndex, priceTrajectory.length - 1)];
  }, [priceTrajectory, currentStepIndex]);

  const currentPrice = currentPricePoint ? currentPricePoint.close : 100;

  // Real-time calculation of player equity
  const playerUnrealizedPnl = useMemo(() => {
    if (positionSide === 'FLAT' || positionUnits === 0) return 0;
    const priceDiff = currentPrice - entryPrice;
    const multiplier = positionSide === 'LONG' ? 1 : -1;
    return priceDiff * positionUnits * multiplier * leverage;
  }, [positionSide, positionUnits, currentPrice, entryPrice, leverage]);

  const playerTotalEquity = useMemo(() => {
    return Math.max(0, cash + playerUnrealizedPnl);
  }, [cash, playerUnrealizedPnl]);

  const playerNetPnl = useMemo(() => {
    return playerTotalEquity - 50000;
  }, [playerTotalEquity]);

  const playerRoi = useMemo(() => {
    return (playerNetPnl / 50000) * 100;
  }, [playerNetPnl]);

  // Current Opponent Equity
  const opponentCurrentEquity = useMemo(() => {
    if (currentMatch?.opponentEquityCurve && currentMatch.opponentEquityCurve.length > 0) {
      const idx = Math.min(currentStepIndex, currentMatch.opponentEquityCurve.length - 1);
      return currentMatch.opponentEquityCurve[idx];
    }
    if (botEquityCurve.length > 0) {
      const idx = Math.min(currentStepIndex, botEquityCurve.length - 1);
      return botEquityCurve[idx];
    }
    return 50000;
  }, [currentMatch, botEquityCurve, currentStepIndex]);

  const opponentNetPnl = opponentCurrentEquity - 50000;
  const opponentRoi = (opponentNetPnl / 50000) * 100;

  // Lead computation
  const leadDiff = playerTotalEquity - opponentCurrentEquity;

  // ── SOUND SFX HELPER ────────────────────────────────────────────────────────
  const playSfx = useCallback(
    (type: Parameters<typeof playDuelSfx>[0]) => {
      playDuelSfx(type, audioEnabled);
    },
    [audioEnabled]
  );

  // ── GAME TICK ENGINE ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;

    gameLoopRef.current = window.setInterval(() => {
      setCurrentStepIndex((prevIndex) => {
        const nextIndex = prevIndex + 1;

        if (nextIndex >= priceTrajectory.length) {
          // FIN DU MATCH
          clearInterval(gameLoopRef.current!);
          endGame();
          return prevIndex;
        }

        // Ticks SFX
        if (nextIndex % 10 === 0) {
          playSfx('tick');
        }

        // Timer update
        setRemainingSeconds((prevSec) => Math.max(0, prevSec - 1));

        // Update player equity tracking
        setPlayerEquityCurve((curve) => [...curve, Math.round(playerTotalEquity * 100) / 100]);

        // Max drawdown tracking
        if (playerTotalEquity > playerPeakEquity) {
          setPlayerPeakEquity(playerTotalEquity);
        } else if (playerPeakEquity > 0) {
          const dd = (playerPeakEquity - playerTotalEquity) / playerPeakEquity;
          if (dd > playerMaxDrawdown) {
            setPlayerMaxDrawdown(dd);
          }
        }

        // Dynamic bot speech generator
        if (nextIndex === 15) {
          setBotMessage('🤖 Bot Quant : Momentum détecté, accumulation en cours.');
        } else if (nextIndex === 45) {
          setBotMessage('🤖 Bot Quant : Hausse de volatilité, resserrement du Stop-Loss.');
        } else if (nextIndex === 85) {
          setBotMessage('🤖 Bot Quant : Divergence RSI identifiée, prise de bénéfices partielle.');
        } else if (nextIndex === 105) {
          setBotMessage('🤖 Bot Quant : Clôture défensive avant le gong final.');
        }

        return nextIndex;
      });
    }, 750); // 1 candle every 750ms for high tension

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isPlaying, priceTrajectory.length, playerTotalEquity, playerPeakEquity, playerMaxDrawdown, playSfx]);

  // ── AUTOMATED STOP-LOSS & TAKE-PROFIT TRIGGER ENGINE ────────────────────────
  useEffect(() => {
    if (!isPlaying || positionSide === 'FLAT' || !currentPricePoint) return;

    const candle = currentPricePoint;

    if (positionSide === 'LONG') {
      // 1. Déclenchement du STOP LOSS (en cas de baisse du cours sous le niveau de SL)
      if (stopLossPrice !== null && (candle.low <= stopLossPrice || candle.close <= stopLossPrice)) {
        playSfx('defeat');
        const exitPrice = stopLossPrice;
        const pnl = (exitPrice - entryPrice) * positionUnits * leverage;
        setCash((c) => c + pnl);
        setPositionSide('FLAT');
        setPositionUnits(0);
        setEntryPrice(0);
        setStopLossPrice(null);
        setTakeProfitPrice(null);
        setPlayerTradesCount((t) => t + 1);
        setLastAutoExitMessage(
          `🛡️ Stop-Loss Déclenché à $${exitPrice.toFixed(2)} (${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)})`
        );
        return;
      }

      // 2. Déclenchement du TAKE PROFIT (en cas de hausse du cours au niveau de TP)
      if (takeProfitPrice !== null && (candle.high >= takeProfitPrice || candle.close >= takeProfitPrice)) {
        playSfx('victory');
        const exitPrice = takeProfitPrice;
        const pnl = (exitPrice - entryPrice) * positionUnits * leverage;
        setCash((c) => c + pnl);
        setPositionSide('FLAT');
        setPositionUnits(0);
        setEntryPrice(0);
        setStopLossPrice(null);
        setTakeProfitPrice(null);
        setPlayerTradesCount((t) => t + 1);
        setLastAutoExitMessage(
          `🎯 Take-Profit Touché avec Succès à $${exitPrice.toFixed(2)} (+${pnl.toFixed(2)}$) !`
        );
        return;
      }
    } else if (positionSide === 'SHORT') {
      // 1. Déclenchement du STOP LOSS en Short (perte si le cours monte au-dessus du SL)
      if (stopLossPrice !== null && (candle.high >= stopLossPrice || candle.close >= stopLossPrice)) {
        playSfx('defeat');
        const exitPrice = stopLossPrice;
        const pnl = (entryPrice - exitPrice) * positionUnits * leverage;
        setCash((c) => c + pnl);
        setPositionSide('FLAT');
        setPositionUnits(0);
        setEntryPrice(0);
        setStopLossPrice(null);
        setTakeProfitPrice(null);
        setPlayerTradesCount((t) => t + 1);
        setLastAutoExitMessage(
          `🛡️ Stop-Loss Short Déclenché à $${exitPrice.toFixed(2)} (${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)})`
        );
        return;
      }

      // 2. Déclenchement du TAKE PROFIT en Short (gain si le cours baisse au niveau du TP)
      if (takeProfitPrice !== null && (candle.low <= takeProfitPrice || candle.close <= takeProfitPrice)) {
        playSfx('victory');
        const exitPrice = takeProfitPrice;
        const pnl = (entryPrice - exitPrice) * positionUnits * leverage;
        setCash((c) => c + pnl);
        setPositionSide('FLAT');
        setPositionUnits(0);
        setEntryPrice(0);
        setStopLossPrice(null);
        setTakeProfitPrice(null);
        setPlayerTradesCount((t) => t + 1);
        setLastAutoExitMessage(
          `🎯 Take-Profit Short Atteint à $${exitPrice.toFixed(2)} (+${pnl.toFixed(2)}$) !`
        );
        return;
      }
    }
  }, [
    currentStepIndex,
    isPlaying,
    positionSide,
    positionUnits,
    entryPrice,
    leverage,
    stopLossPrice,
    takeProfitPrice,
    currentPricePoint,
    playSfx,
  ]);

  // Quick SL / TP preset percentages
  const setSlPresetPct = (pct: number) => {
    if (positionSide === 'FLAT' || entryPrice <= 0) return;
    if (positionSide === 'LONG') {
      const target = Math.round(entryPrice * (1 - pct / 100) * 100) / 100;
      setStopLossPrice(target);
    } else {
      const target = Math.round(entryPrice * (1 + pct / 100) * 100) / 100;
      setStopLossPrice(target);
    }
  };

  const setTpPresetPct = (pct: number) => {
    if (positionSide === 'FLAT' || entryPrice <= 0) return;
    if (positionSide === 'LONG') {
      const target = Math.round(entryPrice * (1 + pct / 100) * 100) / 100;
      setTakeProfitPrice(target);
    } else {
      const target = Math.round(entryPrice * (1 - pct / 100) * 100) / 100;
      setTakeProfitPrice(target);
    }
  };

  // ── PLAYER TRADING ACTIONS ──────────────────────────────────────────────────
  const handleBuy = () => {
    if (!isPlaying || !currentPricePoint) return;
    playSfx('order_buy');

    // Si on était en short, on clôture d'abord
    if (positionSide === 'SHORT') {
      const pnl = (entryPrice - currentPrice) * positionUnits * leverage;
      setCash((c) => c + pnl);
    }

    const availableCapital = cash * 0.4; // 40% de marge par entrée
    const units = Math.max(1, Math.floor(availableCapital / currentPrice));

    setPositionSide('LONG');
    setPositionUnits(units);
    setEntryPrice(currentPrice);
    setStopLossPrice(null);
    setTakeProfitPrice(null);
    setLastAutoExitMessage(null);
    setPlayerTradesCount((t) => t + 1);
  };

  const handleSell = () => {
    if (!isPlaying || !currentPricePoint) return;
    playSfx('order_sell');

    // Si on était en long, on clôture d'abord
    if (positionSide === 'LONG') {
      const pnl = (currentPrice - entryPrice) * positionUnits * leverage;
      setCash((c) => c + pnl);
    }

    const availableCapital = cash * 0.4;
    const units = Math.max(1, Math.floor(availableCapital / currentPrice));

    setPositionSide('SHORT');
    setPositionUnits(units);
    setEntryPrice(currentPrice);
    setStopLossPrice(null);
    setTakeProfitPrice(null);
    setLastAutoExitMessage(null);
    setPlayerTradesCount((t) => t + 1);
  };

  const handleClosePosition = () => {
    if (!isPlaying || positionSide === 'FLAT') return;
    playSfx('order_close');

    const pnl = playerUnrealizedPnl;
    setCash((c) => c + pnl);
    setPositionSide('FLAT');
    setPositionUnits(0);
    setEntryPrice(0);
    setStopLossPrice(null);
    setTakeProfitPrice(null);
    setPlayerTradesCount((t) => t + 1);
  };

  const buildScenarioFromCustomChallenge = (challenge: CustomChallenge): DuelScenario => {
    return {
      id: `CUSTOM_${challenge.id}`,
      codeName: `DÉFI MYSTÈRE : ${challenge.assetName}`,
      category: challenge.category,
      difficulty: challenge.durationMinutes >= 20 ? 'HARD' : 'NORMAL',
      description: "🔒 Données réelles masquées. Tradez à l'aveugle selon vos réflexes et votre analyse des chandeliers.",
      durationSeconds: Math.min(300, challenge.durationMinutes * 60),
      initialCapital: challenge.initialCapital || 50000,
      priceTrajectory: challenge.trajectory,
      realAssetSymbol: challenge.assetSymbol,
      realAssetName: challenge.assetName,
      realPeriod: `Challenge de ${challenge.durationMinutes} Minutes`,
      historicalContext: `Défi créé sur-mesure par l'administrateur (${challenge.creatorName || 'Admin'}).`,
    };
  };

  // LANCEMENT IMMÉDIAT EN SOLO (Aucune attente, ouverture directe du marché !)
  const handleLaunchSoloChallenge = async (challenge: CustomChallenge) => {
    const sc = buildScenarioFromCustomChallenge(challenge);
    setSelectedScenario(sc);
    setOpponentMode('AI');
    setSelected1v1Challenge(null);

    const startingCapital = challenge.initialCapital || 50000;
    setCash(startingCapital);
    setPositionSide('FLAT');
    setPositionUnits(0);
    setEntryPrice(0);
    setLeverage(1);
    setStopLossPrice(null);
    setTakeProfitPrice(null);
    setLastAutoExitMessage(null);
    setPlayerTradesCount(0);
    setPlayerEquityCurve([startingCapital]);
    setPlayerPeakEquity(startingCapital);
    setPlayerMaxDrawdown(0);
    setBotEquityCurve([startingCapital]);
    setCurrentStepIndex(0);
    setRemainingSeconds(sc.durationSeconds || 120);
    setShowRevealModal(false);

    // Démarre la partie immédiatement !
    setIsPlaying(true);
    playSfx('countdown');

    try {
      const match = await createAiDuel({
        scenarioId: sc.id,
        botProfile: selectedBotProfile || 'ALPHA_MEAN_REVERSION',
      });
      setCurrentMatch(match);
      if (match.opponentEquityCurve && match.opponentEquityCurve.length > 0) {
        setBotEquityCurve(match.opponentEquityCurve);
      }
    } catch (err) {
      console.warn('[DUELS] Match IA local créé:', err);
    }
  };

  // OUVERTURE DU MODAL DUEL 1V1 (Invite un ami ou bot)
  const handleOpen1v1Modal = (challenge: CustomChallenge) => {
    setSelected1v1Challenge(challenge);
    setCustom1v1FriendEmail('');
    setCustom1v1InviteUrl(null);
    setCopiedCustom1v1(false);
  };

  // GÉNÉRATION DU LIEN DE DUEL 1V1 AVEC UN AMI
  const handleCreate1v1FriendInvite = async () => {
    if (!selected1v1Challenge) return;
    try {
      setIsCreating1v1(true);
      const sc = buildScenarioFromCustomChallenge(selected1v1Challenge);
      setSelectedScenario(sc);

      const targetEmail = custom1v1FriendEmail.trim() || `ami_${Date.now()}@marketsim.local`;
      const match = await createFriendDuel({
        friendEmail: targetEmail,
        scenarioId: sc.id,
      });

      setCurrentMatch(match);
      const inviteUrl = `${window.location.origin}/app/duels?token=${match.inviteToken}`;
      setCustom1v1InviteUrl(inviteUrl);

      // Rafraîchir les duels pour que l'onglet 'Mes Duels' s'incrémente immédiatement
      try {
        const updated = await getMyDuels();
        setMyDuels(updated);
      } catch (e) {}
    } catch (err: any) {
      alert('Erreur lors de la création du duel 1v1 : ' + (err?.message || 'Erreur réseau'));
    } finally {
      setIsCreating1v1(false);
    }
  };

  // REJOINDRE IMMÉDIATEMENT LE ROUND 1V1 EN ATTENDANT L'AMI
  const handleStart1v1ChallengerRound = () => {
    if (!selected1v1Challenge) return;
    const startingCapital = selected1v1Challenge.initialCapital || 50000;
    const durSec = Math.min(300, selected1v1Challenge.durationMinutes * 60);

    setCash(startingCapital);
    setPositionSide('FLAT');
    setPositionUnits(0);
    setEntryPrice(0);
    setLeverage(1);
    setStopLossPrice(null);
    setTakeProfitPrice(null);
    setLastAutoExitMessage(null);
    setPlayerTradesCount(0);
    setPlayerEquityCurve([startingCapital]);
    setPlayerPeakEquity(startingCapital);
    setPlayerMaxDrawdown(0);
    setCurrentStepIndex(0);
    setRemainingSeconds(durSec);
    setShowRevealModal(false);
    setSelected1v1Challenge(null);

    setIsPlaying(true);
    playSfx('countdown');
  };

  // ── START DUEL ──────────────────────────────────────────────────────────────
  const handleStartDuel = async () => {
    if (!selectedScenario) return;

    try {
      playSfx('countdown');
      let match: DuelMatch;

      if (opponentMode === 'AI') {
        match = await createAiDuel({
          scenarioId: selectedScenario.id,
          botProfile: selectedBotProfile,
        });
        setCurrentMatch(match);
        if (match.opponentEquityCurve && match.opponentEquityCurve.length > 0) {
          setBotEquityCurve(match.opponentEquityCurve);
        }
      } else {
        if (!friendEmail.trim()) {
          alert("Veuillez saisir l'adresse email de votre ami.");
          return;
        }
        match = await createFriendDuel({
          friendEmail: friendEmail.trim(),
          scenarioId: selectedScenario.id,
        });
        setCurrentMatch(match);
        setCreatedInviteUrl(`${window.location.origin}/app/duels?token=${match.inviteToken}`);
      }

      // Reset combat state
      setCash(50000);
      setPositionSide('FLAT');
      setPositionUnits(0);
      setEntryPrice(0);
      setLeverage(1);
      setPlayerTradesCount(0);
      setPlayerEquityCurve([50000]);
      setPlayerPeakEquity(50000);
      setPlayerMaxDrawdown(0);
      setCurrentStepIndex(0);
      setRemainingSeconds(selectedScenario.durationSeconds || 120);
      setIsPlaying(true);
    } catch (err) {
      console.error('[DUELS] Erreur démarrage match:', err);
      // Fallback local play if backend route in progress
      setCash(50000);
      setPositionSide('FLAT');
      setPositionUnits(0);
      setEntryPrice(0);
      setCurrentStepIndex(0);
      setRemainingSeconds(selectedScenario.durationSeconds || 120);
      setIsPlaying(true);
    }
  };

  // ── END GAME & THE BIG REVEAL ───────────────────────────────────────────────
  const endGame = async () => {
    setIsPlaying(false);

    // Clôture finale automatique
    const finalPnl = playerTotalEquity - 50000;
    const finalRoi = (finalPnl / 50000) * 100;
    const finalCurve = [...playerEquityCurve, playerTotalEquity];

    const isWin = playerTotalEquity >= opponentCurrentEquity;
    if (isWin) {
      playSfx('victory');
    } else {
      playSfx('defeat');
    }

    try {
      const matchResult = await submitDuelRun({
        matchId: currentMatch?.id,
        inviteToken: currentMatch?.inviteToken || inviteTokenParam || undefined,
        netPnl: Math.round(finalPnl * 100) / 100,
        returnPct: Math.round(finalRoi * 100) / 100,
        maxDrawdownPct: Math.round(playerMaxDrawdown * 10000) / 10000,
        tradesCount: playerTradesCount,
        equityCurve: finalCurve,
      });
      setCompletedMatchResult(matchResult);
    } catch (e) {
      console.warn('[DUELS] Soumission backend échouée, fallback calcul local:', e);
      // Fallback local visual match result
      const mockResult: DuelMatch = {
        id: currentMatch?.id || 999,
        challengerId: user?.id || 1,
        challengerName: user?.email?.split('@')[0] || 'Vous',
        opponentType: opponentMode === 'AI' ? 'AI_QUANT' : 'HUMAN',
        opponentName: opponentMode === 'AI' ? `Bot ${selectedBotProfile}` : friendEmail || 'Ami Invité',
        scenarioId: selectedScenario?.id || 'BTC_2017',
        scenarioTitle: selectedScenario?.codeName || 'ACTIF MYSTÈRE',
        status: 'COMPLETED',
        inviteToken: 'mock_token',
        inviteUrl: '',
        initialCapital: 50000,
        challengerPnl: finalPnl,
        challengerRoi: finalRoi,
        challengerScore: Math.round(finalPnl * 1.5 + 1000),
        challengerTrades: playerTradesCount,
        opponentPnl: opponentNetPnl,
        opponentRoi: opponentRoi,
        opponentScore: Math.round(opponentNetPnl * 1.5 + 950),
        opponentTrades: 6,
        winnerRole: isWin ? 'CHALLENGER' : 'OPPONENT',
        winnerName: isWin ? 'Vous' : `Bot ${selectedBotProfile}`,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        realAssetSymbol: selectedScenario?.realAssetSymbol,
        realAssetName: selectedScenario?.realAssetName,
        realPeriod: selectedScenario?.realPeriod,
        historicalContext: selectedScenario?.historicalContext,
      };
      setCompletedMatchResult(mockResult);
    }

    setShowRevealModal(true);
  };

  const copyInviteToClipboard = () => {
    if (!createdInviteUrl) return;
    navigator.clipboard.writeText(createdInviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const copyShareDuelResult = () => {
    if (!completedMatchResult) return;
    const isWin = completedMatchResult.winnerRole === 'CHALLENGER';
    const text = `🏆 ESPRIT Market Simulator - DUEL 1v1 BLIND REPLAY\n${isWin ? 'Victoire Écrasante' : 'Duel Épique'} sur l'actif secret ${completedMatchResult.realAssetName || 'Mystère'} !\nMon PnL : $${completedMatchResult.challengerPnl?.toLocaleString()} (${completedMatchResult.challengerRoi?.toFixed(2)}%)\nScore : ${completedMatchResult.challengerScore} pts.\nPrêt à me défier ? Rejoins l'arène !`;
    navigator.clipboard.writeText(text);
    setCopiedShareText(true);
    setTimeout(() => setCopiedShareText(false), 2500);
  };

  // ── SVG CHART SCALING HELPERS ───────────────────────────────────────────────
  const chartSlices = useMemo(() => {
    const visiblePoints = priceTrajectory.slice(0, Math.max(1, currentStepIndex + 1));
    if (visiblePoints.length === 0) return { minP: 0, maxP: 100, points: [] };

    let min = Infinity;
    let max = -Infinity;
    for (const p of visiblePoints) {
      if (p.low < min) min = p.low;
      if (p.high > max) max = p.high;
    }
    const padding = (max - min) * 0.08 || 1;
    return {
      minP: min - padding,
      maxP: max + padding,
      points: visiblePoints,
    };
  }, [priceTrajectory, currentStepIndex]);

  return (
    <AppShell
      title="Duels 1v1 Blind Replay"
      section="E-Sport & Défis"
      badge="LIVE 1v1"
    >
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none pb-12">
        {/* TOP BAR / HEADER */}
        <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Swords className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Duels 1v1 <span className="text-cyan-400">Blind Market Replay</span>
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono">
                  LIVE E-SPORT 2026
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Trader Humain vs Agents IA Quants & Défis Amis par Email • Actifs & dates masqués
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          {!isPlaying && (
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
              <button
                onClick={() => setActiveTab('lobby')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'lobby'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                L'Arène
              </button>
              <button
                onClick={() => setActiveTab('admin_challenges')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'admin_challenges'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                Défis de l'Admin ({customChallenges.length})
              </button>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'leaderboard'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                Panthéon Mondial
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'history'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Mes Duels ({myDuels.length})
              </button>
            </div>
          )}

          {/* Right quick tools */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              title={audioEnabled ? 'Désactiver effets sonores' : 'Activer effets sonores'}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 transition-colors"
            >
              {audioEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>
          </div>
        </header>

        {/* ── MAIN CONTENT SWITCH ──────────────────────────────────────────────── */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {isPlaying ? (
            /* ─────────────────────────────────────────────────────────────────── */
            /* 1. DUEL IN-COMBAT LIVE ARENA (SCREEN ACTIVE)                        */
            /* ─────────────────────────────────────────────────────────────────── */
            <div className="space-y-6 animate-fadeIn">
              {/* HUD SPLIT BAR : PLAYER VS OPPONENT */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
                {/* PLAYER 1 (YOU) */}
                <div className="md:col-span-5 flex items-center gap-4 bg-slate-950/60 border border-cyan-500/30 rounded-xl p-3.5">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center font-bold text-cyan-300">
                    VOUS
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase font-semibold text-cyan-400 tracking-wider">Trader Humain</span>
                      <span className={`text-xs font-mono font-bold ${playerNetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {playerRoi >= 0 ? '+' : ''}{playerRoi.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-xl font-bold font-mono text-white tracking-tight">
                      ${playerTotalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>PnL: <b className={playerNetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>${playerNetPnl >= 0 ? '+' : ''}{playerNetPnl.toFixed(2)}</b></span>
                      <span>•</span>
                      <span>Trades: <b>{playerTradesCount}</b></span>
                    </div>
                  </div>
                </div>

                {/* CENTER TIME & LEAD GAUGE */}
                <div className="md:col-span-2 flex flex-col items-center justify-center text-center">
                  <div className="text-3xl font-black font-mono tracking-tight text-white">
                    {Math.floor(remainingSeconds / 60)}:{(remainingSeconds % 60).toString().padStart(2, '0')}
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full transition-all duration-300"
                      style={{ width: `${(remainingSeconds / (selectedScenario?.durationSeconds || 120)) * 100}%` }}
                    />
                  </div>
                  <div className="mt-2 text-[11px] font-bold tracking-wider uppercase">
                    {leadDiff > 0 ? (
                      <span className="text-emerald-400 flex items-center gap-1 justify-center">
                        <TrendingUp className="w-3 h-3" /> En tête (+${leadDiff.toFixed(0)})
                      </span>
                    ) : leadDiff < 0 ? (
                      <span className="text-rose-400 flex items-center gap-1 justify-center">
                        <TrendingDown className="w-3 h-3" /> Retard (-${Math.abs(leadDiff).toFixed(0)})
                      </span>
                    ) : (
                      <span className="text-amber-400">Égalité</span>
                    )}
                  </div>
                </div>

                {/* OPPONENT (BOT OU AMI) */}
                <div className="md:col-span-5 flex items-center gap-4 bg-slate-950/60 border border-purple-500/30 rounded-xl p-3.5">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center font-bold text-purple-300">
                    {currentMatch?.opponentType === 'AI_QUANT' ? <Bot className="w-6 h-6" /> : 'AMI'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase font-semibold text-purple-400 tracking-wider">
                        {currentMatch?.opponentType === 'AI_QUANT' ? `Agent Quant : ${selectedBotProfile}` : currentMatch?.opponentEmail || 'Adversaire'}
                      </span>
                      <span className={`text-xs font-mono font-bold ${opponentNetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {opponentRoi >= 0 ? '+' : ''}{opponentRoi.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-xl font-bold font-mono text-white tracking-tight">
                      ${opponentCurrentEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>PnL: <b className={opponentNetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>${opponentNetPnl >= 0 ? '+' : ''}{opponentNetPnl.toFixed(2)}</b></span>
                      <span>•</span>
                      <span>Algorithme: <b>Actif</b></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* BOT LIVE TELEMETRY TICKER */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span className="text-slate-400">Flux Quantique :</span>
                  <span className="font-mono text-cyan-300">{botMessage}</span>
                </div>
                {currentPricePoint?.hint && (
                  <div className="text-amber-400 flex items-center gap-1 font-semibold animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {currentPricePoint.hint}
                  </div>
                )}
              </div>

              {/* AUTO-TRIGGER NOTIFICATION BANNER (STOP-LOSS / TAKE-PROFIT) */}
              {lastAutoExitMessage && (
                <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border border-amber-500/40 rounded-xl px-4 py-3 flex items-center justify-between text-xs text-amber-200 animate-fadeIn shadow-lg">
                  <div className="flex items-center gap-2 font-mono font-bold">
                    <span>⚡ EXÉCUTION AUTOMATIQUE :</span>
                    <span className="text-white">{lastAutoExitMessage}</span>
                  </div>
                  <button
                    onClick={() => setLastAutoExitMessage(null)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* MAIN TRADING ENGINE & CHARTS */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT & CENTER : BLIND CANDLESTICK / PRICE SVG CHART (8 COLS) */}
                <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white font-mono tracking-wider">
                        {selectedScenario?.codeName || 'ACTIF MYSTÈRE : DELTA-9'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono">
                        ÉCHELLE TEMPORELLE BLIND
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* VIEW TOGGLE */}
                      <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
                        <button
                          type="button"
                          onClick={() => setGameplayChartView('CANDLESTICKS')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            gameplayChartView === 'CANDLESTICKS'
                              ? 'bg-cyan-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          🕯️ Chandeliers (OHLC)
                        </button>
                        <button
                          type="button"
                          onClick={() => setGameplayChartView('LINE')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            gameplayChartView === 'LINE'
                              ? 'bg-cyan-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          📈 Ligne
                        </button>
                      </div>

                      <div className="text-right">
                        <div className="text-xl font-black font-mono text-white">
                          ${currentPrice.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Vol: {currentPricePoint?.volume.toLocaleString() || '---'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SVG PRICE ACTION GRAPH */}
                  <div className="h-64 w-full my-4 relative bg-slate-950/70 rounded-xl p-2 border border-slate-800/60 overflow-hidden flex flex-col justify-between">
                    <svg className="w-full h-48" viewBox="0 0 600 200" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="blindAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Grid lines */}
                      {[30, 75, 120, 165].map((y) => (
                        <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3 3" />
                      ))}

                      {gameplayChartView === 'CANDLESTICKS' ? (
                        /* JAPANESE CANDLESTICKS RENDERING */
                        <g>
                          {chartSlices.points.map((p, idx) => {
                            const total = Math.max(1, priceTrajectory.length);
                            const candleWidth = Math.max(3, (600 / total) * 0.75);
                            const x = (idx / Math.max(1, total - 1)) * (600 - candleWidth) + candleWidth / 2;

                            const isBullish = p.close >= p.open;
                            const candleColor = isBullish ? '#10b981' : '#f43f5e';

                            const range = chartSlices.maxP - chartSlices.minP || 1;
                            const yHigh = 200 - ((p.high - chartSlices.minP) / range) * 175 - 12;
                            const yLow = 200 - ((p.low - chartSlices.minP) / range) * 175 - 12;
                            const yOpen = 200 - ((p.open - chartSlices.minP) / range) * 175 - 12;
                            const yClose = 200 - ((p.close - chartSlices.minP) / range) * 175 - 12;

                            const bodyTop = Math.min(yOpen, yClose);
                            const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

                            return (
                              <g key={p.step}>
                                <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={candleColor} strokeWidth="1.2" />
                                <rect
                                  x={x - candleWidth / 2}
                                  y={bodyTop}
                                  width={candleWidth}
                                  height={bodyHeight}
                                  fill={candleColor}
                                  rx="1"
                                />
                              </g>
                            );
                          })}
                        </g>
                      ) : (
                        /* CONTINUOUS LINE PLOT */
                        <g>
                          {chartSlices.points.length > 1 && (
                            <path
                              d={`M 0 200 ${chartSlices.points
                                .map((p, i) => {
                                  const x = (i / Math.max(1, priceTrajectory.length - 1)) * 600;
                                  const y = 200 - ((p.close - chartSlices.minP) / (chartSlices.maxP - chartSlices.minP || 1)) * 175 - 12;
                                  return `L ${x} ${y}`;
                                })
                                .join(' ')} L ${(chartSlices.points.length / Math.max(1, priceTrajectory.length - 1)) * 600} 200 Z`}
                              fill="url(#blindAreaGrad)"
                            />
                          )}
                          {chartSlices.points.length > 1 && (
                            <path
                              d={`M 0 ${200 - ((chartSlices.points[0].close - chartSlices.minP) / (chartSlices.maxP - chartSlices.minP || 1)) * 175 - 12} ${chartSlices.points
                                .map((p, i) => {
                                  const x = (i / Math.max(1, priceTrajectory.length - 1)) * 600;
                                  const y = 200 - ((p.close - chartSlices.minP) / (chartSlices.maxP - chartSlices.minP || 1)) * 175 - 12;
                                  return `L ${x} ${y}`;
                                })
                                .join(' ')}`}
                              fill="none"
                              stroke="#22d3ee"
                              strokeWidth="2.5"
                            />
                          )}
                        </g>
                      )}

                      {/* ACTIVE TRADE OVERLAY LINES (ENTRY, STOP LOSS, TAKE PROFIT) */}
                      {positionSide !== 'FLAT' && entryPrice > 0 && (() => {
                        const range = chartSlices.maxP - chartSlices.minP || 1;
                        const yEntry = 200 - ((entryPrice - chartSlices.minP) / range) * 175 - 12;

                        return (
                          <g>
                            {/* Entry line */}
                            <line x1="0" y1={yEntry} x2="600" y2={yEntry} stroke="#06b6d4" strokeWidth="1.2" strokeDasharray="4 4" />
                            <text x="590" y={yEntry - 4} textAnchor="end" fill="#22d3ee" fontSize="9" fontWeight="bold" fontFamily="monospace">
                              {`📍 ENTRÉE $${entryPrice.toFixed(2)}`}
                            </text>

                            {/* Stop-Loss line if defined */}
                            {stopLossPrice !== null && (() => {
                              const ySL = 200 - ((stopLossPrice - chartSlices.minP) / range) * 175 - 12;
                              return (
                                <g>
                                  <line x1="0" y1={ySL} x2="600" y2={ySL} stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3 3" />
                                  <text x="590" y={ySL - 4} textAnchor="end" fill="#f43f5e" fontSize="9" fontWeight="bold" fontFamily="monospace">
                                    {`🛡️ STOP-LOSS $${stopLossPrice.toFixed(2)}`}
                                  </text>
                                </g>
                              );
                            })()}

                            {/* Take-Profit line if defined */}
                            {takeProfitPrice !== null && (() => {
                              const yTP = 200 - ((takeProfitPrice - chartSlices.minP) / range) * 175 - 12;
                              return (
                                <g>
                                  <line x1="0" y1={yTP} x2="600" y2={yTP} stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" />
                                  <text x="590" y={yTP - 4} textAnchor="end" fill="#10b981" fontSize="9" fontWeight="bold" fontFamily="monospace">
                                    {`🎯 TAKE-PROFIT $${takeProfitPrice.toFixed(2)}`}
                                  </text>
                                </g>
                              );
                            })()}
                          </g>
                        );
                      })()}

                      {/* Current pulse dot */}
                      {chartSlices.points.length > 0 && (() => {
                        const total = Math.max(1, priceTrajectory.length);
                        const lastX = ((chartSlices.points.length - 1) / Math.max(1, total - 1)) * 600;
                        const lastY = 200 - ((chartSlices.points[chartSlices.points.length - 1].close - chartSlices.minP) / (chartSlices.maxP - chartSlices.minP || 1)) * 175 - 12;
                        return (
                          <g>
                            <circle cx={lastX} cy={lastY} r="6" fill="#22d3ee" opacity="0.4" className="animate-ping" />
                            <circle cx={lastX} cy={lastY} r="4" fill="#ffffff" stroke="#0891b2" strokeWidth="2" />
                          </g>
                        );
                      })()}
                    </svg>

                    {/* LIVE VOLUME SUB-BAR AT BOTTOM */}
                    <div className="h-8 w-full pt-1 border-t border-slate-900">
                      <svg className="w-full h-full" viewBox="0 0 600 30" preserveAspectRatio="none">
                        {chartSlices.points.map((p, idx) => {
                          const total = Math.max(1, priceTrajectory.length);
                          const w = Math.max(2, (600 / total) * 0.7);
                          const x = (idx / Math.max(1, total - 1)) * (600 - w) + w / 2;
                          const isBullish = p.close >= p.open;
                          const barHeight = Math.min(26, Math.max(3, (p.volume / 80000) * 26));

                          return (
                            <rect
                              key={p.step}
                              x={x - w / 2}
                              y={30 - barHeight}
                              width={w}
                              height={barHeight}
                              fill={isBullish ? '#10b981' : '#f43f5e'}
                              opacity="0.45"
                            />
                          );
                        })}
                      </svg>
                    </div>
                  </div>

                  {/* DUAL EQUITY CURVE COMPARISON MINI-CHART */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-slate-300">Duel en Direct : Courbes de Capital</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 text-cyan-400 font-mono text-[11px]">
                          <span className="w-2.5 h-0.5 bg-cyan-400 rounded-full inline-block" /> Vous
                        </span>
                        <span className="flex items-center gap-1.5 text-purple-400 font-mono text-[11px]">
                          <span className="w-2.5 h-0.5 bg-purple-400 rounded-full inline-block" /> Adversaire
                        </span>
                      </div>
                    </div>

                    <div className="h-16 w-full relative">
                      <svg className="w-full h-full" viewBox="0 0 600 60" preserveAspectRatio="none">
                        {/* Player curve */}
                        {playerEquityCurve.length > 1 && (
                          <path
                            d={`M 0 ${60 - ((playerEquityCurve[0] - 40000) / 30000) * 50 - 5} ${playerEquityCurve
                              .map((v, i) => {
                                const x = (i / Math.max(1, priceTrajectory.length - 1)) * 600;
                                const y = 60 - ((v - 40000) / 30000) * 50 - 5;
                                return `L ${x} ${Math.max(2, Math.min(58, y))}`;
                              })
                              .join(' ')}`}
                            fill="none"
                            stroke="#06b6d4"
                            strokeWidth="2"
                          />
                        )}

                        {/* Bot curve */}
                        {botEquityCurve.length > 1 && (
                          <path
                            d={`M 0 ${60 - ((botEquityCurve[0] - 40000) / 30000) * 50 - 5} ${botEquityCurve
                              .slice(0, currentStepIndex + 1)
                              .map((v, i) => {
                                const x = (i / Math.max(1, priceTrajectory.length - 1)) * 600;
                                const y = 60 - ((v - 40000) / 30000) * 50 - 5;
                                return `L ${x} ${Math.max(2, Math.min(58, y))}`;
                              })
                              .join(' ')}`}
                            fill="none"
                            stroke="#c084fc"
                            strokeWidth="2"
                            strokeDasharray="4 2"
                          />
                        )}
                      </svg>
                    </div>
                  </div>
                </div>

                {/* RIGHT : TRADING COCKPIT (4 COLS) */}
                <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-cyan-400" /> Cockpit d'Exécution Rapide
                    </h3>

                    {/* CURRENT POSITION SUMMARY */}
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Position Active</span>
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                            positionSide === 'LONG'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : positionSide === 'SHORT'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {positionSide === 'LONG' ? 'ACHAT (LONG)' : positionSide === 'SHORT' ? 'VENTE (SHORT)' : 'FLAT (NEUTRE)'}
                        </span>
                      </div>

                      {positionSide !== 'FLAT' && (
                        <>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Prix d'entrée</span>
                            <span className="font-mono text-white">${entryPrice.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Volume & Levier</span>
                            <span className="font-mono text-white">{positionUnits} unités ({leverage}x)</span>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                            <span className="text-slate-400">Gain Latent</span>
                            <span className={`font-mono font-bold text-sm ${playerUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              ${playerUnrealizedPnl >= 0 ? '+' : ''}{playerUnrealizedPnl.toFixed(2)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* STOP-LOSS & TAKE-PROFIT CONTROLS */}
                    <div className="mt-4 bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-rose-400" /> Ordres de Protection
                        </span>
                        {(stopLossPrice !== null || takeProfitPrice !== null) && (
                          <button
                            type="button"
                            onClick={() => {
                              setStopLossPrice(null);
                              setTakeProfitPrice(null);
                            }}
                            className="text-[10px] text-slate-500 hover:text-rose-400 flex items-center gap-0.5"
                          >
                            <X className="w-3 h-3" /> Réinitialiser
                          </button>
                        )}
                      </div>

                      {/* STOP LOSS */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Stop-Loss
                          </span>
                          <span className="font-mono text-rose-400 font-bold text-[11px]">
                            {stopLossPrice !== null ? `$${stopLossPrice.toFixed(2)}` : 'Désactivé'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.01"
                            placeholder={positionSide !== 'FLAT' ? `${(positionSide === 'LONG' ? entryPrice * 0.95 : entryPrice * 1.05).toFixed(2)}` : 'Prix SL ($)'}
                            value={stopLossPrice !== null ? stopLossPrice : ''}
                            onChange={(e) => setStopLossPrice(e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-rose-400"
                          />
                          {positionSide !== 'FLAT' && (
                            <div className="flex items-center gap-1">
                              {[2, 5, 10].map((pct) => (
                                <button
                                  key={pct}
                                  type="button"
                                  onClick={() => setSlPresetPct(pct)}
                                  className="px-1.5 py-1 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 border border-slate-700 rounded text-[10px] font-mono text-slate-300 font-bold transition-all"
                                  title={`Placer le Stop-Loss à ${positionSide === 'LONG' ? '-' : '+'}${pct}%`}
                                >
                                  {positionSide === 'LONG' ? '-' : '+'}{pct}%
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* TAKE PROFIT */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Target className="w-3.5 h-3.5 text-emerald-400" /> Take-Profit
                          </span>
                          <span className="font-mono text-emerald-400 font-bold text-[11px]">
                            {takeProfitPrice !== null ? `$${takeProfitPrice.toFixed(2)}` : 'Désactivé'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.01"
                            placeholder={positionSide !== 'FLAT' ? `${(positionSide === 'LONG' ? entryPrice * 1.08 : entryPrice * 0.92).toFixed(2)}` : 'Prix TP ($)'}
                            value={takeProfitPrice !== null ? takeProfitPrice : ''}
                            onChange={(e) => setTakeProfitPrice(e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
                          />
                          {positionSide !== 'FLAT' && (
                            <div className="flex items-center gap-1">
                              {[4, 8, 15].map((pct) => (
                                <button
                                  key={pct}
                                  type="button"
                                  onClick={() => setTpPresetPct(pct)}
                                  className="px-1.5 py-1 bg-slate-800 hover:bg-emerald-950/60 hover:text-emerald-300 border border-slate-700 rounded text-[10px] font-mono text-slate-300 font-bold transition-all"
                                  title={`Placer le Take-Profit à ${positionSide === 'LONG' ? '+' : '-'}${pct}%`}
                                >
                                  {positionSide === 'LONG' ? '+' : '-'}{pct}%
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* LEVERAGE SELECTOR */}
                    <div className="mt-4">
                      <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">
                        Levier Stratégique
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 5].map((lev) => (
                          <button
                            key={lev}
                            onClick={() => setLeverage(lev)}
                            className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                              leverage === lev
                                ? 'bg-cyan-500 text-white shadow-sm shadow-cyan-500/30'
                                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                            }`}
                          >
                            {lev}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="space-y-2 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleBuy}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5"
                      >
                        <span className="flex items-center gap-1.5 text-sm">
                          <TrendingUp className="w-4 h-4" /> ACHETER (LONG)
                        </span>
                        <span className="text-[10px] text-emerald-100 font-mono">Parier sur la hausse</span>
                      </button>

                      <button
                        onClick={handleSell}
                        className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white font-bold rounded-xl shadow-lg shadow-rose-500/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5"
                      >
                        <span className="flex items-center gap-1.5 text-sm">
                          <TrendingDown className="w-4 h-4" /> VENDRE (SHORT)
                        </span>
                        <span className="text-[10px] text-rose-100 font-mono">Parier sur la baisse</span>
                      </button>
                    </div>

                    <button
                      onClick={handleClosePosition}
                      disabled={positionSide === 'FLAT'}
                      className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                        positionSide !== 'FLAT'
                          ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 shadow-sm active:scale-95'
                          : 'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800'
                      }`}
                    >
                      CLÔTURER POSITION (FLAT)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'lobby' ? (
            /* ─────────────────────────────────────────────────────────────────── */
            /* 2. LOBBY VIEW : CHOOSE OPPONENT & SCENARIO                          */
            /* ─────────────────────────────────────────────────────────────────── */
            <div className="space-y-8 animate-fadeIn">
              {/* HERO BANNER */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-950/60 via-slate-900 to-blue-950/50 border border-cyan-500/30 p-8 shadow-2xl">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold font-mono mb-3">
                    <Sparkles className="w-3.5 h-3.5" /> REPLAY À L'AVEUGLE • ZERO HINDSIGHT BIAS
                  </div>
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">
                    Affrontez un Trader ou une <span className="text-cyan-400">IA Quant</span> en 1v1
                  </h2>
                  <p className="text-slate-300 text-sm mt-2 leading-relaxed">
                    Le nom de l'actif et les dates réelles sont masqués pendant les 120 secondes de trading. Seule votre lecture pure du prix, de la volatilité et du carnet compte. À la fin : <b>The Big Reveal</b> dévoile la vérité historique !
                  </p>
                </div>
              </div>

              {/* STEP 1 : CHOOSE OPPONENT TYPE */}
              <div className="space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-mono">1</span>
                  Choisissez votre Type d'Adversaire
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* OPTION A : BOT IA QUANT */}
                  <div
                    onClick={() => setOpponentMode('AI')}
                    className={`cursor-pointer rounded-2xl p-5 border transition-all ${
                      opponentMode === 'AI'
                        ? 'bg-slate-900 border-cyan-400 shadow-lg shadow-cyan-500/10'
                        : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                          <Bot className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">Agent IA Quant (Solo)</div>
                          <div className="text-xs text-slate-400">Algorithme quantitatif haute fréquence</div>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${opponentMode === 'AI' ? 'border-cyan-400 bg-cyan-400' : 'border-slate-600'}`}>
                        {opponentMode === 'AI' && <Check className="w-3 h-3 text-slate-950 font-bold" />}
                      </div>
                    </div>

                    {/* BOT PROFILE PICKER */}
                    {opponentMode === 'AI' && (
                      <div className="space-y-2 mt-4 pt-3 border-t border-slate-800">
                        <div className="text-xs font-semibold text-slate-400">Profil de l'IA Quant :</div>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'HFT_MOMENTUM', name: 'Scalper HFT', desc: 'Momentum violent' },
                            { id: 'ALPHA_MEAN_REVERSION', name: 'Alpha Quant', desc: 'Retour à la moyenne' },
                            { id: 'CTA_TREND_BREAKOUT', name: 'CTA Trend', desc: 'Breakouts & Suivi' },
                          ].map((b) => (
                            <button
                              key={b.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBotProfile(b.id as DuelBotProfile);
                              }}
                              className={`p-2 rounded-xl text-left border transition-all ${
                                selectedBotProfile === b.id
                                  ? 'bg-cyan-500/20 border-cyan-500/60 text-white'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <div className="text-xs font-bold">{b.name}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">{b.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* OPTION B : FRIEND CHALLENGE BY EMAIL */}
                  <div
                    onClick={() => setOpponentMode('FRIEND')}
                    className={`cursor-pointer rounded-2xl p-5 border transition-all ${
                      opponentMode === 'FRIEND'
                        ? 'bg-slate-900 border-cyan-400 shadow-lg shadow-cyan-500/10'
                        : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                          <UserPlus className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">Défier un Ami par Email</div>
                          <div className="text-xs text-slate-400">Match 1v1 asynchrone sur la même seed</div>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${opponentMode === 'FRIEND' ? 'border-cyan-400 bg-cyan-400' : 'border-slate-600'}`}>
                        {opponentMode === 'FRIEND' && <Check className="w-3 h-3 text-slate-950 font-bold" />}
                      </div>
                    </div>

                    {opponentMode === 'FRIEND' && (
                      <div className="space-y-3 mt-4 pt-3 border-t border-slate-800">
                        <div className="text-xs font-semibold text-slate-400">Email du camarade ou trader :</div>
                        <input
                          type="email"
                          value={friendEmail}
                          onChange={(e) => setFriendEmail(e.target.value)}
                          placeholder="ex: collegue@esprit.tn"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                        />
                        {createdInviteUrl && (
                          <div className="bg-slate-950 border border-cyan-500/30 rounded-xl p-2.5 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-mono text-cyan-300 truncate">{createdInviteUrl}</span>
                            <button
                              onClick={copyInviteToClipboard}
                              className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1"
                            >
                              {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {copiedLink ? 'Copié !' : 'Copier'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* STEP 2 : CHOOSE BLIND SCENARIO */}
              <div className="space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-mono">2</span>
                  Sélectionnez le Scénario de Marché Blind
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {scenarios.map((sc) => {
                    const isSelected = selectedScenario?.id === sc.id;
                    return (
                      <div
                        key={sc.id}
                        onClick={() => setSelectedScenario(sc)}
                        className={`cursor-pointer rounded-2xl p-5 border flex flex-col justify-between transition-all ${
                          isSelected
                            ? 'bg-slate-900 border-cyan-400 shadow-lg shadow-cyan-500/10 scale-[1.02]'
                            : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                              {sc.category}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                sc.difficulty === 'EXTREME'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : sc.difficulty === 'HARD'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-emerald-500/20 text-emerald-400'
                              }`}
                            >
                              {sc.difficulty}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white font-mono">{sc.codeName}</h4>
                          <p className="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed">{sc.description}</p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                          <span>Durée: {sc.durationSeconds}s</span>
                          <span>Cap: $50 000</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* LAUNCH BUTTON */}
              <div className="pt-4 flex justify-center">
                <button
                  onClick={handleStartDuel}
                  className="px-10 py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-base rounded-2xl shadow-xl shadow-cyan-500/25 active:scale-95 transition-all flex items-center gap-3"
                >
                  <Play className="w-5 h-5 fill-current" />
                  ENTRER DANS L'ARÈNE 1v1 MAINTENANT
                </button>
              </div>
            </div>
          ) : activeTab === 'admin_challenges' ? (
            /* ─────────────────────────────────────────────────────────────────── */
            /* 2.5 DÉFIS OFFICIELS DE L'ADMIN (ACTIF X, 10/20/30 MIN)             */
            /* ─────────────────────────────────────────────────────────────────── */
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/50 border border-purple-500/30 rounded-3xl p-7 shadow-xl">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold mb-2">
                    <Sparkles className="w-3.5 h-3.5" /> ÉPREUVES DU MAÎTRE DU JEU
                  </div>
                  <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                    Défis Officiels de l'Admin <span className="text-purple-400">Actif X</span>
                  </h2>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    Scénarios sur-mesure confectionnés manuellement par l'administrateur avec des chocs programmés, fausses alertes news et retournements paraboliques sur 10, 20 ou 30 minutes.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {customChallenges.map((c) => (
                  <div
                    key={c.id}
                    className="bg-slate-900/90 border border-slate-800 hover:border-purple-500/50 rounded-3xl p-6 shadow-xl flex flex-col justify-between transition-all group relative overflow-hidden"
                  >
                    <div className="space-y-4">
                      {/* TOP BADGES: 100% SUSPENSE & DURATION ONLY */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-purple-400" /> DÉFI MYSTÈRE
                        </span>
                        <span className="text-xs font-black font-mono px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10">
                          ⏱ {c.durationMinutes} MINUTES
                        </span>
                      </div>

                      {/* TITLE */}
                      <div>
                        <h3 className="text-xl font-black text-white group-hover:text-purple-300 transition-colors tracking-tight">
                          {c.assetName}
                        </h3>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          Confectionné par l'Admin • Mode Replay à l'Aveugle
                        </div>
                      </div>

                      {/* SUSPENSE TEASER (ZERO SPOILERS!) */}
                      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                          <span>🔒 Effet Suspens Garanti</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          L'identité de l'actif, son historique et la chronologie des chocs sont tenus secrets.
                          Tradez à l'aveugle selon vos réflexes et vos chandeliers japonais !
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-3">
                      <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                        <span>Capital : <b className="text-white">${c.initialCapital.toLocaleString()}</b></span>
                        <span>Levier Max : <b className="text-purple-300">{c.maxLeverage}x</b></span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleLaunchSoloChallenge(c)}
                          className="w-full py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-black text-xs rounded-xl shadow-lg shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" /> Jouer Solo
                        </button>

                        <button
                          onClick={() => handleOpen1v1Modal(c)}
                          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs rounded-xl border border-slate-700 hover:border-cyan-500/40 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <Swords className="w-3.5 h-3.5 text-cyan-400" /> Duel 1v1
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'leaderboard' ? (
            /* ─────────────────────────────────────────────────────────────────── */
            /* 3. PANTHÉON MONDIAL DES DUELS 1V1                                   */
            /* ─────────────────────────────────────────────────────────────────── */
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-amber-400" /> Panthéon Mondial des Duels 1v1
                  </h2>
                  <p className="text-xs text-slate-400">Les victoires les plus mémorables enregistrées sur les Blind Replays</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-4">Rang</th>
                      <th className="p-4">Vainqueur</th>
                      <th className="p-4">Adversaire Vaincu</th>
                      <th className="p-4">Scénario</th>
                      <th className="p-4 text-right">PnL Net ($)</th>
                      <th className="p-4 text-right">ROI (%)</th>
                      <th className="p-4 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {leaderboard.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          Aucun duel terminé pour le moment. Soyez le premier champion !
                        </td>
                      </tr>
                    ) : (
                      leaderboard.map((e) => (
                        <tr key={e.matchId} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4 font-bold">
                            {e.rank === 1 ? '🥇 #1' : e.rank === 2 ? '🥈 #2' : e.rank === 3 ? '🥉 #3' : `#${e.rank}`}
                          </td>
                          <td className="p-4 font-bold text-cyan-400">{e.winnerName}</td>
                          <td className="p-4 text-slate-400">{e.loserName}</td>
                          <td className="p-4 text-slate-300">{e.scenarioTitle}</td>
                          <td className="p-4 text-right font-bold text-emerald-400">
                            +${e.winnerPnl?.toLocaleString()}
                          </td>
                          <td className="p-4 text-right font-bold text-emerald-400">
                            +{e.winnerRoi?.toFixed(2)}%
                          </td>
                          <td className="p-4 text-right font-bold text-amber-400">{e.winnerScore} pts</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ─────────────────────────────────────────────────────────────────── */
            /* 4. MES DUELS & HISTORIQUE                                           */
            /* ─────────────────────────────────────────────────────────────────── */
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <History className="w-6 h-6 text-cyan-400" /> Mon Historique de Duels
                </h2>
                <p className="text-xs text-slate-400">Retrouvez vos matchs passés et les invitations envoyées</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myDuels.length === 0 ? (
                  <div className="col-span-3 text-center p-12 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
                    Vous n'avez pas encore disputé de duel. Lancez votre premier défi !
                  </div>
                ) : (
                  myDuels.map((m) => (
                    <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-cyan-400">{m.scenarioTitle}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            m.status === 'COMPLETED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-white">
                        Adversaire : {m.opponentType === 'AI_QUANT' ? `Bot ${m.botProfile}` : m.opponentEmail || 'Ami'}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-slate-800">
                        <div>
                          <div className="text-slate-400 text-[10px]">Votre PnL</div>
                          <div className={`font-bold ${m.challengerPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            ${m.challengerPnl?.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400 text-[10px]">Vainqueur</div>
                          <div className="font-bold text-amber-400">{m.winnerName || 'En attente'}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>

        {/* ── THE BIG REVEAL MODAL (DÉVOILEMENT POST-MATCH) ───────────────────────── */}
        {showRevealModal && completedMatchResult && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-8 max-w-xl w-full shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

              {/* CORONATION BANNER */}
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 mx-auto flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Trophy className="w-8 h-8 text-slate-950" />
                </div>
                <h3 className="text-2xl font-black text-white tracking-tight">
                  {completedMatchResult.winnerRole === 'CHALLENGER' ? (
                    <span className="text-emerald-400">🏆 VICTOIRE ÉCRASANTE !</span>
                  ) : completedMatchResult.winnerRole === 'OPPONENT' ? (
                    <span className="text-rose-400">⚡ VICTOIRE DE L'ADVERSAIRE</span>
                  ) : (
                    <span className="text-amber-400">🤝 ÉGALITÉ PARFAITE</span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">
                  Le duel à l'aveugle est terminé. Voici la vérité historique sur cet actif !
                </p>
              </div>

              {/* THE BIG REVEAL CONTAINER */}
              <div className="my-6 bg-slate-950 border border-cyan-500/40 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> DÉVOILEMENT DE L'ACTIF
                  </span>
                  <span className="text-xs font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                    {completedMatchResult.realAssetSymbol || 'BTC/USD'}
                  </span>
                </div>
                <div className="text-lg font-bold text-white">
                  {completedMatchResult.realAssetName || 'Bitcoin (Rally Historique 2017)'}
                </div>
                <div className="text-xs text-amber-300 font-mono">
                  Période réelle : {completedMatchResult.realPeriod || '2017'}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed pt-1 border-t border-slate-800/80">
                  {completedMatchResult.historicalContext ||
                    "Vous avez tradé l'une des phases les plus intenses de l'histoire financière moderne."}
                </p>
              </div>

              {/* STATS COMPARISON */}
              <div className="grid grid-cols-2 gap-3 text-center mb-6">
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                  <div className="text-[11px] text-slate-400 uppercase font-semibold">Votre Score</div>
                  <div className="text-xl font-black font-mono text-cyan-400 mt-1">
                    {completedMatchResult.challengerScore} pts
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    PnL: <b className="text-emerald-400">${completedMatchResult.challengerPnl?.toLocaleString()}</b>
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                  <div className="text-[11px] text-slate-400 uppercase font-semibold">Adversaire</div>
                  <div className="text-xl font-black font-mono text-purple-400 mt-1">
                    {completedMatchResult.opponentScore} pts
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    PnL: <b className="text-purple-300">${completedMatchResult.opponentPnl?.toLocaleString()}</b>
                  </div>
                </div>
              </div>

              {/* ACTIONS */}
              <div className="flex items-center gap-3">
                <button
                  onClick={copyShareDuelResult}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all"
                >
                  {copiedShareText ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                  {copiedShareText ? 'Copié dans le presse-papier !' : 'Partager mon Résultat'}
                </button>

                <button
                  onClick={() => {
                    setShowRevealModal(false);
                    setActiveTab('lobby');
                  }}
                  className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
                >
                  <RotateCcw className="w-4 h-4" /> Revanche / Nouveau Défi
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ── 1V1 DUEL CREATION MODAL FOR ADMIN CHALLENGE ────────────────────────── */}
        {selected1v1Challenge && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-5">
              <button
                onClick={() => setSelected1v1Challenge(null)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                  <Swords className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold">
                    ⚔️ DUEL 1V1 • BLIND REPLAY
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
                    {selected1v1Challenge.assetName}
                  </h3>
                  <div className="text-xs text-amber-300 font-mono font-bold">
                    ⏱ Session de {selected1v1Challenge.durationMinutes} Minutes • Capital ${selected1v1Challenge.initialCapital.toLocaleString()}
                  </div>
                </div>
              </div>

              {!custom1v1InviteUrl ? (
                <div className="space-y-4 pt-2">
                  <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs text-slate-300 leading-relaxed">
                    🔒 <b>Effet Suspens Garanti</b> : L'actif est masqué pour vous deux. Le joueur qui réalise la meilleure performance (PnL & Drawdown) remporte le duel !
                  </div>

                  {/* OPTION 1 : DUEL IMMEDIATE VS IA QUANT */}
                  <div className="border border-slate-800 rounded-2xl p-4 bg-slate-950/40 space-y-2">
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <Bot className="w-4 h-4 text-cyan-400" /> Option 1 : Affronter l'IA Quant (Solo 1v1)
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Combattez un bot algorithmique haute fréquence immédiatement sans attendre.
                    </p>
                    <button
                      onClick={() => handleLaunchSoloChallenge(selected1v1Challenge)}
                      className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-md shadow-cyan-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Lancer contre l'IA Maintenant
                    </button>
                  </div>

                  {/* OPTION 2 : DUEL VS UN AMI */}
                  <div className="border border-purple-500/30 rounded-2xl p-4 bg-purple-950/20 space-y-3">
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-400" /> Option 2 : Inviter un Ami (Lien de Partage 1-Clic)
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-1">
                        Email de l'ami (ou laissez vide pour générer un lien libre) :
                      </label>
                      <input
                        type="email"
                        value={custom1v1FriendEmail}
                        onChange={(e) => setCustom1v1FriendEmail(e.target.value)}
                        placeholder="ami@exemple.com"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-400"
                      />
                    </div>
                    <button
                      onClick={handleCreate1v1FriendInvite}
                      disabled={isCreating1v1}
                      className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Link className="w-3.5 h-3.5" />
                      {isCreating1v1 ? 'Génération du lien...' : "🔗 Générer le Lien d'Invitation 1v1"}
                    </button>
                  </div>
                </div>
              ) : (
                /* INVITATION LINK READY VIEW */
                <div className="space-y-4 pt-2">
                  <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl space-y-2">
                    <div className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" /> Défi 1v1 Créé & Ajouté à "Mes Duels" !
                    </div>
                    <p className="text-xs text-slate-300">
                      Envoyez ce lien à votre ami. Il pourra rejoindre le match depuis n'importe quel navigateur !
                    </p>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
                    <input
                      type="text"
                      readOnly
                      value={custom1v1InviteUrl}
                      className="bg-transparent text-xs font-mono text-cyan-300 w-full focus:outline-none select-all truncate"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(custom1v1InviteUrl);
                        setCopiedCustom1v1(true);
                        setTimeout(() => setCopiedCustom1v1(false), 2500);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shrink-0 transition-colors"
                    >
                      {copiedCustom1v1 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCustom1v1 ? 'Copié !' : 'Copier'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      onClick={() => {
                        setSelected1v1Challenge(null);
                        setActiveTab('history');
                      }}
                      className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-all text-center"
                    >
                      Voir dans "Mes Duels"
                    </button>

                    <button
                      onClick={handleStart1v1ChallengerRound}
                      className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Jouer Mon Round
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
