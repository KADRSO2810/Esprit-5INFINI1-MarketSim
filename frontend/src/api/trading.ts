import api from './axios';

// ── Types ───────────────────────────────────────────────────────────────────

export interface PortfolioSummary {
  cash: number;
  equity: number;
  unrealizedPnl: number;
  realizedPnl: number;
  positionsCount: number;
  updatedAt: string;
}

export interface PositionItem {
  symbol: string;
  quantity: number;
  avgPrice: number;
  lastPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  potentialLoss?: number | null;
  potentialProfit?: number | null;
  riskRewardRatio?: number | null;
  slDistancePercent?: number | null;
  tpDistancePercent?: number | null;
  slTpStatus?: 'ACTIVE' | 'SL_ONLY' | 'TP_ONLY' | 'NONE' | string;
}

export interface TradeItem {
  id: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fee: number;
  realizedPnl: number | null;
  tradeReason?: string | null;
  ts: string;
}

export interface OrderFill {
  status: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  fee: number;
  realizedPnl: number | null;
  cashAfter: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  tradeReason?: string | null;
}

export interface ExposureEntry {
  symbol: string;
  weight: number;
  marketValue: number;
}

export interface RiskMetrics {
  var95: number | null;
  maxDrawdown: number | null;
  portfolioEquity: number;
  quoteWindowUsed: number;
  snapshotWindowUsed: number;
  exposureBySymbol: ExposureEntry[];
  message: string | null;
}

// ── API calls ───────────────────────────────────────────────────────────────

export const getPortfolioSummary = async (sessionId = 0): Promise<PortfolioSummary> => {
  const res = await api.get<PortfolioSummary>('/api/portfolio/summary', { params: { sessionId } });
  return res.data;
};

export const getPositions = async (sessionId = 0): Promise<PositionItem[]> => {
  const res = await api.get<PositionItem[]>('/api/portfolio/positions', { params: { sessionId } });
  return res.data;
};

export const getTrades = async (limit = 50, sessionId = 0): Promise<TradeItem[]> => {
  const res = await api.get<TradeItem[]>('/api/portfolio/trades', { params: { limit, sessionId } });
  return res.data;
};

export const placeMarketOrder = async (
  symbol: string,
  side: 'BUY' | 'SELL',
  quantity: number,
  sessionId = 0,
  stopLoss?: number | null,
  takeProfit?: number | null
): Promise<OrderFill> => {
  const payload: Record<string, unknown> = { symbol, side, quantity };
  if (stopLoss != null && stopLoss > 0) payload.stopLoss = stopLoss;
  if (takeProfit != null && takeProfit > 0) payload.takeProfit = takeProfit;

  const res = await api.post<OrderFill>(
    '/api/orders/market',
    payload,
    { params: { sessionId } }
  );
  return res.data;
};

export const updateSlTp = async (
  symbol: string,
  stopLoss?: number | null,
  takeProfit?: number | null,
  sessionId = 0
): Promise<PositionItem> => {
  const payload: Record<string, unknown> = {};
  if (stopLoss !== undefined) payload.stopLoss = stopLoss;
  if (takeProfit !== undefined) payload.takeProfit = takeProfit;

  const res = await api.put<PositionItem>(
    `/api/portfolio/positions/${encodeURIComponent(symbol)}/sl-tp`,
    payload,
    { params: { sessionId } }
  );
  return res.data;
};

export const removeSlTp = async (
  symbol: string,
  sessionId = 0
): Promise<PositionItem> => {
  const res = await api.delete<PositionItem>(
    `/api/portfolio/positions/${encodeURIComponent(symbol)}/sl-tp`,
    { params: { sessionId } }
  );
  return res.data;
};

export const getRiskMetrics = async (): Promise<RiskMetrics> => {
  const res = await api.get<RiskMetrics>('/api/risk/metrics');
  return res.data;
};
