import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  Activity,
  BarChart3,
  PieChart,
  RefreshCw,
  CheckCircle2,
  Layers,
  ArrowUpRight,
  Sliders,
  Sparkles,
} from 'lucide-react';
import {
  PortfolioRiskAnalytics,
  getPortfolioRiskAnalytics,
  acknowledgeRiskAlert,
} from '../../api/trading';
import { AssetLogo, OrbitalSpinner, useToast } from '../ui';

interface PortfolioRiskAnalyticsViewProps {
  sessionId?: number;
  onOpenLimitsModal?: () => void;
  onSelectSymbol?: (symbol: string) => void;
}

export const PortfolioRiskAnalyticsView: React.FC<PortfolioRiskAnalyticsViewProps> = ({
  sessionId = 0,
  onOpenLimitsModal,
  onSelectSymbol,
}) => {
  const toast = useToast();
  const [data, setData] = useState<PortfolioRiskAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confidenceLevel, setConfidenceLevel] = useState<'95' | '99'>('95');
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'contributions' | 'sectors' | 'correlation' | 'audit'>('overview');

  const fetchAnalytics = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const result = await getPortfolioRiskAnalytics(sessionId);
      setData(result);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Impossible de charger les métriques de risque du portefeuille.";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleAcknowledge = async (alertId: number) => {
    setAcknowledgingId(alertId);
    try {
      await acknowledgeRiskAlert(alertId);
      toast.success('Alerte acquittée', 'Le niveau de risque a été pris en compte.');
      // Update local state without full reload
      if (data) {
        setData({
          ...data,
          activeAlerts: data.activeAlerts.filter((a) => a.id !== alertId),
        });
      }
    } catch (err: unknown) {
      toast.error('Erreur', "Impossible d'acquitter l'alerte.");
    } finally {
      setAcknowledgingId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[360px] p-8 text-center bg-[#070B14] rounded-2xl border border-subtle">
        <OrbitalSpinner size="lg" tone="cyan" />
        <p className="mt-4 text-xs font-mono text-slate-300 font-semibold">
          Calcul des métriques de risque du portefeuille...
        </p>
        <p className="mt-1 text-[11px] font-mono text-slate-500">
          Simulation historique VaR/CVaR, décomposition d'Euler et matrice de covariance en cours...
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 text-center bg-[#070B14] rounded-2xl border border-rose-500/20">
        <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
        <h3 className="text-white font-bold text-sm mb-1">Erreur d'analyse de risque</h3>
        <p className="text-slate-400 text-xs font-mono mb-4">{error}</p>
        <button
          onClick={() => fetchAnalytics()}
          className="px-4 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/30 text-sky-300 text-xs font-mono font-medium inline-flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Réessayer
        </button>
      </div>
    );
  }

  if (!data) return null;

  const currentVaRPct = confidenceLevel === '95' ? data.var95Pct : data.var99Pct;
  const currentVaRAmount = confidenceLevel === '95' ? data.var95Amount : data.var99Amount;
  const currentCVaRPct = confidenceLevel === '95' ? data.cvar95Pct : data.cvar99Pct;
  const currentCVaRAmount = confidenceLevel === '95' ? data.cvar95Amount : data.cvar99Amount;

  return (
    <div className="space-y-6">
      {/* Top Header & Telemetry Bar */}
      <div className="bg-[#0B1220] border border-subtle rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shadow-[0_0_15px_-3px_rgba(56,189,248,0.35)]">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                  Intelligence des Risques & Post-Trade
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold uppercase ${
                    data.observationStatus === 'ROBUST'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : data.observationStatus === 'LIMITED_HISTORY'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {data.observationStatus === 'ROBUST'
                    ? 'Historique Robuste (60j+)'
                    : data.observationStatus === 'LIMITED_HISTORY'
                    ? 'Historique Partiel'
                    : 'Portefeuille Cash'}
                </span>
              </div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                Analyse Quantitative du Portefeuille
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Confidence Level Toggle */}
          <div className="flex items-center bg-[#070B14] p-1 rounded-xl border border-subtle">
            <button
              onClick={() => setConfidenceLevel('95')}
              className={`px-3 py-1 text-xs font-mono font-semibold rounded-lg transition-all ${
                confidenceLevel === '95'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              VaR 95% (Standard)
            </button>
            <button
              onClick={() => setConfidenceLevel('99')}
              className={`px-3 py-1 text-xs font-mono font-semibold rounded-lg transition-all ${
                confidenceLevel === '99'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              VaR 99% (Stress Test)
            </button>
          </div>

          {/* Config Limits Shortcut */}
          {onOpenLimitsModal && (
            <button
              onClick={onOpenLimitsModal}
              className="px-3 py-1.5 rounded-xl bg-[#070B14] hover:bg-[#101A2B] border border-subtle text-slate-300 hover:text-white text-xs font-mono font-medium flex items-center gap-1.5 transition"
            >
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span>Limites</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
            className="p-1.5 rounded-xl bg-[#070B14] hover:bg-[#101A2B] border border-subtle text-slate-300 hover:text-white text-xs transition disabled:opacity-40"
            title="Rafraîchir les métriques"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Intelligent Risk Alerts Banner */}
      {data.activeAlerts && data.activeAlerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono px-1">
            <span className="text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Alertes de Risque Actives ({data.activeAlerts.length})
            </span>
            <span className="text-slate-500 text-[11px]">Surveillance continue en temps réel</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.activeAlerts.map((alert) => (
              <motion.div
                key={alert.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                  alert.severity === 'CRITICAL'
                    ? 'bg-rose-950/20 border-rose-500/40 shadow-[0_0_15px_-4px_rgba(239,68,68,0.2)]'
                    : alert.severity === 'WARNING'
                    ? 'bg-amber-950/20 border-amber-500/40 shadow-[0_0_15px_-4px_rgba(245,158,11,0.2)]'
                    : 'bg-sky-950/20 border-sky-500/30'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                          alert.severity === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : alert.severity === 'WARNING'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        }`}
                      >
                        {alert.severity}
                      </span>
                      <h4 className="text-xs font-bold text-white font-mono">{alert.title}</h4>
                    </div>

                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-2.5">{alert.description}</p>

                  {/* Suggestion pill */}
                  {alert.suggestion && (
                    <div className="bg-[#070B14]/80 border border-subtle rounded-lg px-2.5 py-2 text-[11px] text-sky-300 font-mono flex items-start gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 shrink-0 text-sky-400 mt-0.5" />
                      <span>{alert.suggestion}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    {alert.affectedSymbols && alert.affectedSymbols.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500 font-mono">Actifs :</span>
                        {alert.affectedSymbols.map((s) => (
                          <span
                            key={s}
                            onClick={() => onSelectSymbol?.(s)}
                            className="text-[10px] font-mono font-bold text-sky-400 bg-sky-950/40 px-1.5 py-0.5 rounded border border-sky-500/20 cursor-pointer hover:border-sky-400 transition"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    disabled={acknowledgingId === alert.id}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-mono font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    {acknowledgingId === alert.id ? (
                      <OrbitalSpinner size="xs" tone="cyan" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    )}
                    <span>Acquitter</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Primary KPI Grid (VaR, CVaR, Volatility, Drawdown, Beta, HHI) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Value at Risk */}
        <div className="bg-[#0B1220] border border-subtle rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-sky-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">VaR ({confidenceLevel}%)</span>
            <span className="text-[10px] font-mono text-sky-400 font-semibold">1-Jour</span>
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-white tabular-nums">
              {currentVaRAmount != null ? (
                `-$${Math.abs(currentVaRAmount).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              ) : (
                <span className="text-slate-500 text-sm">--</span>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-1">
              <span>Perte max seuil</span>
              <span className="text-rose-400 font-semibold tabular-nums">
                {currentVaRPct != null ? `-${Math.abs(currentVaRPct).toFixed(2)}%` : '--'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Conditional VaR (Expected Shortfall) */}
        <div className="bg-[#0B1220] border border-subtle rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">CVaR ({confidenceLevel}%)</span>
            <span className="text-[10px] font-mono text-rose-400 font-semibold">Tail Risk</span>
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-white tabular-nums">
              {currentCVaRAmount != null ? (
                `-$${Math.abs(currentCVaRAmount).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              ) : (
                <span className="text-slate-500 text-sm">--</span>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-1">
              <span>Perte moy. queue</span>
              <span className="text-rose-400 font-semibold tabular-nums">
                {currentCVaRPct != null ? `-${Math.abs(currentCVaRPct).toFixed(2)}%` : '--'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Annualized Volatility */}
        <div className="bg-[#0B1220] border border-subtle rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">Volatilité (σ)</span>
            <span className="text-[10px] font-mono text-cyan-400 font-semibold">Annualisée</span>
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-white tabular-nums">
              {data.annualizedVolatilityPct != null ? (
                `${data.annualizedVolatilityPct.toFixed(2)}%`
              ) : (
                <span className="text-slate-500 text-sm">--</span>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-1">
              <span>Vol. journalière</span>
              <span className="text-slate-300 font-semibold tabular-nums">
                {data.dailyVolatilityPct != null ? `${data.dailyVolatilityPct.toFixed(2)}%` : '--'}
              </span>
            </div>
          </div>
        </div>

        {/* 4. Maximum Drawdown */}
        <div className="bg-[#0B1220] border border-subtle rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">Drawdown</span>
            <span className="text-[10px] font-mono text-amber-400 font-semibold">Max Hist.</span>
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-white tabular-nums">
              {data.maxHistoricalDrawdownPct != null ? (
                `-${Math.abs(data.maxHistoricalDrawdownPct).toFixed(2)}%`
              ) : (
                '0.00%'
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-1">
              <span>Actuel</span>
              <span
                className={`font-semibold tabular-nums ${
                  data.currentDrawdownPct > 0.1 ? 'text-amber-400' : 'text-slate-300'
                }`}
              >
                {data.currentDrawdownPct > 0 ? `-${data.currentDrawdownPct.toFixed(2)}%` : '0.00%'}
              </span>
            </div>
          </div>
        </div>

        {/* 5. Benchmark Beta */}
        <div className="bg-[#0B1220] border border-subtle rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">Beta (β)</span>
            <span className="text-[10px] font-mono text-indigo-400 font-semibold">
              vs {data.benchmarkSymbol}
            </span>
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-white tabular-nums">
              {data.beta != null ? (
                data.beta.toFixed(2)
              ) : (
                <span className="text-slate-500 text-sm">N/A</span>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-1">
              <span>Sensibilité</span>
              <span className="text-slate-300 font-semibold">
                {data.beta == null
                  ? 'Cash / Neutre'
                  : data.beta > 1.2
                  ? 'Agressif'
                  : data.beta < 0.8
                  ? 'Défensif'
                  : 'Équilibré'}
              </span>
            </div>
          </div>
        </div>

        {/* 6. Concentration (HHI) */}
        <div className="bg-[#0B1220] border border-subtle rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">Indice HHI</span>
            <span className="text-[10px] font-mono text-emerald-400 font-semibold">Herfindahl</span>
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-white tabular-nums">
              {data.hhi != null ? data.hhi.toFixed(3) : '0.000'}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-1">
              <span>Profil</span>
              <span
                className={`font-semibold ${
                  data.hhiLevel === 'DIVERSIFIED'
                    ? 'text-emerald-400'
                    : data.hhiLevel === 'MODERATE'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {data.hhiLevel === 'DIVERSIFIED'
                  ? 'Diversifié'
                  : data.hhiLevel === 'MODERATE'
                  ? 'Modéré'
                  : 'Concentré'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center border-b border-subtle gap-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Vue Globale & Évolution', icon: Activity },
          { id: 'contributions', label: 'Contribution par Actif (Euler)', icon: BarChart3, badge: data.positionsRisk?.length },
          { id: 'sectors', label: 'Concentration Sectorielle', icon: PieChart, badge: data.sectorConcentration?.length },
          { id: 'correlation', label: 'Matrice de Corrélation', icon: Layers },
          { id: 'audit', label: 'Audit Post-Trade & Deltas', icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-semibold border-b-2 transition whitespace-nowrap ${
                isActive
                  ? 'border-sky-400 text-sky-400 bg-sky-500/5'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge != null && tab.badge > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview & Risk Evolution Chart */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Methodology Explanations Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#0B1220] border border-subtle rounded-2xl p-4">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-sky-400 mb-2">
                <Info className="w-4 h-4" />
                <span>Méthodologie VaR & CVaR (Simulation Historique)</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-mono">
                {data.varMethodology ||
                  "VaR calculée par rééchantillonnage historique complet sur les rendements alignés à 1 jour."}
              </p>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed font-mono border-t border-slate-800/80 pt-2">
                {data.cvarExplanation ||
                  "La CVaR (Expected Shortfall) quantifie l'espérance de perte moyenne dans les pires 5% (ou 1%) des scénarios extrêmes."}
              </p>
            </div>

            <div className="bg-[#0B1220] border border-subtle rounded-2xl p-4">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400 mb-2">
                <ShieldAlert className="w-4 h-4" />
                <span>Diagnostic de Diversification & Benchmark</span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Ratio de Diversification (DR) :</span>
                  <span className="font-bold text-white">
                    {data.diversificationRatio != null ? data.diversificationRatio.toFixed(2) : '--'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Plus grand contributeur au risque :</span>
                  <span className="font-bold text-amber-400">
                    {data.largestRiskContributor || 'Aucun (Cash)'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Equity Sommet (Peak) :</span>
                  <span className="font-bold text-emerald-400">
                    ${data.peakEquity?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Equity & Drawdown Evolution SVG Curve */}
          <div className="bg-[#0B1220] border border-subtle rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                  Trajectoire Historique
                </span>
                <h3 className="text-sm font-bold text-white font-mono">
                  Évolution de l'Equity & Courbe sous l'eau (Underwater Drawdown)
                </h3>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-sky-400 rounded-full" />
                  <span className="text-slate-300">Equity ($)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-rose-400/80 rounded-full" />
                  <span className="text-slate-300">Drawdown (%)</span>
                </div>
              </div>
            </div>

            {data.riskEvolution && data.riskEvolution.length > 1 ? (
              <div className="h-56 w-full relative">
                {/* Visual SVG Curve */}
                <svg className="w-full h-full overflow-visible" viewBox="0 0 800 200" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity="0.0" />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity="0.2" />
                    </linearGradient>
                  </defs>

                  {/* Build SVG points */}
                  {(() => {
                    const points = data.riskEvolution;
                    const equities = points.map((p) => Number(p.equity));
                    const minEq = Math.min(...equities) * 0.98;
                    const maxEq = Math.max(...equities) * 1.02;
                    const eqRange = maxEq - minEq || 1;

                    const coords = points.map((p, idx) => {
                      const x = (idx / (points.length - 1)) * 800;
                      const y = 170 - ((Number(p.equity) - minEq) / eqRange) * 140;
                      return { x, y, dd: Number(p.drawdownPct), eq: Number(p.equity), ts: p.ts };
                    });

                    const polylineStr = coords.map((c) => `${c.x},${c.y}`).join(' ');
                    const areaStr = `0,180 ${polylineStr} 800,180`;

                    return (
                      <>
                        {/* Grid lines */}
                        <line x1="0" y1="30" x2="800" y2="30" stroke="#1E293B" strokeDasharray="3 3" />
                        <line x1="0" y1="100" x2="800" y2="100" stroke="#1E293B" strokeDasharray="3 3" />
                        <line x1="0" y1="170" x2="800" y2="170" stroke="#1E293B" />

                        {/* Fill area under equity */}
                        <polygon points={areaStr} fill="url(#equityGrad)" />

                        {/* Main equity line */}
                        <polyline
                          points={polylineStr}
                          fill="none"
                          stroke="#38BDF8"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Data dots */}
                        {coords.map((c, i) => (
                          <circle
                            key={i}
                            cx={c.x}
                            cy={c.y}
                            r={i === coords.length - 1 ? 4 : 2}
                            fill="#38BDF8"
                            stroke="#070B14"
                            strokeWidth="2"
                          />
                        ))}
                      </>
                    );
                  })()}
                </svg>

                <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 mt-2 px-1">
                  <span>Début observation</span>
                  <span>Point de référence : {data.observationWindow} observations</span>
                  <span>Temps réel</span>
                </div>
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-center text-slate-500 text-xs font-mono border border-dashed border-slate-800 rounded-xl">
                <Activity className="w-6 h-6 mb-2 text-slate-600" />
                <span>Observations historiques en cours de constitution.</span>
                <span className="text-[11px] text-slate-600 mt-1">
                  Passez des simulations d'ordres pour enregistrer des instantanés de portefeuille.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Position Risk Contribution (Euler Component Risk) */}
      {activeTab === 'contributions' && (
        <div className="bg-[#0B1220] border border-subtle rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                Décomposition d'Euler
              </span>
              <h3 className="text-sm font-bold text-white font-mono">
                Contribution Marginale & Risque par Position
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Formule : Component Risk = w_i × Marginal Risk
            </span>
          </div>

          {data.positionsRisk && data.positionsRisk.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-subtle text-slate-400 text-[11px]">
                    <th className="py-2.5 px-3">Actif</th>
                    <th className="py-2.5 px-3">Secteur</th>
                    <th className="py-2.5 px-3 text-right">Valeur Marché</th>
                    <th className="py-2.5 px-3 text-right">Poids Ptf (%)</th>
                    <th className="py-2.5 px-3 text-right">Volatilité (σ)</th>
                    <th className="py-2.5 px-3 text-right">Contribution Risque (%)</th>
                    <th className="py-2.5 px-3 text-right">Ratio Risque/Poids</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.positionsRisk.map((pos) => {
                    const weight = Number(pos.weightPct);
                    const riskContrib = Number(pos.riskContributionPct);
                    const ratio = weight > 0 ? riskContrib / weight : 1;
                    return (
                      <tr key={pos.symbol} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3">
                          <div
                            onClick={() => onSelectSymbol?.(pos.symbol)}
                            className="flex items-center gap-2 cursor-pointer group"
                          >
                            <AssetLogo symbol={pos.symbol} size="sm" />
                            <div>
                              <div className="font-bold text-white group-hover:text-sky-400 transition flex items-center gap-1">
                                {pos.symbol}
                                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {pos.quantity} @ ${Number(pos.currentPrice).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-slate-300 px-2 py-0.5 rounded-full bg-slate-800/60 border border-slate-700/60 text-[10px]">
                            {pos.sector}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-white font-semibold tabular-nums">
                          ${Number(pos.marketValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-300 tabular-nums">
                          {weight.toFixed(2)}%
                        </td>
                        <td className="py-3 px-3 text-right text-slate-300 tabular-nums">
                          {Number(pos.assetVolatilityPct).toFixed(2)}%
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span
                              className={`font-bold tabular-nums ${
                                riskContrib > weight * 1.3
                                  ? 'text-rose-400'
                                  : riskContrib < weight * 0.8
                                  ? 'text-emerald-400'
                                  : 'text-sky-300'
                              }`}
                            >
                              {riskContrib.toFixed(2)}%
                            </span>
                            {/* Visual mini bar */}
                            <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  riskContrib > 35 ? 'bg-rose-500' : riskContrib > 20 ? 'bg-amber-400' : 'bg-sky-400'
                                }`}
                                style={{ width: `${Math.min(riskContrib, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              ratio > 1.3
                                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                : ratio < 0.8
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {ratio.toFixed(2)}x
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 font-mono text-xs">
              Aucune position ouverte actuellement dans le portefeuille.
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Sector Concentration Breakdown */}
      {activeTab === 'sectors' && (
        <div className="bg-[#0B1220] border border-subtle rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                Diversification & Macro
              </span>
              <h3 className="text-sm font-bold text-white font-mono">
                Exposition & Concentration par Secteur d'Activité
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Limite standard recommandée : &le; 40% par secteur
            </span>
          </div>

          {data.sectorConcentration && data.sectorConcentration.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.sectorConcentration.map((sec) => {
                const weight = Number(sec.weightPct);
                const isOverLimit = weight > 40;
                return (
                  <div
                    key={sec.sector}
                    className={`bg-[#070B14] border rounded-xl p-4 flex flex-col justify-between ${
                      isOverLimit ? 'border-amber-500/40 bg-amber-950/10' : 'border-subtle'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold font-mono text-white">{sec.sector}</span>
                        <span
                          className={`text-xs font-mono font-bold tabular-nums px-2 py-0.5 rounded ${
                            isOverLimit
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-sky-500/10 text-sky-300 border border-sky-400/20'
                          }`}
                        >
                          {weight.toFixed(1)}%
                        </span>
                      </div>

                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden mb-3">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isOverLimit ? 'bg-amber-400' : 'bg-sky-400'
                          }`}
                          style={{ width: `${Math.min(weight, 100)}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 mb-2">
                        <span>Valeur marchande :</span>
                        <span className="text-white font-semibold tabular-nums">
                          ${Number(sec.marketValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-500">{sec.assetsCount} actif(s)</span>
                      <div className="flex items-center gap-1">
                        {sec.symbols.map((sym) => (
                          <span
                            key={sym}
                            onClick={() => onSelectSymbol?.(sym)}
                            className="bg-slate-800/80 hover:bg-slate-700 px-1.5 py-0.5 rounded text-slate-300 cursor-pointer transition"
                          >
                            {sym}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 font-mono text-xs">
              Aucune exposition sectorielle active.
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Correlation Matrix Heatmap */}
      {activeTab === 'correlation' && (
        <div className="bg-[#0B1220] border border-subtle rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                Covariance Multi-Actifs
              </span>
              <h3 className="text-sm font-bold text-white font-mono">
                Matrice de Corrélation de Pearson (K × K)
              </h3>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-blue-600 inline-block" /> Inverse (-1.0)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-slate-700 inline-block" /> Neutre (0.0)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" /> Corrélation Forte (+1.0)
              </span>
            </div>
          </div>

          {(() => {
            const corr = data.correlationMatrix;
            if (!corr || !corr.symbols || corr.symbols.length <= 1) {
              return (
                <div className="py-12 text-center text-slate-500 font-mono text-xs">
                  Au moins 2 actifs distincts avec historique de prix sont nécessaires pour calculer la matrice de corrélation.
                </div>
              );
            }

            return (
              <div className="space-y-4">
                {/* High correlation warnings banner */}
                {corr.highlyCorrelatedPairs && corr.highlyCorrelatedPairs.length > 0 && (
                  <div className="bg-amber-950/20 border border-amber-500/40 rounded-xl p-3 text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold mb-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Paires Fortement Corrélées Détectées (&rho; &gt; 0.85) :
                    </div>
                    <ul className="space-y-1 text-slate-300">
                      {corr.highlyCorrelatedPairs.map((pair, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="text-white font-bold">
                            {pair.symbolA} & {pair.symbolB} :
                          </span>
                          <span className="text-rose-400 font-semibold tabular-nums">
                            &rho; = {pair.correlation.toFixed(3)}
                          </span>
                          <span className="text-slate-400 text-[11px]">— {pair.warning}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Heatmap Grid */}
                <div className="overflow-x-auto">
                  <table className="border-collapse text-center font-mono text-xs mx-auto">
                    <thead>
                      <tr>
                        <th className="p-2 border border-slate-800 bg-[#070B14] text-slate-400 font-bold" />
                        {corr.symbols.map((sym) => (
                          <th
                            key={sym}
                            className="p-2 border border-slate-800 bg-[#070B14] text-white font-bold min-w-[64px]"
                          >
                            {sym}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {corr.symbols.map((rowSym, rIdx) => (
                        <tr key={rowSym}>
                          <th className="p-2 border border-slate-800 bg-[#070B14] text-white font-bold text-left px-3">
                            {rowSym}
                          </th>
                          {corr.matrix[rIdx].map((val, cIdx) => {
                            const isSelf = rIdx === cIdx;

                            // Compute background color gradient
                            let bgStyle = 'bg-slate-800/40 text-slate-300';
                            if (isSelf) {
                              bgStyle = 'bg-slate-800 text-slate-400 font-bold';
                            } else if (val > 0.85) {
                              bgStyle = 'bg-rose-500/40 text-rose-200 font-bold border border-rose-500/50';
                            } else if (val > 0.5) {
                              bgStyle = 'bg-amber-500/25 text-amber-200 font-semibold';
                            } else if (val > 0.1) {
                              bgStyle = 'bg-sky-500/15 text-sky-200';
                            } else if (val < -0.2) {
                              bgStyle = 'bg-blue-600/30 text-blue-200 font-semibold';
                            }

                            return (
                              <td
                                key={cIdx}
                                className={`p-2.5 border border-slate-800/80 transition cursor-default ${bgStyle}`}
                                title={`${rowSym} / ${corr.symbols[cIdx]} : ${val.toFixed(4)}`}
                              >
                                <span className="tabular-nums">{val.toFixed(2)}</span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Tab 5: Post-Trade Audit & Deltas */}
      {activeTab === 'audit' && (
        <div className="bg-[#0B1220] border border-subtle rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                Surveillance Post-Exécution
              </span>
              <h3 className="text-sm font-bold text-white font-mono">
                Audit de l'Impact de Risque par Transaction (&Delta; Avant / Après)
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Évaluation automatique après chaque ordre de marché ou SL/TP
            </span>
          </div>

          {data.lastPostTradeImpact ? (
            <div className="space-y-4">
              <div className="bg-[#070B14] border border-subtle rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        data.lastPostTradeImpact.side === 'BUY'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {data.lastPostTradeImpact.side} {data.lastPostTradeImpact.quantity} {data.lastPostTradeImpact.symbol}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      @ ${Number(data.lastPostTradeImpact.price).toFixed(2)}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    {new Date(data.lastPostTradeImpact.createdAt).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Delta Exposure */}
                  <div className="bg-[#0B1220] border border-subtle rounded-lg p-3">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      &Delta; Exposition Portefeuille
                    </span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-mono text-slate-300">
                        {Number(data.lastPostTradeImpact.exposurePctBefore).toFixed(1)}% &rarr;{' '}
                        {Number(data.lastPostTradeImpact.exposurePctAfter).toFixed(1)}%
                      </span>
                      <span
                        className={`text-xs font-mono font-bold ${
                          Number(data.lastPostTradeImpact.deltaExposurePct) > 0
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {Number(data.lastPostTradeImpact.deltaExposurePct) >= 0 ? '+' : ''}
                        {Number(data.lastPostTradeImpact.deltaExposurePct).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Delta VaR */}
                  <div className="bg-[#0B1220] border border-subtle rounded-lg p-3">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      &Delta; VaR 95%
                    </span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-mono text-slate-300">
                        ${Number(data.lastPostTradeImpact.var95Before).toFixed(1)} &rarr; $
                        {Number(data.lastPostTradeImpact.var95After).toFixed(1)}
                      </span>
                      <span
                        className={`text-xs font-mono font-bold ${
                          Number(data.lastPostTradeImpact.deltaVar95) > 0
                            ? 'text-rose-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {Number(data.lastPostTradeImpact.deltaVar95) >= 0 ? '+' : ''}
                        ${Number(data.lastPostTradeImpact.deltaVar95).toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* Delta HHI Concentration */}
                  <div className="bg-[#0B1220] border border-subtle rounded-lg p-3">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      &Delta; Concentration HHI
                    </span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-mono text-slate-300">
                        {Number(data.lastPostTradeImpact.concentrationHhiBefore).toFixed(3)} &rarr;{' '}
                        {Number(data.lastPostTradeImpact.concentrationHhiAfter).toFixed(3)}
                      </span>
                      <span className="text-xs font-mono text-slate-400 font-bold">
                        HHI Impact
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 font-mono text-xs">
              Aucun audit post-trade récent enregistré.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
