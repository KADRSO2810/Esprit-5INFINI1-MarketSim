import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Send,
  Zap,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { ChallengePhase, CreateCustomChallengePayload, CustomChallenge } from '../../types/challenge';
import { createCustomChallenge, deleteCustomChallenge } from '../../api/challenge';
import { useToast } from '../ui';

interface CustomScenarioStudioProps {
  existingChallenges: CustomChallenge[];
  onChallengeCreated: () => void;
}

export const CustomScenarioStudio: React.FC<CustomScenarioStudioProps> = ({
  existingChallenges,
  onChallengeCreated,
}) => {
  const toast = useToast();

  // Form State
  const [assetName, setAssetName] = useState<string>('Actif X : Quantum Energy');
  const [assetSymbol, setAssetSymbol] = useState<string>('QNTX');
  const [category, setCategory] = useState<string>('Technologie de Rupture & Énergie');
  const [description, setDescription] = useState<string>(
    "Scénario haute intensité créé par l'Admin. 15 minutes d'accumulation, flash crash et short squeeze parabolique."
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [initialPrice, setInitialPrice] = useState<number>(100.0);
  const [initialCapital, setInitialCapital] = useState<number>(50000);
  const [maxLeverage, setMaxLeverage] = useState<number>(5);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Phases State
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

  // Template Quick Presets
  const applyPreset = (presetKey: 'dump_squeeze' | 'bear_market' | 'super_cycle' | 'rollercoaster') => {
    switch (presetKey) {
      case 'dump_squeeze':
        setDurationMinutes(15);
        setPhases([
          {
            phaseOrder: 1,
            name: 'Accumulation Calme',
            startMinute: 0,
            endMinute: 4,
            trendType: 'BULLISH',
            targetPriceChangePct: 8.0,
            volatilityLevel: 'LOW',
            breakingNewsHeadline: "IPO de l'Actif X sous afflux de capitaux",
            breakingNewsSeverity: 'INFO',
          },
          {
            phaseOrder: 2,
            name: 'Krach Éclair & Purge',
            startMinute: 4,
            endMinute: 8,
            trendType: 'PARABOLIC_CRASH',
            targetPriceChangePct: -35.0,
            volatilityLevel: 'EXTREME',
            breakingNewsHeadline: "Rupture de partenariat majeure (-35%)",
            breakingNewsSeverity: 'PANIC',
          },
          {
            phaseOrder: 3,
            name: 'Support & Faux Rebonds',
            startMinute: 8,
            endMinute: 11,
            trendType: 'VOLATILE_RANGE',
            targetPriceChangePct: 6.0,
            volatilityLevel: 'HIGH',
            breakingNewsHeadline: 'Test du support plancher',
            breakingNewsSeverity: 'WARNING',
          },
          {
            phaseOrder: 4,
            name: 'Short Squeeze Record',
            startMinute: 11,
            endMinute: 15,
            trendType: 'RECOVERY_SQUEEZE',
            targetPriceChangePct: 60.0,
            volatilityLevel: 'HIGH',
            breakingNewsHeadline: "Offre publique d'achat surprise (+60%)",
            breakingNewsSeverity: 'EUPHORIA',
          },
        ]);
        break;

      case 'bear_market':
        setDurationMinutes(20);
        setPhases([
          {
            phaseOrder: 1,
            name: 'Érosion Lente',
            startMinute: 0,
            endMinute: 7,
            trendType: 'BEARISH',
            targetPriceChangePct: -15.0,
            volatilityLevel: 'MEDIUM',
            breakingNewsHeadline: 'Ralentissement des commandes trimestrielles',
            breakingNewsSeverity: 'WARNING',
          },
          {
            phaseOrder: 2,
            name: 'Panique Générale',
            startMinute: 7,
            endMinute: 14,
            trendType: 'PARABOLIC_CRASH',
            targetPriceChangePct: -45.0,
            volatilityLevel: 'EXTREME',
            breakingNewsHeadline: 'Dégradation de note de crédit en catégorie spéculative',
            breakingNewsSeverity: 'PANIC',
          },
          {
            phaseOrder: 3,
            name: 'Rebond du Chat Mort (Dead Cat Bounce)',
            startMinute: 14,
            endMinute: 20,
            trendType: 'VOLATILE_RANGE',
            targetPriceChangePct: 12.0,
            volatilityLevel: 'HIGH',
            breakingNewsHeadline: 'Rachats techniques opportunistes',
            breakingNewsSeverity: 'INFO',
          },
        ]);
        break;

      case 'super_cycle':
        setDurationMinutes(30);
        setPhases([
          {
            phaseOrder: 1,
            name: 'Cassure de Résistance',
            startMinute: 0,
            endMinute: 10,
            trendType: 'BULLISH',
            targetPriceChangePct: 25.0,
            volatilityLevel: 'MEDIUM',
            breakingNewsHeadline: 'Brevet révolutionnaire validé',
            breakingNewsSeverity: 'INFO',
          },
          {
            phaseOrder: 2,
            name: 'FOMO Massif',
            startMinute: 10,
            endMinute: 22,
            trendType: 'RECOVERY_SQUEEZE',
            targetPriceChangePct: 75.0,
            volatilityLevel: 'HIGH',
            breakingNewsHeadline: 'Ruée des hedge funds et investisseurs particuliers',
            breakingNewsSeverity: 'EUPHORIA',
          },
          {
            phaseOrder: 3,
            name: 'Prise de Bénéfices Institutionnelle',
            startMinute: 22,
            endMinute: 30,
            trendType: 'BEARISH',
            targetPriceChangePct: -20.0,
            volatilityLevel: 'HIGH',
            breakingNewsHeadline: 'Distribution massive des insiders au sommet',
            breakingNewsSeverity: 'WARNING',
          },
        ]);
        break;

      case 'rollercoaster':
        setDurationMinutes(10);
        setPhases([
          {
            phaseOrder: 1,
            name: 'Pic Volatilité 1',
            startMinute: 0,
            endMinute: 3,
            trendType: 'BULLISH',
            targetPriceChangePct: 20.0,
            volatilityLevel: 'HIGH',
            breakingNewsHeadline: 'Rumeur de rachat',
            breakingNewsSeverity: 'INFO',
          },
          {
            phaseOrder: 2,
            name: 'Démenti & Chute',
            startMinute: 3,
            endMinute: 6,
            trendType: 'PARABOLIC_CRASH',
            targetPriceChangePct: -30.0,
            volatilityLevel: 'EXTREME',
            breakingNewsHeadline: 'Démenti officiel du rachat',
            breakingNewsSeverity: 'PANIC',
          },
          {
            phaseOrder: 3,
            name: 'Contre-Attaque',
            startMinute: 6,
            endMinute: 10,
            trendType: 'RECOVERY_SQUEEZE',
            targetPriceChangePct: 40.0,
            volatilityLevel: 'EXTREME',
            breakingNewsHeadline: 'Entrée surprise d’un fonds activiste',
            breakingNewsSeverity: 'EUPHORIA',
          },
        ]);
        break;
    }
  };

  // Add Phase
  const handleAddPhase = () => {
    const lastPhase = phases[phases.length - 1];
    const startMin = lastPhase ? lastPhase.endMinute : 0;
    const endMin = Math.min(durationMinutes, startMin + 4);

    const newPhase: ChallengePhase = {
      phaseOrder: phases.length + 1,
      name: `Phase ${phases.length + 1}`,
      startMinute: startMin,
      endMinute: endMin > startMin ? endMin : startMin + 2,
      trendType: 'VOLATILE_RANGE',
      targetPriceChangePct: 10.0,
      volatilityLevel: 'MEDIUM',
      breakingNewsHeadline: 'Nouveau développement de marché',
      breakingNewsSeverity: 'INFO',
    };
    setPhases([...phases, newPhase]);
  };

  // Remove Phase
  const handleRemovePhase = (index: number) => {
    if (phases.length <= 1) {
      toast.error('Erreur', 'Un scénario doit contenir au moins une phase.');
      return;
    }
    setPhases(phases.filter((_, i) => i !== index));
  };

  // Update Phase
  const handleUpdatePhase = (index: number, updatedFields: Partial<ChallengePhase>) => {
    setPhases((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...updatedFields } : p))
    );
  };

  // Real-time Preview Points Simulation
  const previewPoints = useMemo(() => {
    const pts: { x: number; y: number; price: number; hint?: string }[] = [];
    let p = initialPrice;
    const totalSteps = 60;

    for (let s = 0; s < totalSteps; s++) {
      const min = (s / totalSteps) * durationMinutes;
      const activePhase =
        phases.find((phase) => min >= phase.startMinute && min <= phase.endMinute) ||
        phases[phases.length - 1];

      const phaseTarget = activePhase?.targetPriceChangePct || 0;
      const phaseSteps = Math.max(1, totalSteps / Math.max(1, phases.length));
      const drift = (phaseTarget / 100) / phaseSteps;
      const noise = Math.sin(s * 0.9) * 0.015;

      p = Math.max(1, p * (1 + drift + noise));
      pts.push({
        x: s,
        y: p,
        price: Math.round(p * 100) / 100,
        hint: activePhase?.breakingNewsHeadline,
      });
    }

    const minP = Math.min(...pts.map((pt) => pt.price));
    const maxP = Math.max(...pts.map((pt) => pt.price));
    const range = maxP - minP || 1;

    return {
      pts: pts.map((pt) => ({
        ...pt,
        normX: (pt.x / (totalSteps - 1)) * 560 + 20,
        normY: 170 - ((pt.price - minP) / range) * 140,
      })),
      minPrice: minP,
      maxPrice: maxP,
      finalPrice: pts[pts.length - 1]?.price || initialPrice,
    };
  }, [phases, initialPrice, durationMinutes]);

  // Submit Challenge Creation
  const handlePublishChallenge = async () => {
    if (!assetName.trim() || !assetSymbol.trim()) {
      toast.error('Champs manquants', "Veuillez renseigner le nom et le symbole de l'Actif X.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: CreateCustomChallengePayload = {
        assetName: assetName.trim(),
        assetSymbol: assetSymbol.trim().toUpperCase(),
        category: category.trim(),
        description: description.trim(),
        durationMinutes,
        initialPrice,
        initialCapital,
        maxLeverage,
        phases,
      };

      await createCustomChallenge(payload);
      toast.success(
        'Challenge Officiel Publié !',
        `Le défi "${assetName}" (${durationMinutes} min) est maintenant accessible pour tous les traders de la plateforme.`
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950/70 via-slate-900 to-indigo-950/60 border border-purple-500/30 p-7 shadow-2xl">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold font-mono mb-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" /> STUDIO MAÎTRE DU JEU • SCÉNARIOS SUR-MESURE
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Créez un <span className="text-purple-400">Actif X</span> & Confectionnez son Histoire
          </h2>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Façonnez un actif synthétique, définissez ses chocs, rédigez vos propres alertes news et publiez un défi officiel de 10, 20 ou 30 minutes que tous les étudiants et traders pourront jouer en Solo ou en 1v1.
          </p>
        </div>
      </div>

      {/* QUICK PRESETS */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Modèles de Scénarios Rapides (Templates 1-Clic) :
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: 'dump_squeeze', label: '⚡ Flash Dump & Squeeze (15 min)', color: 'border-cyan-500/30 hover:bg-cyan-500/10' },
            { id: 'bear_market', label: '💥 Krach Prolongé (20 min)', color: 'border-rose-500/30 hover:bg-rose-500/10' },
            { id: 'super_cycle', label: '🚀 Super-Cycle Parabolique (30 min)', color: 'border-emerald-500/30 hover:bg-emerald-500/10' },
            { id: 'rollercoaster', label: '🎢 Montagnes Russes (10 min)', color: 'border-amber-500/30 hover:bg-amber-500/10' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyPreset(t.id as any)}
              className={`p-3 rounded-xl border bg-slate-900/60 text-slate-300 text-xs font-semibold text-left transition-all ${t.color}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN TWO-COLUMN FORM & PREVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: ASSET CONFIGURATION & TIMELINE (7 COLS) */}
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

          {/* SECTION 2: ÉDITEUR DE TIMELINE & CHOCS */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" /> 2. Chronologie des Phases & Chocs ({phases.length})
              </h3>
              <button
                type="button"
                onClick={handleAddPhase}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter une Phase
              </button>
            </div>

            <div className="space-y-3">
              {phases.map((phase, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5 relative group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 text-[11px] font-mono font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={phase.name}
                        onChange={(e) => handleUpdatePhase(idx, { name: e.target.value })}
                        className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-purple-400 text-xs font-bold text-white focus:outline-none px-1"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-slate-400">
                        {phase.startMinute}m ➔ {phase.endMinute}m
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemovePhase(idx)}
                        className="text-slate-600 hover:text-rose-400 transition-colors p-1"
                        title="Supprimer cette phase"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Variation Cible (%)</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={phase.targetPriceChangePct}
                          onChange={(e) =>
                            handleUpdatePhase(idx, { targetPriceChangePct: parseFloat(e.target.value) || 0 })
                          }
                          className={`w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono font-bold focus:outline-none focus:border-purple-400 ${
                            phase.targetPriceChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        />
                        <span className="text-slate-500 font-mono">%</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Volatilité</label>
                      <select
                        value={phase.volatilityLevel}
                        onChange={(e) =>
                          handleUpdatePhase(idx, { volatilityLevel: e.target.value as any })
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-400 font-mono"
                      >
                        <option value="LOW">Faible (Calme)</option>
                        <option value="MEDIUM">Moyenne (Normale)</option>
                        <option value="HIGH">Élevée (Forte)</option>
                        <option value="EXTREME">Extrême (Tempête)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Gravité News</label>
                      <select
                        value={phase.breakingNewsSeverity}
                        onChange={(e) =>
                          handleUpdatePhase(idx, { breakingNewsSeverity: e.target.value as any })
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-400 font-mono"
                      >
                        <option value="INFO">Info Neutre</option>
                        <option value="WARNING">Avertissement</option>
                        <option value="PANIC">Panique / Vente</option>
                        <option value="EUPHORIA">Euphorie / Rally</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                      🔴 Alerte Flash News Déclenchée au Début de la Phase :
                    </label>
                    <input
                      type="text"
                      value={phase.breakingNewsHeadline || ''}
                      onChange={(e) => handleUpdatePhase(idx, { breakingNewsHeadline: e.target.value })}
                      placeholder="ex: Décision choc de la banque centrale : Taux relevés de +75 bps..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: REAL-TIME TRAJECTORY PREVIEW & PUBLISH (5 COLS) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 sticky top-24 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  APPERÇU EN DIRECT
                </span>
                <h3 className="text-base font-bold text-white font-mono mt-1">{assetName}</h3>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Prix Final Est.</div>
                <div className="text-base font-black font-mono text-emerald-400">
                  ${previewPoints.finalPrice.toFixed(2)}
                </div>
              </div>
            </div>

            {/* SVG LIVE CHART PREVIEW */}
            <div className="h-56 w-full bg-slate-950 rounded-xl p-2 border border-slate-800/80 relative overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 600 200" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="studioGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal reference lines */}
                {[40, 80, 120, 160].map((y) => (
                  <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" />
                ))}

                {/* Path Area */}
                {previewPoints.pts.length > 1 && (
                  <path
                    d={`M ${previewPoints.pts[0].normX} 200 ${previewPoints.pts
                      .map((pt) => `L ${pt.normX} ${pt.normY}`)
                      .join(' ')} L ${previewPoints.pts[previewPoints.pts.length - 1].normX} 200 Z`}
                    fill="url(#studioGrad)"
                  />
                )}

                {/* Line */}
                {previewPoints.pts.length > 1 && (
                  <path
                    d={`M ${previewPoints.pts[0].normX} ${previewPoints.pts[0].normY} ${previewPoints.pts
                      .map((pt) => `L ${pt.normX} ${pt.normY}`)
                      .join(' ')}`}
                    fill="none"
                    stroke="#c084fc"
                    strokeWidth="2.5"
                  />
                )}

                {/* Start & End Points */}
                {previewPoints.pts.length > 0 && (
                  <circle
                    cx={previewPoints.pts[0].normX}
                    cy={previewPoints.pts[0].normY}
                    r="4"
                    fill="#ffffff"
                    stroke="#a855f7"
                    strokeWidth="2"
                  />
                )}
                {previewPoints.pts.length > 0 && (
                  <circle
                    cx={previewPoints.pts[previewPoints.pts.length - 1].normX}
                    cy={previewPoints.pts[previewPoints.pts.length - 1].normY}
                    r="5"
                    fill="#34d399"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                )}
              </svg>

              <div className="absolute bottom-2 left-3 text-[10px] font-mono text-slate-500">
                Min: ${previewPoints.minPrice.toFixed(2)} • Max: ${previewPoints.maxPrice.toFixed(2)}
              </div>
            </div>

            {/* SUMMARY STATS OF THE CHALLENGE */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-500 text-[10px] block">DURÉE</span>
                <span className="font-bold text-white">{durationMinutes} Minutes</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">CAPITAL / LEVIER</span>
                <span className="font-bold text-white">${initialCapital.toLocaleString()} ({maxLeverage}x)</span>
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
              {isSubmitting ? 'Publication en cours...' : 'PUBLIER LE DÉFI OFFICIEL SUR MARKETSIM'}
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
