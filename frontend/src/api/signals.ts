import api from './axios';
import { ExpertSignal, MarketHealth, ScanSignalsRequest, SignalTrackRecord } from '../types/signal';

export const getMarketHealth = async (): Promise<MarketHealth> => {
  const response = await api.get<MarketHealth>('/api/signals/health');
  return response.data;
};

export const getActiveSignals = async (): Promise<ExpertSignal[]> => {
  const response = await api.get<ExpertSignal[]>('/api/signals/active');
  return response.data;
};

export const scanSignals = async (request: ScanSignalsRequest): Promise<ExpertSignal[]> => {
  const response = await api.post<ExpertSignal[]>('/api/signals/scan', request);
  return response.data;
};

export const getSignalTrackRecord = async (): Promise<SignalTrackRecord> => {
  const response = await api.get<SignalTrackRecord>('/api/signals/track-record');
  return response.data;
};

export const boostTakeProfit = async (symbol: string): Promise<{ success: boolean; realizedPnl: number; message: string }> => {
  const response = await api.post<{ success: boolean; realizedPnl: number; message: string }>(`/api/signals/boost-tp/${symbol}`);
  return response.data;
};

export const closeStalePositions = async (): Promise<{ closedCount: number; totalPnl: number; message: string }> => {
  const response = await api.post<{ closedCount: number; totalPnl: number; message: string }>('/api/signals/close-stale-positions');
  return response.data;
};
