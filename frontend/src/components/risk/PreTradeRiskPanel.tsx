import React, { useState } from 'react';
import { PreTradeRiskResponse, calculatePositionSize } from '../../api/trading';
import { OrbitalSpinner } from '../ui';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Calculator,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';

interface PreTradeRiskPanelProps {
  assessment: PreTradeRiskResponse | null;
  loading: boolean;
  compact?: boolean;
  entryPrice: number | null;
  stopLoss: number | null;
  symbol: string;
  onApplyQuantity?: (qty: string) => void;
}

export const PreTradeRiskPanel: React.FC<PreTradeRiskPanelProps> = ({
  assessment,
  loading,
  compact = false,
  entryPrice,
  stopLoss,
  symbol,
  onApplyQuantity,
}) => {
  const [showDetails, setShowDetails] = useState(!compact);
  const [calculatingSize, setCalculatingSize] = useState(false);
  const [calcNotice, setCalcNotice] = useState<string | null>(null);

  const handleComputeOptimalSize = async () => {
    if (!stopLoss || !entryPrice || entryPrice <= 0) return;
    setCalculatingSize(true);
    setCalcNotice(null);
    try {
      const res = await calculatePositionSize({
        symbol,
        entryPrice,
        stopLoss,
        riskPercentage: assessment?.limits?.maxRiskPerTradePct ?? 2.0,
      });
      if (onApplyQuantity && res.suggestedQuantity > 0) {
        onApplyQuantity(String(res.suggestedQuantity));
        setCalcNotice(`Taille optimale calculée : ${res.suggestedQuantity} (${res.formulaExplanation.slice(0, 60)}...)`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur lors du calcul";
      setCalcNotice(msg);
    } finally {
      setCalculatingSize(false);
    }
  };

  if (!assessment && !loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-xs text-slate-500 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          Contrôle du risque pré-trade
        </span>
        <span className="text-[11px] text-slate-500 font-mono">Prêt</span>
      </div>
    );
  }

  if (!assessment && loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-xs text-slate-400 flex items-center justify-between animate-pulse">
        <span className="flex items-center gap-1.5 text-sky-400">
          <OrbitalSpinner size="xs" tone="cyan" />
          Évaluation des limites de risque...
        </span>
      </div>
    );
  }

  const decision = assessment?.decision ?? 'APPROVED';
  const isApproved = decision === 'APPROVED';
  const isWarning = decision === 'WARNING';
  const isRejected = decision === 'REJECTED';

  const badgeBg = isApproved
    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
    : isWarning
    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
    : 'bg-rose-500/15 border-rose-500/40 text-rose-300';

  const BadgeIcon = isApproved ? ShieldCheck : isWarning ? AlertTriangle : ShieldAlert;

  return (
    <div
      className={`rounded-xl border transition-all ${
        isRejected
          ? 'border-rose-500/40 bg-gradient-to-b from-rose-950/20 to-[#070B14]'
          : isWarning
          ? 'border-amber-500/35 bg-gradient-to-b from-amber-950/15 to-[#070B14]'
          : 'border-subtle bg-[#070B14]/60'
      } overflow-hidden`}
    >
      {/* Header bar */}
      <div
        className={`px-3.5 py-2.5 flex items-center justify-between border-b border-subtle/50 cursor-pointer ${
          compact ? 'hover:bg-white/[0.02]' : ''
        }`}
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-lg border flex items-center justify-center ${badgeBg}`}>
            <BadgeIcon className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Pre-Trade Risk Engine
              </span>
              {loading && <OrbitalSpinner size="xs" tone="cyan" />}
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-xs font-bold font-mono tracking-wide ${
                  isApproved ? 'text-emerald-400' : isWarning ? 'text-amber-300' : 'text-rose-400'
                }`}
              >
                {decision === 'APPROVED'
                  ? 'CONFORME AUX LIMITES'
                  : decision === 'WARNING'
                  ? 'ATTENTION : RISQUE ÉLEVÉ'
                  : 'TRANSACTION BLOQUÉE'}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="p-1 text-slate-400 hover:text-white transition"
          aria-label="Toggle details"
        >
          {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Main Content */}
      {showDetails && assessment && (
        <div className="p-3.5 space-y-3 text-xs">
          {/* Rejections Banner */}
          {isRejected && assessment.rejections && assessment.rejections.length > 0 && (
            <div className="rounded-lg bg-rose-500/15 border border-rose-500/30 p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-300">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Règles de risque transgressées :</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-200/90 font-mono">
                {assessment.rejections.map((rej, idx) => (
                  <li key={idx} className="leading-snug">{rej}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings Banner */}
          {isWarning && assessment.warnings && assessment.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Avertissements de risque :</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-200/90 font-mono">
                {assessment.warnings.map((warn, idx) => (
                  <li key={idx} className="leading-snug">{warn}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Key Risk Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums">
            {/* Asset Exposure */}
            <div className="bg-[#0B1220]/70 border border-subtle/70 rounded-lg p-2 space-y-0.5">
              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>Exposition Actif</span>
                <span className="text-slate-500">Max: {assessment.limits?.maxAssetExposurePct}%</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span className="text-slate-400">{assessment.currentAssetExposurePct.toFixed(1)}%</span>
                <span className="text-slate-600">→</span>
                <span
                  className={
                    assessment.newAssetExposurePct > (assessment.limits?.maxAssetExposurePct ?? 20)
                      ? 'text-rose-400'
                      : assessment.newAssetExposurePct > 15
                      ? 'text-amber-300'
                      : 'text-white'
                  }
                >
                  {assessment.newAssetExposurePct.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Portfolio Exposure */}
            <div className="bg-[#0B1220]/70 border border-subtle/70 rounded-lg p-2 space-y-0.5">
              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>Exposition Portefeuille</span>
                <span className="text-slate-500">Max: {assessment.limits?.maxPortfolioExposurePct}%</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span className="text-slate-400">{assessment.currentPortfolioExposurePct.toFixed(1)}%</span>
                <span className="text-slate-600">→</span>
                <span
                  className={
                    assessment.newPortfolioExposurePct > (assessment.limits?.maxPortfolioExposurePct ?? 100)
                      ? 'text-rose-400'
                      : assessment.newPortfolioExposurePct > 80
                      ? 'text-amber-300'
                      : 'text-white'
                  }
                >
                  {assessment.newPortfolioExposurePct.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Risk per trade % */}
            <div className="bg-[#0B1220]/70 border border-subtle/70 rounded-lg p-2 space-y-0.5">
              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>Risque Trade (SL)</span>
                <span className="text-slate-500">Max: {assessment.limits?.maxRiskPerTradePct}%</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                {assessment.riskPerTradePct != null ? (
                  <>
                    <span
                      className={
                        assessment.riskPerTradePct > (assessment.limits?.maxRiskPerTradePct ?? 2)
                          ? 'text-rose-400'
                          : 'text-emerald-400'
                      }
                    >
                      {assessment.riskPerTradePct.toFixed(2)}%
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      (-${Math.abs(assessment.potentialLoss ?? 0).toFixed(0)})
                    </span>
                  </>
                ) : (
                  <span className="text-slate-500 italic text-[10px]">SL non défini</span>
                )}
              </div>
            </div>

            {/* Risk / Reward */}
            <div className="bg-[#0B1220]/70 border border-subtle/70 rounded-lg p-2 space-y-0.5">
              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>Ratio Risque/Gain</span>
                <span className="text-slate-500">Rec: 1:1.5+</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                {assessment.riskRewardRatio != null ? (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      assessment.riskRewardRatio >= 1.5
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : assessment.riskRewardRatio >= 1.0
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    1:{assessment.riskRewardRatio.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-slate-500 italic text-[10px]">Non calculable</span>
                )}
              </div>
            </div>
          </div>

          {/* Sizing & Optimal Calculator Button */}
          {stopLoss != null && stopLoss > 0 && onApplyQuantity && (
            <div className="pt-1">
              <button
                type="button"
                onClick={handleComputeOptimalSize}
                disabled={calculatingSize}
                className="w-full py-1.5 px-2.5 rounded-lg bg-[#142035] hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 hover:text-white transition flex items-center justify-between text-[11px] font-mono group"
              >
                <div className="flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-sky-400 group-hover:rotate-12 transition-transform" />
                  <span>Ajuster taille selon règle 2% ({assessment.limits?.maxRiskPerTradePct ?? 2}%)</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-sky-400 font-bold">
                  {calculatingSize ? (
                    <OrbitalSpinner size="xs" tone="cyan" />
                  ) : assessment.suggestedMaxQuantity > 0 ? (
                    <>
                      <span>{assessment.suggestedMaxQuantity} max</span>
                      <Sparkles className="w-3 h-3" />
                    </>
                  ) : (
                    <span>Calculer</span>
                  )}
                </div>
              </button>
              {calcNotice && (
                <div className="text-[10px] font-mono text-sky-300/80 mt-1 px-1">{calcNotice}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
