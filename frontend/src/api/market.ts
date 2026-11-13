import api from './axios';

export interface MarketQuote {
  symbol: string;
  price: number;
  ts: string;
  source: string;
}

export interface WatchlistResponse {
  symbols: string[];
}

export interface CandleItem {
  symbol: string;
  resolution: string;
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const getWatchlist = async (): Promise<string[]> => {
  const response = await api.get<WatchlistResponse>('/api/market/watchlist');
  return response.data.symbols;
};

export const updateWatchlist = async (symbols: string[]): Promise<string[]> => {
  const response = await api.post<WatchlistResponse>('/api/market/watchlist', { symbols });
  return response.data.symbols;
};

export const getLastQuotes = async (): Promise<MarketQuote[]> => {
  const response = await api.get<MarketQuote[]>('/api/market/last-quotes');
  return response.data;
};

export const getQuotesHistory = async (symbol: string, limit = 50): Promise<MarketQuote[]> => {
  const response = await api.get<MarketQuote[]>(`/api/market/quotes`, {
    params: { symbol, limit },
  });
  return response.data;
};

export const getCandles = async (
  symbol: string,
  resolution: string = '15',
  from?: number,
  to?: number,
  refresh: boolean = false
): Promise<CandleItem[]> => {
  const response = await api.get<CandleItem[]>('/api/market/candles', {
    params: { symbol, resolution, from, to, refresh },
  });
  return response.data;
};
