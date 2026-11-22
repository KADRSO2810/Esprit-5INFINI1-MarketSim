import axios from './axios';

export type InsuranceProductType = 'AUTO' | 'HEALTH' | 'HOME' | 'LIFE' | 'COMMERCIAL';

export interface PolicyholderProfile {
  productType: InsuranceProductType;
  age: number;
  bonusMalus: number;
  coverageAmount: number;
  deductible: number;
  geographicalZone: 'A' | 'B' | 'C';
  historyClaimsCount: number;
  portfolioSize: number;
  safetyLoadingPct?: number;
  expenseLoadingPct?: number;
  targetProfitPct?: number;
}

export interface ActuarialPricingResult {
  productType: InsuranceProductType;
  productLabel: string;
  purePremium: number;
  safetyLoadingAmount: number;
  expenseLoadingAmount: number;
  targetProfitAmount: number;
  commercialPremium: number;
  monthlyPremium: number;
  expectedClaimFrequency: number;
  expectedClaimSeverity: number;
  expectedAnnualClaimsCost: number;
  premiumMargin: number;
  premiumMarginPct: number;
  lossRatio: number;
  combinedRatio: number;
  isProfitable: boolean;
  underwritingAssessment: string;
  riskCoefficients: Record<string, any>;
}

export interface ClaimBucket {
  rangeLabel: string;
  minAmount: number;
  maxAmount: number;
  count: number;
  percentage: number;
}

export interface ClaimSimulationResult {
  portfolioSize: number;
  simulatedClaimsCount: number;
  empiricalFrequency: number;
  totalClaimsCost: number;
  averageClaimSeverity: number;
  maxSingleClaim: number;
  totalPremiumsCollected: number;
  totalExpenses: number;
  netUnderwritingResult: number;
  simulatedLossRatio: number;
  simulatedCombinedRatio: number;
  varClaims99: number;
  claimsDistribution: ClaimBucket[];
  isSolvent: boolean;
  riskDiagnosis: string;
}

export interface ProvisioningResult {
  methodName: string;
  originYears: number[];
  developmentYears: number[];
  cumulativeTriangle: number[][];
  incrementalTriangle: number[][];
  developmentFactors: number[];
  ultimateClaimsByYear: Record<number, number>;
  paidClaimsByYear: Record<number, number>;
  ibnrReservesByYear: Record<number, number>;
  totalPaidToDate: number;
  totalUltimateClaims: number;
  totalIbnrReserve: number;
  solvencyCapitalRequirement: number;
  commentary: string;
}

export interface InsuranceProductInfo {
  type: InsuranceProductType;
  label: string;
  description: string;
  baseFrequency: number;
  baseSeverity: number;
}

export interface ActuarialComparisonRow {
  dimension: string;
  classicalFinance: string;
  actuarialApproach: string;
  concreteImpact: string;
}

export interface TradingActuarialAnalysis {
  currentCapital: number;
  winRatePct: number;
  rewardRiskRatio: number;
  riskPerTradePct: number;
  currentLeverage: number;
  lundbergRuinProbability: number;
  lundbergAdjustmentCoefficientR: number;
  optimalKellyFractionPct: number;
  actuarialSafePositionSizePct: number;
  maxSafeLeverage: number;

  gaussianVaR95: number;
  gaussianVaR99: number;
  actuarialEvtVaR95: number;
  actuarialEvtVaR99: number;
  expectedShortfallCVaR99: number;
  riskUnderestimationFactor: number;
  tailIndexXi: number;
  evtDiagnosis: string;

  halfLifeTrades: number;
  survivalDaysByLeverage: Record<string, number>;
  capitalSurvivalProbability100Trades: number;

  recommendedSolvencyBuffer: number;
  solvencyRatioPct: number;
  tenYearStressDrawdown: number;
  isSolventSolvency2: boolean;

  professorQuestionAnswer: string;
  comparativeMatrix: ActuarialComparisonRow[];
}

export interface SimulateRuinRequest {
  initialCapital?: number;
  winRatePct?: number;
  rewardRiskRatio?: number;
  riskPerTradePct?: number;
  leverage?: number;
  numTrades?: number;
  numSimulations?: number;
}

export interface RuinTrajectory {
  name: string;
  equityPath: number[];
  ruined: boolean;
  maxDrawdownPct: number;
}

export interface SimulateRuinResult {
  empiricalRuinProbability: number;
  theoreticalLundbergBound: number;
  maxDrawdownAverage: number;
  maxDrawdownWorstCase: number;
  medianFinalCapital: number;
  survivalRate100Trades: number;
  sampleTrajectories: RuinTrajectory[];
  survivalCurve: Record<number, number>;
}

export const actuaryApi = {
  getProducts: async (): Promise<InsuranceProductInfo[]> => {
    const res = await axios.get<InsuranceProductInfo[]>('/api/actuary/products');
    return res.data;
  },

  calculatePricing: async (profile: PolicyholderProfile): Promise<ActuarialPricingResult> => {
    const res = await axios.post<ActuarialPricingResult>('/api/actuary/pricing', profile);
    return res.data;
  },

  simulateClaims: async (profile: PolicyholderProfile): Promise<ClaimSimulationResult> => {
    const res = await axios.post<ClaimSimulationResult>('/api/actuary/simulate-claims', profile);
    return res.data;
  },

  getProvisioning: async (productType: string = 'AUTO'): Promise<ProvisioningResult> => {
    const res = await axios.get<ProvisioningResult>('/api/actuary/provisioning', {
      params: { productType },
    });
    return res.data;
  },

  getTradingRiskAnalysis: async (sessionId: number = 0): Promise<TradingActuarialAnalysis> => {
    const res = await axios.get<TradingActuarialAnalysis>('/api/actuary/trading-risk', {
      params: { sessionId },
    });
    return res.data;
  },

  simulateTradingRuin: async (params: SimulateRuinRequest): Promise<SimulateRuinResult> => {
    const res = await axios.post<SimulateRuinResult>('/api/actuary/simulate-ruin', params);
    return res.data;
  },

  transferToTrading: async (amount: number, sessionId: number = 0): Promise<any> => {
    const res = await axios.post('/api/actuary/transfer-to-trading', null, {
      params: { amount, sessionId },
    });
    return res.data;
  },
};
