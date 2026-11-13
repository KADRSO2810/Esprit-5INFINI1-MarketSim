import React, { useState, useEffect } from 'react';
import {
  NewsArticle,
  getNews,
  recomputeSentimentBatch,
} from '../api/news';
import { NewsArticleModal } from './NewsArticleModal';
import {
  NewsSkeleton,
  EmptyState,
  OrbitalSpinner,
  AnimatedMarketLoader,
  useToast,
  AssetLogo,
} from './ui';
import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Sparkles,
  Calendar,
  Search,
  Tag,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface NewsTimelinePanelProps {
  defaultSymbol?: string;
  onSelectArticle?: (article: NewsArticle) => void;
}

export const NewsTimelinePanel: React.FC<NewsTimelinePanelProps> = ({
  defaultSymbol = 'AAPL',
}) => {
  const toast = useToast();
  const [symbol, setSymbol] = useState<string>(defaultSymbol);
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [batchLoading, setBatchLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterSentiment, setFilterSentiment] = useState<
    'ALL' | 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
  >('ALL');
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLiveNews();
  }, [symbol]);

  const loadLiveNews = async (forceRefresh: boolean = false, start?: string, end?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNews(symbol, start || fromDate, end || toDate, forceRefresh);
      setArticles(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erreur lors du chargement des actualités.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPreset = (preset: '30d' | '180d') => {
    const d = new Date();
    const end = d.toISOString().split('T')[0];
    d.setDate(d.getDate() - (preset === '30d' ? 30 : 180));
    const start = d.toISOString().split('T')[0];
    setFromDate(start);
    setToDate(end);
    loadLiveNews(false, start, end);
  };

  const handleBatchSentiment = async () => {
    setBatchLoading(true);
    try {
      await recomputeSentimentBatch({
        symbol,
        from: fromDate,
        to: toDate,
        limit: 100,
      });
      await loadLiveNews(false);
      toast.success('Analyse FinBERT terminée', 'Les scores de sentiment ont été mis à jour.');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Erreur lors du calcul de sentiment en lot.';
      setError(msg);
      toast.error('Erreur FinBERT Batch', msg);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleArticleUpdated = (updated: NewsArticle) => {
    setArticles((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const filteredArticles = articles.filter((a) => {
    const matchesSearch =
      searchQuery === '' ||
      a.headline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.summary && a.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (a.source && a.source.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSentiment =
      filterSentiment === 'ALL' ||
      (filterSentiment === 'POSITIVE' && a.sentiment?.label === 'POSITIVE') ||
      (filterSentiment === 'NEGATIVE' && a.sentiment?.label === 'NEGATIVE') ||
      (filterSentiment === 'NEUTRAL' && a.sentiment?.label === 'NEUTRAL');

    return matchesSearch && matchesSentiment;
  });

  const posCount = articles.filter((a) => a.sentiment?.label === 'POSITIVE').length;
  const negCount = articles.filter((a) => a.sentiment?.label === 'NEGATIVE').length;
  const neuCount = articles.filter((a) => a.sentiment?.label === 'NEUTRAL').length;

  return (
    <div className="workstation-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-subtle bg-[#0B1220]/60 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
              <Newspaper className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight">
                  Intelligence Actualités &amp; FinBERT
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Flux officiel Finnhub · Scoring NLP FinBERT &amp; XAI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadLiveNews(true)}
              disabled={loading}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-slate-200 bg-[#142035] hover:bg-[#192841] border border-subtle transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Rafraîchir
            </button>
            <button
              onClick={handleBatchSentiment}
              disabled={batchLoading || articles.length === 0}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white btn-ai transition-all active:scale-[0.985] disabled:opacity-40 gap-1.5"
            >
              {batchLoading ? (
                <OrbitalSpinner size="xs" tone="violet" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {batchLoading ? 'Inférence IA...' : 'Analyser FinBERT'}
            </button>
          </div>
        </div>

        {/* Live Query Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-subtle">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-medium">Symbole</span>
            <AssetLogo symbol={symbol} size="sm" />
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="bg-[#070B14] border border-subtle text-white font-mono text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-400"
            >
              {['AAPL', 'MSFT', 'TSLA', 'NVDA', 'AMZN', 'GOOGL', 'META', 'JPM', 'SPY'].map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-[#070B14] border border-subtle text-white font-mono text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-400"
            />
            <span className="text-[11px]">au</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-[#070B14] border border-subtle text-white font-mono text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-400"
            />
            <button
              onClick={() => loadLiveNews(false)}
              className="px-3 py-1.5 bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold rounded-lg text-xs transition"
            >
              Appliquer
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleApplyPreset('30d')}
              className="px-2.5 py-1.5 rounded-lg bg-[#070B14] hover:bg-[#142035] text-[11px] font-medium text-sky-300 border border-subtle transition"
            >
              30 derniers jours
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('180d')}
              className="px-2.5 py-1.5 rounded-lg bg-[#070B14] hover:bg-[#142035] text-[11px] font-medium text-slate-300 border border-subtle transition"
            >
              6 derniers mois
            </button>
          </div>
        </div>

        {/* Sentiment Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-subtle">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setFilterSentiment('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium font-mono tabular-nums transition border ${
                filterSentiment === 'ALL'
                  ? 'bg-[#192841] text-white border-strong'
                  : 'bg-[#070B14] text-slate-400 border-subtle hover:text-white'
              }`}
            >
              Tous ({articles.length})
            </button>
            <button
              onClick={() => setFilterSentiment('POSITIVE')}
              className={`inline-flex items-center px-2.5 py-1 rounded-lg font-medium font-mono tabular-nums transition border ${
                filterSentiment === 'POSITIVE'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-[#070B14] text-slate-400 border-subtle hover:text-emerald-300'
              }`}
            >
              <TrendingUp className="w-3 h-3 mr-1.5 text-emerald-400" />
              Positifs ({posCount})
            </button>
            <button
              onClick={() => setFilterSentiment('NEGATIVE')}
              className={`inline-flex items-center px-2.5 py-1 rounded-lg font-medium font-mono tabular-nums transition border ${
                filterSentiment === 'NEGATIVE'
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                  : 'bg-[#070B14] text-slate-400 border-subtle hover:text-rose-300'
              }`}
            >
              <TrendingDown className="w-3 h-3 mr-1.5 text-rose-400" />
              Négatifs ({negCount})
            </button>
            <button
              onClick={() => setFilterSentiment('NEUTRAL')}
              className={`inline-flex items-center px-2.5 py-1 rounded-lg font-medium font-mono tabular-nums transition border ${
                filterSentiment === 'NEUTRAL'
                  ? 'bg-slate-600/25 text-slate-200 border-slate-500/40'
                  : 'bg-[#070B14] text-slate-400 border-subtle hover:text-slate-200'
              }`}
            >
              <Minus className="w-3 h-3 mr-1.5 text-slate-400" />
              Neutres ({neuCount})
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Rechercher un titre…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#070B14] border border-subtle text-white text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-sky-400 w-48 transition"
            />
          </div>
        </div>
      </div>

      {/* Articles Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {batchLoading && (
          <AnimatedMarketLoader
            mode="ai"
            variant="inline"
            badge="FINBERT NLP · XAI"
            title="Inférence FinBERT en cours sur le fil d'actualités…"
            subtitle="Classification contextuelle Positive / Neutre / Négative et extraction des tokens clés."
          />
        )}
        {loading && articles.length === 0 ? (
          <NewsSkeleton count={4} />
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            {error}
          </div>
        ) : filteredArticles.length === 0 ? (
          <EmptyState
            icon={Newspaper}
            title="Aucune actualité correspondante"
            description="Ajustez la plage de dates, le symbole boursier ou le filtre de sentiment FinBERT."
          />
        ) : (
          filteredArticles.map((article) => {
            const sentiment = article.sentiment;
            const isPos = sentiment?.label === 'POSITIVE';
            const isNeg = sentiment?.label === 'NEGATIVE';
            const topTokens = sentiment?.xai?.topTokens || [];

            return (
              <div
                key={article.id}
                onClick={() => setSelectedArticle(article)}
                className="group p-4 rounded-xl bg-[#070B14]/70 hover:bg-[#142035]/90 border border-subtle card-interactive cursor-pointer transition-all duration-150 space-y-2.5"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono bg-violet-500/15 text-violet-300 font-semibold border border-violet-500/25">
                      <AssetLogo symbol={article.symbol} size="xs" />
                      {article.symbol}
                    </span>
                    <span className="text-slate-300 font-medium">
                      {article.source || 'Finnhub'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 font-mono tabular-nums">
                    <Clock className="w-3 h-3" />
                    <span>
                      {new Date(article.publishedAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-white group-hover:text-sky-300 transition leading-snug line-clamp-2">
                  {article.headline}
                </h3>

                {article.summary && (
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {article.summary}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-subtle">
                  {sentiment ? (
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold border ${
                          isPos
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : isNeg
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-[#101A2B] text-slate-300 border-subtle'
                        }`}
                      >
                        {isPos ? (
                          <TrendingUp className="w-3 h-3 mr-1" />
                        ) : isNeg ? (
                          <TrendingDown className="w-3 h-3 mr-1" />
                        ) : (
                          <Minus className="w-3 h-3 mr-1" />
                        )}
                        {sentiment.label} ({((sentiment.score ?? 0) * 100).toFixed(0)}%)
                      </span>

                      {topTokens.slice(0, 3).map((tok, idx) => (
                        <span
                          key={idx}
                          className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#101A2B] border border-subtle text-slate-300"
                        >
                          <Tag className="w-2.5 h-2.5 mr-1 text-sky-400 opacity-75" />
                          {tok.token}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">
                      Sentiment en attente d'inférence
                    </span>
                  )}

                  <span className="text-[11px] font-medium text-sky-400/80 group-hover:text-sky-300 transition">
                    Détails & XAI →
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <NewsArticleModal
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
        onArticleUpdated={handleArticleUpdated}
      />
    </div>
  );
};
