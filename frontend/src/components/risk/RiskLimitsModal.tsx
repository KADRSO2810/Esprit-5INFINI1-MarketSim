import React, { useState, useEffect } from 'react';
import { RiskLimits, getRiskLimits, updateRiskLimits } from '../../api/trading';
import { AnimatedModal, useToast, OrbitalSpinner } from '../ui';
import {
  Shield,
  RotateCcw,
  Check,
  AlertCircle,
  Percent,
  Layers,
  PieChart,
  Briefcase,
} from 'lucide-react';

interface RiskLimitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLimitsUpdated?: (limits: RiskLimits) => void;
}

const DEFAULT_LIMITS: RiskLimits = {
  maxRiskPerTradePct: 2.0,
  maxAssetExposurePct: 20.0,
  maxSectorExposurePct: 40.0,
  maxPortfolioExposurePct: 100.0,
};

export const RiskLimitsModal: React.FC<RiskLimitsModalProps> = ({
  isOpen,
  onClose,
  onLimitsUpdated,
}) => {
  const toast = useToast();
  const [limits, setLimits] = useState<RiskLimits>(DEFAULT_LIMITS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadLimits();
    }
  }, [isOpen]);

  const loadLimits = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRiskLimits();
      setLimits(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Impossible de charger les limites.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await updateRiskLimits(limits);
      setLimits(updated);
      toast.success("Limites de risque mises à jour", "Les règles pré-trade ont été actualisées avec succès.");
      onLimitsUpdated?.(updated);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Échec de l'enregistrement des limites.";
      setError(msg);
      toast.error("Erreur", msg);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setLimits(DEFAULT_LIMITS);
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidthClass="max-w-md">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                Institutional Risk Policy
              </span>
              <h2 className="font-bold text-white text-sm">Paramètres des Limites de Risque</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#192841] transition"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="p-8 flex flex-col items-center justify-center gap-2">
            <OrbitalSpinner size="md" tone="cyan" />
            <span className="text-xs font-mono text-slate-400">Chargement de la politique de risque...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-5 space-y-4">
            {error && (
              <div className="flex items-start gap-2 text-rose-300 text-xs bg-rose-500/10 border border-rose-500/25 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. Max Risk per trade */}
            <div className="bg-[#070B14] border border-subtle rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-rose-400" />
                  <label className="text-xs font-semibold text-slate-200">
                    Risque Max par Transaction
                  </label>
                </div>
                <span className="text-xs font-mono font-bold text-rose-400 tabular-nums">
                  {limits.maxRiskPerTradePct}%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Perte maximale autorisée si le Stop-Loss est déclenché, exprimée en % de l'equity du portefeuille.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={limits.maxRiskPerTradePct}
                  onChange={(e) =>
                    setLimits({ ...limits, maxRiskPerTradePct: parseFloat(e.target.value) })
                  }
                  className="w-full accent-rose-400 cursor-pointer"
                />
              </div>
            </div>

            {/* 2. Max Exposure per asset */}
            <div className="bg-[#070B14] border border-subtle rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-amber-400" />
                  <label className="text-xs font-semibold text-slate-200">
                    Exposition Max par Actif
                  </label>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400 tabular-nums">
                  {limits.maxAssetExposurePct}%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Pondération maximale d'une seule ligne d'actif dans le portefeuille global pour éviter la surconcentration.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={limits.maxAssetExposurePct}
                  onChange={(e) =>
                    setLimits({ ...limits, maxAssetExposurePct: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>
            </div>

            {/* 3. Max Exposure per sector */}
            <div className="bg-[#070B14] border border-subtle rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <label className="text-xs font-semibold text-slate-200">
                    Exposition Max par Secteur
                  </label>
                </div>
                <span className="text-xs font-mono font-bold text-sky-400 tabular-nums">
                  {limits.maxSectorExposurePct}%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Plafond d'allocation cumulée sur un même secteur (Tech, Crypto, Finance, etc.).
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="range"
                  min="10"
                  max="80"
                  step="5"
                  value={limits.maxSectorExposurePct}
                  onChange={(e) =>
                    setLimits({ ...limits, maxSectorExposurePct: parseFloat(e.target.value) })
                  }
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </div>
            </div>

            {/* 4. Max Portfolio Exposure */}
            <div className="bg-[#070B14] border border-subtle rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-400" />
                  <label className="text-xs font-semibold text-slate-200">
                    Exposition Totale du Portefeuille
                  </label>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
                  {limits.maxPortfolioExposurePct}%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Ratio maximal d'investissement (100% = sans effet de levier, 100% investi maximum).
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="range"
                  min="20"
                  max="150"
                  step="10"
                  value={limits.maxPortfolioExposurePct}
                  onChange={(e) =>
                    setLimits({ ...limits, maxPortfolioExposurePct: parseFloat(e.target.value) })
                  }
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-3 py-2.5 rounded-xl border border-subtle hover:bg-[#142035] text-slate-300 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Rétablir défaut</span>
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition flex items-center justify-center gap-2 shadow-glow-bull disabled:opacity-40"
              >
                {saving ? (
                  <OrbitalSpinner size="xs" tone="slate" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>{saving ? 'Enregistrement...' : 'Appliquer la politique'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </AnimatedModal>
  );
};
