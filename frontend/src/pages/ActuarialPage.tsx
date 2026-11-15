import React, { useState, useEffect } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { PageTransition, QuantOrbitalLoader, useToast } from '../components/ui';
import {
  actuaryApi,
  InsuranceProductType,
  PolicyholderProfile,
  ActuarialPricingResult,
  ClaimSimulationResult,
  ProvisioningResult,
  InsuranceProductInfo,
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
} from 'lucide-react';

export const ActuarialPage: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'PRICING' | 'SIMULATION' | 'PROVISIONING'>('PRICING');

  // Products and profile state
  const [products, setProducts] = useState<InsuranceProductInfo[]>([]);
  const activeProductInfo = products.find(p => p.type === profile.productType);
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

  // Results state
  const [pricingResult, setPricingResult] = useState<ActuarialPricingResult | null>(null);
  const [simulationResult, setSimulationResult] = useState<ClaimSimulationResult | null>(null);
  const [provisioningResult, setProvisioningResult] = useState<ProvisioningResult | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [pricingLoading, setPricingLoading] = useState<boolean>(false);
  const [simLoading, setSimLoading] = useState<boolean>(false);
  const [provLoading, setProvLoading] = useState<boolean>(false);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [prods, pricing, sim, prov] = await Promise.all([
          actuaryApi.getProducts().catch(() => []),
          actuaryApi.calculatePricing(profile),
          actuaryApi.simulateClaims(profile),
          actuaryApi.getProvisioning('AUTO'),
        ]);
        setProducts(prods);
        setPricingResult(pricing);
        setSimulationResult(sim);
        setProvisioningResult(prov);
      } catch (err: any) {
        toast.error('Erreur actuariat', err?.message || 'Connexion au moteur actuariel impossible');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

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
              { id: 'PRICING', label: 'Tarification Prédictive & Marges', icon: Calculator },
              { id: 'SIMULATION', label: 'Survenance des Sinistres (Monte Carlo)', icon: Zap },
              { id: 'PROVISIONING', label: 'Provisionnement Chain-Ladder (IBNR)', icon: Table },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30 ring-1 ring-violet-400'
                      : 'border border-slate-800 bg-[#070B14]/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
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
