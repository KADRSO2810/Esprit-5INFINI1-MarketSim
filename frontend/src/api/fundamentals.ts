import api from './axios';

// ── Types ───────────────────────────────────────────────────────────────────

export interface CompanyProfile {
  symbol: string;
  name: string;
  country?: string;
  currency?: string;
  exchange?: string;
  ipoDate?: string;
  marketCapitalization?: number; // en millions USD
  shareOutstanding?: number;    // en millions d'actions
  finnhubIndustry?: string;
  sector?: string;
  logoUrl?: string;
  weburl?: string;
  phone?: string;
  isEquity: boolean;
}

export interface IncomeStatement {
  periodLabel: string;
  year: number;
  quarter: number;
  form: string;
  filedDate?: string;
  startDate?: string;
  endDate?: string;

  revenue?: number;
  costOfGoodsSold?: number;
  grossProfit?: number;
  researchAndDevelopment?: number;
  sellingGeneralAdmin?: number;
  operatingExpenses?: number;
  operatingIncome?: number;
  ebitda?: number;
  netInterestExpense?: number;
  pretaxIncome?: number;
  incomeTax?: number;
  netIncome?: number;
  epsBasic?: number;
  epsDiluted?: number;
  sharesBasic?: number;
  sharesDiluted?: number;

  grossMarginPct?: number;
  operatingMarginPct?: number;
  netMarginPct?: number;
}

export interface BalanceSheet {
  periodLabel: string;
  year: number;
  quarter: number;
  form: string;
  filedDate?: string;

  cashAndEquivalents?: number;
  shortTermInvestments?: number;
  totalCashAndShortTerm?: number;
  accountsReceivable?: number;
  inventory?: number;
  otherCurrentAssets?: number;
  currentAssets?: number;
  propertyPlantEquipmentNet?: number;
  longTermInvestments?: number;
  intangibleAssets?: number;
  totalAssets?: number;

  accountsPayable?: number;
  shortTermDebt?: number;
  currentLiabilities?: number;
  longTermDebt?: number;
  totalLiabilities?: number;
  totalDebt?: number;

  commonStock?: number;
  retainedEarnings?: number;
  totalStockholdersEquity?: number;
  totalLiabilitiesAndEquity?: number;

  workingCapital?: number;
  netDebt?: number;
}

export interface CashFlowStatement {
  periodLabel: string;
  year: number;
  quarter: number;
  form: string;
  filedDate?: string;

  netIncome?: number;
  depreciationAmortization?: number;
  stockBasedCompensation?: number;
  changeInWorkingCapital?: number;
  operatingCashFlow?: number;

  capitalExpenditures?: number;
  acquisitionsNet?: number;
  purchasesMarketableSecurities?: number;
  salesMarketableSecurities?: number;
  investingCashFlow?: number;

  commonStockIssuance?: number;
  commonStockRepurchase?: number;
  dividendsPaid?: number;
  debtIssuance?: number;
  debtRepayment?: number;
  financingCashFlow?: number;

  netChangeInCash?: number;
  freeCashFlow?: number;
}

export interface CompanyFinancialStatements {
  symbol: string;
  frequency: 'ANNUAL' | 'QUARTERLY';
  available: boolean;
  provider: string;
  dataFreshness?: string;
  message?: string;
  incomeStatements: IncomeStatement[];
  balanceSheets: BalanceSheet[];
  cashFlowStatements: CashFlowStatement[];
  retrievedAt: string;
}

export interface FinancialRatioItem {
  key: string;
  label: string;
  category: 'VALUATION' | 'PROFITABILITY' | 'HEALTH' | 'GROWTH';
  value: number | null;
  formattedValue: string;
  unit: string;
  formula: string;
  tooltip: string;
  benchmarkText?: string;
  source: string;
  status: 'AVAILABLE' | 'NEGATIVE_EARNINGS' | 'DIV_ZERO' | 'UNAVAILABLE';
}

export interface CompanyRatios {
  symbol: string;
  available: boolean;
  provider: string;
  message?: string;
  valuationRatios: FinancialRatioItem[];
  profitabilityRatios: FinancialRatioItem[];
  healthRatios: FinancialRatioItem[];
  growthRatios: FinancialRatioItem[];
  calculatedAt: string;
}

export interface HistoricalFinancialPoint {
  periodLabel: string;
  year: number;
  quarter: number;
  revenue?: number;
  grossProfit?: number;
  operatingIncome?: number;
  netIncome?: number;
  eps?: number;
  operatingCashFlow?: number;
  freeCashFlow?: number;
  capitalExpenditures?: number;
  grossMarginPct?: number;
  operatingMarginPct?: number;
  netMarginPct?: number;
}

export interface CompanyFundamentalOverview {
  symbol: string;
  available: boolean;
  message?: string;
  provider: string;
  dataFreshness?: string;

  profile?: CompanyProfile;
  currentPrice?: number | null;

  latestIncomeStatement?: IncomeStatement | null;
  latestBalanceSheet?: BalanceSheet | null;
  latestCashFlowStatement?: CashFlowStatement | null;

  ratios?: CompanyRatios;

  historicalAnnual: HistoricalFinancialPoint[];
  historicalQuarterly: HistoricalFinancialPoint[];

  reportingPeriod?: string;
  latestRevenue?: number | null;
  latestNetIncome?: number | null;
  latestEps?: number | null;
  roe?: number | null;
  debtToEquity?: number | null;
  peRatio?: number | null;
  dividendYield?: number | null;
  revenueGrowthYoY?: number | null;
  epsGrowthYoY?: number | null;
  freeCashFlow?: number | null;

  evaluatedAt: string;
}

export interface ComparisonMetricRow {
  key: string;
  label: string;
  category: string;
  unit: string;
  description: string;
  valuesBySymbol: Record<string, string>;
  rawValuesBySymbol: Record<string, number>;
  bestSymbol?: string | null;
  higherIsBetter: boolean;
}

export interface CompanyComparison {
  symbols: string[];
  profiles: CompanyProfile[];
  comparisonRows: ComparisonMetricRow[];
  warnings: string[];
  comparedAt: string;
}

export interface CompanySearchItem {
  symbol: string;
  name: string;
  type: 'EQUITY' | 'CRYPTO';
  exchange?: string;
  logoUrl?: string;
  fundamentalSupported: boolean;
}

// ── API Calls ───────────────────────────────────────────────────────────────

export const getCompanyOverview = async (
  symbol = 'AAPL'
): Promise<CompanyFundamentalOverview> => {
  const res = await api.get<CompanyFundamentalOverview>('/api/fundamentals/overview', {
    params: { symbol },
  });
  return res.data;
};

export const getCompanyFinancialStatements = async (
  symbol = 'AAPL',
  frequency: 'ANNUAL' | 'QUARTERLY' = 'ANNUAL'
): Promise<CompanyFinancialStatements> => {
  const res = await api.get<CompanyFinancialStatements>('/api/fundamentals/statements', {
    params: { symbol, frequency },
  });
  return res.data;
};

export const getCompanyProfile = async (
  symbol = 'AAPL'
): Promise<CompanyProfile> => {
  const res = await api.get<CompanyProfile>('/api/fundamentals/profile', {
    params: { symbol },
  });
  return res.data;
};

export const getCompanyRatios = async (
  symbol = 'AAPL'
): Promise<CompanyRatios> => {
  const res = await api.get<CompanyRatios>('/api/fundamentals/ratios', {
    params: { symbol },
  });
  return res.data;
};

export const compareCompanies = async (
  symbols: string[]
): Promise<CompanyComparison> => {
  const res = await api.post<CompanyComparison>('/api/fundamentals/compare', symbols);
  return res.data;
};

export const searchCompanies = async (
  query = ''
): Promise<CompanySearchItem[]> => {
  const res = await api.get<CompanySearchItem[]>('/api/fundamentals/search', {
    params: { query },
  });
  return res.data;
};
