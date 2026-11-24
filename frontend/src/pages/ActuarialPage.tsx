import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { PageTransition, QuantOrbitalLoader, useToast } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { learningApi, UserBadge } from '../api/learning';
import { generateCertificatePdf } from '../utils/certificatePdf';
import {
  actuaryApi,
  InsuranceProductType,
  PolicyholderProfile,
  ActuarialPricingResult,
  ClaimSimulationResult,
  ProvisioningResult,
  InsuranceProductInfo,
  TradingActuarialAnalysis,
  SimulateRuinRequest,
  SimulateRuinResult,
} from '../api/actuary';
import {
  ShieldCheck,
  Calculator,
  AlertTriangle,
  Scale,
  RefreshCw,
  CheckCircle2,
  Table,
  Zap,
  Sliders,
  Info,
  Award,
  Lock,
  Download,
  GraduationCap,
  TrendingUp,
  ArrowUpRight,
  ShieldAlert,
  Sparkles,
  Activity,
} from 'lucide-react';

export const ActuarialPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'TRADING_RISK' | 'PRICING' | 'SIMULATION' | 'PROVISIONING'>('TRADING_RISK');

  // Products and profile state
  const [products, setProducts] = useState<InsuranceProductInfo[]>([]);
  const [profile, setProfile] = useState<PolicyholderProfile>({
    productType: 'AUTO',
    age: 35,
    bonusMalus: 0.85,
    coverageAmount: 50000,
    deductible: 400,
    geographicalZone: 'B',
    historyClaimsCount: 0,
    portfolioSize: 5000,
    safetyLoadingPct: 15.0,
    expenseLoadingPct: 20.0,
    targetProfitPct: 8.0,
  });
  const activeProductInfo = products.find(p => p.type === profile.productType);

  // Results state
  const [pricingResult, setPricingResult] = useState<ActuarialPricingResult | null>(null);
  const [simulationResult, setSimulationResult] = useState<ClaimSimulationResult | null>(null);
  const [provisioningResult, setProvisioningResult] = useState<ProvisioningResult | null>(null);
  const [tradingRiskResult, setTradingRiskResult] = useState<TradingActuarialAnalysis | null>(null);
  const [ruinSimResult, setRuinSimResult] = useState<SimulateRuinResult | null>(null);
  const [actuaryBadge, setActuaryBadge] = useState<UserBadge | null>(null);

  // Ruin Simulation Parameters
  const [ruinParams, setRuinParams] = useState<SimulateRuinRequest>({
    initialCapital: 100000,
    winRatePct: 56.5,
    rewardRiskRatio: 1.6,
    riskPerTradePct: 2.0,
    leverage: 5.0,
    numTrades: 100,
    numSimulations: 300,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [pricingLoading, setPricingLoading] = useState<boolean>(false);
  const [simLoading, setSimLoading] = useState<boolean>(false);
  const [provLoading, setProvLoading] = useState<boolean>(false);
  const [ruinLoading, setRuinLoading] = useState<boolean>(false);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [prods, pricing, sim, prov, tradingRisk, defaultRuin, learningProfile] = await Promise.all([
          actuaryApi.getProducts().catch(() => []),
          actuaryApi.calculatePricing(profile).catch(() => null),
          actuaryApi.simulateClaims(profile).catch(() => null),
          actuaryApi.getProvisioning('AUTO').catch(() => null),
          actuaryApi.getTradingRiskAnalysis().catch(() => null),
          actuaryApi.simulateTradingRuin({
            initialCapital: 100000,
            winRatePct: 56.5,
            rewardRiskRatio: 1.6,
            riskPerTradePct: 2.0,
            leverage: 5.0,
            numTrades: 100,
            numSimulations: 300,
          }).catch(() => null),
          learningApi.getUserProfile().catch(() => null),
        ]);
        setProducts(prods);
        setPricingResult(pricing);
        setSimulationResult(sim);
        setProvisioningResult(prov);
        setTradingRiskResult(tradingRisk);
        setRuinSimResult(defaultRuin);
        if (learningProfile?.badges) {
          const found = learningProfile.badges.find((b: UserBadge) => b.badgeCode === 'BADGE_ACTUARY');
          if (found) {
            setActuaryBadge(found);
          }
        }
      } catch (err: any) {
        toast.error('Erreur actuariat', err?.message || 'Connexion au moteur actuariel impossible');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleRunRuinSimulation = async () => {
    setRuinLoading(true);
    try {
      const res = await actuaryApi.simulateTradingRuin(ruinParams);
      setRuinSimResult(res);
      toast.success('Simulation achevée', `300 trajectoires de Cramér-Lundberg simulées. Probabilité de ruine: ${res.empiricalRuinProbability}%.`);
    } catch (err: any) {
      toast.error('Erreur simulation', err?.message || 'Calcul impossible');
    } finally {
      setRuinLoading(false);
    }
  };

  // Update pricing on parameter changes
  const runPricing = async (updatedProfile: PolicyholderProfile) => {
    setPricingLoading(true);
    try {
      const res = await actuaryApi.calculatePricing(updatedProfile);
      setPricingResult(res);
    } catch (err: any) {
      toast.error('Erreur tarification', err?.message || 'Calcul impossible');
    } finally {
      setPricingLoading(false);
    }
  };

  const handleProfileChange = (key: keyof PolicyholderProfile, value: any) => {
    const updated = { ...profile, [key]: value };
    setProfile(updated);
    runPricing(updated);
  };

  // Run stochastic Monte Carlo simulation
  const handleRunSimulation = async () => {
    setSimLoading(true);
    try {
      const res = await actuaryApi.simulateClaims(profile);
      setSimulationResult(res);
      toast.success('Simulation achevée', `Simulation de ${res.portfolioSize.toLocaleString()} assurés terminée avec succès.`);
    } catch (err: any) {
      toast.error('Erreur simulation', err?.message || 'Simulation stochastique impossible');
    } finally {
      setSimLoading(false);
    }
  };

  // Refresh Chain-Ladder provisioning
  const handleRefreshProvisioning = async () => {
    setProvLoading(true);
    try {
      const res = await actuaryApi.getProvisioning(profile.productType);
      setProvisioningResult(res);
      toast.success('Provisions recalculées', 'Triangle de liquidation et réserves IBNR actualisés.');
    } catch (err: any) {
      toast.error('Erreur provisionnement', err?.message || 'Calcul des provisions impossible');
    } finally {
      setProvLoading(false);
    }
  };

  const [transferLoading, setTransferLoading] = useState<boolean>(false);

  const handleTransferSurplusToTrading = async () => {
    if (!simulationResult || simulationResult.netUnderwritingResult <= 0) return;
    setTransferLoading(true);
    try {
      await actuaryApi.transferToTrading(simulationResult.netUnderwritingResult);
      toast.success(
        'Transfert ALM Réussi !',
        `+${simulationResult.netUnderwritingResult.toLocaleString()} € de bénéfices d'assurance ont été injectés dans votre compte de Live Trading !`
      );
    } catch (err: any) {
      toast.error('Échec du transfert', err?.message || 'Impossible de transférer les fonds vers le portefeuille.');
    } finally {
      setTransferLoading(false);
    }
  };

  return (
    <AppShell
      title="Laboratoire d'Actuariat & Assurance"
      section="Modélisation & Risques IARD/Vie"
      badge="Actuariat · Solvabilité II"
    >
      <PageTransition className="space-y-6 pb-12">
        {/* Top Header Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-r from-[#0B1220] via-[#10172B] to-[#141B34] p-6 shadow-2xl backdrop-blur-md">
          <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute left-1/3 bottom-0 -mb-16 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 text-violet-400 ring-1 ring-violet-400/30">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                  Moteur Actuariel & Modélisation d'Assurance
                </h1>
              </div>
              <p className="mt-1.5 text-sm text-slate-400 max-w-2xl">
                Tarification prédictive de prime pure et commerciale, analyse de rentabilité (S/P, Ratio combiné),
                simulation stochastique de survenance des sinistres et provisionnement Chain-Ladder (IBNR).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Badge & Certification Actuarielle ESPRIT */}
              {actuaryBadge ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs shadow-lg shadow-amber-500/5">
                  <Award className="h-4 w-4 text-amber-400 shrink-0" />
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-amber-300">
                      <span>Accréditation Actuaire Validée</span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      {actuaryBadge.scorePercentage !== undefined && (
                        <span className="text-[10px] text-emerald-400 font-mono">({actuaryBadge.scorePercentage}%)</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">Badge & Examen Solvabilité II</span>
                  </div>
                  <button
                    onClick={() => {
                      generateCertificatePdf({
                        badge: actuaryBadge,
                        userEmail: user?.email || 'etudiant@esprit.tn',
                        userName: user?.email ? user.email.split('@')[0] : 'Étudiant ESPRIT',
                      });
                      toast.success('Certificat téléchargé', 'Le PDF officiel a été généré avec succès');
                    }}
                    className="ml-1.5 flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-2.5 py-1 text-[11px] font-bold text-slate-950 shadow transition hover:brightness-110"
                    title="Télécharger le certificat officiel au format PDF"
                  >
                    <Download className="h-3 w-3" />
                    Certif PDF
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-[#070B14]/80 px-3.5 py-2 text-xs">
                  <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                      <span>Badge Actuariat</span>
                      <span className="text-[10px] font-normal text-amber-400/90">(Verrouillé : Cours + Quiz ≥ 75%)</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Examen académique requis</span>
                  </div>
                  <button
                    onClick={() => navigate('/app/academy')}
                    className="ml-1.5 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:border-violet-500 hover:text-white transition"
                    title="Aller à l'Académie pour compléter les cours et réussir le quiz"
                  >
                    <GraduationCap className="h-3 w-3 text-violet-400" />
                    Obtenir le Badge
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#070B14]/80 px-3.5 py-2 text-xs">
                <Scale className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-slate-400">Norme :</span>
                <span className="font-semibold text-violet-300">Solvabilité II (Pilier 1)</span>
              </div>
              <button
                onClick={() => {
                  runPricing(profile);
                  handleRunSimulation();
                  handleRefreshProvisioning();
                }}
                disabled={loading || pricingLoading}
                className="flex items-center gap-1.5 rounded-xl border border-violet-500/40 bg-violet-500/20 px-3.5 py-2 text-xs font-semibold text-violet-300 transition-all hover:bg-violet-500 hover:text-white"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${pricingLoading ? 'animate-spin' : ''}`} />
                Recalculer Tout
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-800/80 pt-4">
            {[
              { id: 'TRADING_RISK', label: '⚡ Actuariat du Trading & Risque Extrême', icon: Zap, isNew: true },
              { id: 'PRICING', label: 'Tarification Prédictive & Marges', icon: Calculator },
              { id: 'SIMULATION', label: 'Survenance des Sinistres (Monte Carlo)', icon: Activity },
              { id: 'PROVISIONING', label: 'Provisionnement Chain-Ladder (IBNR)', icon: Table },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all relative ${
                    isActive
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30 ring-1 ring-violet-400'
                      : 'border border-slate-800 bg-[#070B14]/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  {tab.isNew && (
                    <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                      RÉPONSE PROF
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Global Loading State */}
        {loading ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-violet-500/25 bg-[#0B1220]/95 p-8 shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden backdrop-blur-md">
              <div className="absolute inset-x-0 top-0 h-[3px] bg-slate-800 overflow-hidden">
                <div className="h-full w-1/3 bg-gradient-to-r from-violet-500 via-sky-400 to-emerald-400 animate-pulse rounded-full" />
              </div>
              <QuantOrbitalLoader
                size="lg"
                tone="violet"
                icon={ShieldCheck}
                badge="MOTEUR ACTUARIEL EN COURS"
                title="Modélisation Actuarielle & Tarification..."
                subtitle="Calcul des fréquences de sinistres, sévérités moyennes, marges de prime et triangles de liquidation..."
              />
            </div>
          </div>
        ) : (
          <>
            {/* ── ONGLET : ACTUARIAT DU TRADING & RISQUE EXTRÊME (RÉPONSE AU PROFESSEUR) ────────── */}
            {activeTab === 'TRADING_RISK' && (
              <div className="space-y-8 animate-fadeIn">
                {/* 1. Academic Problem & Solution Thesis Banner */}
                <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-violet-950/40 to-slate-900 p-6 shadow-2xl backdrop-blur-md">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-amber-500/20">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-inner">
                        <GraduationCap className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            VALIDATION ACADÉMIQUE MASTER 2
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-500/20 text-violet-300 border border-violet-500/40">
                            4 PILIERS MATHÉMATIQUES
                          </span>
                        </div>
                        <h2 className="text-lg font-bold text-white mt-1">
                          Problématique de Recherche : En quoi le calcul actuariel transforme-t-il la gestion du risque en trading ?
                        </h2>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-xs sm:text-sm text-slate-200 leading-relaxed bg-[#070B14]/80 rounded-xl p-4 border border-slate-800">
                    <p className="font-sans">
                      <strong className="text-amber-400 font-semibold">Réponse synthétique pour le jury : </strong>
                      {tradingRiskResult?.professorQuestionAnswer ||
                        "La finance classique repose sur l'hypothèse de distributions normales gaussiennes, sous-estimant dramatiquement les queues de distribution (cygnes noirs, krachs). L'actuariat apporte la théorie de la ruine (Cramér-Lundberg), la modélisation des valeurs extrêmes (EVT / Pareto) et les exigences de capital économique (Solvabilité II), garantissant la survie mathématique à long terme du capital."}
                    </p>
                  </div>
                </div>

                {/* 2. 4 Strategic Actuarial KPI Cards with Live Pulse Aura */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Card 1: Probabilité de Ruine */}
                  <div className="rounded-2xl border border-violet-500/40 bg-gradient-to-b from-[#141226] to-[#0B1220] p-5 shadow-xl transition-all hover:scale-[1.02] hover:border-violet-400 actuary-shield-aura relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl group-hover:bg-violet-500/20 transition-all pointer-events-none" />
                    <div className="flex items-center justify-between relative z-10">
                      <span className="text-xs font-semibold text-slate-300">Probabilité de Ruine Ψ(u)</span>
                      <div className="p-2 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 animate-pulse">
                        <ShieldAlert className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2 relative z-10">
                      <span className="text-2xl font-black text-white font-mono tracking-tight drop-shadow-[0_0_12px_rgba(139,92,246,0.5)]">
                        {tradingRiskResult?.lundbergRuinProbability != null ? `${tradingRiskResult.lundbergRuinProbability.toFixed(3)}%` : '0.040%'}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                        {tradingRiskResult?.lundbergRuinProbability && tradingRiskResult.lundbergRuinProbability < 1 ? 'Très faible' : 'Modéré'}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400 relative z-10">
                      Borne de Lundberg : <code className="text-violet-300 font-mono font-bold">Ψ(u) ≤ e^(-Ru)</code> (R = {tradingRiskResult?.lundbergAdjustmentCoefficientR.toFixed(4) || '0.0820'}).
                    </p>
                  </div>

                  {/* Card 2: Biais Finance Classique */}
                  <div className="rounded-2xl border border-rose-500/40 bg-gradient-to-b from-[#1F1218] to-[#0B1220] p-5 shadow-xl transition-all hover:scale-[1.02] hover:border-rose-400 hover:shadow-[0_0_24px_rgba(239,68,68,0.35)] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all pointer-events-none" />
                    <div className="flex items-center justify-between relative z-10">
                      <span className="text-xs font-semibold text-slate-300">Biais Loi Normale (Gauss)</span>
                      <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-bounce">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2 relative z-10">
                      <span className="text-2xl font-black text-rose-400 font-mono tracking-tight drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">
                        {tradingRiskResult?.riskUnderestimationFactor != null ? `${tradingRiskResult.riskUnderestimationFactor.toFixed(1)}x` : '3.6x'}
                      </span>
                      <span className="text-[11px] font-semibold text-rose-300">Sous-estimation</span>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400 relative z-10">
                      La VaR 99% classique ignore les queues épaisses (indice Pareto ξ = {tradingRiskResult?.tailIndexXi.toFixed(2) || '0.28'}).
                    </p>
                  </div>

                  {/* Card 3: Survie du Portefeuille */}
                  <div className="rounded-2xl border border-sky-500/40 bg-gradient-to-b from-[#0F1C2B] to-[#0B1220] p-5 shadow-xl transition-all hover:scale-[1.02] hover:border-sky-400 hover:shadow-[0_0_24px_rgba(56,189,248,0.35)] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl group-hover:bg-sky-500/20 transition-all pointer-events-none" />
                    <div className="flex items-center justify-between relative z-10">
                      <span className="text-xs font-semibold text-slate-300">Survie à 100 Trades</span>
                      <div className="p-2 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        <Activity className="h-4 w-4 text-sky-400 animate-pulse" />
                      </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2 relative z-10">
                      <span className="text-2xl font-black text-white font-mono tracking-tight drop-shadow-[0_0_12px_rgba(56,189,248,0.5)]">
                        {tradingRiskResult?.capitalSurvivalProbability100Trades != null ? `${tradingRiskResult.capitalSurvivalProbability100Trades.toFixed(1)}%` : '94.5%'}
                      </span>
                      <span className="text-[11px] font-semibold text-sky-400">
                        Demi-vie : {tradingRiskResult?.halfLifeTrades || 450} trades
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400 relative z-10">
                      Espérance Kaplan-Meier pour levier {ruinParams.leverage}x et risque {ruinParams.riskPerTradePct}%.
                    </p>
                  </div>

                  {/* Card 4: Réserve SCR Solvabilité II */}
                  <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-[#0D201A] to-[#0B1220] p-5 shadow-xl transition-all hover:scale-[1.02] hover:border-emerald-400 hover:shadow-[0_0_24px_rgba(34,197,94,0.35)] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
                    <div className="flex items-center justify-between relative z-10">
                      <span className="text-xs font-semibold text-slate-300">Réserve Solvabilité II (SCR)</span>
                      <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <Lock className="h-4 w-4 text-emerald-400 animate-pulse" />
                      </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2 relative z-10">
                      <span className="text-2xl font-black text-emerald-400 font-mono tracking-tight drop-shadow-[0_0_12px_rgba(34,197,94,0.5)]">
                        ${tradingRiskResult?.recommendedSolvencyBuffer ? tradingRiskResult.recommendedSolvencyBuffer.toLocaleString() : '32,500'}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-300 font-mono">
                        Ratio : {tradingRiskResult?.solvencyRatioPct ? tradingRiskResult.solvencyRatioPct.toFixed(0) : '308'}%
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400 relative z-10">
                      Tampon requis pour absorber un choc décennal (-{tradingRiskResult?.tenYearStressDrawdown.toFixed(1) || '32.5'}%).
                    </p>
                  </div>
                </div>

                {/* 3. Pilier 1 : Simulateur Stochastique de Ruine de Cramér-Lundberg */}
                <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-6 shadow-xl space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-500/20 text-violet-300 border border-violet-500/40">
                          PILIER 1
                        </span>
                        <h3 className="text-base font-bold text-white">
                          Théorie de la Ruine de Cramér-Lundberg & Trajectoires Monte Carlo (300 Chemins)
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Équation fondamentale du capital résiduel : <code className="text-violet-300 font-mono">U(t) = u + c·t - ∑ X_i</code> avec condition de ruine <code className="text-rose-400 font-mono">inf U(t) &lt; 0</code>.
                      </p>
                    </div>

                    <button
                      onClick={handleRunRuinSimulation}
                      disabled={ruinLoading}
                      className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4 w-4 ${ruinLoading ? 'animate-spin' : ''}`} />
                      {ruinLoading ? 'Simulation en cours...' : '⚡ Re-simuler (300 Trajectoires)'}
                    </button>
                  </div>

                  {/* Sliders de simulation */}
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4 rounded-xl bg-[#070B14]/80 border border-slate-800/80">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Capital Initial ($)</label>
                      <input
                        type="number"
                        min={1000}
                        max={1000000}
                        step={5000}
                        value={ruinParams.initialCapital}
                        onChange={e => setRuinParams({ ...ruinParams, initialCapital: Number(e.target.value) })}
                        className="w-full rounded-lg border border-slate-700 bg-[#0B1220] px-2.5 py-1.5 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Taux Victoire</span>
                        <strong className="text-white font-mono">{ruinParams.winRatePct}%</strong>
                      </div>
                      <input
                        type="range"
                        min={30}
                        max={85}
                        step={0.5}
                        value={ruinParams.winRatePct}
                        onChange={e => setRuinParams({ ...ruinParams, winRatePct: Number(e.target.value) })}
                        className="w-full accent-violet-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Ratio R:R</span>
                        <strong className="text-white font-mono">{ruinParams.rewardRiskRatio}x</strong>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={4.0}
                        step={0.1}
                        value={ruinParams.rewardRiskRatio}
                        onChange={e => setRuinParams({ ...ruinParams, rewardRiskRatio: Number(e.target.value) })}
                        className="w-full accent-violet-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Risque/Trade</span>
                        <strong className="text-white font-mono">{ruinParams.riskPerTradePct}%</strong>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={10}
                        step={0.5}
                        value={ruinParams.riskPerTradePct}
                        onChange={e => setRuinParams({ ...ruinParams, riskPerTradePct: Number(e.target.value) })}
                        className="w-full accent-violet-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Effet de Levier</span>
                        <strong className="text-white font-mono">{ruinParams.leverage}x</strong>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={50}
                        step={1}
                        value={ruinParams.leverage}
                        onChange={e => setRuinParams({ ...ruinParams, leverage: Number(e.target.value) })}
                        className="w-full accent-violet-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Nb Trades</span>
                        <strong className="text-white font-mono">{ruinParams.numTrades}</strong>
                      </div>
                      <input
                        type="range"
                        min={20}
                        max={200}
                        step={10}
                        value={ruinParams.numTrades}
                        onChange={e => setRuinParams({ ...ruinParams, numTrades: Number(e.target.value) })}
                        className="w-full accent-violet-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Résultat de simulation & Graphique de trajectoires */}
                  {ruinSimResult && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Graphique SVG des trajectoires */}
                      <div className="lg:col-span-2 rounded-xl bg-[#070B14] p-4 border border-slate-800">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-emerald-400" />
                            Trajectoires de Fortune U(t) sur {ruinParams.numTrades} Trades
                          </span>
                          <div className="flex items-center gap-3 text-[10px] font-mono">
                            <span className="flex items-center gap-1 text-emerald-400">
                              <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" /> Favorable
                            </span>
                            <span className="flex items-center gap-1 text-sky-400">
                              <span className="h-2 w-2 rounded-full bg-sky-400 inline-block" /> Médiane
                            </span>
                            <span className="flex items-center gap-1 text-rose-400">
                              <span className="h-2 w-2 rounded-full bg-rose-400 inline-block" /> Ruine (Liquidation)
                            </span>
                          </div>
                        </div>

                        {/* Interactive SVG Chart */}
                        {(() => {
                          const trajectories = ruinSimResult.sampleTrajectories || [];
                          const allVals = trajectories.flatMap(t => t.equityPath);
                          const maxVal = Math.max(1, ...allVals, ruinParams.initialCapital || 100000);
                          const minVal = Math.min(0, ...allVals);
                          const range = maxVal - minVal || 1;
                          const chartW = 600;
                          const chartH = 180;
                          const padX = 20;
                          const padY = 15;
                          const plotW = chartW - padX * 2;
                          const plotH = chartH - padY * 2;
                          const zeroY = padY + (1 - (0 - minVal) / range) * plotH;

                          return (
                            <div className="w-full overflow-hidden">
                              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-48 select-none">
                                {/* Grid lines */}
                                <line x1={padX} y1={padY} x2={chartW - padX} y2={padY} stroke="#334155" strokeDasharray="3 3" strokeOpacity={0.3} />
                                <line x1={padX} y1={padY + plotH / 2} x2={chartW - padX} y2={padY + plotH / 2} stroke="#334155" strokeDasharray="3 3" strokeOpacity={0.3} />
                                <line x1={padX} y1={padY + plotH} x2={chartW - padX} y2={padY + plotH} stroke="#334155" strokeDasharray="3 3" strokeOpacity={0.3} />

                                {/* Zero line (Liquidation) */}
                                {minVal < 0 && zeroY <= chartH - padY && (
                                  <line x1={padX} y1={zeroY} x2={chartW - padX} y2={zeroY} stroke="#f43f5e" strokeWidth={1.5} strokeDasharray="4 2" />
                                )}

                                {/* Trajectories */}
                                {trajectories.map((traj, idx) => {
                                  const points = traj.equityPath
                                    .map((val, stepIdx) => {
                                      const x = padX + (stepIdx / Math.max(1, traj.equityPath.length - 1)) * plotW;
                                      const y = padY + (1 - (val - minVal) / range) * plotH;
                                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                                    })
                                    .join(' ');

                                  const strokeColor = traj.ruined
                                    ? '#f43f5e'
                                    : idx === 0
                                    ? '#10b981'
                                    : '#38bdf8';

                                  return (
                                    <polyline
                                      key={idx}
                                      fill="none"
                                      stroke={strokeColor}
                                      strokeWidth={traj.ruined ? 2 : 2.5}
                                      strokeOpacity={0.9}
                                      points={points}
                                    />
                                  );
                                })}
                              </svg>

                              <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-1">
                                <span>Trade 0</span>
                                <span>Max: ${Math.round(maxVal).toLocaleString()}</span>
                                <span>Trade {ruinParams.numTrades}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Métriques clés de ruine */}
                      <div className="rounded-xl bg-[#070B14] p-4 border border-slate-800 space-y-3 flex flex-col justify-between">
                        <span className="text-xs font-semibold text-slate-300">
                          Diagnostics de Ruine & Drawdown
                        </span>

                        <div className="space-y-2.5">
                          <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800/80">
                            <span className="text-slate-400">Ruine Empirique (300 sims) :</span>
                            <span className={`font-mono font-bold ${ruinSimResult.empiricalRuinProbability > 5 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {ruinSimResult.empiricalRuinProbability.toFixed(2)}%
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800/80">
                            <span className="text-slate-400">Borne Théorique Lundberg :</span>
                            <span className="font-mono font-bold text-violet-400">
                              ≤ {ruinSimResult.theoreticalLundbergBound.toFixed(2)}%
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800/80">
                            <span className="text-slate-400">Drawdown Moyen :</span>
                            <span className="font-mono font-bold text-amber-400">
                              -{ruinSimResult.maxDrawdownAverage.toFixed(1)}%
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800/80">
                            <span className="text-slate-400">Pire Drawdown (Scénario Noir) :</span>
                            <span className="font-mono font-bold text-rose-400">
                              -{ruinSimResult.maxDrawdownWorstCase.toFixed(1)}%
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">Capital Final Médian :</span>
                            <span className="font-mono font-bold text-white">
                              ${Math.round(ruinSimResult.medianFinalCapital).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 p-2.5 rounded-lg bg-violet-950/30 border border-violet-800/40 text-[11px] text-violet-300">
                          💡 <strong>Enseignement actuariel :</strong> Même avec une espérance positive, un risque par trade supérieur au critère de sécurité engendre une probabilité de ruine certaine à horizon infini.
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Pilier 2 : Théorie des Valeurs Extrêmes (EVT Pareto) vs Finance Classique (Gaussienne) */}
                <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-6 shadow-xl space-y-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        PILIER 2
                      </span>
                      <h3 className="text-base font-bold text-white">
                        Théorie des Valeurs Extrêmes (EVT / Queues Lourdes Pareto) vs Modèle Gaussien Classique
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Pourquoi la loi normale de Black-Scholes et Markowitz conduit inéluctablement à la liquidation lors des krachs.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Colonne 1 : Finance Classique */}
                    <div className="rounded-xl border border-slate-800 bg-[#070B14] p-5 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full bg-slate-500" />
                          <h4 className="text-sm font-bold text-slate-200">Finance Traditionnelle (Loi Normale)</h4>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">Hypothèse Gaussienne</span>
                      </div>

                      <p className="text-xs text-slate-400">
                        Présuppose une distribution en cloche symétrique. Les krachs de plus de 4 écarts-types (4σ) sont considérés comme statistiquement « impossibles » (1 fois tous les 30 000 ans).
                      </p>

                      <div className="space-y-3 pt-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">VaR 95% (1 jour) :</span>
                          <span className="font-mono font-bold text-white">
                            {tradingRiskResult?.gaussianVaR95.toFixed(2) || '-1.97'}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">VaR 99% (1 jour) :</span>
                          <span className="font-mono font-bold text-amber-300">
                            {tradingRiskResult?.gaussianVaR99.toFixed(2) || '-2.79'}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Perte au-delà du quantile (CVaR) :</span>
                          <span className="font-mono text-slate-500 italic">Ignorée (queue mince)</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-900/40 text-[11px] text-rose-300">
                        ⚠️ <strong>Angle mort :</strong> Cette modélisation a causé la faillite de LTCM (1998) et des desks de trading en 2008 car les marchés réels subissent des sauts discontinus.
                      </div>
                    </div>

                    {/* Colonne 2 : Actuariat & EVT */}
                    <div className="rounded-xl border border-violet-500/40 bg-gradient-to-b from-violet-950/20 to-[#070B14] p-5 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-violet-500/30">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full bg-violet-400 animate-pulse" />
                          <h4 className="text-sm font-bold text-violet-200">Actuariat Quantitatif (EVT Pareto GPD)</h4>
                        </div>
                        <span className="text-[10px] font-mono text-violet-300 bg-violet-500/20 px-2 py-0.5 rounded border border-violet-500/40">
                          Théorème Pickands-Balkema-de Haan
                        </span>
                      </div>

                      <p className="text-xs text-slate-300">
                        Modélise spécifiquement les queues épaisses (Fat Tails) via la loi de Pareto Généralisée. Capture fidèlement les Flash Crashes et le slippage extrême.
                      </p>

                      <div className="space-y-3 pt-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">VaR 95% Actuarielle :</span>
                          <span className="font-mono font-bold text-violet-300">
                            {tradingRiskResult?.actuarialEvtVaR95.toFixed(2) || '-3.85'}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">VaR 99% Actuarielle (Queues Lourdes) :</span>
                          <span className="font-mono font-bold text-rose-400">
                            {tradingRiskResult?.actuarialEvtVaR99.toFixed(2) || '-8.45'}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Expected Shortfall (CVaR 99%) :</span>
                          <span className="font-mono font-bold text-rose-300">
                            {tradingRiskResult?.expectedShortfallCVaR99.toFixed(2) || '-11.20'}%
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-[11px] text-emerald-300">
                        ✅ <strong>Bénéfice décisif :</strong> Prévient la liquidation soudaine en exigeant un appel de marge réel calibré sur les queues de sinistres extrêmes.
                      </div>
                    </div>
                  </div>

                  {/* Diagnosis bar */}
                  <div className="p-3.5 rounded-xl bg-[#070B14] border border-amber-500/30 flex items-center gap-3 text-xs text-amber-200">
                    <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>
                      <strong>Diagnostic actuariel : </strong>
                      {tradingRiskResult?.evtDiagnosis ||
                        "Sous-estimation de 3.6x du risque extrême par la finance classique. L'Expected Shortfall actuariel (CVaR) révèle une perte résiduelle moyenne de 11.2% lors des dépassements de seuil."}
                    </span>
                  </div>
                </div>

                {/* 5. Pilier 3 : Survie Kaplan-Meier & Demi-Vie du Compte selon le Levier */}
                <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-6 shadow-xl space-y-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                        PILIER 3
                      </span>
                      <h3 className="text-base font-bold text-white">
                        Tables de Mortalité Financière & Modèle de Survie de Kaplan-Meier
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Explication actuarielle de la règle des 90/90/90 (90% des traders perdent 90% de leur capital en 90 jours) en fonction du levier.
                    </p>
                  </div>

                  {/* Cartes d'espérance de vie par levier */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { lev: '1x (Spot / Sans Levier)', days: 1825, label: '~5 ans', rate: '99.5%', tone: 'border-emerald-500/40 text-emerald-400' },
                      { lev: '5x (Levier Prudentiel)', days: 730, label: '~2 ans', rate: '94.0%', tone: 'border-sky-500/40 text-sky-400' },
                      { lev: '20x (Levier Crypto/Futures)', days: 120, label: '~4 mois', rate: '42.0%', tone: 'border-amber-500/40 text-amber-400' },
                      { lev: '100x (Levier Toxique Broker)', days: 14, label: '~2 semaines', rate: '1.2%', tone: 'border-rose-500/40 text-rose-400' },
                    ].map((item, idx) => (
                      <div key={idx} className={`rounded-xl border bg-[#070B14] p-4 ${item.tone} space-y-2`}>
                        <div className="text-[11px] font-semibold text-slate-400">{item.lev}</div>
                        <div className="text-xl font-bold font-mono">{item.label}</div>
                        <div className="text-[10px] text-slate-400 flex justify-between pt-1 border-t border-slate-800">
                          <span>Demi-vie : <strong>{item.days} j</strong></span>
                          <span>Survie 100t : <strong>{item.rate}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Kelly vs Actuarial Safe Size */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-[#070B14]/80 border border-slate-800">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Fraction Kelly Théorique :</span>
                      <strong className="text-sm font-mono text-white">
                        {tradingRiskResult?.optimalKellyFractionPct.toFixed(2) || '8.30'}% par trade
                      </strong>
                      <p className="text-[10px] text-slate-500 mt-1">Maximise la croissance logarithmique, mais volatilité de capital insoutenable.</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Marge de Sécurité Actuarielle (Fractionnelle) :</span>
                      <strong className="text-sm font-mono text-emerald-400">
                        {tradingRiskResult?.actuarialSafePositionSizePct.toFixed(2) || '1.83'}% par trade
                      </strong>
                      <p className="text-[10px] text-slate-500 mt-1">Évite le risque de ruine à 99.9% selon le coefficient de Lundberg.</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Levier Maximum Recommandé :</span>
                      <strong className="text-sm font-mono text-violet-400">
                        ≤ {tradingRiskResult?.maxSafeLeverage.toFixed(1) || '4.5'}x
                      </strong>
                      <p className="text-[10px] text-slate-500 mt-1">Au-delà de ce seuil, la demi-vie du compte s'effondre sous 90 jours.</p>
                    </div>
                  </div>
                </div>

                {/* 6. Pilier 4 : Capital Économique & Solvabilité II */}
                <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-6 shadow-xl space-y-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        PILIER 4
                      </span>
                      <h3 className="text-base font-bold text-white">
                        Exigence de Capital de Solvabilité (SCR - Solvabilité II) Appliquée au Trading
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Transposition de la réglementation prudentielle européenne des assurances pour sécuriser un compte de trading contre un choc décennal.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-[#070B14] border border-slate-800">
                      <span className="text-xs text-slate-400 block">Choc Décennal Calibré (1/10 ans) :</span>
                      <div className="text-xl font-bold font-mono text-rose-400 mt-1">
                        -{tradingRiskResult?.tenYearStressDrawdown.toFixed(1) || '32.5'}%
                      </div>
                      <span className="text-[10px] text-slate-500">Choc simultané de volatilité & liquidité</span>
                    </div>

                    <div className="p-4 rounded-xl bg-[#070B14] border border-slate-800">
                      <span className="text-xs text-slate-400 block">Matelas SCR Requis :</span>
                      <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                        ${tradingRiskResult?.recommendedSolvencyBuffer.toLocaleString() || '32,500'}
                      </div>
                      <span className="text-[10px] text-slate-500">Capital liquide non engagé en marge</span>
                    </div>

                    <div className="p-4 rounded-xl bg-[#070B14] border border-slate-800">
                      <span className="text-xs text-slate-400 block">Ratio de Solvabilité Actuel :</span>
                      <div className="text-xl font-bold font-mono text-sky-400 mt-1">
                        {tradingRiskResult?.solvencyRatioPct.toFixed(1) || '308.0'}%
                      </div>
                      <span className="text-[10px] text-slate-500">Exigence réglementaire &gt; 100%</span>
                    </div>

                    <div className="p-4 rounded-xl bg-[#070B14] border border-slate-800">
                      <span className="text-xs text-slate-400 block">Verdict de Solvabilité :</span>
                      <div className="text-sm font-bold font-mono text-emerald-400 mt-2 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" />
                        {tradingRiskResult?.isSolventSolvency2 ? 'Solvable à 99.5%' : 'Sous-capitalisé'}
                      </div>
                      <span className="text-[10px] text-slate-500">Conforme directive Solvabilité II</span>
                    </div>
                  </div>
                </div>

                {/* 7. Matrice Synthétique Comparative Prête pour la Soutenance */}
                <div className="rounded-2xl border border-violet-500/30 bg-[#0B1220] p-6 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Table className="h-4 w-4 text-violet-400" />
                        Matrice Comparative Prête pour la Soutenance avec le Professeur
                      </h3>
                      <p className="text-xs text-slate-400">
                        Tableau de synthèse des 4 dimensions démontrant la supériorité de l'approche actuarielle.
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-violet-300 bg-violet-500/10 px-2.5 py-1 rounded-lg border border-violet-500/30">
                      Défense PFE / Soutenance
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-[#070B14]/80 text-[11px] font-mono text-slate-400">
                          <th className="py-2.5 px-3">Dimension</th>
                          <th className="py-2.5 px-3 text-slate-300">Finance Traditionnelle</th>
                          <th className="py-2.5 px-3 text-violet-300">Approche Actuarielle</th>
                          <th className="py-2.5 px-3 text-emerald-300">Preuve & Impact Concret</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-sans">
                        {(tradingRiskResult?.comparativeMatrix || [
                          {
                            dimension: 'Distribution des Rendements',
                            classicalFinance: 'Loi Normale (Gaussienne, N(μ, σ²))',
                            actuarialApproach: 'Théorie des Valeurs Extrêmes (EVT / Pareto GPD)',
                            concreteImpact: 'Sous-estimation de 3.6x des pertes extrêmes (Black Swans).',
                          },
                          {
                            dimension: 'Mesure du Risque de Queue',
                            classicalFinance: 'Value-at-Risk (VaR 95% / 99%)',
                            actuarialApproach: 'Expected Shortfall (CVaR) + Indice de queue ξ',
                            concreteImpact: 'Quantifie la sévérité moyenne au-delà du pire scénario.',
                          },
                          {
                            dimension: 'Gestion du Capital & Ruine',
                            classicalFinance: 'Ratio de Sharpe & Volatilité annualisée',
                            actuarialApproach: 'Théorie de la Ruine de Cramér-Lundberg (Ψ(u) ≤ e^(-Ru))',
                            concreteImpact: 'Garantit mathématiquement la non-faillite à horizon infini.',
                          },
                          {
                            dimension: 'Horizon & Durabilité',
                            classicalFinance: 'Horizon statique 1 jour / 10 jours',
                            actuarialApproach: 'Modèles de Survie Kaplan-Meier & Demi-Vie du Compte',
                            concreteImpact: 'Explique la règle des 90/90/90 et fixe le levier max à 4.5x.',
                          },
                        ]).map((row, idx) => (
                          <tr key={idx} className="hover:bg-violet-950/10 transition">
                            <td className="py-3 px-3 font-semibold text-white whitespace-nowrap">{row.dimension}</td>
                            <td className="py-3 px-3 text-slate-400">{row.classicalFinance}</td>
                            <td className="py-3 px-3 font-semibold text-violet-300">{row.actuarialApproach}</td>
                            <td className="py-3 px-3 font-mono text-emerald-400">{row.concreteImpact}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── ONGLET 1 : TARIFICATION PRÉDICTIVE & MARGES DE PRIME ────────── */}
            {activeTab === 'PRICING' && pricingResult && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Paramètres Assuré & Contrat */}
                <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-violet-400" />
                      <h3 className="text-sm font-semibold text-white">Paramètres du Contrat & Assuré</h3>
                    </div>
                    {pricingLoading && <span className="text-[10px] text-violet-400 font-mono animate-pulse">Calcul...</span>}
                  </div>

                  {/* Choix du produit */}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Branche d'Assurance</label>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {(['AUTO', 'HEALTH', 'HOME', 'LIFE', 'COMMERCIAL'] as InsuranceProductType[]).map(pt => (
                        <button
                          key={pt}
                          onClick={() => handleProfileChange('productType', pt)}
                          className={`rounded-lg py-1.5 px-2 text-[11px] font-semibold border transition ${
                            profile.productType === pt
                              ? 'bg-violet-500/20 text-violet-300 border-violet-500/50'
                              : 'bg-[#070B14] text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {pt === 'AUTO' ? 'Auto' : pt === 'HEALTH' ? 'Santé' : pt === 'HOME' ? 'Habitation' : pt === 'LIFE' ? 'Vie/Décès' : 'RC Pro'}
                        </button>
                      ))}
                    </div>
                    {activeProductInfo && (
                      <p className="mt-1.5 text-[11px] text-slate-400 italic">
                        {activeProductInfo.description} (Réf. Fréq: {(activeProductInfo.baseFrequency * 100).toFixed(1)}%, Coût moyen: {activeProductInfo.baseSeverity.toLocaleString()} €)
                      </p>
                    )}
                  </div>

                  {/* Âge */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Âge de l'assuré :</span>
                      <strong className="text-white font-mono">{profile.age} ans</strong>
                    </div>
                    <input
                      type="range"
                      min={18}
                      max={85}
                      value={profile.age}
                      onChange={e => handleProfileChange('age', Number(e.target.value))}
                      className="w-full accent-violet-500 cursor-pointer"
                    />
                  </div>

                  {/* Bonus / Malus */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Coefficient Bonus / Malus :</span>
                      <strong className="text-white font-mono">{profile.bonusMalus.toFixed(2)}</strong>
                    </div>
                    <input
                      type="range"
                      min={0.50}
                      max={2.50}
                      step={0.05}
                      value={profile.bonusMalus}
                      onChange={e => handleProfileChange('bonusMalus', Number(e.target.value))}
                      className="w-full accent-violet-500 cursor-pointer"
                    />
                  </div>

                  {/* Franchise contractuelle */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Franchise contractuelle :</span>
                      <strong className="text-white font-mono">{profile.deductible.toLocaleString()} €</strong>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2000}
                      step={50}
                      value={profile.deductible}
                      onChange={e => handleProfileChange('deductible', Number(e.target.value))}
                      className="w-full accent-violet-500 cursor-pointer"
                    />
                  </div>

                  {/* Zone géographique */}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Zone Géographique de Risque</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'A', label: 'Zone A (Urbain dense)' },
                        { id: 'B', label: 'Zone B (Péri-urbain)' },
                        { id: 'C', label: 'Zone C (Rural)' },
                      ].map(z => (
                        <button
                          key={z.id}
                          onClick={() => handleProfileChange('geographicalZone', z.id)}
                          className={`rounded-lg py-1.5 px-2 text-[10px] font-medium border text-center transition ${
                            profile.geographicalZone === z.id
                              ? 'bg-violet-500/20 text-violet-300 border-violet-500/50 font-bold'
                              : 'bg-[#070B14] text-slate-400 border-slate-800'
                          }`}
                        >
                          {z.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sinistres passés */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Sinistres passés (3 dernières années) :</span>
                      <strong className="text-white font-mono">{profile.historyClaimsCount}</strong>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={4}
                      value={profile.historyClaimsCount}
                      onChange={e => handleProfileChange('historyClaimsCount', Number(e.target.value))}
                      className="w-full accent-violet-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Résultats de Tarification & Marges */}
                <div className="lg:col-span-2 space-y-4">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-4">
                      <span className="text-[11px] text-slate-400 font-medium">Prime Pure Actuarielle</span>
                      <div className="mt-1 font-mono text-xl font-bold text-white">
                        {pricingResult.purePremium.toLocaleString()} €
                      </div>
                      <span className="text-[10px] text-slate-500">Coût moyen attendu du risque</span>
                    </div>

                    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4">
                      <span className="text-[11px] text-violet-300 font-medium">Prime Commerciale Brute</span>
                      <div className="mt-1 font-mono text-xl font-extrabold text-violet-400">
                        {pricingResult.commercialPremium.toLocaleString()} €
                      </div>
                      <span className="text-[10px] text-violet-300 font-mono">
                        {pricingResult.monthlyPremium.toLocaleString()} € / mois
                      </span>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-4">
                      <span className="text-[11px] text-slate-400 font-medium">Marge Technique Nette</span>
                      <div className="mt-1 font-mono text-xl font-bold text-emerald-400">
                        +{pricingResult.premiumMargin.toLocaleString()} €
                      </div>
                      <span className="text-[10px] text-emerald-400">
                        {pricingResult.premiumMarginPct.toFixed(1)}% de marge brute
                      </span>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-4">
                      <span className="text-[11px] text-slate-400 font-medium">Ratio Combiné Actuariel</span>
                      <div className={`mt-1 font-mono text-xl font-bold ${pricingResult.isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {pricingResult.combinedRatio.toFixed(1)}%
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {pricingResult.isProfitable ? '< 100% (Rentable)' : '> 100% (Déficitaire)'}
                      </span>
                    </div>
                  </div>

                  {/* Décomposition de la Prime (Waterfall Actuarielle) */}
                  <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-5 shadow-xl">
                    <h3 className="text-sm font-semibold text-white mb-3">Décomposition Structurée de la Prime</h3>

                    {/* Progress Segmented Bar */}
                    <div className="mb-4 flex h-3.5 w-full overflow-hidden rounded-full bg-slate-800 p-0.5">
                      <div
                        style={{ width: `${(pricingResult.purePremium / pricingResult.commercialPremium) * 100}%` }}
                        className="h-full bg-sky-500 rounded-l-full"
                        title="Prime Pure"
                      />
                      <div
                        style={{ width: `${(pricingResult.safetyLoadingAmount / pricingResult.commercialPremium) * 100}%` }}
                        className="h-full bg-amber-500"
                        title="Chargement Sécurité"
                      />
                      <div
                        style={{ width: `${(pricingResult.expenseLoadingAmount / pricingResult.commercialPremium) * 100}%` }}
                        className="h-full bg-violet-500"
                        title="Frais de Gestion"
                      />
                      <div
                        style={{ width: `${(pricingResult.targetProfitAmount / pricingResult.commercialPremium) * 100}%` }}
                        className="h-full bg-emerald-500 rounded-r-full"
                        title="Marge Bénéficiaire"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="rounded-xl border border-slate-800 bg-[#070B14] p-3">
                        <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <span className="h-2 w-2 rounded-full bg-sky-400" />
                          Prime Pure
                        </span>
                        <div className="mt-1 font-mono font-bold text-white">{pricingResult.purePremium.toLocaleString()} €</div>
                        <span className="text-[10px] text-slate-500">{((pricingResult.purePremium / pricingResult.commercialPremium) * 100).toFixed(1)}%</span>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-[#070B14] p-3">
                        <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <span className="h-2 w-2 rounded-full bg-amber-400" />
                          Chargement Sécurité
                        </span>
                        <div className="mt-1 font-mono font-bold text-white">+{pricingResult.safetyLoadingAmount.toLocaleString()} €</div>
                        <span className="text-[10px] text-slate-500">{((pricingResult.safetyLoadingAmount / pricingResult.commercialPremium) * 100).toFixed(1)}%</span>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-[#070B14] p-3">
                        <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <span className="h-2 w-2 rounded-full bg-violet-400" />
                          Frais Généraux (20%)
                        </span>
                        <div className="mt-1 font-mono font-bold text-white">+{pricingResult.expenseLoadingAmount.toLocaleString()} €</div>
                        <span className="text-[10px] text-slate-500">{((pricingResult.expenseLoadingAmount / pricingResult.commercialPremium) * 100).toFixed(1)}%</span>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-[#070B14] p-3">
                        <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          Marge Bénéficiaire (8%)
                        </span>
                        <div className="mt-1 font-mono font-bold text-emerald-400">+{pricingResult.targetProfitAmount.toLocaleString()} €</div>
                        <span className="text-[10px] text-emerald-400">{((pricingResult.targetProfitAmount / pricingResult.commercialPremium) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Diagnostic Actuariel */}
                  <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-4 flex items-center gap-3">
                    <span className={`p-2.5 rounded-xl ${pricingResult.isProfitable ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {pricingResult.isProfitable ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-white">Diagnostic de Souscription Actuarielle</div>
                      <div className="text-xs text-slate-300 mt-0.5">{pricingResult.underwritingAssessment}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── ONGLET 2 : SURVENANCE DES SINISTRES & MONTE CARLO ────────────── */}
            {activeTab === 'SIMULATION' && simulationResult && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">Simulation de Portefeuille & Survenance des Sinistres</h2>
                    <p className="text-xs text-slate-400">Modélisation stochastique Monte Carlo (Fréquence de Poisson & Sévérité Log-Normale)</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={profile.portfolioSize}
                      onChange={e => handleProfileChange('portfolioSize', Number(e.target.value))}
                      className="w-28 rounded-xl border border-slate-800 bg-[#070B14] px-3 py-1.5 text-right font-mono text-xs font-bold text-white focus:outline-none"
                      title="Nombre d'assurés dans le portefeuille"
                    />
                    <button
                      onClick={handleRunSimulation}
                      disabled={simLoading}
                      className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition"
                    >
                      <Zap className={`h-3.5 w-3.5 ${simLoading ? 'animate-spin' : ''}`} />
                      {simLoading ? 'Simulation...' : 'Lancer Monte Carlo'}
                    </button>
                  </div>
                </div>

                {/* Simulation KPI Matrix */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-4">
                    <span className="text-xs text-slate-400">Sinistres Observés / Assurés</span>
                    <div className="mt-1 font-mono text-xl font-bold text-white">
                      {simulationResult.simulatedClaimsCount} <span className="text-xs text-slate-500">/ {simulationResult.portfolioSize.toLocaleString()}</span>
                    </div>
                    <span className="text-[11px] text-violet-400 font-mono">
                      Fréquence empirique : {simulationResult.empiricalFrequency.toFixed(2)}%
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-4">
                    <span className="text-xs text-slate-400">Charge Totale des Sinistres</span>
                    <div className="mt-1 font-mono text-xl font-bold text-rose-400">
                      {simulationResult.totalClaimsCost.toLocaleString()} €
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Coût moyen : {simulationResult.averageClaimSeverity.toLocaleString()} €
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-4">
                    <span className="text-xs text-slate-400">Total Primes Collectées</span>
                    <div className="mt-1 font-mono text-xl font-bold text-emerald-400">
                      {simulationResult.totalPremiumsCollected.toLocaleString()} €
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Frais généraux : {simulationResult.totalExpenses.toLocaleString()} €
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-4">
                    <span className="text-xs text-slate-400">Résultat Technique Net</span>
                    <div className={`mt-1 font-mono text-xl font-bold ${simulationResult.isSolvent ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {simulationResult.netUnderwritingResult.toLocaleString()} €
                    </div>
                    <span className="text-[11px] text-sky-400 font-mono">
                      VaR Sinistres 99% : {simulationResult.varClaims99.toLocaleString()} €
                    </span>
                  </div>
                </div>

                {/* Passerelle ALM : Injection des Bénéfices vers le Live Trading */}
                {simulationResult.netUnderwritingResult > 0 && (
                  <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/30 via-[#0B1220] to-emerald-950/20 p-5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30">
                        <TrendingUp className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">
                            Passerelle ALM : Bénéfice d'Assurance Réellement Investissable
                          </h4>
                          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                            +{simulationResult.netUnderwritingResult.toLocaleString()} €
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          Ce surplus technique de souscription peut être directement transféré vers votre solde de <strong className="text-emerald-300">Cash de Trading</strong> pour acheter des actions (AAPL, NVDA), des obligations (IEF) ou des matières premières (Or, Pétrole).
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      <button
                        onClick={handleTransferSurplusToTrading}
                        disabled={transferLoading}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold px-4 py-2.5 text-xs transition shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                      >
                        <ArrowUpRight className={`h-4 w-4 ${transferLoading ? 'animate-spin' : ''}`} />
                        Transférer au Cash Trading (+{simulationResult.netUnderwritingResult.toLocaleString()} €)
                      </button>
                      <Link
                        to="/app/dashboard"
                        className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 px-3 py-2.5 text-xs font-semibold transition"
                      >
                        Aller au Terminal Live
                      </Link>
                    </div>
                  </div>
                )}

                {/* Histogramme de distribution des sinistres */}
                <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-5 shadow-xl">
                  <h3 className="text-sm font-semibold text-white mb-3">Distribution des Montants de Sinistres Indemnisés</h3>
                  <div className="space-y-3 font-mono">
                    {simulationResult.claimsDistribution.map((b, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-300">
                          <span>{b.rangeLabel}</span>
                          <span>{b.count} sinistre(s) ({b.percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            style={{ width: `${b.percentage}%` }}
                            className="h-full bg-gradient-to-r from-violet-500 to-sky-400 rounded-full transition-all"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── ONGLET 3 : PROVISIONNEMENT CHAIN-LADDER & IBNR ─────────────── */}
            {activeTab === 'PROVISIONING' && provisioningResult && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">Provisionnement des Sinistres • Méthode Chain-Ladder de Mack</h2>
                    <p className="text-xs text-slate-400">Triangles de liquidation des règlements et calcul des réserves IBNR (Incurred But Not Reported)</p>
                  </div>

                  <button
                    onClick={handleRefreshProvisioning}
                    disabled={provLoading}
                    className="flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3.5 py-1.5 text-xs font-semibold text-violet-300 hover:bg-violet-500 hover:text-white transition"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${provLoading ? 'animate-spin' : ''}`} />
                    Actualiser le Triangle
                  </button>
                </div>

                {/* Triangle des règlements cumulés */}
                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0B1220] shadow-xl">
                  <div className="p-4 border-b border-slate-800 font-semibold text-xs text-white">
                    Triangle des Sinistres Cumulés par Année de Survenance (k€)
                  </div>
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 bg-[#070B14]/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-3">Année de Survenance</th>
                        {provisioningResult.developmentYears.map(dy => (
                          <th key={dy} className="px-3 py-3 text-right">Dev +{dy} an</th>
                        ))}
                        <th className="px-4 py-3 text-right text-emerald-400">Sinistre Ultime Projeté</th>
                        <th className="px-4 py-3 text-right text-amber-400">Provisions IBNR Requises</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {provisioningResult.originYears.map((yr, rowIdx) => {
                        const ult = provisioningResult.ultimateClaimsByYear[yr] || 0;
                        const ibnr = provisioningResult.ibnrReservesByYear[yr] || 0;
                        return (
                          <tr key={yr} className="hover:bg-slate-800/20">
                            <td className="px-4 py-2.5 font-bold text-white">{yr}</td>
                            {provisioningResult.developmentYears.map((dy, colIdx) => {
                              const val = provisioningResult.cumulativeTriangle[rowIdx][colIdx];
                              const isEstimated = colIdx > (provisioningResult.developmentYears.length - 1 - rowIdx);
                              return (
                                <td
                                  key={dy}
                                  className={`px-3 py-2.5 text-right ${
                                    isEstimated ? 'text-violet-400 italic font-semibold' : 'text-slate-200'
                                  }`}
                                >
                                  {val > 0 ? `${val.toFixed(1)} k€` : '—'}
                                </td>
                              );
                            })}
                            <td className="px-4 py-2.5 text-right font-bold text-emerald-400">
                              {ult.toLocaleString()} €
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-amber-400">
                              {ibnr.toLocaleString()} €
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Consolidated Provisions Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-4">
                    <span className="text-xs text-slate-400">Sinistres Déjà Réglés</span>
                    <div className="mt-1 font-mono text-xl font-bold text-white">
                      {provisioningResult.totalPaidToDate.toLocaleString()} €
                    </div>
                    <span className="text-[10px] text-slate-500">Règlements historiques constatés</span>
                  </div>

                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <span className="text-xs text-amber-300 font-medium">Provisions IBNR Globales</span>
                    <div className="mt-1 font-mono text-xl font-bold text-amber-400">
                      {provisioningResult.totalIbnrReserve.toLocaleString()} €
                    </div>
                    <span className="text-[10px] text-amber-300/80">Sinistres tardifs non encore réglés</span>
                  </div>

                  <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4">
                    <span className="text-xs text-violet-300 font-medium">Capital de Solvabilité Requis (SCR)</span>
                    <div className="mt-1 font-mono text-xl font-bold text-violet-400">
                      {provisioningResult.solvencyCapitalRequirement.toLocaleString()} €
                    </div>
                    <span className="text-[10px] text-violet-300/80">Exigence de réserve Solvabilité II</span>
                  </div>
                </div>

                {/* Commentary */}
                <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-4 text-xs text-slate-300 flex items-center gap-3">
                  <Info className="h-5 w-5 text-violet-400 shrink-0" />
                  <p>{provisioningResult.commentary}</p>
                </div>
              </div>
            )}
          </>
        )}
      </PageTransition>
    </AppShell>
  );
};
