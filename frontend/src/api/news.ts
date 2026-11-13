import api from './axios';

export type SentimentLabel = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

export interface SentimentScores {
  positive?: number;
  neutral?: number;
  negative?: number;
  [key: string]: number | undefined;
}

export interface XaiToken {
  token: string;
  weight: number;
  direction?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

export interface NewsSentiment {
  model: string;
  label: SentimentLabel;
  score: number;
  details?: SentimentScores;
  xai?: {
    topTokens?: XaiToken[];
    [key: string]: any;
  };
}

export interface NewsArticle {
  id: number;
  symbol: string;
  symbols?: string[];
  headline: string;
  summary?: string;
  url: string;
  source?: string;
  imageUrl?: string;
  publishedAt: string;
  sentiment?: NewsSentiment;
}

export interface BatchSentimentParams {
  symbol?: string;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  limit?: number;
}

/**
 * Récupère les actualités pour un symbole avec cache DB et refresh optionnel.
 */
export async function getNews(
  symbol: string = 'AAPL',
  from?: string,
  to?: string,
  refresh: boolean = false
): Promise<NewsArticle[]> {
  const params: Record<string, any> = { symbol, refresh };
  if (from) params.from = from;
  if (to) params.to = to;

  const res = await api.get<NewsArticle[]>('/api/news', { params });
  return res.data;
}

/**
 * Recalcule le sentiment IA pour un article unique.
 */
export async function recomputeSentiment(articleId: number): Promise<NewsArticle> {
  const res = await api.post<NewsArticle>('/api/news/sentiment/recompute', null, {
    params: { articleId }
  });
  return res.data;
}

/**
 * Recalcule en lot le sentiment IA pour les articles d'un symbole.
 */
export async function recomputeSentimentBatch(params: BatchSentimentParams): Promise<NewsArticle[]> {
  const res = await api.post<NewsArticle[]>('/api/news/sentiment/recompute-batch', params);
  return res.data;
}
