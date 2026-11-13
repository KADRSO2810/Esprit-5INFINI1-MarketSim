import React, { useState, useEffect } from 'react';
import { PositionItem, updateSlTp, removeSlTp } from '../api/trading';
import { AnimatedModal, AssetLogo, OrbitalSpinner, useToast } from './ui';
import {
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Trash2,
  Check,
} from 'lucide-react';

interface SlTpConfigModalProps {
  isOpen: boolean;
  position: PositionItem | null;
  currentPrice: number | null;
  onClose: () => void;
  onUpdated: (updated: PositionItem) => void;
}

export const SlTpConfigModal: React.FC<SlTpConfigModalProps> = ({
  isOpen,
  position,
  currentPrice,
  onClose,
  onUpdated,
}) => {
  const toast = useToast();
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (position && isOpen) {
      setStopLoss(position.stopLoss != null ? String(position.stopLoss) : '');
      setTakeProfit(position.takeProfit != null ? String(position.takeProfit) : '');
      setError(null);
    }
  }, [position, isOpen]);

  if (!position) return null;

  const marketPrice = currentPrice ?? position.lastPrice ?? position.avgPrice;
  const avgPrice = position.avgPrice;
  const quantity = position.quantity;

  const numSL = stopLoss ? parseFloat(stopLoss) : null;
  const numTP = takeProfit ? parseFloat(takeProfit) : null;

  // Calculs de risque
  const riskPerUnit = numSL != null ? avgPrice - numSL : null;
  const rewardPerUnit = numTP != null ? numTP - avgPrice : null;
  const potentialLoss = riskPerUnit != null ? riskPerUnit * quantity : null;
  const potentialProfit = rewardPerUnit != null ? rewardPerUnit * quantity : null;

  let riskRewardRatio: number | null = null;
  if (potentialLoss != null && potentialProfit != null && potentialLoss > 0) {
    riskRewardRatio = potentialProfit / potentialLoss;
  }

  const slDistPct = numSL != null && marketPrice > 0 ? ((marketPrice - numSL) / marketPrice) * 100 : null;
  const tpDistPct = numTP != null && marketPrice > 0 ? ((numTP - marketPrice) / marketPrice) * 100 : null;

  // Presets pour SL (-2%, -5%, -10%, -15%)
  const applySlPreset = (pct: number) => {
    const val = marketPrice * (1 - pct / 100);
    setStopLoss(val.toFixed(2));
    setError(null);
  };

  // Presets pour TP (+5%, +10%, +20%, +30%)
  const applyTpPreset = (pct: number) => {
    const val = marketPrice * (1 + pct / 100);
    setTakeProfit(val.toFixed(2));
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation locale
    if (numSL != null) {
      if (numSL <= 0) {
        setError('Le Stop-Loss doit être strictement supérieur à 0.');
        return;
      }
      if (numSL >= marketPrice) {
        setError(`Le Stop-Loss ($${numSL.toFixed(2)}) doit être strictement inférieur au cours actuel ($${marketPrice.toFixed(2)}).`);
        return;
      }
    }

    if (numTP != null) {
      if (numTP <= 0) {
        setError('Le Take-Profit doit être strictement supérieur à 0.');
        return;
      }
      if (numTP <= marketPrice) {
        setError(`Le Take-Profit ($${numTP.toFixed(2)}) doit être strictement supérieur au cours actuel ($${marketPrice.toFixed(2)}).`);
        return;
      }
    }

    if (numSL != null && numTP != null && numSL >= numTP) {
      setError('Le Stop-Loss doit être strictement inférieur au Take-Profit.');
      return;
    }

    setLoading(true);
    try {
      const updated = await updateSlTp(position.symbol, numSL, numTP, 0);
      toast.success(
        'Protection mise à jour',
        `${position.symbol} : SL ${numSL ? '$' + numSL.toFixed(2) : 'Désactivé'} | TP ${numTP ? '$' + numTP.toFixed(2) : 'Désactivé'}`
      );
      onUpdated(updated);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Échec de la mise à jour des niveaux SL/TP.';
      setError(msg);
      toast.error('Erreur SL/TP', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await removeSlTp(position.symbol, 0);
      toast.info('Protection retirée', `Niveaux SL et TP supprimés pour ${position.symbol}.`);
      onUpdated(updated);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Échec de la suppression des niveaux SL/TP.';
      setError(msg);
      toast.error('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  const hasExistingLevels = position.stopLoss != null || position.takeProfit != null;

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidthClass="max-w-md">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-subtle bg-[#0B1220]">
        <div className="flex items-center gap-2.5">
          <AssetLogo symbol={position.symbol} size="md" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                Risk Management
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-300 font-mono">
                LONG
              </span>
            </div>
            <h2 className="font-bold text-white text-base font-mono">
              {position.symbol} — SL & TP
            </h2>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#142035] transition"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 trading-scrollbar trading-scrollbar-bullish">
          {/* Position Context Card */}
          <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-[#070B14]/60 border border-subtle text-xs font-mono">
            <div>
              <div className="text-[10px] text-slate-400 uppercase">Quantité</div>
              <div className="text-white font-semibold">{Number(quantity).toFixed(4)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase">PRU Moyen</div>
              <div className="text-slate-200 font-semibold">${Number(avgPrice).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] text-sky-400 uppercase">Cours Live</div>
              <div className="text-white font-bold">${Number(marketPrice).toFixed(2)}</div>
            </div>
          </div>
          {/* Stop-Loss Section */}
          <div className="space-y-1.5 p-3 rounded-lg bg-rose-500/5 border border-rose-500/20">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                Stop-Loss (Protection)
              </label>
              {slDistPct != null && (
                <span className="text-[10px] font-mono text-rose-400">
                  -{slDistPct.toFixed(2)}% du cours
                </span>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-xs">$</span>
              <input
                type="number"
                step="0.01"
                placeholder={`ex: ${(marketPrice * 0.95).toFixed(2)}`}
                value={stopLoss}
                onChange={(e) => {
                  setStopLoss(e.target.value);
                  setError(null);
                }}
                className="w-full bg-[#0B1220] border border-rose-500/30 rounded-lg pl-7 pr-3 py-2 text-white font-mono text-xs placeholder:text-slate-600 focus:outline-none focus:border-rose-400"
              />
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[9px] text-slate-400 uppercase tracking-wider">Presets:</span>
              {[2, 5, 10, 15].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => applySlPreset(pct)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#101A2B] hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition"
                >
                  -{pct}%
                </button>
              ))}
            </div>

            {potentialLoss != null && (
              <div className="text-[10px] font-mono text-rose-300/80 pt-0.5">
                Perte estimée : -${Math.abs(potentialLoss).toFixed(2)} (-${Math.abs(riskPerUnit ?? 0).toFixed(2)}/u)
              </div>
            )}
          </div>

          {/* Take-Profit Section */}
          <div className="space-y-1.5 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                Take-Profit (Objectif)
              </label>
              {tpDistPct != null && (
                <span className="text-[10px] font-mono text-emerald-400">
                  +{tpDistPct.toFixed(2)}% du cours
                </span>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-xs">$</span>
              <input
                type="number"
                step="0.01"
                placeholder={`ex: ${(marketPrice * 1.1).toFixed(2)}`}
                value={takeProfit}
                onChange={(e) => {
                  setTakeProfit(e.target.value);
                  setError(null);
                }}
                className="w-full bg-[#0B1220] border border-emerald-500/30 rounded-lg pl-7 pr-3 py-2 text-white font-mono text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-400"
              />
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[9px] text-slate-400 uppercase tracking-wider">Presets:</span>
              {[5, 10, 20, 30].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => applyTpPreset(pct)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#101A2B] hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition"
                >
                  +{pct}%
                </button>
              ))}
            </div>

            {potentialProfit != null && (
              <div className="text-[10px] font-mono text-emerald-300/80 pt-0.5">
                Gain estimé : +${potentialProfit.toFixed(2)} (+${(rewardPerUnit ?? 0).toFixed(2)}/u)
              </div>
            )}
          </div>

          {/* Risk/Reward Dashboard */}
          {riskRewardRatio != null && (
            <div className="p-3 rounded-lg bg-[#070B14] border border-subtle flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Ratio Risque / Rendement</span>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    riskRewardRatio >= 2
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : riskRewardRatio >= 1
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  1:{riskRewardRatio.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400">
                  {riskRewardRatio >= 2 ? 'Excellent' : riskRewardRatio >= 1 ? 'Correct' : 'Défavorable'}
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Sticky Action Buttons Footer */}
        <div className="shrink-0 flex items-center gap-2 px-5 py-3.5 border-t border-subtle bg-[#070B14]">
          {hasExistingLevels && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={loading}
              className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition text-xs font-semibold flex items-center gap-1.5"
              title="Supprimer la protection"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Supprimer</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-[#142035] hover:bg-[#1B2B47] text-slate-300 transition text-xs font-semibold"
          >
            Annuler
          </button>

          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold transition text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/20"
          >
            {loading ? (
              <OrbitalSpinner size="sm" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                Enregistrer
              </>
            )}
          </button>
        </div>
      </form>
    </AnimatedModal>
  );
};
