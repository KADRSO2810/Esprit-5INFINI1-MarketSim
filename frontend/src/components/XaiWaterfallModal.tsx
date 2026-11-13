import React from 'react';
import { motion } from 'framer-motion';
import { X, Brain, TrendingUp, TrendingDown, Layers, Building2 } from 'lucide-react';
import { LocalXaiExplanation, StressResult } from '../api/stress';
import { EmptyState, AnimatedModal, OrbitalSpinner } from './ui';

interface XaiWaterfallModalProps {
  isOpen: boolean;
  onClose: () => void;
  bankResult: StressResult | null;
  localExplanation: LocalXaiExplanation | null;
  targetKey: string;
  isLoading: boolean;
}

export const XaiWaterfallModal: React.FC<XaiWaterfallModalProps> = ({
  isOpen,
  onClose,
  bankResult,
  localExplanation,
  targetKey,
  isLoading,
}) => {
  const contributions = localExplanation?.contributions || [];
  const baseValue = Number(localExplanation?.base_value ?? 0);
  const predictedValue = Number(localExplanation?.predicted_value ?? 0);

  const maxAbs = Math.max(
    ...contributions.map((c) => Math.abs(Number(c.contribution ?? 0))),
    0.0001
  );

  const baselineVal = Number(
    bankResult?.baseline?.[targetKey] ?? bankResult?.baseline?.['expected_loss'] ?? 0
  );
  const stressedVal = Number(
    bankResult?.stressed?.[targetKey] ??
      bankResult?.stressed?.['expected_loss'] ??
      predictedValue
  );
  const deltaVal = Number(
    bankResult?.delta?.[targetKey] ??
      bankResult?.delta?.['expected_loss'] ??
      stressedVal - baselineVal
  );

  return (
    <AnimatedModal isOpen={Boolean(isOpen && bankResult)} onClose={onClose} maxWidthClass="max-w-2xl">
      {bankResult && (
        <>
          {/* Header */}
          <div className="px-6 py-4 border-b border-subtle bg-[#0B1220]/90 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-400 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white truncate flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  {bankResult.bankName}
                </h3>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold ${
                    bankResult.bankType === 'CONVENTIONAL'
                      ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {bankResult.bankType === 'CONVENTIONAL' ? 'Conventionnelle' : 'Non-Conv.'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Explication locale SHAP · Attribution marginale sous scénario de stress ({targetKey})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fermer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#192841] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Baseline -> Stressed -> Delta Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-[#0B1220] border border-subtle">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Baseline (Observée)
              </span>
              <span className="text-lg font-bold font-mono tabular-nums text-slate-200 mt-1 block">
                {baselineVal.toFixed(4)}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B1220] border border-amber-500/25">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 block">
                Prédiction Stress
              </span>
              <span className="text-lg font-bold font-mono tabular-nums text-amber-300 mt-1 block">
                {stressedVal.toFixed(4)}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B1220] border border-rose-500/25">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-400 block">
                Impact Net (Δ)
              </span>
              <span
                className={`text-lg font-bold font-mono tabular-nums mt-1 block ${
                  deltaVal >= 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {deltaVal >= 0 ? '+' : ''}
                {deltaVal.toFixed(4)}
              </span>
            </div>
          </div>

          {/* SHAP Diverging Waterfall */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-violet-400" />
                <span>Décomposition SHAP par Facteur</span>
              </h4>
              <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Atténuant (-)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-400" /> Aggravant (+)
                </span>
              </div>
            </div>

            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                <OrbitalSpinner size="lg" tone="violet" />
                <span className="text-xs font-mono text-violet-300">Calcul des attributions SHAP locales…</span>
              </div>
            ) : contributions.length === 0 ? (
              <EmptyState
                icon={Brain}
                title="Aucune explication SHAP disponible"
                description="Les contributions locales n'ont pas encore été calculées pour cet établissement."
                compact
              />
            ) : (
              <div className="p-4 rounded-xl bg-[#0B1220] border border-subtle space-y-3">
                {contributions.map((item, idx) => {
                  const contribVal = Number(item.contribution ?? 0);
                  const isPositive = contribVal >= 0;
                  const pct = Math.min(100, Math.round((Math.abs(contribVal) / maxAbs) * 100));

                  return (
                    <div key={`${item.feature}-${idx}`} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-semibold text-slate-200 truncate">
                            {item.feature}
                          </span>
                          <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-[#142035] border border-subtle text-slate-400">
                            val: {Number(item.value ?? 0).toFixed(3)}
                          </span>
                        </div>
                        <span
                          className={`font-mono tabular-nums font-bold inline-flex items-center gap-1 shrink-0 ${
                            isPositive ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {isPositive ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {isPositive ? '+' : ''}
                          {contribVal.toFixed(4)}
                        </span>
                      </div>

                      {/* Centered Diverging Waterfall Bar */}
                      <div className="h-2.5 w-full bg-[#101A2B] rounded-full border border-subtle relative flex items-center overflow-hidden">
                        {/* Left half (negative mitigation) */}
                        <div className="w-1/2 h-full flex justify-end">
                          {!isPositive && (
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{
                                duration: 0.48,
                                delay: idx * 0.04,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                              className="h-full bg-gradient-to-l from-emerald-500 to-teal-400 rounded-l-full"
                            />
                          )}
                        </div>
                        {/* Center axis line */}
                        <div className="w-px h-full bg-slate-500/60 shrink-0 z-10" />
                        {/* Right half (positive risk impact) */}
                        <div className="w-1/2 h-full flex justify-start">
                          {isPositive && (
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{
                                duration: 0.48,
                                delay: idx * 0.04,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                              className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-r-full"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="pt-3 border-t border-subtle flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-400">
                  <span>
                    Base Value E[f(X)] : <strong className="text-slate-200">{baseValue.toFixed(4)}</strong>
                  </span>
                  <span>
                    Sortie Modèle f(x) : <strong className="text-violet-300">{predictedValue.toFixed(4)}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-subtle bg-[#0B1220]/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#142035] hover:bg-[#192841] border border-subtle text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Fermer
          </button>
        </div>
        </>
      )}
    </AnimatedModal>
  );
};
