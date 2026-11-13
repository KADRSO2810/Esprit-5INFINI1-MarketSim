import React, { useState, useEffect } from 'react';
import { NewsArticle, recomputeSentiment } from '../api/news';
import { AnimatedModal, OrbitalSpinner, useToast } from './ui';
import {
  X,
  ExternalLink,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  HelpCircle,
  Tag,
} from 'lucide-react';

interface NewsArticleModalProps {
  article: NewsArticle | null;
  onClose: () => void;
  onArticleUpdated?: (updated: NewsArticle) => void;
}

export const NewsArticleModal: React.FC<NewsArticleModalProps> = ({
  article,
  onClose,
  onArticleUpdated,
}) => {
  const [recomputing, setRecomputing] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<NewsArticle | null>(article);
  const toast = useToast();

  useEffect(() => {
    setCurrentArticle(article);
  }, [article]);

  const a = currentArticle || article;
  const sentiment = a?.sentiment;

  const handleRecompute = async () => {
    if (!a) return;
    setRecomputing(true);
    try {
      const updated = await recomputeSentiment(a.id);
      setCurrentArticle(updated);
      if (onArticleUpdated) onArticleUpdated(updated);
      toast.success('Inférence FinBERT terminée', `Sentiment : ${updated.sentiment?.label}`);
    } catch (err) {
      console.error('Erreur recalcul sentiment:', err);
      toast.error('Erreur FinBERT', "Impossible de recalculer le score de sentiment.");
    } finally {
      setRecomputing(false);
    }
  };

  const getLabelColor = (label?: string) => {
    switch (label) {
      case 'POSITIVE':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          icon: <TrendingUp className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />,
        };
      case 'NEGATIVE':
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          icon: <TrendingDown className="w-3.5 h-3.5 mr-1.5 text-rose-400" />,
        };
      default:
        return {
          bg: 'bg-slate-500/10 border-slate-500/30 text-slate-300',
          icon: <Minus className="w-3.5 h-3.5 mr-1.5 text-slate-400" />,
        };
    }
  };

  const labelStyle = getLabelColor(sentiment?.label);
  const posScore = sentiment?.details?.positive ?? 0;
  const neuScore = sentiment?.details?.neutral ?? 0;
  const negScore = sentiment?.details?.negative ?? 0;
  const topTokens = sentiment?.xai?.topTokens || [];

  return (
    <AnimatedModal isOpen={Boolean(article)} onClose={onClose} maxWidthClass="max-w-2xl">
      {a && (
        <>
          <div className="flex items-center justify-between px-6 py-4 border-b border-subtle">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-0.5 text-[11px] font-mono font-semibold rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/30">
              {a.symbol}
            </span>
            <span className="text-xs font-mono text-slate-400">
              {a.source || 'Finnhub'} ·{' '}
              {new Date(a.publishedAt).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#192841] transition"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white leading-snug">{a.headline}</h2>
            {a.imageUrl && (
              <img
                src={a.imageUrl}
                alt="article visual"
                className="mt-3 w-full h-44 object-cover rounded-xl border border-subtle"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            )}
          </div>

          {a.summary && (
            <div className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-[#070B14]/70 p-4 rounded-xl border border-subtle">
              {a.summary}
            </div>
          )}

          {/* FinBERT Sentiment & XAI */}
          <div className="p-4 rounded-xl ai-surface space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                  Inférence FinBERT & XAI
                </span>
              </div>
              <button
                onClick={handleRecompute}
                disabled={recomputing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-200 bg-[#142035] hover:bg-[#192841] border border-subtle transition disabled:opacity-50"
              >
                {recomputing ? (
                  <OrbitalSpinner size="xs" tone="violet" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                {recomputing ? 'Inférence...' : 'Recalculer'}
              </button>
            </div>

            {sentiment ? (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-bold border ${labelStyle.bg}`}
                  >
                    {labelStyle.icon}
                    {sentiment.label}
                  </div>
                  <span className="text-xs text-slate-300 font-mono tabular-nums">
                    Confiance :{' '}
                    <strong className="text-white">{(sentiment.score * 100).toFixed(1)}%</strong>
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-mono tabular-nums">
                    <span className="text-emerald-400">
                      Positif {(posScore * 100).toFixed(0)}%
                    </span>
                    <span className="text-slate-400">
                      Neutre {(neuScore * 100).toFixed(0)}%
                    </span>
                    <span className="text-rose-400">
                      Négatif {(negScore * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#101A2B] rounded-full overflow-hidden flex border border-subtle">
                    <div
                      style={{ width: `${posScore * 100}%` }}
                      className="bg-emerald-500 transition-all duration-500"
                    />
                    <div
                      style={{ width: `${neuScore * 100}%` }}
                      className="bg-slate-500 transition-all duration-500"
                    />
                    <div
                      style={{ width: `${negScore * 100}%` }}
                      className="bg-rose-500 transition-all duration-500"
                    />
                  </div>
                </div>

                {topTokens.length > 0 && (
                  <div className="pt-3 border-t border-subtle">
                    <div className="flex items-center text-[11px] text-slate-400 mb-2">
                      <HelpCircle className="w-3.5 h-3.5 mr-1.5 text-sky-400" />
                      <span>Mots-clés déterminants dans la décision du modèle :</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {topTokens.map((tok, idx) => {
                        const isPos = tok.direction === 'POSITIVE';
                        const isNeg = tok.direction === 'NEGATIVE';
                        const badgeColor = isPos
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : isNeg
                          ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                          : 'bg-[#101A2B] text-slate-300 border-subtle';

                        return (
                          <span
                            key={idx}
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono border ${badgeColor}`}
                          >
                            <Tag className="w-2.5 h-2.5 mr-1 opacity-60" />
                            {tok.token}
                            <span className="ml-1 opacity-75 text-[10px]">
                              ({(tok.weight * 100).toFixed(0)}%)
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-3 text-center">
                Article non encore analysé. Cliquez sur « Recalculer » pour lancer FinBERT.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-subtle bg-[#0B1220]">
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs font-medium text-sky-400 hover:text-sky-300 transition"
          >
            Lire la dépêche originale ({a.source || 'Source'})
            <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-[#142035] hover:bg-[#192841] text-slate-200 border border-subtle rounded-lg transition"
          >
            Fermer
          </button>
        </div>
        </>
      )}
    </AnimatedModal>
  );
};
