import React from 'react';
import {
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Code,
  Cpu,
  Gauge,
  Layers,
  GitBranch,
  Sparkles,
} from 'lucide-react';
import { StrategySignal } from '../api/strategies';
import { AnimatedModal } from './ui';

interface SignalExplanationModalProps {
  signal: StrategySignal | null;
  onClose: () => void;
}

export const SignalExplanationModal: React.FC<SignalExplanationModalProps> = ({
  signal,
  onClose,
}) => {
  const expl = signal?.explanation || {};
  const isBuy = signal?.signal === 'BUY';
  const isSell = signal?.signal === 'SELL';

  const hasSmaData =
    expl.strategy === 'SMA_CROSS' ||
    (expl.strategy === 'SMA_SENTIMENT' && expl.currentFastSma !== undefined);

  const rsiValue = Math.min(100, Math.max(0, Number(expl.rsiValue ?? 50)));
  const oversold = Number(expl.oversoldThreshold ?? 30);
  const overbought = Number(expl.overboughtThreshold ?? 70);

  const sentPos = Number(expl.sentimentFilter?.positiveCount ?? 0);
  const sentNeg = Number(expl.sentimentFilter?.negativeCount ?? 0);
  const sentNeu = Number(expl.sentimentFilter?.neutralCount ?? 0);
  const sentTotal = Math.max(1, sentPos + sentNeg + sentNeu);

  return (
    <AnimatedModal isOpen={Boolean(signal)} onClose={onClose} maxWidthClass="max-w-xl">
      {signal && (
        <>
          {/* Header */}
          <div className="px-6 py-4 border-b border-subtle bg-[#0B1220]/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono inline-flex items-center gap-1.5 border ${
                isBuy
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : isSell
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  : 'bg-slate-500/15 text-slate-300 border-slate-500/30'
              }`}
            >
              {isBuy ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : isSell ? (
                <TrendingDown className="w-3.5 h-3.5" />
              ) : (
                <Minus className="w-3.5 h-3.5" />
              )}
              {signal.signal}
            </span>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white font-mono text-base tracking-tight">
                  {signal.symbol}
                </h3>
                <span className="text-sm font-mono tabular-nums text-sky-400 font-semibold">
                  ${Number(signal.price ?? 0).toFixed(2)}
                </span>
                {expl.strategy && (
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/25">
                    {expl.strategy}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                Émis le {new Date(signal.ts).toLocaleString('fr-FR')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fermer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#192841] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Primary Trigger Rule */}
          <div className="p-4 rounded-xl ai-surface flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Cpu className="w-4 h-4 text-sky-400" />
            </div>
            <div className="space-y-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                Règle Quantitative Déclenchée (XAI)
              </span>
              <p className="text-sm text-slate-100 leading-relaxed font-medium">
                {expl.rule || expl.reason || 'Condition algorithmique évaluée sur le dernier flux de marché.'}
              </p>
            </div>
          </div>

          {/* Strategy: SMA_CROSS (+ SMA component of SMA_SENTIMENT) */}
          {hasSmaData && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-sky-400" />
                  Croisement de Moyennes Mobiles (SMA)
                </h4>
                {expl.crossDirection && (
                  <span
                    className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                      String(expl.crossDirection).includes('GOLDEN') || String(expl.crossDirection).includes('UP')
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                        : String(expl.crossDirection).includes('DEATH') || String(expl.crossDirection).includes('DOWN')
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/25'
                        : 'bg-slate-500/10 text-slate-300 border-slate-500/25'
                    }`}
                  >
                    {expl.crossDirection}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-[#0B1220] rounded-xl border border-subtle space-y-1">
                  <span className="text-[11px] text-slate-400 block">
                    SMA Rapide ({expl.fastPeriod ?? '-'})
                  </span>
                  <span className="text-base font-bold font-mono tabular-nums text-sky-400 block">
                    ${Number(expl.currentFastSma ?? 0).toFixed(2)}
                  </span>
                  <span className="text-[10px] font-mono tabular-nums text-slate-500 block">
                    Précédent : ${Number(expl.previousFastSma ?? 0).toFixed(2)}
                  </span>
                </div>

                <div className="p-3.5 bg-[#0B1220] rounded-xl border border-subtle space-y-1">
                  <span className="text-[11px] text-slate-400 block">
                    SMA Lente ({expl.slowPeriod ?? '-'})
                  </span>
                  <span className="text-base font-bold font-mono tabular-nums text-violet-400 block">
                    ${Number(expl.currentSlowSma ?? 0).toFixed(2)}
                  </span>
                  <span className="text-[10px] font-mono tabular-nums text-slate-500 block">
                    Précédent : ${Number(expl.previousSlowSma ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Strategy: RSI */}
          {expl.strategy === 'RSI' && (
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-amber-400" />
                Oscillateur RSI ({expl.period ?? 14} périodes)
              </h4>

              <div className="p-4 bg-[#0B1220] rounded-xl border border-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Niveau RSI mesuré</span>
                  <span
                    className={`text-lg font-bold font-mono tabular-nums ${
                      rsiValue < oversold
                        ? 'text-emerald-400'
                        : rsiValue > overbought
                        ? 'text-rose-400'
                        : 'text-slate-100'
                    }`}
                  >
                    {rsiValue.toFixed(2)}
                  </span>
                </div>

                {/* RSI Gauge with Marker */}
                <div className="relative pt-1 pb-1">
                  <div className="w-full h-2.5 bg-[#142035] rounded-full overflow-hidden flex border border-subtle">
                    <div style={{ width: `${oversold}%` }} className="bg-emerald-500/45" />
                    <div
                      style={{ width: `${Math.max(0, overbought - oversold)}%` }}
                      className="bg-slate-600/35"
                    />
                    <div
                      style={{ width: `${Math.max(0, 100 - overbought)}%` }}
                      className="bg-rose-500/45"
                    />
                  </div>
                  <div
                    className="absolute top-0 w-3.5 h-3.5 -ml-1.5 rounded-full bg-white border-2 border-sky-400 shadow"
                    style={{ left: `${rsiValue}%` }}
                  />
                </div>

                <div className="flex justify-between text-[10px] font-mono tabular-nums text-slate-400">
                  <span className="text-emerald-400">Survente &lt; {oversold}</span>
                  <span>Zone Neutre</span>
                  <span className="text-rose-400">Surachat &gt; {overbought}</span>
                </div>
              </div>
            </div>
          )}

          {/* Strategy: SMA_SENTIMENT */}
          {expl.strategy === 'SMA_SENTIMENT' && (
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                Filtre de Sentiment FinBERT (24h)
              </h4>

              {expl.sentimentFilter ? (
                <div className="p-4 bg-[#0B1220] rounded-xl border border-subtle space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-500" />
                      Articles analysés (24h)
                    </span>
                    <span className="font-bold font-mono tabular-nums text-white">
                      {expl.sentimentFilter.articlesCount24h}
                    </span>
                  </div>

                  {/* Proportional bar */}
                  <div className="w-full h-2 rounded-full bg-[#142035] overflow-hidden flex">
                    <div
                      style={{ width: `${(sentPos / sentTotal) * 100}%` }}
                      className="bg-emerald-500"
                    />
                    <div
                      style={{ width: `${(sentNeu / sentTotal) * 100}%` }}
                      className="bg-slate-500"
                    />
                    <div
                      style={{ width: `${(sentNeg / sentTotal) * 100}%` }}
                      className="bg-rose-500"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Distribution</span>
                    <div className="flex items-center gap-3 font-mono tabular-nums text-[11px]">
                      <span className="text-emerald-400">+{sentPos} pos</span>
                      <span className="text-slate-400">{sentNeu} neu</span>
                      <span className="text-rose-400">-{sentNeg} neg</span>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-subtle flex items-center justify-between text-xs">
                    <span className="text-slate-400">Verdict Sentiment</span>
                    <span
                      className={`font-bold font-mono uppercase px-2 py-0.5 rounded border text-[11px] ${
                        expl.sentimentFilter.predominant === 'POSITIVE'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : expl.sentimentFilter.predominant === 'NEGATIVE'
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          : 'bg-slate-500/15 text-slate-300 border-slate-500/30'
                      }`}
                    >
                      {expl.sentimentFilter.predominant}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-[#0B1220] rounded-xl border border-subtle text-xs text-slate-400">
                  Aucune donnée de filtre FinBERT attachée à ce signal.
                </div>
              )}
            </div>
          )}

          {/* Raw JSON Audit Toggle */}
          <details className="text-xs group">
            <summary className="cursor-pointer text-slate-400 hover:text-slate-200 flex items-center gap-1.5 font-mono select-none">
              <Code className="w-3.5 h-3.5 text-sky-400" />
              <span>Payload JSON d’audit brut</span>
            </summary>
            <pre className="mt-2 p-3 rounded-xl bg-[#070B14] font-mono text-[11px] text-slate-300 overflow-x-auto border border-subtle leading-relaxed">
              {JSON.stringify(expl, null, 2)}
            </pre>
          </details>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-subtle bg-[#0B1220]/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-[#142035] hover:bg-[#192841] text-slate-200 hover:text-white rounded-lg border border-subtle transition-colors"
          >
            Fermer
          </button>
        </div>
        </>
      )}
    </AnimatedModal>
  );
};
