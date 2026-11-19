import { DuelPricePoint } from './duel';

export interface ChallengePhase {
  phaseOrder: number;
  name: string;
  startMinute: number;
  endMinute: number;
  trendType: 'BULLISH' | 'BEARISH' | 'VOLATILE_RANGE' | 'PARABOLIC_CRASH' | 'RECOVERY_SQUEEZE';
  targetPriceChangePct: number; // ex: -30 pour -30%
  volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  breakingNewsHeadline?: string;
  breakingNewsSeverity?: 'INFO' | 'WARNING' | 'PANIC' | 'EUPHORIA';
}

export interface CustomChallenge {
  id: number;
  creatorId: number;
  creatorName: string;
  assetName: string;
  assetSymbol: string;
  category: string;
  description: string;
  durationMinutes: number;
  initialPrice: number;
  initialCapital: number;
  maxLeverage: number;
  status: 'ACTIVE' | 'ARCHIVED';
  phases: ChallengePhase[];
  trajectory: DuelPricePoint[];
  totalParticipants?: number;
  createdAt: string;
}

export interface CreateCustomChallengePayload {
  assetName: string;
  assetSymbol: string;
  category: string;
  description: string;
  durationMinutes: number;
  initialPrice: number;
  initialCapital?: number;
  maxLeverage?: number;
  phases: ChallengePhase[];
}

export interface SubmitChallengeRunPayload {
  challengeId: number;
  mode: 'SOLO' | 'DUEL_1V1';
  opponentId?: number | null;
  finalEquity: number;
  netPnl: number;
  returnPct: number;
  maxDrawdownPct: number;
  tradesCount: number;
  equityCurve: number[];
}

export interface ChallengeLeaderboardEntry {
  rank: number;
  runId: number;
  traderName: string;
  mode: string;
  finalEquity: number;
  netPnl: number;
  returnPct: number;
  maxDrawdownPct: number;
  tradesCount: number;
  score: number;
  completedAt: string;
}
