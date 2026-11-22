export interface DailyTopPick {
  rank: number;
  symbol: string;
  cleanSymbol: string;
  assetName: string;
  assetClass: 'CRYPTO' | 'COMMODITY' | 'EQUITY' | string;
  currentPrice: number;
  previousClose: number;
  dailyChangePct: number;
  expectedReturnPct: number;
  confidenceScore: number;
  recommendation: string;
  catalyst: string;
  pattern: string;
  timeframe: string;
  targetPrice: number;
  stopLoss: number;
}

export interface ExpertSignal {
  id: string;
  symbol: string;
  assetName: string;
  assetClass: 'COMMODITY' | 'US_STOCK' | 'CRYPTO' | 'EQUITY' | string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskRewardRatio: number;
  confidenceScore: number;
  qualityGrade: 'AAA' | 'AA+' | 'AA' | 'A' | 'B' | string;
  technicalThesis: string;
  fundamentalCatalyst: string;
  riskManagementRule: string;
  indicatorsUsed: string[];
  telegramFormattedText: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'TP1_HIT' | 'TP2_HIT' | 'TP3_HIT' | 'SL_HIT' | string;
  recommendedPositionSizePct?: number;
  currentProfitPct?: number;
  progressToTp1Pct?: number;
  detectedPattern?: string;
  beginnerAdvice?: string;
  isInstantAlert?: boolean;
  durationSeconds?: number;
  isScalp5Min?: boolean;
  previousClosePrice?: number;
  dailyVariationPct?: number;
  dailyAnalysisDate?: string;
  isWeekend247?: boolean;
  isDailyTopPick?: boolean;
  dailyTopRank?: number;
  createdAt?: string;
  validUntil?: string;
}

export interface MarketHealth {
  nyseOpen: boolean;
  nyseStatusLabel: string;
  marketRegime: string;
  isStableForTrading: boolean;
  goldStatus: string;
  advisoryMessage: string;
  activeSignalsCount: number;
  overallWinRate: number;
  averageRiskReward: number;
  evaluatedAt: string;
  isWeekendSession: boolean;
  sessionActiveMarket: string;
  currentTradingDate: string;
  dailyTopPredictions: DailyTopPick[];
}

export interface ScanSignalsRequest {
  assetFilter: 'ALL' | 'TOP' | 'GOLD' | 'COMMODITIES' | 'STOCKS' | 'CRYPTO';
  forceSimulatedScan: boolean;
  minRiskReward: number;
}

export interface PastSignalResult {
  id: string;
  symbol: string;
  assetName: string;
  side: 'BUY' | 'SELL' | string;
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  result: 'TP1_HIT' | 'TP2_HIT' | 'TP3_HIT' | 'SL_HIT' | string;
  profitPct: number;
  closedAt: string;
}

export interface SignalTrackRecord {
  winRate: number;
  totalSignals: number;
  successfulSignals: number;
  failedSignals: number;
  totalProfitPips: number;
  avgRiskReward: number;
  maxDrawdownPct: number;
  recentHistory: PastSignalResult[];
}
