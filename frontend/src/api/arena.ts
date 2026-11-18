import axios from './axios';

export interface ArenaCrisisEvent {
  timeSec: number;
  headline: string;
  severity: 'CRITICAL' | 'PANIC' | 'INTERVENTION' | 'COLLAPSE';
  source: string;
  shockMultiplier: number;
  hint: string;
}

export interface ArenaPricePoint {
  timeSec: number;
  price: number;
  vix: number;
  marketReturnPct: number;
  liquidityIndex: number;
}

export interface ArenaBoss {
  id: string;
  name: string;
  subtitle: string;
  year: number;
  difficulty: 'EXTRÊME' | 'HARDCORE' | 'LÉGENDAIRE' | 'ÉPIQUE';
  themeColor: string;
  initialEquity: number;
  durationSeconds: number;
  lore: string;
  mechanicsDescription: string;
  historicalMaxDrawdown: number;
  vixSpike: number;
  assetName: string;
  initialPrice: number;
  events: ArenaCrisisEvent[];
  priceTrajectory: ArenaPricePoint[];
}

export interface ArenaRunRequest {
  bossId: string;
  initialEquity: number;
  finalEquity: number;
  maxDrawdownPct: number;
  survivalSeconds: number;
  survived: boolean;
  actionsTaken?: number;
  hedgesCount?: number;
}

export interface ArenaRunResponse {
  id: number;
  bossId: string;
  bossName: string;
  initialEquity: number;
  finalEquity: number;
  netPnl: number;
  returnPct: number;
  maxDrawdownPct: number;
  survivalSeconds: number;
  survived: boolean;
  rankGrade: 'SSS' | 'S' | 'A' | 'B' | 'C' | 'F';
  score: number;
  xpEarned: number;
  titleEarned: string;
  auditFeedback: string;
  createdAt: string;
}

export interface ArenaLeaderboardEntry {
  rank: number;
  runId: number;
  traderName: string;
  bossId: string;
  bossName: string;
  finalEquity: number;
  netPnl: number;
  returnPct: number;
  maxDrawdownPct: number;
  survivalSeconds: number;
  survived: boolean;
  rankGrade: string;
  score: number;
  date: string;
}

export const getArenaBosses = async (): Promise<ArenaBoss[]> => {
  const response = await axios.get<ArenaBoss[]>('/api/arena/bosses');
  return response.data;
};

export const getArenaBoss = async (bossId: string): Promise<ArenaBoss> => {
  const response = await axios.get<ArenaBoss>(`/api/arena/bosses/${bossId}`);
  return response.data;
};

export const recordArenaRun = async (request: ArenaRunRequest): Promise<ArenaRunResponse> => {
  const response = await axios.post<ArenaRunResponse>('/api/arena/runs', request);
  return response.data;
};

export const getArenaLeaderboard = async (): Promise<ArenaLeaderboardEntry[]> => {
  const response = await axios.get<ArenaLeaderboardEntry[]>('/api/arena/leaderboard');
  return response.data;
};

export const getMyArenaHistory = async (): Promise<ArenaRunResponse[]> => {
  const response = await axios.get<ArenaRunResponse[]>('/api/arena/my-history');
  return response.data;
};
