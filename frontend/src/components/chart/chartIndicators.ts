import { CandleItem } from '../../api/market';

export type DrawTool = 'cursor' | 'hline' | 'trendline' | 'measure';

export interface PriceLevel {
  id: string;
  price: number;
}

export interface ChartAnchor {
  time: number;
  price: number;
}

export interface TrendLine {
  id: string;
  p1: ChartAnchor;
  p2: ChartAnchor;
}

export interface MeasureRange {
  p1: ChartAnchor;
  p2: ChartAnchor;
}

export interface BollingerBandPoint {
  upper: number | null;
  middle: number | null;
  lower: number | null;
}

/**
 * Simple Moving Average over candle closes.
 */
export function computeSMA(candles: CandleItem[], period = 20): (number | null)[] {
  return candles.map((_, idx) => {
    if (idx < period - 1) return null;
    let sum = 0;
    for (let j = idx - period + 1; j <= idx; j++) {
      sum += candles[j].close;
    }
    return sum / period;
  });
}

/**
 * Exponential Moving Average over candle closes.
 */
export function computeEMA(candles: CandleItem[], period = 12): (number | null)[] {
  if (candles.length === 0) return [];
  const k = 2 / (period + 1);
  const result: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period) return result;

  let seed = 0;
  for (let i = 0; i < period; i++) {
    seed += candles[i].close;
  }
  let ema = seed / period;
  result[period - 1] = ema;

  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

/**
 * Bollinger Bands (middle SMA + +/- mult * stddev) over candle closes.
 */
export function computeBollingerBands(
  candles: CandleItem[],
  period = 20,
  mult = 2
): BollingerBandPoint[] {
  return candles.map((_, idx) => {
    if (idx < period - 1) {
      return { upper: null, middle: null, lower: null };
    }
    let sum = 0;
    for (let j = idx - period + 1; j <= idx; j++) {
      sum += candles[j].close;
    }
    const mean = sum / period;

    let sqDiff = 0;
    for (let j = idx - period + 1; j <= idx; j++) {
      const diff = candles[j].close - mean;
      sqDiff += diff * diff;
    }
    const std = Math.sqrt(sqDiff / period);
    return {
      upper: mean + mult * std,
      middle: mean,
      lower: mean - mult * std,
    };
  });
}

/**
 * Wilder-style RSI(14) latest value computed from candle closes.
 */
export function computeLatestRSI(candles: CandleItem[], period = 14): number | null {
  if (candles.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const delta = candles[i].close - candles[i - 1].close;
    if (delta >= 0) gains += delta;
    else losses -= delta;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < candles.length; i++) {
    const delta = candles[i].close - candles[i - 1].close;
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Resolve a chart epoch-ms anchor to an X pixel coordinate within the visible window.
 * Interpolates smoothly against candle spacing if the timestamp falls outside visible bounds.
 */
export function resolveTimeToX(
  timeMs: number,
  candles: CandleItem[],
  startIdx: number,
  step: number,
  intervalSec: number
): number | null {
  if (candles.length === 0) return null;

  let exactIdx = -1;
  let nearestDist = Infinity;
  for (let i = 0; i < candles.length; i++) {
    const t = Date.parse(candles[i].ts);
    if (t === timeMs) {
      exactIdx = i;
      break;
    }
    const dist = Math.abs(t - timeMs);
    if (dist < nearestDist && dist <= intervalSec * 500) {
      nearestDist = dist;
      exactIdx = i;
    }
  }

  if (exactIdx !== -1) {
    const localIdx = exactIdx - startIdx;
    return localIdx * step + step / 2;
  }

  const firstMs = Date.parse(candles[0].ts);
  const barOffset = (timeMs - firstMs) / Math.max(1, intervalSec * 1000);
  const localIdx = barOffset - startIdx;
  return localIdx * step + step / 2;
}
