export type DuelOpponentType = 'AI_QUANT' | 'HUMAN';

export type DuelBotProfile = 'HFT_MOMENTUM' | 'ALPHA_MEAN_REVERSION' | 'CTA_TREND_BREAKOUT';

export type DuelStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED';

export type DuelWinnerRole = 'CHALLENGER' | 'OPPONENT' | 'TIE';

export interface DuelPricePoint {
  step: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  hint?: string | null;
}

export interface DuelScenario {
  id: string;
  codeName: string;
  category: string;
  difficulty: 'NORMAL' | 'HARD' | 'EXTREME';
  description: string;
  durationSeconds: number;
  initialCapital: number;
  priceTrajectory: DuelPricePoint[];
  realAssetSymbol?: string;
  realAssetName?: string;
  realPeriod?: string;
  historicalContext?: string;
}

export interface DuelMatch {
  id: number;
  challengerId: number;
  challengerName: string;
  opponentType: DuelOpponentType;
  opponentId?: number | null;
  opponentName?: string;
  opponentEmail?: string | null;
  botProfile?: DuelBotProfile | null;
  scenarioId: string;
  scenarioTitle: string;
  status: DuelStatus;
  inviteToken: string;
  inviteUrl: string;
  initialCapital: number;
  challengerPnl: number;
  challengerRoi: number;
  challengerScore: number;
  challengerTrades: number;
  challengerEquityCurve?: number[];
  opponentPnl: number;
  opponentRoi: number;
  opponentScore: number;
  opponentTrades: number;
  opponentEquityCurve?: number[];
  winnerId?: number | null;
  winnerRole?: DuelWinnerRole | null;
  winnerName?: string | null;
  createdAt: string;
  completedAt?: string | null;
  realAssetSymbol?: string;
  realAssetName?: string;
  realPeriod?: string;
  historicalContext?: string;
}

export interface DuelLeaderboardEntry {
  rank: number;
  matchId: number;
  winnerName: string;
  loserName: string;
  scenarioTitle: string;
  winnerPnl: number;
  winnerRoi: number;
  winnerScore: number;
  completedAt: string;
}

export interface CreateAiDuelPayload {
  scenarioId: string;
  botProfile: DuelBotProfile;
}

export interface CreateFriendDuelPayload {
  friendEmail: string;
  scenarioId: string;
}

export interface SubmitDuelRunPayload {
  matchId?: number;
  inviteToken?: string;
  netPnl: number;
  returnPct: number;
  maxDrawdownPct: number;
  tradesCount: number;
  equityCurve: number[];
}
