import api from './axios';

export type StrategyType = 'SMA_CROSS' | 'RSI' | 'SMA_SENTIMENT';
export type StrategyMode = 'LIVE';
export type StrategyStatus = 'RUNNING' | 'STOPPED';
export type PositionSizingType = 'FIXED_NOTIONAL' | 'PCT_EQUITY';
export type SignalType = 'BUY' | 'SELL' | 'HOLD';

export interface Strategy {
  id: number;
  name: string;
  strategyType: StrategyType;
  symbols: string[];
  resolution: string;
  params: Record<string, any>;
  mode: StrategyMode;
  sessionId: number;
  autoTrade: boolean;
  positionSizing: PositionSizingType;
  sizingValue: number;
  riskRules?: Record<string, any>;
  status: StrategyStatus;
  createdAt: string;
  latestSignal?: StrategySignal;
}

export interface StrategySignal {
  id: number;
  strategyId: number;
  ts: string;
  symbol: string;
  signal: SignalType;
  price: number;
  explanation: Record<string, any>;
}

export interface StrategyExecution {
  id: number;
  strategyId: number;
  ts: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  orderResult: Record<string, any>;
}

export interface StrategyPerformance {
  strategyId: number;
  totalSignals: number;
  buySignals: number;
  sellSignals: number;
  holdSignals: number;
  totalExecutions: number;
  totalVolume: number;
  winRatePct: number;
  realizedPnl: number;
  returnPct: number;
  maxDrawdownPct: number;
}

export interface CreateStrategyParams {
  name: string;
  strategyType: StrategyType;
  symbols: string[];
  resolution?: string;
  params: Record<string, any>;
  mode?: StrategyMode;
  sessionId?: number;
  autoTrade?: boolean;
  positionSizing?: PositionSizingType;
  sizingValue?: number;
  riskRules?: Record<string, any>;
}

export interface UpdateStrategyParams {
  name?: string;
  symbols?: string[];
  resolution?: string;
  params?: Record<string, any>;
  autoTrade?: boolean;
  positionSizing?: PositionSizingType;
  sizingValue?: number;
  riskRules?: Record<string, any>;
}

export async function listStrategies(): Promise<Strategy[]> {
  const res = await api.get<Strategy[]>('/api/strategies');
  return res.data;
}

export async function getStrategy(id: number): Promise<Strategy> {
  const res = await api.get<Strategy>(`/api/strategies/${id}`);
  return res.data;
}

export async function createStrategy(data: CreateStrategyParams): Promise<Strategy> {
  const res = await api.post<Strategy>('/api/strategies', data);
  return res.data;
}

export async function updateStrategy(id: number, data: UpdateStrategyParams): Promise<Strategy> {
  const res = await api.put<Strategy>(`/api/strategies/${id}`, data);
  return res.data;
}

export async function deleteStrategy(id: number): Promise<void> {
  await api.delete(`/api/strategies/${id}`);
}

export async function startStrategy(id: number): Promise<Strategy> {
  const res = await api.post<Strategy>(`/api/strategies/${id}/start`);
  return res.data;
}

export async function stopStrategy(id: number): Promise<Strategy> {
  const res = await api.post<Strategy>(`/api/strategies/${id}/stop`);
  return res.data;
}

export async function getSignals(id: number, limit: number = 100): Promise<StrategySignal[]> {
  const res = await api.get<StrategySignal[]>(`/api/strategies/${id}/signals`, { params: { limit } });
  return res.data;
}

export async function getExecutions(id: number, limit: number = 100): Promise<StrategyExecution[]> {
  const res = await api.get<StrategyExecution[]>(`/api/strategies/${id}/executions`, { params: { limit } });
  return res.data;
}

export async function getPerformance(id: number): Promise<StrategyPerformance> {
  const res = await api.get<StrategyPerformance>(`/api/strategies/${id}/performance`);
  return res.data;
}
