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

export interface OrderBookEntry {
  price: number;
  quantity: number;
  total: number;
  depthPercentage: number;
  orderCount: number;
}

export interface OrderBook {
  symbol: string;
  lastPrice: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
  spreadPercentage: number;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  totalBidVolume: number;
  totalAskVolume: number;
  timestamp: string;
  assetClass: string;
}

export interface LimitOrder {
  id: number;
  userId: number;
  sessionId: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'LIMIT';
  quantity: number;
  limitPrice: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  createdAt: string;
  filledAt?: string | null;
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
  takeProfit?: number | null,
  orderType: 'MARKET' | 'LIMIT' = 'MARKET',
  limitPrice?: number | null
): Promise<OrderFill> => {
  const payload: Record<string, unknown> = { symbol, side, quantity, orderType };
  if (stopLoss != null && stopLoss > 0) payload.stopLoss = stopLoss;
  if (takeProfit != null && takeProfit > 0) payload.takeProfit = takeProfit;
  if (orderType === 'LIMIT' && limitPrice != null && limitPrice > 0) payload.limitPrice = limitPrice;

  const res = await api.post<OrderFill>(
    '/api/orders/market',
    payload,
    { params: { sessionId } }
  );
  return res.data;
};

export const getOrderBook = async (symbol: string): Promise<OrderBook> => {
  const res = await api.get<OrderBook>('/api/orders/orderbook', { params: { symbol } });
  return res.data;
};

export const getPendingOrders = async (sessionId = 0): Promise<LimitOrder[]> => {
  const res = await api.get<LimitOrder[]>('/api/orders/pending', { params: { sessionId } });
  return res.data;
};

export const cancelPendingOrder = async (orderId: number): Promise<void> => {
  await api.delete(`/api/orders/pending/${orderId}`);
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

// ── Pre-Trade Risk Management System ────────────────────────────────────────

export interface RiskLimits {
  maxRiskPerTradePct: number;
  maxAssetExposurePct: number;
  maxSectorExposurePct: number;
  maxPortfolioExposurePct: number;
}

export interface PreTradeRiskRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  sessionId?: number;
}

export interface PreTradeRiskResponse {
  decision: 'APPROVED' | 'WARNING' | 'REJECTED';
  orderNotional: number;
  currentCash: number;
  cashAfter: number;
  portfolioEquity: number;
  currentPortfolioExposure: number;
  currentPortfolioExposurePct: number;
  newPortfolioExposure: number;
  newPortfolioExposurePct: number;
  currentAssetExposure: number;
  currentAssetExposurePct: number;
  newAssetExposure: number;
  newAssetExposurePct: number;
  sector: string;
  currentSectorExposurePct: number;
  newSectorExposurePct: number;
  potentialLoss?: number | null;
  riskPerTradePct?: number | null;
  potentialProfit?: number | null;
  riskRewardRatio?: number | null;
  positionSizePct: number;
  remainingAvailableExposure: number;
  suggestedMaxQuantity: number;
  limits: RiskLimits;
  reasons: string[];
  warnings: string[];
  rejections: string[];
}

export interface PositionSizingRequest {
  symbol: string;
  riskPercentage?: number | null;
  entryPrice?: number | null;
  stopLoss: number;
  sessionId?: number;
}

export interface PositionSizingResponse {
  symbol: string;
  portfolioEquity: number;
  riskPercentage: number;
  riskBudget: number;
  entryPrice: number;
  stopLoss: number;
  riskPerUnit: number;
  maxQuantityByRisk: number;
  maxQuantityByCash: number;
  maxQuantityByAssetExposure: number;
  suggestedQuantity: number;
  formulaExplanation: string;
}

export const assessPreTradeRisk = async (
  req: PreTradeRiskRequest
): Promise<PreTradeRiskResponse> => {
  const res = await api.post<PreTradeRiskResponse>('/api/risk/pre-trade-assessment', req);
  return res.data;
};

export const calculatePositionSize = async (
  req: PositionSizingRequest
): Promise<PositionSizingResponse> => {
  const res = await api.post<PositionSizingResponse>('/api/risk/position-sizing', req);
  return res.data;
};

export const getRiskLimits = async (): Promise<RiskLimits> => {
  const res = await api.get<RiskLimits>('/api/risk/limits');
  return res.data;
};

export const updateRiskLimits = async (limits: RiskLimits): Promise<RiskLimits> => {
  const res = await api.put<RiskLimits>('/api/risk/limits', limits);
  return res.data;
};

// ── Portfolio Risk Intelligence & Analytics (Task 03) ──────────────────────────

export interface PositionRiskContribution {
  symbol: string;
  quantity: number;
  currentPrice: number;
  marketValue: number;
  weightPct: number;
  assetVolatilityPct: number;
  marginalRiskContribution: number;
  componentRiskContribution: number;
  riskContributionPct: number;
  sector: string;
}

export interface SectorConcentration {
  sector: string;
  marketValue: number;
  weightPct: number;
  assetsCount: number;
  symbols: string[];
}

export interface CorrelatedPair {
  symbolA: string;
  symbolB: string;
  correlation: number;
  warning: string;
}

export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][];
  highlyCorrelatedPairs: CorrelatedPair[];
}

export interface RiskAlert {
  id: number;
  alertType: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  description: string;
  metricName: string;
  metricValue: number;
  thresholdValue: number;
  affectedSymbols: string[];
  suggestion: string;
  acknowledged: boolean;
  createdAt: string;
}

export interface RiskEvolutionPoint {
  ts: string;
  equity: number;
  drawdownPct: number;
  dailyReturnPct: number;
}

export interface PostTradeRiskEvaluation {
  id: number;
  tradeId: number;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  equityBefore: number;
  equityAfter: number;
  exposurePctBefore: number;
  exposurePctAfter: number;
  deltaExposurePct: number;
  var95Before: number;
  var95After: number;
  deltaVar95: number;
  concentrationHhiBefore: number;
  concentrationHhiAfter: number;
  warnings: string[];
  createdAt: string;
}

export interface PortfolioRiskAnalytics {
  portfolioEquity: number;
  cashBalance: number;
  investedValue: number;
  totalExposurePct: number;
  positionsCount: number;

  var95Pct: number | null;
  var95Amount: number | null;
  var99Pct: number | null;
  var99Amount: number | null;
  varMethodology: string;

  cvar95Pct: number | null;
  cvar95Amount: number | null;
  cvar99Pct: number | null;
  cvar99Amount: number | null;
  cvarExplanation: string;

  dailyVolatilityPct: number | null;
  annualizedVolatilityPct: number | null;

  currentDrawdownPct: number;
  maxHistoricalDrawdownPct: number;
  peakEquity: number;

  beta: number | null;
  benchmarkSymbol: string;
  benchmarkStatus: string;

  hhi: number;
  hhiLevel: string;
  diversificationRatio: number | null;
  largestRiskContributor: string | null;

  positionsRisk: PositionRiskContribution[];
  sectorConcentration: SectorConcentration[];
  correlationMatrix: CorrelationMatrix | null;
  riskEvolution: RiskEvolutionPoint[];
  activeAlerts: RiskAlert[];
  lastPostTradeImpact: PostTradeRiskEvaluation | null;

  observationWindow: number;
  observationStatus: string;
  message: string | null;
  calculatedAt: string;
}

export const getPortfolioRiskAnalytics = async (
  sessionId = 0
): Promise<PortfolioRiskAnalytics> => {
  const res = await api.get<PortfolioRiskAnalytics>('/api/risk/portfolio-analytics', {
    params: { sessionId },
  });
  return res.data;
};

export const getRiskAlerts = async (): Promise<RiskAlert[]> => {
  const res = await api.get<RiskAlert[]>('/api/risk/alerts');
  return res.data;
};

export const acknowledgeRiskAlert = async (alertId: number): Promise<RiskAlert> => {
  const res = await api.post<RiskAlert>(`/api/risk/alerts/${alertId}/acknowledge`);
  return res.data;
};

export const getPostTradeRiskEvaluations = async (
  sessionId = 0
): Promise<PostTradeRiskEvaluation[]> => {
  const res = await api.get<PostTradeRiskEvaluation[]>('/api/risk/post-trade-evaluations', {
    params: { sessionId },
  });
  return res.data;
};

