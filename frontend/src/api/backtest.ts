import api from './axios';

export interface BacktestRequest {
  symbol: string;
  resolution: string; // "1", "5", "15", "60", "D"
  fromEpochSec: number;
  toEpochSec: number;
  strategy?: string;
  params: {
    fast: number;
    slow: number;
    [key: string]: unknown;
  };
  initialCash: number;
}

export interface BacktestRunResponse {
  id: number;
  symbol: string;
  resolution: string;
  fromTs: string;
  toTs: string;
  strategy: string;
  params: {
    fast?: number;
    slow?: number;
    [key: string]: unknown;
  };
  initialCash: number;
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';
  errorMessage?: string;
  totalReturn?: number;
  maxDrawdown?: number;
  sharpeRatio?: number;
  tradesCount?: number;
  winRate?: number;
  createdAt: string;
}

export interface BacktestTrade {
  id: number;
  ts: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  fee: number;
  cashAfter: number;
}

export interface BacktestEquityPoint {
  ts: string;
  equity: number;
}

export interface Candle {
  symbol: string;
  resolution: string;
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const launchBacktest = async (data: BacktestRequest): Promise<BacktestRunResponse> => {
  const response = await api.post<BacktestRunResponse>('/api/backtests', data);
  return response.data;
};

export const getBacktestRuns = async (): Promise<BacktestRunResponse[]> => {
  const response = await api.get<BacktestRunResponse[]>('/api/backtests');
  return response.data;
};

export const getBacktestRun = async (runId: number): Promise<BacktestRunResponse> => {
  const response = await api.get<BacktestRunResponse>(`/api/backtests/${runId}`);
  return response.data;
};

export const getBacktestTrades = async (runId: number): Promise<BacktestTrade[]> => {
  const response = await api.get<BacktestTrade[]>(`/api/backtests/${runId}/trades`);
  return response.data;
};

export const getBacktestEquity = async (runId: number): Promise<BacktestEquityPoint[]> => {
  const response = await api.get<BacktestEquityPoint[]>(`/api/backtests/${runId}/equity`);
  return response.data;
};

export const getCandles = async (
  symbol: string,
  resolution: string,
  fromEpochSec: number,
  toEpochSec: number,
  refresh = false
): Promise<Candle[]> => {
  const response = await api.get<Candle[]>('/api/candles', {
    params: { symbol, resolution, fromEpochSec, toEpochSec, refresh }
  });
  return response.data;
};
