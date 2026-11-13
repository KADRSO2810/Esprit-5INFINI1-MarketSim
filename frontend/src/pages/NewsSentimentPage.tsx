import React from 'react';
import { AppShell } from '../components/layout/AppShell';
import { NewsTimelinePanel } from '../components/NewsTimelinePanel';
import { PageTransition } from '../components/ui';
import { Sparkles } from 'lucide-react';

export const NewsSentimentPage: React.FC = () => {
  return (
    <AppShell
      section="AI Intelligence"
      title="Financial News & FinBERT"
      badge="NLP · FinBERT + XAI"
    >
      <PageTransition className="flex flex-col gap-5">
        <div className="workstation-panel rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-2 border-l-sky-400">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-sky-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Moteur de Sentiment NLP Financier (ProsusAI/FinBERT)
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
                Les dépêches officielles Finnhub sont notées en temps réel selon leur polarité financière
                (Positive, Neutre, Négative) et connectées directement au module{' '}
                <strong className="text-violet-300 font-medium">Strategy Lab (SMA + FinBERT)</strong>{' '}
                pour filtrer les faux signaux d'achat en cas d'actualités défavorables.
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-[#070B14] border border-subtle px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            Transformer FinBERT :8090
          </div>
        </div>

        <div className="min-h-[680px]">
          <NewsTimelinePanel defaultSymbol="AAPL" />
        </div>
      </PageTransition>
    </AppShell>
  );
};
