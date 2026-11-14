import axios from './axios';

export type AssetClass = 'EQUITY' | 'CRYPTO' | 'FOREX' | 'BOND' | 'COMMODITY';

export interface MarketInstrument {
  symbol: string;
  displayName: string;
  assetClass: AssetClass;
  baseCurrency?: string;
  quoteCurrency: string;
  pricePrecision: number;
  minQuantity: number;
  unit?: string;
  tradingStatus?: string;
  marketDataSource?: string;
  tradingSession?: string;
  currentPrice: number;
  bid?: number;
  ask?: number;
  spread?: number;
  spreadPips?: number;
  change24h?: number;
  change24hPct?: number;
  high24h?: number;
  low24h?: number;
  volume?: number;
  metadata?: Record<string, any>;
  lastUpdated?: string;
}

export interface ForexQuote {
  symbol: string;
  displayName: string;
  baseCurrency: string;
  quoteCurrency: string;
  bid: number;
  ask: number;
  midPrice: number;
  spreadPrice: number;
  spreadPips: number;
  pipSize: number;
  pipValueUsd: number;
  change24h: number;
  change24hPct: number;
  high24h: number;
  low24h: number;
  sessionStatus: 'OPEN' | 'CLOSED';
  sessionDescription: string;
  marketDataSource: string;
  timestamp: string;
  historicalRates?: Record<string, number>;
}

export interface BondInstrument {
  symbol: string;
  displayName: string;
  issuerType: string;
  issuerName: string;
  parValue: number;
  cleanPrice: number;
  dirtyPrice: number;
  accruedInterest: number;
  couponRate: number;
  paymentFrequency: string;
  maturityYears: number;
  currentYield: number;
  yieldToMaturity: number;
  macaulayDuration: number;
  modifiedDuration: number;
  change24hPct: number;
  high24h: number;
  low24h: number;
  tradingSession: string;
  marketDataSource: string;
  timestamp: string;
}

export interface CommodityInstrument {
  symbol: string;
  displayName: string;
  commodityGroup: 'PRECIOUS_METALS' | 'ENERGY' | 'INDUSTRIAL_METALS' | 'AGRICULTURE';
  unit: string;
  contractType: string;
  physicalBacking: string;
  currentPrice: number;
  bid: number;
  ask: number;
  spreadPrice: number;
  change24hPct: number;
  high24h: number;
  low24h: number;
  volume: number;
  tradingSession: string;
  marketDataSource: string;
  timestamp: string;
}

export interface CurrencyConversion {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  convertedAmount: number;
  exchangeRate: number;
  rateDate: string;
  marketDataSource: string;
  timestamp: string;
}

export interface AssetClassSlice {
  assetClass: AssetClass;
  label: string;
  marketValue: number;
  weightPct: number;
  positionsCount: number;
  colorCode: string;
}

export interface AssetAllocationBreakdown {
  totalPortfolioValue: number;
  cashBalance: number;
  cashWeightPct: number;
  valuesByAssetClass: Record<AssetClass, number>;
  weightsByAssetClass: Record<AssetClass, number>;
  slices: AssetClassSlice[];
  isDiversified: boolean;
  riskCommentary: string;
  concentrationAlerts: string[];
  calculatedAt: string;
}

export const multiAssetApi = {
  getInstruments: async (assetClass?: AssetClass): Promise<MarketInstrument[]> => {
    const params = assetClass ? { assetClass } : {};
    const res = await axios.get<MarketInstrument[]>('/api/multi-asset/instruments', { params });
    return res.data;
  },

  getInstrumentDetails: async (symbol: string): Promise<MarketInstrument> => {
    const res = await axios.get<MarketInstrument>(`/api/multi-asset/instruments/${encodeURIComponent(symbol)}`);
    return res.data;
  },

  getAllForexQuotes: async (): Promise<ForexQuote[]> => {
    const res = await axios.get<ForexQuote[]>('/api/multi-asset/forex');
    return res.data;
  },

  getForexQuote: async (pair: string): Promise<ForexQuote> => {
    const encoded = pair.replace('/', '-');
    const res = await axios.get<ForexQuote>(`/api/multi-asset/forex/${encodeURIComponent(encoded)}`);
    return res.data;
  },

  convertCurrency: async (amount: number, from: string, to: string): Promise<CurrencyConversion> => {
    const res = await axios.get<CurrencyConversion>('/api/multi-asset/forex/convert', {
      params: { amount, from, to },
    });
    return res.data;
  },

  getAllBonds: async (): Promise<BondInstrument[]> => {
    const res = await axios.get<BondInstrument[]>('/api/multi-asset/bonds');
    return res.data;
  },

  getBondDetails: async (symbol: string): Promise<BondInstrument> => {
    const res = await axios.get<BondInstrument>(`/api/multi-asset/bonds/${encodeURIComponent(symbol)}`);
    return res.data;
  },

  getAllCommodities: async (): Promise<CommodityInstrument[]> => {
    const res = await axios.get<CommodityInstrument[]>('/api/multi-asset/commodities');
    return res.data;
  },

  getCommodityDetails: async (symbol: string): Promise<CommodityInstrument> => {
    const res = await axios.get<CommodityInstrument>(`/api/multi-asset/commodities/${encodeURIComponent(symbol)}`);
    return res.data;
  },

  getPortfolioAllocation: async (sessionId: number = 0): Promise<AssetAllocationBreakdown> => {
    const res = await axios.get<AssetAllocationBreakdown>('/api/multi-asset/portfolio/allocation', {
      params: { sessionId },
    });
    return res.data;
  },
};
