import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Send,
  Zap,
  Activity,
  CheckCircle2,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { ChallengePhase, CreateCustomChallengePayload, CustomChallenge } from '../../types/challenge';
import { DuelPricePoint } from '../../types/duel';
import { createCustomChallenge, deleteCustomChallenge } from '../../api/challenge';
import { useToast } from '../ui';

interface CustomScenarioStudioProps {
  existingChallenges: CustomChallenge[];
  onChallengeCreated: () => void;
}

interface Waypoint {
  id: string;
  minute: number;
  pricePct: number; // Variation en % par rapport au prix initial
  hint?: string;
}

export const CustomScenarioStudio: React.FC<CustomScenarioStudioProps> = ({
  existingChallenges,
  onChallengeCreated,
}) => {
  const toast = useToast();

  // Mode Selection
  const [studioMode, setStudioMode] = useState<'CURVE_DRAW' | 'PHASES'>('CURVE_DRAW');
  const [previewView, setPreviewView] = useState<'CANDLESTICKS' | 'LINE'>('CANDLESTICKS');

  // Form State
  const [assetName, setAssetName] = useState<string>('Actif X : Quantum Energy');
  const [assetSymbol, setAssetSymbol] = useState<string>('QNTX');
  const [category, setCategory] = useState<string>('Technologie de Rupture & Énergie');
  const [description, setDescription] = useState<string>(
    "Scénario haute intensité créé par l'Admin. Accumulation, flash crash puis short squeeze parabolique."
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [initialPrice, setInitialPrice] = useState<number>(100.0);
  const [initialCapital, setInitialCapital] = useState<number>(50000);
  const [maxLeverage, setMaxLeverage] = useState<number>(5);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [hoveredCandle, setHoveredCandle] = useState<DuelPricePoint | null>(null);

  // Volatility setting for the curve
  const [curveVolatility, setCurveVolatility] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'>('HIGH');

  // Waypoints for Mode Tracé Libre
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    { id: 'w0', minute: 0, pricePct: 0, hint: "IPO / Lancement de l'Actif X" },
    { id: 'w1', minute: 3, pricePct: 15, hint: "Afflux de liquidité acheteuse" },
    { id: 'w2', minute: 7, pricePct: -28, hint: "🔴 FLASH CRASH : Vente panique" },
    { id: 'w3', minute: 11, pricePct: -5, hint: "Test du support et guerre des ordres" },
    { id: 'w4', minute: 15, pricePct: 45, hint: "🚀 SHORT SQUEEZE : Reprise parabolique" },
  ]);

  const [activeDraggingWp, setActiveDraggingWp] = useState<string | null>(null);
  const curveSvgRef = useRef<SVGSVGElement | null>(null);

  // Phases State (for Mode Phases)
  const [phases, setPhases] = useState<ChallengePhase[]>([
    {
      phaseOrder: 1,
      name: 'Accumulation Initiale',
      startMinute: 0,
      endMinute: 4,
      trendType: 'BULLISH',
      targetPriceChangePct: 10.0,
      volatilityLevel: 'LOW',
      breakingNewsHeadline: "Introduction en bourse de l'Actif X avec carnet acheteur fourni",
      breakingNewsSeverity: 'INFO',
    },
    {
      phaseOrder: 2,
      name: 'Le Flash Dump Surprise',
      startMinute: 4,
      endMinute: 8,
      trendType: 'PARABOLIC_CRASH',
      targetPriceChangePct: -32.0,
      volatilityLevel: 'EXTREME',
      breakingNewsHeadline: "Alerte Fraude : Enquête réglementaire ouverte sur l'Actif X (-32%)",
      breakingNewsSeverity: 'PANIC',
    },
    {
      phaseOrder: 3,
      name: 'Guerre de Volatilité (Whipsaws)',
      startMinute: 8,
      endMinute: 11,
      trendType: 'VOLATILE_RANGE',
      targetPriceChangePct: 5.0,
      volatilityLevel: 'HIGH',
      breakingNewsHeadline: 'Bataille féroce entre acheteurs institutionnels et vendeurs à découvert',
      breakingNewsSeverity: 'WARNING',
    },
    {
      phaseOrder: 4,
      name: 'Short Squeeze Parabolique',
      startMinute: 11,
      endMinute: 15,
      trendType: 'RECOVERY_SQUEEZE',
      targetPriceChangePct: 55.0,
      volatilityLevel: 'HIGH',
      breakingNewsHeadline: "Rachat total des positions vendeuses : Reprise historique de +55%",
      breakingNewsSeverity: 'EUPHORIA',
    },
  ]);

  // Apply Chartist Shape Presets for Curve Draw Mode
  const applyChartistPreset = (preset: 'double_bottom' | 'flash_crash_v' | 'pump_dump' | 'squeeze' | 'cup_handle') => {
    const d = durationMinutes;
    switch (preset) {
      case 'double_bottom':
        setWaypoints([
          { id: 'w0', minute: 0, pricePct: 0, hint: 'Consolidation initiale' },
          { id: 'w1', minute: Math.round(d * 0.25), pricePct: -22, hint: '1er Creux : Test du support' },
          { id: 'w2', minute: Math.round(d * 0.5), pricePct: -4, hint: 'Ligne de cou : Rebond technique' },
          { id: 'w3', minute: Math.round(d * 0.75), pricePct: -22, hint: '2ème Creux : Double Bottom validé' },
          { id: 'w4', minute: d, pricePct: 35, hint: '🚀 Breakout haussier massif (+35%)' },
        ]);
        break;
      case 'flash_crash_v':
        setWaypoints([
          { id: 'w0', minute: 0, pricePct: 0, hint: 'Marché calme' },
          { id: 'w1', minute: Math.round(d * 0.2), pricePct: 4, hint: 'Fausse stabilité' },
          { id: 'w2', minute: Math.round(d * 0.45), pricePct: -38, hint: '💥 FLASH CRASH IMMÉDIAT (-38%)' },
          { id: 'w3', minute: Math.round(d * 0.65), pricePct: -10, hint: 'Rebond en V ultra-agressif' },
          { id: 'w4', minute: d, pricePct: 25, hint: 'Reprise totale et nouveaux sommets' },
        ]);
        break;
      case 'pump_dump':
        setWaypoints([
          { id: 'w0', minute: 0, pricePct: 0, hint: 'Accumulation discrète' },
          { id: 'w1', minute: Math.round(d * 0.35), pricePct: 65, hint: '🚀 PUMP PARABOLIQUE (+65%)' },
          { id: 'w2', minute: Math.round(d * 0.55), pricePct: 70, hint: 'Sommet : Piège acheteur' },
          { id: 'w3', minute: Math.round(d * 0.8), pricePct: -30, hint: '🩸 DUMP BRUTAL : Fuite des capitaux' },
          { id: 'w4', minute: d, pricePct: -45, hint: 'Capitulation finale (-45%)' },
        ]);
        break;
      case 'squeeze':
        setWaypoints([
          { id: 'w0', minute: 0, pricePct: 0, hint: 'Pression vendeuse' },
          { id: 'w1', minute: Math.round(d * 0.3), pricePct: -15, hint: 'Accumulation des shorts' },
          { id: 'w2', minute: Math.round(d * 0.55), pricePct: 10, hint: 'Cassure du pivot' },
          { id: 'w3', minute: Math.round(d * 0.8), pricePct: 55, hint: '⚡ LIQUIDATION DES SHORTS' },
          { id: 'w4', minute: d, pricePct: 80, hint: 'Euphorie parabolique (+80%)' },
        ]);
        break;
      case 'cup_handle':
        setWaypoints([
          { id: 'w0', minute: 0, pricePct: 10, hint: 'Sommet de départ' },
          { id: 'w1', minute: Math.round(d * 0.25), pricePct: -18, hint: 'Creux arrondi de la tasse' },
          { id: 'w2', minute: Math.round(d * 0.55), pricePct: -15, hint: 'Fond de consolidation' },
          { id: 'w3', minute: Math.round(d * 0.75), pricePct: 8, hint: 'Retour au niveau supérieur' },
          { id: 'w4', minute: Math.round(d * 0.88), pricePct: 0, hint: 'Micro-retrait : Création de l’anse' },
          { id: 'w5', minute: d, pricePct: 40, hint: '🚀 Explosion haussière de l’anse (+40%)' },
        ]);
        break;
    }
  };

  // Convert Curve / Waypoints into Japanese Candlesticks (OHLCV)
  const generatedCandles: DuelPricePoint[] = useMemo(() => {
    const totalSteps = 80;
    const candles: DuelPricePoint[] = [];

    // Ensure waypoints are sorted by minute
    const sortedWp = [...waypoints].sort((a, b) => a.minute - b.minute);
    const duration = Math.max(1, durationMinutes);

    const getInterpolatedPrice = (minute: number): { price: number; hint?: string } => {
      if (sortedWp.length === 0) return { price: initialPrice };
      if (minute <= sortedWp[0].minute) {
        return {
          price: initialPrice * (1 + sortedWp[0].pricePct / 100),
          hint: sortedWp[0].hint,
        };
      }
      if (minute >= sortedWp[sortedWp.length - 1].minute) {
        const last = sortedWp[sortedWp.length - 1];
        return {
          price: initialPrice * (1 + last.pricePct / 100),
          hint: last.hint,
        };
      }

      // Find surrounding waypoints
      let idx = 0;
      while (idx < sortedWp.length - 1 && sortedWp[idx + 1].minute < minute) {
        idx++;
      }
      const wA = sortedWp[idx];
      const wB = sortedWp[idx + 1];
      const span = wB.minute - wA.minute || 1;
      const t = (minute - wA.minute) / span;

      // Cosine smooth interpolation
      const smoothT = (1 - Math.cos(t * Math.PI)) / 2;
      const pct = wA.pricePct + (wB.pricePct - wA.pricePct) * smoothT;
      const hint = t < 0.2 ? wA.hint : t > 0.8 ? wB.hint : undefined;

      return { price: Math.max(0.5, initialPrice * (1 + pct / 100)), hint };
    };

    const volMult = curveVolatility === 'LOW' ? 0.004 : curveVolatility === 'MEDIUM' ? 0.009 : curveVolatility === 'HIGH' ? 0.016 : 0.028;
    let prevClose = initialPrice;

    // Pseudorandom deterministic noise generator
    let seed = 42;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let s = 0; s < totalSteps; s++) {
      const min = (s / (totalSteps - 1)) * duration;
      const { price: targetPrice, hint } = getInterpolatedPrice(min);

      // Micro gap and intra-step noise
      const gapNoise = (random() - 0.5) * volMult * 0.5;
      const open = Math.max(0.5, Math.round(prevClose * (1 + gapNoise) * 100) / 100);

      const closeNoise = (random() - 0.5) * volMult;
      const close = Math.max(0.5, Math.round(targetPrice * (1 + closeNoise) * 100) / 100);

      // Upper and lower rejection wicks
      const candleMax = Math.max(open, close);
      const candleMin = Math.min(open, close);
      const upperWick = (random() * volMult * 1.4 + 0.002) * candleMax;
      const lowerWick = (random() * volMult * 1.4 + 0.002) * candleMin;

      const high = Math.round((candleMax + upperWick) * 100) / 100;
      const low = Math.max(0.2, Math.round((candleMin - lowerWick) * 100) / 100);

      // Volume correlates with price velocity and volatility
      const priceDelta = Math.abs(close - open) / (open || 1);
      const volume = Math.floor(18000 + priceDelta * 1200000 + random() * 35000);

      candles.push({
        step: s + 1,
        open,
        high,
        low,
        close,
        volume,
        hint: hint || null,
      });

      prevClose = close;
    }

    return candles;
  }, [waypoints, durationMinutes, initialPrice, curveVolatility]);

  // Derive Phases from generated candles for backwards compatibility
  const derivedPhases: ChallengePhase[] = useMemo(() => {
    if (generatedCandles.length === 0) return phases;
    const quarter = Math.max(1, Math.floor(generatedCandles.length / 4));
    const res: ChallengePhase[] = [];

    for (let i = 0; i < 4; i++) {
      const startIdx = i * quarter;
      const endIdx = i === 3 ? generatedCandles.length - 1 : Math.min(generatedCandles.length - 1, (i + 1) * quarter);
      const cStart = generatedCandles[startIdx];
      const cEnd = generatedCandles[endIdx];

      const openP = cStart.open;
      const closeP = cEnd.close;
      const deltaPct = openP > 0 ? ((closeP - openP) / openP) * 100 : 0;

      const startMin = Math.round((i / 4) * durationMinutes);
      const endMin = Math.round(((i + 1) / 4) * durationMinutes);

      let trend: ChallengePhase['trendType'] = 'VOLATILE_RANGE';
      if (deltaPct > 12) trend = 'RECOVERY_SQUEEZE';
      else if (deltaPct > 4) trend = 'BULLISH';
      else if (deltaPct < -15) trend = 'PARABOLIC_CRASH';
      else if (deltaPct < -4) trend = 'BEARISH';

      res.push({
        phaseOrder: i + 1,
        name: `Phase ${i + 1} (${startMin}m ➔ ${endMin}m)`,
        startMinute: startMin,
        endMinute: endMin,
        trendType: trend,
        targetPriceChangePct: Math.round(deltaPct * 10) / 10,
        volatilityLevel: curveVolatility,
        breakingNewsHeadline:
          i === 0
            ? "Introduction de l'Actif X et première découverte de prix"
            : i === 1
            ? 'Pic de volatilité et afflux institutionnel'
            : i === 2
            ? 'Bataille acharnée sur les supports chartistes'
            : 'Sprint final et dénouement des positions ouvertes',
        breakingNewsSeverity: deltaPct < -12 ? 'PANIC' : deltaPct > 12 ? 'EUPHORIA' : 'INFO',
      });
    }

    return res;
  }, [generatedCandles, durationMinutes, curveVolatility, phases]);

  // Bounds for Chart Drawing & Preview
  const chartBounds = useMemo(() => {
    if (generatedCandles.length === 0) return { minP: 50, maxP: 150, range: 100, finalPrice: initialPrice };
    let minP = Infinity;
    let maxP = -Infinity;
    generatedCandles.forEach((c) => {
      if (c.low < minP) minP = c.low;
      if (c.high > maxP) maxP = c.high;
    });
    // Add margin
    const pad = (maxP - minP) * 0.08 || 5;
    minP = Math.max(0.1, minP - pad);
    maxP = maxP + pad;
    const range = maxP - minP || 1;
    const finalPrice = generatedCandles[generatedCandles.length - 1]?.close || initialPrice;
    return { minP, maxP, range, finalPrice };
  }, [generatedCandles, initialPrice]);

  // Handle Dragging Waypoints on the Canvas
  const handleSvgPointerDown = (wpId: string) => {
    setActiveDraggingWp(wpId);
  };

  const handleSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!activeDraggingWp || !curveSvgRef.current) return;
      const rect = curveSvgRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const normX = Math.max(0, Math.min(1, clientX / rect.width));
      const normY = Math.max(0, Math.min(1, clientY / rect.height));

      // Map normX to minute (except start which is minute 0 and end which is durationMinutes)
      const targetMin = Math.round(normX * durationMinutes * 10) / 10;
      // Map normY to pricePct (-60% at bottom, +100% at top)
      const targetPct = Math.round((1 - normY) * 160 - 60);

      setWaypoints((prev) =>
        prev.map((wp) => {
          if (wp.id !== activeDraggingWp) return wp;
          // Don't change minute for first or last point
          const isFirst = wp.id === 'w0';
          const isLast = wp.id === prev[prev.length - 1].id;
          return {
            ...wp,
            minute: isFirst ? 0 : isLast ? durationMinutes : targetMin,
            pricePct: targetPct,
          };
        })
      );
    },
    [activeDraggingWp, durationMinutes]
  );

  const handleSvgPointerUp = () => {
    setActiveDraggingWp(null);
  };

  // Add new Waypoint on double click
  const handleSvgDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!curveSvgRef.current) return;
    const rect = curveSvgRef.current.getBoundingClientRect();
    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const min = Math.round(normX * durationMinutes * 10) / 10;
    const targetPct = Math.round((1 - normY) * 160 - 60);

    const newId = `w_${Date.now()}`;
    const newWp: Waypoint = {
      id: newId,
      minute: min,
      pricePct: targetPct,
      hint: `Point clé à ${min} min`,
    };

    setWaypoints((prev) => [...prev, newWp].sort((a, b) => a.minute - b.minute));
    toast.info('Point Clé Ajouté', `Nouveau niveau tracé à ${min} min (${targetPct > 0 ? '+' : ''}${targetPct}%).`);
  };

  const handleRemoveWaypoint = (id: string) => {
    if (waypoints.length <= 2) {
      toast.error('Impossible', 'Le tracé doit conserver au minimum le point de départ et le point de fin.');
      return;
    }
    setWaypoints((prev) => prev.filter((w) => w.id !== id));
  };

  // Submit Challenge Creation
  const handlePublishChallenge = async () => {
    if (!assetName.trim() || !assetSymbol.trim()) {
      toast.error('Champs manquants', "Veuillez renseigner le nom et le symbole de l'Actif X.");
      return;
    }

    try {
      setIsSubmitting(true);
      const effectivePhases = studioMode === 'CURVE_DRAW' ? derivedPhases : phases;

      const payload: CreateCustomChallengePayload = {
        assetName: assetName.trim(),
        assetSymbol: assetSymbol.trim().toUpperCase(),
        category: category.trim(),
        description: description.trim(),
        durationMinutes,
        initialPrice,
        initialCapital,
        maxLeverage,
        phases: effectivePhases,
        customTrajectory: studioMode === 'CURVE_DRAW' ? generatedCandles : undefined,
      };

      await createCustomChallenge(payload);
      toast.success(
        'Challenge Officiel Publié !',
        `Le défi "${assetName}" (${durationMinutes} min) avec ses chandeliers japonais est désormais accessible en Solo ou 1v1.`
      );
      onChallengeCreated();
    } catch (err: any) {
      toast.error('Erreur de Publication', err?.message || 'Impossible de créer le challenge.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Voulez-vous vraiment supprimer ce challenge ?')) return;
    try {
      await deleteCustomChallenge(id);
      toast.success('Défi Supprimé', 'Le challenge a été retiré.');
      onChallengeCreated();
    } catch (err: any) {
      toast.error('Erreur', err?.message || 'Impossible de supprimer.');
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* HEADER BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/70 border border-purple-500/30 p-7 shadow-2xl">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold font-mono mb-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" /> STUDIO MAÎTRE DU JEU • SCÉNARIOS & COURBES SUR-MESURE
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Créez un <span className="text-purple-400">Actif X</span> & Tracez sa Courbe de Prix
          </h2>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Tracez manuellement la trajectoire de l'actif ou sculptez-la avec nos figures chartistes. Le moteur transforme
            instantanément votre dessin en <b>chandeliers japonais ultra-réalistes</b> avec mèches, volumes et stop loss / take profit
            pour les joueurs en live !
          </p>
        </div>
      </div>

      {/* MODE SELECTOR */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 p-2 rounded-2xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStudioMode('CURVE_DRAW')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              studioMode === 'CURVE_DRAW'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" /> 🎨 Mode Tracé Libre & Courbe Interactive
          </button>
          <button
            type="button"
            onClick={() => setStudioMode('PHASES')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              studioMode === 'PHASES'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" /> 📋 Mode Découpage par Phases (3-4 min)
          </button>
        </div>

        <div className="text-xs text-slate-400 font-mono hidden sm:block pr-2">
          Durée : <span className="text-purple-300 font-bold">{durationMinutes} min</span> • Actif :{' '}
          <span className="text-white font-bold">{assetSymbol}</span>
        </div>
      </div>

      {/* MAIN TWO-COLUMN FORM & PREVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: ASSET CONFIGURATION & TIMELINE / DRAW (7 COLS) */}
        <div className="lg:col-span-7 space-y-6">
          {/* SECTION 1: PROPRIÉTÉS DE L'ACTIF X */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" /> 1. Fiche d'Identité de l'Actif X
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Nom de l'Actif X</label>
                <input
                  type="text"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="ex: Actif X : Quantum Energy"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Ticker / Symbole</label>
                <input
                  type="text"
                  value={assetSymbol}
                  onChange={(e) => setAssetSymbol(e.target.value.toUpperCase())}
                  placeholder="ex: QNTX"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Catégorie Marché</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="ex: Technologie de Rupture & Énergie"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Prix Initial ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={initialPrice}
                  onChange={(e) => setInitialPrice(parseFloat(e.target.value) || 100)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">Description & Lore du Défi</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
              />
            </div>

            {/* DURÉE & CAPITAL */}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Durée Session</label>
                <div className="flex items-center gap-1">
                  {[10, 15, 20, 30].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setDurationMinutes(dur)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                        durationMinutes === dur
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {dur}m
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Capital Initial</label>
                <select
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-400"
                >
                  <option value={10000}>$10 000</option>
                  <option value={50000}>$50 000</option>
                  <option value={100000}>$100 000</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Levier Max</label>
                <select
                  value={maxLeverage}
                  onChange={(e) => setMaxLeverage(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-400"
                >
                  <option value={1}>1x (Aucun)</option>
                  <option value={2}>2x</option>
                  <option value={5}>5x</option>
                  <option value={10}>10x</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: CANVAS DE TRACÉ LIBRE OU PHASES */}
          {studioMode === 'CURVE_DRAW' ? (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-400" /> 2. Tracé Manuel de la Courbe ({waypoints.length} Points Clés)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Faites glisser les points interactifs ou double-cliquez pour en ajouter. Le tracé s'adapte en temps réel.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Micro-Volatilité:</span>
                  <select
                    value={curveVolatility}
                    onChange={(e) => setCurveVolatility(e.target.value as any)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-purple-300 font-mono focus:outline-none"
                  >
                    <option value="LOW">Faible (Lisse)</option>
                    <option value="MEDIUM">Moyenne</option>
                    <option value="HIGH">Élevée (Réaliste)</option>
                    <option value="EXTREME">Extrême (Tempête)</option>
                  </select>
                </div>
              </div>

              {/* QUICK CHARTIST SHAPES PRESETS */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Formes Chartistes Clés (Génération 1-Clic) :
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'double_bottom', label: '👑 Double Creux (W)', color: 'hover:border-emerald-500/50 hover:bg-emerald-500/10' },
                    { id: 'flash_crash_v', label: '💥 Krach Flash & V', color: 'hover:border-rose-500/50 hover:bg-rose-500/10' },
                    { id: 'pump_dump', label: '🚀 Pump & Dump', color: 'hover:border-amber-500/50 hover:bg-amber-500/10' },
                    { id: 'squeeze', label: '⚡ Short Squeeze', color: 'hover:border-cyan-500/50 hover:bg-cyan-500/10' },
                    { id: 'cup_handle', label: '☕ Tasse avec Anse', color: 'hover:border-purple-500/50 hover:bg-purple-500/10' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyChartistPreset(p.id as any)}
                      className={`p-2 rounded-xl border border-slate-800 bg-slate-950 text-[11px] font-semibold text-slate-300 text-center transition-all ${p.color}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* INTERACTIVE DRAWING CANVAS (SVG) */}
              <div className="h-64 w-full bg-slate-950 rounded-xl p-3 border border-slate-800/80 relative select-none">
                <svg
                  ref={curveSvgRef}
                  className="w-full h-full cursor-crosshair"
                  viewBox="0 0 600 220"
                  preserveAspectRatio="none"
                  onPointerMove={handleSvgPointerMove}
                  onPointerUp={handleSvgPointerUp}
                  onDoubleClick={handleSvgDoubleClick}
                >
                  <defs>
                    <linearGradient id="curveDrawGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Guide Lines */}
                  {[30, 75, 120, 165, 200].map((y) => (
                    <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" />
                  ))}

                  {/* Base zero price line (Initial price line) */}
                  <line x1="0" y1="137.5" x2="600" y2="137.5" stroke="#64748b" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />

                  {/* Interpolated curve path fill */}
                  {generatedCandles.length > 1 && (
                    <path
                      d={`M 0 220 ${generatedCandles
                        .map((c, i) => {
                          const x = (i / (generatedCandles.length - 1)) * 600;
                          const y = 220 - ((c.close - chartBounds.minP) / chartBounds.range) * 190 - 15;
                          return `L ${x} ${y}`;
                        })
                        .join(' ')} L 600 220 Z`}
                      fill="url(#curveDrawGrad)"
                    />
                  )}

                  {/* Interpolated curve line */}
                  {generatedCandles.length > 1 && (
                    <path
                      d={`M 0 ${220 - ((generatedCandles[0].close - chartBounds.minP) / chartBounds.range) * 190 - 15} ${generatedCandles
                        .map((c, i) => {
                          const x = (i / (generatedCandles.length - 1)) * 600;
                          const y = 220 - ((c.close - chartBounds.minP) / chartBounds.range) * 190 - 15;
                          return `L ${x} ${y}`;
                        })
                        .join(' ')}`}
                      fill="none"
                      stroke="#c084fc"
                      strokeWidth="2.5"
                    />
                  )}

                  {/* Interactive Draggable Waypoint Handles */}
                  {waypoints.map((wp) => {
                    const normX = (wp.minute / durationMinutes) * 600;
                    // Y calculation: pricePct maps to height
                    const currentPrice = initialPrice * (1 + wp.pricePct / 100);
                    const normY = 220 - ((currentPrice - chartBounds.minP) / chartBounds.range) * 190 - 15;
                    const isDragging = activeDraggingWp === wp.id;

                    return (
                      <g key={wp.id} className="cursor-grab active:cursor-grabbing">
                        {/* Ping ripple when dragging */}
                        {isDragging && <circle cx={normX} cy={normY} r="14" fill="#a855f7" opacity="0.3" />}

                        {/* Outer Glow */}
                        <circle
                          cx={normX}
                          cy={normY}
                          r="8"
                          fill="#1e1b4b"
                          stroke={wp.pricePct >= 0 ? '#34d399' : '#f43f5e'}
                          strokeWidth="2.5"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            handleSvgPointerDown(wp.id);
                          }}
                        />

                        {/* Inner Dot */}
                        <circle cx={normX} cy={normY} r="3.5" fill="#ffffff" pointerEvents="none" />

                        {/* Label */}
                        <text
                          x={normX}
                          y={normY - 12}
                          textAnchor="middle"
                          fill="#e2e8f0"
                          fontSize="10"
                          fontWeight="bold"
                          fontFamily="monospace"
                          pointerEvents="none"
                        >
                          {wp.minute}m ({wp.pricePct > 0 ? '+' : ''}
                          {wp.pricePct}%)
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Helper overlay instructions */}
                <div className="absolute top-2 left-3 flex items-center gap-2 text-[10px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                  <span>💡 Double-clic : Ajouter un point</span>
                  <span>•</span>
                  <span>Glisser : Modifier niveau</span>
                </div>
              </div>

              {/* LIST OF CURRENT WAYPOINTS WITH NEWS HEADLINE INPUT */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300">Points Chartistes & Chocs de Marché :</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {waypoints.map((wp) => (
                    <div
                      key={wp.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs font-mono font-bold">
                          <span className="text-purple-400">⏱ {wp.minute} min</span>
                          <span className={wp.pricePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {wp.pricePct > 0 ? '+' : ''}
                            {wp.pricePct}% (${(initialPrice * (1 + wp.pricePct / 100)).toFixed(2)})
                          </span>
                        </div>
                        <input
                          type="text"
                          value={wp.hint || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setWaypoints((prev) => prev.map((w) => (w.id === wp.id ? { ...w, hint: val } : w)));
                          }}
                          placeholder="Headline / Alerte news..."
                          className="w-full bg-slate-900/60 border border-slate-800 rounded px-2 py-0.5 text-[11px] text-amber-300 placeholder-slate-600 focus:outline-none mt-1"
                        />
                      </div>

                      {wp.id !== 'w0' && wp.id !== waypoints[waypoints.length - 1]?.id && (
                        <button
                          type="button"
                          onClick={() => handleRemoveWaypoint(wp.id)}
                          className="text-slate-600 hover:text-rose-400 p-1"
                          title="Supprimer ce point"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* SECTION 2 (ALTERNATIVE): MODE PHASES */
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" /> Chronologie des Phases ({phases.length})
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    const last = phases[phases.length - 1];
                    const startMin = last ? last.endMinute : 0;
                    const endMin = Math.min(durationMinutes, startMin + 3);
                    setPhases([
                      ...phases,
                      {
                        phaseOrder: phases.length + 1,
                        name: `Phase ${phases.length + 1}`,
                        startMinute: startMin,
                        endMinute: endMin > startMin ? endMin : startMin + 2,
                        trendType: 'VOLATILE_RANGE',
                        targetPriceChangePct: 8.0,
                        volatilityLevel: 'MEDIUM',
                        breakingNewsHeadline: 'Nouveau développement de marché',
                        breakingNewsSeverity: 'INFO',
                      },
                    ]);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter Phase
                </button>
              </div>

              <div className="space-y-3">
                {phases.map((phase, idx) => (
                  <div key={idx} className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 text-[11px] font-mono font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={phase.name}
                          onChange={(e) =>
                            setPhases((prev) => prev.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p)))
                          }
                          className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-purple-400 text-xs font-bold text-white focus:outline-none px-1"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-slate-400">
                          {phase.startMinute}m ➔ {phase.endMinute}m
                        </span>
                        {phases.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setPhases(phases.filter((_, i) => i !== idx))}
                            className="text-slate-600 hover:text-rose-400 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Variation Cible (%)</label>
                        <input
                          type="number"
                          value={phase.targetPriceChangePct}
                          onChange={(e) =>
                            setPhases((prev) =>
                              prev.map((p, i) =>
                                i === idx ? { ...p, targetPriceChangePct: parseFloat(e.target.value) || 0 } : p
                              )
                            )
                          }
                          className={`w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono font-bold focus:outline-none ${
                            phase.targetPriceChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Volatilité</label>
                        <select
                          value={phase.volatilityLevel}
                          onChange={(e) =>
                            setPhases((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, volatilityLevel: e.target.value as any } : p))
                            )
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none"
                        >
                          <option value="LOW">Faible</option>
                          <option value="MEDIUM">Moyenne</option>
                          <option value="HIGH">Élevée</option>
                          <option value="EXTREME">Extrême</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Gravité News</label>
                        <select
                          value={phase.breakingNewsSeverity}
                          onChange={(e) =>
                            setPhases((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, breakingNewsSeverity: e.target.value as any } : p))
                            )
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none"
                        >
                          <option value="INFO">Info Neutre</option>
                          <option value="WARNING">Alerte</option>
                          <option value="PANIC">Panique</option>
                          <option value="EUPHORIA">Euphorie</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: CANDLESTICK / LINE PREVIEW & PUBLISH (5 COLS) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 sticky top-24 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  APERÇU DU CHALLENGE ({durationMinutes} MIN)
                </span>
                <h3 className="text-base font-bold text-white font-mono mt-1">{assetName}</h3>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-400">Prix Final Est.</div>
                <div className="text-base font-black font-mono text-emerald-400">
                  ${chartBounds.finalPrice.toFixed(2)}
                </div>
              </div>
            </div>

            {/* PREVIEW MODE TOGGLE : CANDLESTICKS VS LINE */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Format d'Affichage :</span>
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
                <button
                  type="button"
                  onClick={() => setPreviewView('CANDLESTICKS')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    previewView === 'CANDLESTICKS'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🕯️ Chandeliers (OHLC)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewView('LINE')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    previewView === 'LINE'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📈 Ligne Continue
                </button>
              </div>
            </div>

            {/* CANDLESTICK / LINE CHART VIEWPORT */}
            <div className="h-64 w-full bg-slate-950 rounded-xl p-2 border border-slate-800/80 relative overflow-hidden flex flex-col justify-between">
              <svg className="w-full h-44" viewBox="0 0 600 180" preserveAspectRatio="none">
                {/* Horizontal reference lines */}
                {[30, 75, 120, 160].map((y) => (
                  <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3 3" />
                ))}

                {previewView === 'CANDLESTICKS' ? (
                  /* JAPANESE CANDLESTICKS RENDERING */
                  <g>
                    {generatedCandles.map((c, idx) => {
                      const total = generatedCandles.length;
                      const candleWidth = Math.max(3, (600 / total) * 0.75);
                      const x = (idx / (total - 1)) * (600 - candleWidth) + candleWidth / 2;

                      const isBullish = c.close >= c.open;
                      const candleColor = isBullish ? '#10b981' : '#f43f5e';

                      const yHigh = 180 - ((c.high - chartBounds.minP) / chartBounds.range) * 160 - 10;
                      const yLow = 180 - ((c.low - chartBounds.minP) / chartBounds.range) * 160 - 10;
                      const yOpen = 180 - ((c.open - chartBounds.minP) / chartBounds.range) * 160 - 10;
                      const yClose = 180 - ((c.close - chartBounds.minP) / chartBounds.range) * 160 - 10;

                      const bodyTop = Math.min(yOpen, yClose);
                      const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

                      return (
                        <g
                          key={c.step}
                          className="cursor-pointer transition-opacity hover:opacity-80"
                          onMouseEnter={() => setHoveredCandle(c)}
                          onMouseLeave={() => setHoveredCandle(null)}
                        >
                          {/* Upper and lower wick */}
                          <line
                            x1={x}
                            y1={yHigh}
                            x2={x}
                            y2={yLow}
                            stroke={candleColor}
                            strokeWidth="1.2"
                          />

                          {/* Candle body rectangle */}
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
                    {generatedCandles.length > 1 && (
                      <path
                        d={`M 0 ${180 - ((generatedCandles[0].close - chartBounds.minP) / chartBounds.range) * 160 - 10} ${generatedCandles
                          .map((c, i) => {
                            const x = (i / (generatedCandles.length - 1)) * 600;
                            const y = 180 - ((c.close - chartBounds.minP) / chartBounds.range) * 160 - 10;
                            return `L ${x} ${y}`;
                          })
                          .join(' ')}`}
                        fill="none"
                        stroke="#c084fc"
                        strokeWidth="2.5"
                      />
                    )}
                  </g>
                )}
              </svg>

              {/* VOLUME HISTOGRAM AT BOTTOM */}
              <div className="h-10 w-full pt-1 border-t border-slate-900">
                <svg className="w-full h-full" viewBox="0 0 600 40" preserveAspectRatio="none">
                  {generatedCandles.map((c, idx) => {
                    const total = generatedCandles.length;
                    const w = Math.max(2, (600 / total) * 0.7);
                    const x = (idx / (total - 1)) * (600 - w) + w / 2;
                    const isBullish = c.close >= c.open;
                    const barHeight = Math.min(36, Math.max(4, (c.volume / 80000) * 36));

                    return (
                      <rect
                        key={c.step}
                        x={x - w / 2}
                        y={40 - barHeight}
                        width={w}
                        height={barHeight}
                        fill={isBullish ? '#10b981' : '#f43f5e'}
                        opacity="0.5"
                      />
                    );
                  })}
                </svg>
              </div>

              {/* HOVER TOOLTIP */}
              {hoveredCandle ? (
                <div className="absolute top-2 right-2 bg-slate-900/95 border border-slate-700 rounded-lg p-2 text-[10px] font-mono text-slate-300 shadow-xl pointer-events-none">
                  <div>Bougie #{hoveredCandle.step}</div>
                  <div className="text-white">
                    O: ${hoveredCandle.open} • H: ${hoveredCandle.high} • L: ${hoveredCandle.low} • C: ${hoveredCandle.close}
                  </div>
                  <div className="text-slate-400">Vol: {hoveredCandle.volume.toLocaleString()}</div>
                  {hoveredCandle.hint && <div className="text-amber-400 font-bold mt-0.5">{hoveredCandle.hint}</div>}
                </div>
              ) : (
                <div className="absolute bottom-11 left-3 text-[10px] font-mono text-slate-500">
                  Min: ${chartBounds.minP.toFixed(2)} • Max: ${chartBounds.maxP.toFixed(2)}
                </div>
              )}
            </div>

            {/* SUMMARY STATS OF THE CHALLENGE */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-500 text-[10px] block">FORMAT</span>
                <span className="font-bold text-purple-300">🕯️ Chandeliers Japonais</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">CAPITAL / LEVIER</span>
                <span className="font-bold text-white">
                  ${initialCapital.toLocaleString()} ({maxLeverage}x)
                </span>
              </div>
            </div>

            {/* PUBLISH BUTTON */}
            <button
              type="button"
              onClick={handlePublishChallenge}
              disabled={isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-extrabold text-sm rounded-xl shadow-xl shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'Publication en cours...' : 'CONFIRMER & PUBLIER LE DÉFI (CHANDELIERS)'}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: LIST OF ALREADY PUBLISHED CHALLENGES */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Défis Déjà Publiés & En Ligne ({existingChallenges.length})
        </h3>

        {existingChallenges.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
            Aucun défi officiel créé pour l'instant. Utilisez le formulaire ci-dessus pour publier le premier !
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {existingChallenges.map((c) => (
              <div key={c.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono font-bold text-purple-400">{c.assetSymbol}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                      ⏱ {c.durationMinutes} MIN
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{c.assetName}</h4>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{c.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-400">Prix: ${c.initialPrice}</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="text-rose-400 hover:text-rose-300 flex items-center gap-1 text-[11px] font-bold"
                  >
                    <Trash2 className="w-3 h-3" /> Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
