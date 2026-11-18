export interface ParsedVoiceOrder {
  rawTranscript: string;
  side: 'BUY' | 'SELL';
  symbol: string;
  symbolDisplay: string;
  quantity: number;
  orderType: 'MARKET' | 'LIMIT';
  limitPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  confidence: number;
  isComplete: boolean;
  explanationFr: string;
  feedbackSpeechFr: string;
  feedbackSpeechEn?: string;
}

// Dictionnaire de correspondances phonétiques et synonymes d'actifs
const SYMBOL_DICTIONARY: Record<string, { ticker: string; display: string }> = {
  // Actions US
  apple: { ticker: 'AAPL', display: 'Apple Inc. (AAPL)' },
  aapl: { ticker: 'AAPL', display: 'Apple Inc. (AAPL)' },
  tesla: { ticker: 'TSLA', display: 'Tesla Inc. (TSLA)' },
  tsla: { ticker: 'TSLA', display: 'Tesla Inc. (TSLA)' },
  nvidia: { ticker: 'NVDA', display: 'NVIDIA Corp. (NVDA)' },
  nvda: { ticker: 'NVDA', display: 'NVIDIA Corp. (NVDA)' },
  microsoft: { ticker: 'MSFT', display: 'Microsoft (MSFT)' },
  msft: { ticker: 'MSFT', display: 'Microsoft (MSFT)' },
  google: { ticker: 'GOOGL', display: 'Alphabet / Google (GOOGL)' },
  googl: { ticker: 'GOOGL', display: 'Alphabet / Google (GOOGL)' },
  alphabet: { ticker: 'GOOGL', display: 'Alphabet / Google (GOOGL)' },
  amazon: { ticker: 'AMZN', display: 'Amazon.com (AMZN)' },
  amzn: { ticker: 'AMZN', display: 'Amazon.com (AMZN)' },
  meta: { ticker: 'META', display: 'Meta Platforms (META)' },
  facebook: { ticker: 'META', display: 'Meta Platforms (META)' },
  netflix: { ticker: 'NFLX', display: 'Netflix (NFLX)' },
  nflx: { ticker: 'NFLX', display: 'Netflix (NFLX)' },
  amd: { ticker: 'AMD', display: 'AMD (AMD)' },
  intel: { ticker: 'INTC', display: 'Intel Corp. (INTC)' },
  intc: { ticker: 'INTC', display: 'Intel Corp. (INTC)' },
  jpmorgan: { ticker: 'JPM', display: 'JPMorgan Chase (JPM)' },
  'jp morgan': { ticker: 'JPM', display: 'JPMorgan Chase (JPM)' },
  jpm: { ticker: 'JPM', display: 'JPMorgan Chase (JPM)' },
  disney: { ticker: 'DIS', display: 'Walt Disney (DIS)' },
  dis: { ticker: 'DIS', display: 'Walt Disney (DIS)' },

  // Crypto
  bitcoin: { ticker: 'BINANCE:BTCUSDT', display: 'Bitcoin (BTC/USDT)' },
  btc: { ticker: 'BINANCE:BTCUSDT', display: 'Bitcoin (BTC/USDT)' },
  ethereum: { ticker: 'BINANCE:ETHUSDT', display: 'Ethereum (ETH/USDT)' },
  eth: { ticker: 'BINANCE:ETHUSDT', display: 'Ethereum (ETH/USDT)' },
  solana: { ticker: 'BINANCE:SOLUSDT', display: 'Solana (SOL/USDT)' },
  sol: { ticker: 'BINANCE:SOLUSDT', display: 'Solana (SOL/USDT)' },
  ripple: { ticker: 'BINANCE:XRPUSDT', display: 'Ripple (XRP/USDT)' },
  xrp: { ticker: 'BINANCE:XRPUSDT', display: 'Ripple (XRP/USDT)' },
  binance: { ticker: 'BINANCE:BNBUSDT', display: 'BNB (BNB/USDT)' },
  bnb: { ticker: 'BINANCE:BNBUSDT', display: 'BNB (BNB/USDT)' },
  doge: { ticker: 'BINANCE:DOGEUSDT', display: 'Dogecoin (DOGE/USDT)' },
  dogecoin: { ticker: 'BINANCE:DOGEUSDT', display: 'Dogecoin (DOGE/USDT)' },

  // Matières Premières & Indices
  or: { ticker: 'GLD', display: 'Or Physique (GLD)' },
  gold: { ticker: 'GLD', display: 'Gold ETF (GLD)' },
  gld: { ticker: 'GLD', display: 'Gold ETF (GLD)' },
  petrole: { ticker: 'USO', display: 'Pétrole WTI (USO)' },
  pétrole: { ticker: 'USO', display: 'Pétrole WTI (USO)' },
  oil: { ticker: 'USO', display: 'Crude Oil (USO)' },
  uso: { ticker: 'USO', display: 'United States Oil (USO)' },
  sp500: { ticker: 'SPY', display: 'S&P 500 Index (SPY)' },
  's&p': { ticker: 'SPY', display: 'S&P 500 Index (SPY)' },
};

// Mots de chiffres en français & anglais
const WORD_TO_NUMBER: Record<string, number> = {
  un: 1,
  une: 1,
  one: 1,
  deux: 2,
  two: 2,
  trois: 3,
  three: 3,
  quatre: 4,
  four: 4,
  cinq: 5,
  five: 5,
  six: 6,
  six_en: 6,
  sept: 7,
  seven: 7,
  huit: 8,
  eight: 8,
  neuf: 9,
  nine: 9,
  dix: 10,
  ten: 10,
  quinze: 15,
  fifteen: 15,
  vingt: 20,
  twenty: 20,
  trente: 30,
  thirty: 30,
  quarante: 40,
  forty: 40,
  cinquante: 50,
  fifty: 50,
  soixante: 60,
  sixty: 60,
  cent: 100,
  hundred: 100,
  mille: 1000,
  thousand: 1000,
};

/**
 * Analyse une phrase transcrite pour extraire les paramètres d'un ordre financier.
 */
export function parseVoiceTradingCommand(
  rawTranscript: string,
  currentSelectedSymbol: string = 'AAPL'
): ParsedVoiceOrder | null {
  if (!rawTranscript || rawTranscript.trim().length === 0) return null;

  const normalized = rawTranscript
    .toLowerCase()
    .replace(/[',.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. Détection du Sens (BUY / SELL)
  let side: 'BUY' | 'SELL' = 'BUY';
  let sideFound = false;

  const buyKeywords = ['achète', 'achete', 'acheter', 'achat', 'buy', 'prends', 'payer', 'long'];
  const sellKeywords = ['vends', 'vendre', 'vente', 'sell', 'liquide', 'short', 'dégager'];

  for (const kw of sellKeywords) {
    if (normalized.includes(kw)) {
      side = 'SELL';
      sideFound = true;
      break;
    }
  }

  if (!sideFound) {
    for (const kw of buyKeywords) {
      if (normalized.includes(kw)) {
        side = 'BUY';
        sideFound = true;
        break;
      }
    }
  }

  // 2. Détection du Symbole / Actif
  let matchedSymbol = currentSelectedSymbol;
  let matchedDisplay = currentSelectedSymbol;
  let symbolFound = false;

  for (const [key, val] of Object.entries(SYMBOL_DICTIONARY)) {
    // Regex avec mot frontière pour éviter les faux positifs (ex: "or" dans "ordre")
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(normalized)) {
      matchedSymbol = val.ticker;
      matchedDisplay = val.display;
      symbolFound = true;
      break;
    }
  }

  // 3. Détection de la Quantité
  let quantity = 1;
  let quantityFound = false;

  // Recherche d'un nombre numérique (ex: "50", "25.5", "100")
  const numericMatch = normalized.match(/\b(\d+(?:\.\d+)?)\b/);
  if (numericMatch) {
    const parsedNum = parseFloat(numericMatch[1]);
    if (parsedNum > 0 && parsedNum < 100000) {
      quantity = parsedNum;
      quantityFound = true;
    }
  }

  // Si pas de nombre numérique, recherche dans les mots littéraux
  if (!quantityFound) {
    for (const [word, numVal] of Object.entries(WORD_TO_NUMBER)) {
      const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
      if (wordRegex.test(normalized)) {
        quantity = numVal;
        quantityFound = true;
        break;
      }
    }
  }

  // 4. Détection du Type d'ordre (MARKET ou LIMIT) & Prix
  let orderType: 'MARKET' | 'LIMIT' = 'MARKET';
  let limitPrice: number | null = null;

  if (
    normalized.includes('limite') ||
    normalized.includes('limit') ||
    normalized.includes('à la limite')
  ) {
    orderType = 'LIMIT';
  }

  // Détection du prix limite
  const limitMatch = normalized.match(/(?:limite|limit|cours|prix|à|a)\s*(?:de)?\s*(\d+(?:\.\d+)?)/);
  if (limitMatch && orderType === 'LIMIT') {
    const p = parseFloat(limitMatch[1]);
    if (p > 0) limitPrice = p;
  }

  // 5. Détection de Stop-Loss & Take-Profit
  let stopLoss: number | null = null;
  let takeProfit: number | null = null;

  const slMatch = normalized.match(/(?:stop|stop loss|sl)\s*(?:à|a|de)?\s*(\d+(?:\.\d+)?)/);
  if (slMatch) {
    const sl = parseFloat(slMatch[1]);
    if (sl > 0) stopLoss = sl;
  }

  const tpMatch = normalized.match(/(?:tp|take profit|objectif|cible)\s*(?:à|a|de)?\s*(\d+(?:\.\d+)?)/);
  if (tpMatch) {
    const tp = parseFloat(tpMatch[1]);
    if (tp > 0) takeProfit = tp;
  }

  // Score de confiance
  let confidence = 0.5;
  if (sideFound) confidence += 0.25;
  if (symbolFound) confidence += 0.25;

  const isComplete = sideFound && (symbolFound || quantityFound);

  // Construction de la phrase de retour vocal
  const sideLabel = side === 'BUY' ? 'Achat' : 'Vente';
  const qtyLabel = `${quantity} ${quantity > 1 ? 'parts' : 'part'}`;
  const orderTypeLabel = orderType === 'LIMIT' && limitPrice ? `à la limite de $${limitPrice}` : 'au marché';

  const explanationFr = `${sideLabel} de ${qtyLabel} sur ${matchedDisplay} ${orderTypeLabel}${
    stopLoss ? ` avec Stop-Loss à $${stopLoss}` : ''
  }${takeProfit ? ` et Take-Profit à $${takeProfit}` : ''}.`;

  const feedbackSpeechFr = `Ordre reconnu : ${sideLabel} de ${quantity} ${matchedDisplay.split(' ')[0]} ${orderTypeLabel}.`;
  const feedbackEn = `Order recognized: ${side} ${quantity} ${matchedSymbol} ${orderType}.`;

  return {
    rawTranscript,
    side,
    symbol: matchedSymbol,
    symbolDisplay: matchedDisplay,
    quantity,
    orderType,
    limitPrice,
    stopLoss,
    takeProfit,
    confidence,
    isComplete,
    explanationFr,
    feedbackSpeechFr,
    feedbackSpeechEn: feedbackEn,
  };
}
