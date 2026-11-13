import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getCandles, CandleItem } from '../api/market';
import { PositionItem } from '../api/trading';
import { LiveQuote, PricePoint } from '../hooks/useMarketWebSocket';
import { ChartSkeleton, LivePulseDot, AssetLogo } from './ui';
import {
  computeSMA,
  computeEMA,
  computeBollingerBands,
  computeLatestRSI,
  resolveTimeToX,
  DrawTool,
  PriceLevel,
  TrendLine,
  MeasureRange,
  ChartAnchor,
} from './chart/chartIndicators';
import { FullscreenOrderDock } from './chart/FullscreenOrderDock';
import {
  TrendingUp,
  TrendingDown,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  BarChart2,
  LineChart,
  Zap,
  Volume2,
  Clock,
  Maximize2,
  Minimize2,
  MousePointer2,
  Minus,
  PenLine,
  Ruler,
  Trash2,
  PanelRight,
  X,
} from 'lucide-react';

interface TradingViewChartProps {
  symbol: string;
  currentQuote?: LiveQuote;
  points?: PricePoint[];
  onBuy?: () => void;
  onSell?: () => void;
  watchlist?: string[];
  onSelectSymbol?: (symbol: string) => void;
  portfolioCash?: number | null;
  positions?: PositionItem[];
  onOrderExecuted?: () => void;
}

type TimeframeOption = {
  id: string;
  label: string;
  intervalSec: number;
};

const TIMEFRAMES: TimeframeOption[] = [
  { id: '1', label: '1m', intervalSec: 60 },
  { id: '3', label: '3m', intervalSec: 180 },
  { id: '5', label: '5m', intervalSec: 300 },
  { id: '15', label: '15m', intervalSec: 900 },
  { id: '30', label: '30m', intervalSec: 1800 },
  { id: '60', label: '1h', intervalSec: 3600 },
  { id: 'D', label: '1D', intervalSec: 86400 },
];

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  symbol,
  currentQuote,
  points = [],
  onBuy,
  onSell,
  watchlist = [],
  onSelectSymbol,
  portfolioCash,
  positions = [],
  onOrderExecuted,
}) => {
  const [resolution, setResolution] = useState<string>('15');
  const [chartMode, setChartMode] = useState<'candles' | 'line'>('candles');
  const [showSma, setShowSma] = useState<boolean>(true);
  const [showEma, setShowEma] = useState<boolean>(false);
  const [showBb, setShowBb] = useState<boolean>(false);
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [candles, setCandles] = useState<CandleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [tickAnim, setTickAnim] = useState<boolean>(false);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showOrderDock, setShowOrderDock] = useState<boolean>(true);
  const [drawTool, setDrawTool] = useState<DrawTool>('cursor');
  const [priceLevelsBySymbol, setPriceLevelsBySymbol] = useState<Record<string, PriceLevel[]>>({});
  const [trendLinesBySymbol, setTrendLinesBySymbol] = useState<Record<string, TrendLine[]>>({});
  const [pendingTrendStart, setPendingTrendStart] = useState<ChartAnchor | null>(null);
  const [measureStart, setMeasureStart] = useState<ChartAnchor | null>(null);
  const [measureRangeBySymbol, setMeasureRangeBySymbol] = useState<Record<string, MeasureRange | null>>({});

  const [visibleCount, setVisibleCount] = useState<number>(48);
  const [panOffset, setPanOffset] = useState<number>(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverY, setHoverY] = useState<number | null>(null);
  const [hoverAnchor, setHoverAnchor] = useState<ChartAnchor | null>(null);
  const [canvasWidth, setCanvasWidth] = useState<number>(820);
  const [canvasHeight, setCanvasHeight] = useState<number>(336);

  const plotContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartPanRef = useRef<number>(0);

  // Measure actual pixel dimensions for crisp, unstretched SVG coordinates
  useEffect(() => {
    const el = plotContainerRef.current;
    if (!el) return;
    const updateSize = () => {
      if (el.clientWidth > 0) setCanvasWidth(el.clientWidth);
      if (el.clientHeight > 0) setCanvasHeight(el.clientHeight);
    };
    updateSize();
    const raf = requestAnimationFrame(updateSize);
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [isFullscreen, showOrderDock, loading]);

  // Escape key exits fullscreen & body scroll lock
  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingTrendStart || measureStart) {
          setPendingTrendStart(null);
          setMeasureStart(null);
        } else {
          setIsFullscreen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFullscreen, pendingTrendStart, measureStart]);

  // Reset transient drawing anchors on symbol/timeframe change
  useEffect(() => {
    setPendingTrendStart(null);
    setMeasureStart(null);
  }, [symbol, resolution]);

  const currentPosition = useMemo(
    () => positions.find((p) => p.symbol.toUpperCase() === symbol.toUpperCase()),
    [positions, symbol]
  );

  const loadCandles = useCallback(
    async (res: string) => {
      setLoading(true);
      try {
        const data = await getCandles(symbol, res, undefined, undefined, true);
        const tfSec = TIMEFRAMES.find((t) => t.id === res)?.intervalSec || 900;
        const bucketDurationMs = tfSec * 1000;
        const nowMs = Date.now();
        const currentLivePrice =
          currentQuote?.price || (points.length > 0 ? points[points.length - 1].price : 150.0);

        let candlesList: CandleItem[] = [];

        if (data && data.length > 0) {
          candlesList = [...data];
          const lastCandle = candlesList[candlesList.length - 1];
          const lastCandleTime = new Date(lastCandle.ts).getTime();

          if (nowMs - lastCandleTime > bucketDurationMs * 2) {
            const gapMs = nowMs - lastCandleTime;
            const missingBuckets = Math.min(80, Math.max(1, Math.floor(gapMs / bucketDurationMs)));
            const startP = lastCandle.close;
            const endP = currentLivePrice;
            const step = (endP - startP) / missingBuckets;

            let currTime = lastCandleTime;
            let p = startP;

            for (let i = 1; i <= missingBuckets; i++) {
              currTime += bucketDurationMs;
              const open = p;
              p = i === missingBuckets ? endP : p + step + (Math.random() - 0.49) * (p * 0.001);
              const close = i === missingBuckets ? endP : p;
              const high = Math.max(open, close) + Math.random() * (p * 0.0015);
              const low = Math.min(open, close) - Math.random() * (p * 0.0015);

              candlesList.push({
                symbol,
                resolution: res,
                ts: new Date(currTime).toISOString(),
                open,
                high,
                low,
                close,
                volume: Math.floor(1000 + Math.random() * 25000),
              });
            }
          }
        } else {
          let p = currentLivePrice;
          for (let i = 45; i >= 0; i--) {
            const t = new Date(nowMs - i * bucketDurationMs).toISOString();
            const change = (Math.random() - 0.49) * (p * 0.005);
            const open = p;
            const close = p + change;
            const high = Math.max(open, close) + Math.random() * (p * 0.003);
            const low = Math.min(open, close) - Math.random() * (p * 0.003);
            const vol = Math.floor(2000 + Math.random() * 40000);
            candlesList.push({
              symbol,
              resolution: res,
              ts: t,
              open,
              high,
              low,
              close,
              volume: vol,
            });
            p = close;
          }
        }

        setCandles(candlesList);
      } catch (e) {
        console.warn('[TradingViewChart] Erreur fetch bougies:', e);
      } finally {
        setLoading(false);
        setPanOffset(0);
      }
    },
    [symbol, currentQuote?.price, points]
  );

  useEffect(() => {
    loadCandles(resolution);
  }, [symbol, resolution]);

  const latestPrice = currentQuote?.price || (points.length > 0 ? points[points.length - 1].price : 0);
  const latestTs = currentQuote?.ts;

  useEffect(() => {
    if (!latestPrice || latestPrice <= 0) return;

    setTickAnim(true);
    const timer = setTimeout(() => setTickAnim(false), 260);

    const nowMs = Date.now();
    const tfSec = TIMEFRAMES.find((t) => t.id === resolution)?.intervalSec || 900;
    const bucketDurationMs = tfSec * 1000;
    const currentBucketTs = Math.floor(nowMs / bucketDurationMs) * bucketDurationMs;

    setCandles((prev) => {
      if (!prev || prev.length === 0) {
        return [
          {
            symbol,
            resolution,
            ts: new Date(currentBucketTs).toISOString(),
            open: latestPrice,
            high: latestPrice,
            low: latestPrice,
            close: latestPrice,
            volume: 1,
          },
        ];
      }

      const last = prev[prev.length - 1];
      const lastCandleBucket = Math.floor(new Date(last.ts).getTime() / bucketDurationMs) * bucketDurationMs;

      if (currentBucketTs <= lastCandleBucket) {
        const updated: CandleItem = {
          ...last,
          high: Math.max(last.high, latestPrice),
          low: Math.min(last.low, latestPrice),
          close: latestPrice,
          volume: (last.volume || 0) + 1,
        };
        return [...prev.slice(0, -1), updated];
      } else {
        const newCandle: CandleItem = {
          symbol,
          resolution,
          ts: new Date(currentBucketTs).toISOString(),
          open: last.close,
          high: Math.max(last.close, latestPrice),
          low: Math.min(last.close, latestPrice),
          close: latestPrice,
          volume: 1,
        };
        return [...prev.slice(-150), newCandle];
      }
    });

    return () => clearTimeout(timer);
  }, [latestPrice, latestTs, resolution, symbol]);

  const switchTimeframe = (dir: 'in' | 'out') => {
    const currentIndex = TIMEFRAMES.findIndex((t) => t.id === resolution);
    if (dir === 'in' && currentIndex > 0) {
      setResolution(TIMEFRAMES[currentIndex - 1].id);
      setVisibleCount(40);
    } else if (dir === 'out' && currentIndex < TIMEFRAMES.length - 1) {
      setResolution(TIMEFRAMES[currentIndex + 1].id);
      setVisibleCount(48);
    }
  };

  const handleZoom = (delta: number) => {
    setVisibleCount((prev) => {
      const next = prev + delta;
      if (next < 18) {
        switchTimeframe('in');
        return 35;
      }
      if (next > 90) {
        switchTimeframe('out');
        return 48;
      }
      return Math.max(18, Math.min(100, next));
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    handleZoom(e.deltaY < 0 ? -4 : 4);
  };

  const priceAxisWidth = 74;
  const timeAxisHeight = 26;
  const chartHeight = isFullscreen ? Math.max(340, canvasHeight - timeAxisHeight) : 310;
  const plotW = Math.max(200, canvasWidth - priceAxisWidth);
  const currentIntervalSec = TIMEFRAMES.find((t) => t.id === resolution)?.intervalSec || 900;

  const { visibleCandles, startIndex } = useMemo(() => {
    if (!candles || candles.length === 0) return { visibleCandles: [], startIndex: 0 };
    const count = Math.min(candles.length, visibleCount);
    const end = candles.length - panOffset;
    const start = Math.max(0, end - count);
    return {
      visibleCandles: candles.slice(start, end),
      startIndex: start,
    };
  }, [candles, visibleCount, panOffset]);

  const { minPrice, priceRange, maxVol } = useMemo(() => {
    if (visibleCandles.length === 0) return { minPrice: 0, priceRange: 1, maxVol: 1 };
    let min = Infinity;
    let max = -Infinity;
    let mv = 0;
    for (const c of visibleCandles) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
      if (c.volume > mv) mv = c.volume;
    }
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const pRange = max - min;
    const paddedMin = min - pRange * 0.06;
    const paddedMax = max + pRange * 0.06;
    return {
      minPrice: paddedMin,
      priceRange: paddedMax - paddedMin || 1,
      maxVol: mv || 1,
    };
  }, [visibleCandles]);

  const priceToY = (price: number) =>
    10 + (chartHeight - 20) - ((price - minPrice) / priceRange) * (chartHeight - 20);

  const yToPrice = (y: number) =>
    minPrice + ((10 + (chartHeight - 20) - y) / Math.max(1, chartHeight - 20)) * priceRange;

  const getChartAnchorFromEvent = (e: React.MouseEvent): { anchor: ChartAnchor; y: number } | null => {
    if (!svgRef.current || visibleCandles.length === 0) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    if (mouseX < 0 || mouseX > plotW || mouseY < 0 || mouseY > chartHeight) return null;
    const slotWidth = plotW / visibleCandles.length;
    const idx = Math.min(visibleCandles.length - 1, Math.max(0, Math.floor(mouseX / slotWidth)));
    const candle = visibleCandles[idx];
    return {
      anchor: {
        time: Date.parse(candle.ts),
        price: yToPrice(mouseY),
      },
      y: mouseY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (drawTool === 'cursor') {
      isDraggingRef.current = true;
      dragStartXRef.current = e.clientX;
      dragStartPanRef.current = panOffset;
      return;
    }

    const hit = getChartAnchorFromEvent(e);
    if (!hit) return;

    if (drawTool === 'hline') {
      const id = `lvl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setPriceLevelsBySymbol((prev) => ({
        ...prev,
        [symbol]: [...(prev[symbol] || []), { id, price: hit.anchor.price }],
      }));
      setDrawTool('cursor');
    } else if (drawTool === 'trendline') {
      if (!pendingTrendStart) {
        setPendingTrendStart(hit.anchor);
      } else {
        const id = `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        setTrendLinesBySymbol((prev) => ({
          ...prev,
          [symbol]: [...(prev[symbol] || []), { id, p1: pendingTrendStart, p2: hit.anchor }],
        }));
        setPendingTrendStart(null);
        setDrawTool('cursor');
      }
    } else if (drawTool === 'measure') {
      if (!measureStart) {
        setMeasureStart(hit.anchor);
        setMeasureRangeBySymbol((prev) => ({ ...prev, [symbol]: null }));
      } else {
        setMeasureRangeBySymbol((prev) => ({
          ...prev,
          [symbol]: { p1: measureStart, p2: hit.anchor },
        }));
        setMeasureStart(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (drawTool === 'cursor' && isDraggingRef.current) {
      const diffX = e.clientX - dragStartXRef.current;
      const newPan = Math.max(
        0,
        Math.min(candles.length - visibleCount, Math.round(dragStartPanRef.current + diffX * 0.25))
      );
      setPanOffset(newPan);
    }

    if (svgRef.current && visibleCandles.length > 0) {
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      if (mouseX >= 0 && mouseX <= plotW) {
        const slotWidth = plotW / visibleCandles.length;
        const index = Math.min(visibleCandles.length - 1, Math.max(0, Math.floor(mouseX / slotWidth)));
        setHoverIndex(index);
        if (mouseY >= 0 && mouseY <= chartHeight) {
          setHoverY(mouseY);
          setHoverAnchor({
            time: Date.parse(visibleCandles[index].ts),
            price: yToPrice(mouseY),
          });
        } else {
          setHoverY(null);
          setHoverAnchor(null);
        }
      } else {
        setHoverIndex(null);
        setHoverY(null);
        setHoverAnchor(null);
      }
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    setHoverIndex(null);
    setHoverY(null);
    setHoverAnchor(null);
  };

  const smaValues = useMemo(() => {
    if (!showSma || candles.length === 0) return [];
    return computeSMA(candles, 20).slice(startIndex, startIndex + visibleCandles.length);
  }, [candles, showSma, startIndex, visibleCandles.length]);

  const emaValues = useMemo(() => {
    if (!showEma || candles.length === 0) return [];
    return computeEMA(candles, 12).slice(startIndex, startIndex + visibleCandles.length);
  }, [candles, showEma, startIndex, visibleCandles.length]);

  const bbValues = useMemo(() => {
    if (!showBb || candles.length === 0) return [];
    return computeBollingerBands(candles, 20, 2).slice(startIndex, startIndex + visibleCandles.length);
  }, [candles, showBb, startIndex, visibleCandles.length]);

  const rsi14 = useMemo(() => computeLatestRSI(candles, 14), [candles]);

  const symbolLevels = priceLevelsBySymbol[symbol] || [];
  const symbolTrendLines = trendLinesBySymbol[symbol] || [];
  const symbolMeasure = measureRangeBySymbol[symbol] || null;
  const activeMeasure: MeasureRange | null =
    measureStart && hoverAnchor ? { p1: measureStart, p2: hoverAnchor } : symbolMeasure;

  const removePriceLevel = (id: string) => {
    setPriceLevelsBySymbol((prev) => ({
      ...prev,
      [symbol]: (prev[symbol] || []).filter((lvl) => lvl.id !== id),
    }));
  };

  const removeTrendLine = (id: string) => {
    setTrendLinesBySymbol((prev) => ({
      ...prev,
      [symbol]: (prev[symbol] || []).filter((tl) => tl.id !== id),
    }));
  };

  const clearAllDrawings = () => {
    setPriceLevelsBySymbol((prev) => ({ ...prev, [symbol]: [] }));
    setTrendLinesBySymbol((prev) => ({ ...prev, [symbol]: [] }));
    setMeasureRangeBySymbol((prev) => ({ ...prev, [symbol]: null }));
    setPendingTrendStart(null);
    setMeasureStart(null);
    setDrawTool('cursor');
  };

  const drawingsCount =
    symbolLevels.length + symbolTrendLines.length + (symbolMeasure ? 1 : 0);

  const activeCandle =
    hoverIndex !== null && visibleCandles[hoverIndex]
      ? visibleCandles[hoverIndex]
      : visibleCandles[visibleCandles.length - 1];

  const currentDisplayPrice = latestPrice > 0 ? latestPrice : activeCandle?.close || 0;
  const isUpSession = activeCandle ? activeCandle.close >= activeCandle.open : true;
  const priceChange = activeCandle ? activeCandle.close - activeCandle.open : 0;
  const priceChangePct =
    activeCandle && activeCandle.open > 0 ? (priceChange / activeCandle.open) * 100 : 0;

  const gridTicks = isFullscreen ? 7 : 5;
  const gridPrices = useMemo(() => {
    const list: number[] = [];
    const step = priceRange / gridTicks;
    for (let i = 0; i <= gridTicks; i++) {
      list.push(minPrice + i * step);
    }
    return list;
  }, [minPrice, priceRange, gridTicks]);

  const fmtAxisPrice = (p: number) =>
    p >= 1000
      ? p.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : p.toFixed(p < 1 ? 4 : 2);

  const symbolPosition = useMemo(
    () => positions.find((p) => p.symbol === symbol),
    [positions, symbol]
  );

  if (loading && candles.length === 0) {
    return <ChartSkeleton height={isFullscreen ? 640 : 440} />;
  }

  const activeToolHint =
    drawTool === 'hline'
      ? 'Cliquez sur le graphique pour tracer un support / résistance'
      : drawTool === 'trendline'
        ? pendingTrendStart
          ? 'Cliquez le point B pour finaliser la ligne de tendance (Esc pour annuler)'
          : 'Cliquez le point A pour démarrer la ligne de tendance'
        : drawTool === 'measure'
          ? measureStart
            ? 'Cliquez le point final pour verrouiller la mesure'
            : 'Cliquez le point de départ pour mesurer Δ$ / Δ%'
          : null;

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-40 bg-[#070B14] select-none flex flex-col overflow-hidden'
          : 'workstation-panel rounded-xl p-4 select-none flex flex-col'
      }
    >
      {/* Header Toolbar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-b border-subtle ${
          isFullscreen ? 'px-4 py-2.5 bg-[#0B1120]' : 'pb-3'
        }`}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <LivePulseDot color={currentQuote ? (isUpSession ? 'emerald' : 'rose') : 'cyan'} active={Boolean(currentQuote)} size="sm" />
            <AssetLogo symbol={symbol} size="md" />
            <h2 className="text-base font-bold text-white font-mono tracking-tight">{symbol}</h2>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/25">
              {TIMEFRAMES.find((t) => t.id === resolution)?.label}
            </span>
            {isFullscreen && rsi14 != null && (
              <span
                className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${
                  rsi14 >= 70
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : rsi14 <= 30
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                }`}
              >
                RSI {rsi14.toFixed(1)}
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2 font-mono tabular-nums">
            <span
              className={`text-lg sm:text-xl font-bold transition-colors duration-200 ${
                tickAnim ? (isUpSession ? 'text-emerald-300' : 'text-rose-300') : 'text-white'
              }`}
            >
              $
              {currentDisplayPrice >= 1000
                ? currentDisplayPrice.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : currentDisplayPrice.toFixed(currentDisplayPrice < 0.1 ? 4 : 2)}
            </span>
            <span
              className={`text-[11px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                isUpSession
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {isUpSession ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {priceChange >= 0 ? '+' : ''}
              {priceChange.toFixed(2)} ({priceChangePct >= 0 ? '+' : ''}
              {priceChangePct.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Timeframes & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 bg-[#070B14] p-1 rounded-lg border border-subtle">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                onClick={() => {
                  setResolution(tf.id);
                  setPanOffset(0);
                }}
                className={`px-2 py-1 text-[11px] font-semibold font-mono rounded-md transition ${
                  resolution === tf.id
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-[#142035] border border-transparent'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex bg-[#070B14] p-0.5 rounded-lg border border-subtle">
              <button
                onClick={() => setChartMode('candles')}
                className={`p-1.5 rounded-md transition ${
                  chartMode === 'candles'
                    ? 'bg-[#192841] text-sky-300'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Chandeliers Japonais"
              >
                <BarChart2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setChartMode('line')}
                className={`p-1.5 rounded-md transition ${
                  chartMode === 'line'
                    ? 'bg-[#192841] text-sky-300'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Courbe Aire"
              >
                <LineChart className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => setShowSma((s) => !s)}
              className={`px-2 py-1 text-[11px] font-mono font-semibold rounded-lg border transition ${
                showSma
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-[#070B14] border-subtle text-slate-500 hover:text-slate-300'
              }`}
              title="Moyenne Mobile SMA 20"
            >
              SMA20
            </button>

            {isFullscreen && (
              <>
                <button
                  onClick={() => setShowEma((s) => !s)}
                  className={`px-2 py-1 text-[11px] font-mono font-semibold rounded-lg border transition ${
                    showEma
                      ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                      : 'bg-[#070B14] border-subtle text-slate-500 hover:text-slate-300'
                  }`}
                  title="Moyenne Mobile Exponentielle EMA 12"
                >
                  EMA12
                </button>
                <button
                  onClick={() => setShowBb((s) => !s)}
                  className={`px-2 py-1 text-[11px] font-mono font-semibold rounded-lg border transition ${
                    showBb
                      ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                      : 'bg-[#070B14] border-subtle text-slate-500 hover:text-slate-300'
                  }`}
                  title="Bandes de Bollinger (20, 2)"
                >
                  BB20
                </button>
              </>
            )}

            <button
              onClick={() => setShowVolume((v) => !v)}
              className={`p-1.5 rounded-lg border transition ${
                showVolume
                  ? 'bg-[#192841] text-slate-200 border-strong'
                  : 'bg-[#070B14] text-slate-500 border-subtle'
              }`}
              title="Volumes"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center bg-[#070B14] rounded-lg border border-subtle p-0.5">
              <button
                onClick={() => handleZoom(-5)}
                className="p-1 text-slate-400 hover:text-white transition"
                title="Zoom +"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleZoom(5)}
                className="p-1 text-slate-400 hover:text-white transition"
                title="Zoom -"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setPanOffset(0);
                  setVisibleCount(48);
                }}
                className="p-1 text-slate-400 hover:text-white transition"
                title="Réinitialiser"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {isFullscreen && (
              <button
                onClick={() => setShowOrderDock((v) => !v)}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition ${
                  showOrderDock
                    ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                    : 'bg-[#070B14] text-slate-400 border-subtle hover:text-white'
                }`}
                title="Afficher / Masquer le ticket d'ordre"
              >
                <PanelRight className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Trading Dock</span>
              </button>
            )}

            <button
              onClick={() => setIsFullscreen((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition ${
                isFullscreen
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
                  : 'bg-sky-500/15 text-sky-300 border-sky-500/30 hover:bg-sky-500/25'
              }`}
              title={isFullscreen ? 'Quitter le plein écran (Esc)' : 'Ouvrir le graphique en plein écran'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Quitter (Esc)</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Plein écran</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area (Fullscreen adds Left Drawing Bar + Right Order Dock) */}
      <div className={isFullscreen ? 'flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden' : 'flex flex-col'}>
        {isFullscreen && (
          <aside className="w-full lg:w-12 shrink-0 bg-[#0B1120] border-b lg:border-b-0 lg:border-r border-subtle flex lg:flex-col items-center justify-between lg:justify-start gap-1.5 p-2">
            <div className="flex lg:flex-col items-center gap-1.5">
              <button
                onClick={() => {
                  setDrawTool('cursor');
                  setPendingTrendStart(null);
                  setMeasureStart(null);
                }}
                className={`p-2 rounded-lg border transition ${
                  drawTool === 'cursor'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : 'bg-[#070B14] text-slate-400 border-subtle hover:text-white'
                }`}
                title="Curseur / Pan"
              >
                <MousePointer2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setDrawTool('hline');
                  setPendingTrendStart(null);
                  setMeasureStart(null);
                }}
                className={`p-2 rounded-lg border transition ${
                  drawTool === 'hline'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-[#070B14] text-slate-400 border-subtle hover:text-white'
                }`}
                title="Ligne horizontale (Support / Résistance)"
              >
                <Minus className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setDrawTool('trendline');
                  setPendingTrendStart(null);
                  setMeasureStart(null);
                }}
                className={`p-2 rounded-lg border transition ${
                  drawTool === 'trendline'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-[#070B14] text-slate-400 border-subtle hover:text-white'
                }`}
                title="Ligne de tendance (2 points)"
              >
                <PenLine className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setDrawTool('measure');
                  setPendingTrendStart(null);
                  setMeasureStart(null);
                }}
                className={`p-2 rounded-lg border transition ${
                  drawTool === 'measure'
                    ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                    : 'bg-[#070B14] text-slate-400 border-subtle hover:text-white'
                }`}
                title="Mesure de prix & pourcentage"
              >
                <Ruler className="w-4 h-4" />
              </button>
            </div>

            <div className="lg:mt-auto flex lg:flex-col items-center gap-1.5">
              {drawingsCount > 0 && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  {drawingsCount}
                </span>
              )}
              <button
                onClick={clearAllDrawings}
                disabled={drawingsCount === 0 && !pendingTrendStart && !measureStart}
                className="p-2 rounded-lg border border-subtle bg-[#070B14] text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition disabled:opacity-35"
                title="Effacer tous les tracés de cet actif"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </aside>
        )}

        <div className={isFullscreen ? 'flex-1 min-w-0 min-h-0 flex flex-col p-3' : 'flex flex-col'}>
          {/* OHLC Telemetry Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums py-2 text-slate-400 border-b border-subtle">
            <div className="flex flex-wrap items-center gap-3">
              {activeCandle ? (
                <>
                  <span className="text-slate-300 font-medium flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-sky-400" />
                    {new Date(activeCandle.ts).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                    })}{' '}
                    {new Date(activeCandle.ts).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span>
                    O{' '}
                    <strong className={isUpSession ? 'text-emerald-400' : 'text-rose-400'}>
                      ${activeCandle.open.toFixed(2)}
                    </strong>
                  </span>
                  <span>
                    H{' '}
                    <strong className={isUpSession ? 'text-emerald-400' : 'text-rose-400'}>
                      ${activeCandle.high.toFixed(2)}
                    </strong>
                  </span>
                  <span>
                    L{' '}
                    <strong className={isUpSession ? 'text-emerald-400' : 'text-rose-400'}>
                      ${activeCandle.low.toFixed(2)}
                    </strong>
                  </span>
                  <span>
                    C{' '}
                    <strong className={isUpSession ? 'text-emerald-400' : 'text-rose-400'}>
                      ${activeCandle.close.toFixed(2)}
                    </strong>
                  </span>
                  {showVolume && (
                    <span>
                      VOL <strong className="text-slate-200">{activeCandle.volume.toLocaleString()}</strong>
                    </span>
                  )}
                </>
              ) : (
                <span>En attente de données OHLC…</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
              {activeToolHint && (
                <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold">
                  {activeToolHint}
                </span>
              )}
              {isFullscreen &&
                symbolLevels.map((lvl) => (
                  <span
                    key={lvl.id}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30"
                  >
                    ${fmtAxisPrice(lvl.price)}
                    <button
                      type="button"
                      onClick={() => removePriceLevel(lvl.id)}
                      className="hover:text-white"
                      title="Supprimer ce niveau"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              {isFullscreen &&
                symbolTrendLines.map((tl, idx) => (
                  <span
                    key={tl.id}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30"
                  >
                    T{idx + 1}
                    <button
                      type="button"
                      onClick={() => removeTrendLine(tl.id)}
                      className="hover:text-white"
                      title="Supprimer cette ligne"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              {currentPosition && currentPosition.quantity > 0 && (
                <>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/30 text-[10px] font-mono">
                    PRU: ${fmtAxisPrice(currentPosition.avgPrice)}
                  </span>
                  {currentPosition.stopLoss != null && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-mono">
                      SL: ${fmtAxisPrice(currentPosition.stopLoss)}
                    </span>
                  )}
                  {currentPosition.takeProfit != null && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono">
                      TP: ${fmtAxisPrice(currentPosition.takeProfit)}
                    </span>
                  )}
                </>
              )}
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                STOMP FEED
              </span>
              <span>·</span>
              <span>{visibleCandles.length} bars</span>
            </div>
          </div>

          {/* SVG Chart Plot (1:1 pixel ratio via ResizeObserver) */}
          <div
            ref={plotContainerRef}
            className={`relative w-full bg-[#070B14]/70 rounded-lg border border-subtle mt-2.5 overflow-hidden ${
              isFullscreen ? 'flex-1 min-h-[340px]' : 'h-[336px]'
            } ${drawTool === 'cursor' ? 'cursor-crosshair' : 'cursor-cell'}`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
        <svg
          ref={svgRef}
          width={canvasWidth}
          height={chartHeight + timeAxisHeight}
          viewBox={`0 0 ${canvasWidth} ${chartHeight + timeAxisHeight}`}
          className="w-full h-full select-none block"
        >
          {/* Vertical right axis separator */}
          <line
            x1={plotW}
            y1={0}
            x2={plotW}
            y2={chartHeight}
            stroke="rgba(148,163,184,0.12)"
            strokeWidth="1"
          />

          {/* Horizontal Grid Lines & Price Labels */}
          {gridPrices.map((p, idx) => {
            const y = priceToY(p);
            return (
              <g key={idx}>
                <line
                  x1="0"
                  y1={y}
                  x2={plotW}
                  y2={y}
                  stroke="rgba(148,163,184,0.08)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={plotW + 8}
                  y={y + 3.5}
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  ${fmtAxisPrice(p)}
                </text>
              </g>
            );
          })}

          {/* Volume Histogram */}
          {showVolume &&
            visibleCandles.map((c, i) => {
              const slotW = plotW / Math.max(visibleCandles.length, 1);
              const xCenter = (i + 0.5) * slotW;
              const barW = Math.max(1.5, slotW * 0.68);
              const volHeight = (c.volume / maxVol) * 44;
              const isGreen = c.close >= c.open;

              return (
                <rect
                  key={`vol-${i}`}
                  x={xCenter - barW / 2}
                  y={chartHeight - volHeight}
                  width={barW}
                  height={volHeight}
                  fill={isGreen ? '#22C55E' : '#EF4444'}
                  opacity={hoverIndex === i ? 0.6 : 0.22}
                  className="transition-opacity duration-150"
                />
              );
            })}

          {/* Candlesticks or Line Mode */}
          {chartMode === 'candles'
            ? visibleCandles.map((c, i) => {
                const slotW = plotW / Math.max(visibleCandles.length, 1);
                const xCenter = (i + 0.5) * slotW;
                const candleWidth = Math.max(2, Math.min(14, slotW * 0.7));

                const yHigh = priceToY(c.high);
                const yLow = priceToY(c.low);
                const yOpen = priceToY(c.open);
                const yClose = priceToY(c.close);

                const topY = Math.min(yOpen, yClose);
                const bodyH = Math.max(1.5, Math.abs(yClose - yOpen));
                const isGreen = c.close >= c.open;
                const candleColor = isGreen ? '#22C55E' : '#EF4444';
                const isHovered = hoverIndex === i;

                return (
                  <g
                    key={`candle-${i}`}
                    style={
                      isHovered
                        ? { filter: `drop-shadow(0 0 8px ${candleColor}88)` }
                        : undefined
                    }
                  >
                    {isHovered && (
                      <rect
                        x={xCenter - slotW / 2}
                        y={0}
                        width={slotW}
                        height={chartHeight}
                        fill="rgba(56, 189, 248, 0.06)"
                      />
                    )}
                    <line
                      x1={xCenter}
                      y1={yHigh}
                      x2={xCenter}
                      y2={yLow}
                      stroke={candleColor}
                      strokeWidth={isHovered ? 1.9 : 1.15}
                    />
                    <rect
                      x={xCenter - candleWidth / 2}
                      y={topY}
                      width={candleWidth}
                      height={bodyH}
                      fill={candleColor}
                      stroke={candleColor}
                      strokeWidth={isHovered ? 1.4 : 0.4}
                      rx={1}
                    />
                  </g>
                );
              })
            : (() => {
                if (visibleCandles.length === 0) return null;
                const slotW = plotW / visibleCandles.length;
                const pts = visibleCandles
                  .map((c, i) => {
                    const x = (i + 0.5) * slotW;
                    const y = priceToY(c.close);
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(' ');

                const firstX = 0.5 * slotW;
                const lastX = (visibleCandles.length - 0.5) * slotW;
                const areaPath = `M ${firstX},${chartHeight} L ${pts.replace(/ /g, ' L ')} L ${lastX},${chartHeight} Z`;

                const lastCandle = visibleCandles[visibleCandles.length - 1];
                const lastY = priceToY(lastCandle.close);
                const isLineUp = lastCandle.close >= visibleCandles[0].close;
                const lineColor = isLineUp ? '#22C55E' : '#EF4444';

                return (
                  <g>
                    <defs>
                      <linearGradient id="tvLineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={lineColor} stopOpacity="0.24" />
                        <stop offset="100%" stopColor={lineColor} stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#tvLineAreaGrad)" />
                    <polyline
                      points={pts}
                      fill="none"
                      stroke={lineColor}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      pathLength={100}
                      className="animate-draw-line"
                      style={{ filter: `drop-shadow(0 0 6px ${lineColor}55)` }}
                    />
                    <circle cx={lastX} cy={lastY} r="8" fill={lineColor} opacity={0.18} />
                    <circle cx={lastX} cy={lastY} r="3.8" fill={lineColor} stroke="#070B14" strokeWidth="1.5" />
                  </g>
                );
              })()}

          {/* SMA 20 Overlay */}
          {showSma &&
            (() => {
              const slotW = plotW / Math.max(visibleCandles.length, 1);
              const smaPts: string[] = [];
              visibleCandles.forEach((_, i) => {
                const sma = smaValues[i];
                if (sma !== null && sma !== undefined) {
                  const x = (i + 0.5) * slotW;
                  const y = priceToY(sma);
                  smaPts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
                }
              });

              if (smaPts.length < 2) return null;
              return (
                <polyline
                  points={smaPts.join(' ')}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                  opacity={0.85}
                />
              );
            })()}

          {/* Bollinger Bands (20, 2) Overlay */}
          {showBb &&
            (() => {
              const slotW = plotW / Math.max(visibleCandles.length, 1);
              const upperPts: { x: number; y: number }[] = [];
              const lowerPts: { x: number; y: number }[] = [];
              visibleCandles.forEach((_, i) => {
                const pt = bbValues[i];
                if (pt && pt.upper !== null && pt.lower !== null) {
                  const x = (i + 0.5) * slotW;
                  upperPts.push({ x, y: priceToY(pt.upper) });
                  lowerPts.push({ x, y: priceToY(pt.lower) });
                }
              });

              if (upperPts.length < 2) return null;
              const upperStr = upperPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
              const lowerStr = lowerPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
              const bandPolygon = [
                ...upperPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
                ...[...lowerPts].reverse().map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
              ].join(' ');

              return (
                <g className="pointer-events-none">
                  <polygon points={bandPolygon} fill="rgba(139, 92, 246, 0.08)" />
                  <polyline
                    points={upperStr}
                    fill="none"
                    stroke="#A78BFA"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                    opacity={0.75}
                  />
                  <polyline
                    points={lowerStr}
                    fill="none"
                    stroke="#A78BFA"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                    opacity={0.75}
                  />
                </g>
              );
            })()}

          {/* EMA 12 Overlay */}
          {showEma &&
            (() => {
              const slotW = plotW / Math.max(visibleCandles.length, 1);
              const emaPts: string[] = [];
              visibleCandles.forEach((_, i) => {
                const ema = emaValues[i];
                if (ema !== null && ema !== undefined) {
                  const x = (i + 0.5) * slotW;
                  const y = priceToY(ema);
                  emaPts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
                }
              });

              if (emaPts.length < 2) return null;
              return (
                <polyline
                  points={emaPts.join(' ')}
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="1.6"
                  opacity={0.9}
                />
              );
            })()}

          {/* User Horizontal Price Levels (Support / Resistance) */}
          {symbolLevels.map((lvl) => {
            const y = priceToY(lvl.price);
            if (y < 0 || y > chartHeight) return null;
            return (
              <g key={lvl.id}>
                <line
                  x1="0"
                  y1={y}
                  x2={plotW}
                  y2={y}
                  stroke="#F59E0B"
                  strokeWidth="1.25"
                  strokeDasharray="5 3"
                  opacity={0.9}
                />
                <rect
                  x={plotW + 4}
                  y={y - 9}
                  width={priceAxisWidth - 8}
                  height="18"
                  rx="4"
                  fill="#F59E0B"
                />
                <text
                  x={plotW + 8}
                  y={y + 3.5}
                  fill="#070B14"
                  fontSize="10"
                  fontWeight="700"
                  fontFamily="JetBrains Mono, monospace"
                >
                  ${fmtAxisPrice(lvl.price)}
                </text>
              </g>
            );
          })}

          {/* Position PRU, Stop-Loss and Take-Profit Lines */}
          {currentPosition && currentPosition.quantity > 0 && (() => {
            const elements = [];

            // 1. Position Entry (PRU) Line
            const yPru = priceToY(currentPosition.avgPrice);
            if (yPru >= 0 && yPru <= chartHeight) {
              elements.push(
                <g key="pos-pru-line" className="pointer-events-none">
                  <line
                    x1="0"
                    y1={yPru}
                    x2={plotW}
                    y2={yPru}
                    stroke="#38BDF8"
                    strokeWidth="1.25"
                    strokeDasharray="4 4"
                    opacity={0.85}
                  />
                  <text
                    x="8"
                    y={yPru - 4}
                    fill="#38BDF8"
                    fontSize="9"
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    PRU ENTRY
                  </text>
                  <rect
                    x={plotW + 4}
                    y={yPru - 9}
                    width={priceAxisWidth - 8}
                    height="18"
                    rx="4"
                    fill="#0284C7"
                  />
                  <text
                    x={plotW + 8}
                    y={yPru + 3.5}
                    fill="#FFFFFF"
                    fontSize="10"
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    ${fmtAxisPrice(currentPosition.avgPrice)}
                  </text>
                </g>
              );
            }

            // 2. Stop-Loss Line
            if (currentPosition.stopLoss != null) {
              const ySl = priceToY(currentPosition.stopLoss);
              if (ySl >= 0 && ySl <= chartHeight) {
                elements.push(
                  <g key="pos-sl-line" className="pointer-events-none">
                    <line
                      x1="0"
                      y1={ySl}
                      x2={plotW}
                      y2={ySl}
                      stroke="#EF4444"
                      strokeWidth="1.5"
                      strokeDasharray="5 3"
                      opacity={0.95}
                    />
                    <text
                      x="8"
                      y={ySl - 4}
                      fill="#EF4444"
                      fontSize="9"
                      fontWeight="700"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      STOP-LOSS
                    </text>
                    <rect
                      x={plotW + 4}
                      y={ySl - 9}
                      width={priceAxisWidth - 8}
                      height="18"
                      rx="4"
                      fill="#EF4444"
                    />
                    <text
                      x={plotW + 8}
                      y={ySl + 3.5}
                      fill="#FFFFFF"
                      fontSize="10"
                      fontWeight="700"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      SL ${fmtAxisPrice(currentPosition.stopLoss)}
                    </text>
                  </g>
                );
              }
            }

            // 3. Take-Profit Line
            if (currentPosition.takeProfit != null) {
              const yTp = priceToY(currentPosition.takeProfit);
              if (yTp >= 0 && yTp <= chartHeight) {
                elements.push(
                  <g key="pos-tp-line" className="pointer-events-none">
                    <line
                      x1="0"
                      y1={yTp}
                      x2={plotW}
                      y2={yTp}
                      stroke="#10B981"
                      strokeWidth="1.5"
                      strokeDasharray="5 3"
                      opacity={0.95}
                    />
                    <text
                      x="8"
                      y={yTp - 4}
                      fill="#10B981"
                      fontSize="9"
                      fontWeight="700"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      TAKE-PROFIT
                    </text>
                    <rect
                      x={plotW + 4}
                      y={yTp - 9}
                      width={priceAxisWidth - 8}
                      height="18"
                      rx="4"
                      fill="#10B981"
                    />
                    <text
                      x={plotW + 8}
                      y={yTp + 3.5}
                      fill="#070B14"
                      fontSize="10"
                      fontWeight="700"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      TP ${fmtAxisPrice(currentPosition.takeProfit)}
                    </text>
                  </g>
                );
              }
            }

            return elements;
          })()}

          {/* Horizontal Line Placement Preview */}
          {drawTool === 'hline' && hoverY !== null && hoverY >= 0 && hoverY <= chartHeight && (
            <g className="pointer-events-none">
              <line
                x1="0"
                y1={hoverY}
                x2={plotW}
                y2={hoverY}
                stroke="#FBBF24"
                strokeWidth="1"
                strokeDasharray="2 3"
                opacity={0.7}
              />
            </g>
          )}

          {/* User Trendlines + Live Preview */}
          {(() => {
            const slotW = plotW / Math.max(visibleCandles.length, 1);
            const allLines: { id: string; p1: ChartAnchor; p2: ChartAnchor; preview?: boolean }[] = [
              ...symbolTrendLines,
              ...(drawTool === 'trendline' && pendingTrendStart && hoverAnchor
                ? [{ id: 'preview-tl', p1: pendingTrendStart, p2: hoverAnchor, preview: true }]
                : []),
            ];

            return allLines.map((tl) => {
              const x1 = resolveTimeToX(tl.p1.time, candles, startIndex, slotW, currentIntervalSec);
              const x2 = resolveTimeToX(tl.p2.time, candles, startIndex, slotW, currentIntervalSec);
              if (x1 === null || x2 === null) return null;
              const y1 = priceToY(tl.p1.price);
              const y2 = priceToY(tl.p2.price);

              return (
                <g key={tl.id} className="pointer-events-none">
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#22D3EE"
                    strokeWidth={tl.preview ? '1.4' : '1.9'}
                    strokeDasharray={tl.preview ? '4 3' : undefined}
                    opacity={tl.preview ? 0.8 : 0.95}
                  />
                  <circle cx={x1} cy={y1} r="3.5" fill="#070B14" stroke="#22D3EE" strokeWidth="1.5" />
                  <circle cx={x2} cy={y2} r="3.5" fill="#070B14" stroke="#22D3EE" strokeWidth="1.5" />
                </g>
              );
            });
          })()}

          {/* Price Measurement Range Overlay */}
          {activeMeasure &&
            (() => {
              const slotW = plotW / Math.max(visibleCandles.length, 1);
              const x1 = resolveTimeToX(activeMeasure.p1.time, candles, startIndex, slotW, currentIntervalSec);
              const x2 = resolveTimeToX(activeMeasure.p2.time, candles, startIndex, slotW, currentIntervalSec);
              if (x1 === null || x2 === null) return null;
              const y1 = priceToY(activeMeasure.p1.price);
              const y2 = priceToY(activeMeasure.p2.price);

              const minX = Math.min(x1, x2);
              const width = Math.max(2, Math.abs(x2 - x1));
              const minY = Math.min(y1, y2);
              const height = Math.max(2, Math.abs(y2 - y1));

              const diffPrice = activeMeasure.p2.price - activeMeasure.p1.price;
              const diffPct =
                activeMeasure.p1.price !== 0 ? (diffPrice / activeMeasure.p1.price) * 100 : 0;
              const isGain = diffPrice >= 0;
              const barsCount = Math.max(
                1,
                Math.round(Math.abs(activeMeasure.p2.time - activeMeasure.p1.time) / Math.max(1000, currentIntervalSec * 1000))
              );
              const labelText = `${isGain ? '+' : ''}$${diffPrice.toFixed(2)} (${
                isGain ? '+' : ''
              }${diffPct.toFixed(2)}%) · ${barsCount} bars`;
              const boxCenterX = Math.min(plotW - 115, Math.max(115, minX + width / 2));
              const boxLabelY = Math.max(28, minY - 10);

              return (
                <g className="pointer-events-none">
                  <rect
                    x={minX}
                    y={minY}
                    width={width}
                    height={height}
                    fill={isGain ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.14)'}
                    stroke={isGain ? 'rgba(34,197,94,0.75)' : 'rgba(239,68,68,0.75)'}
                    strokeWidth="1.2"
                    strokeDasharray="4 2"
                  />
                  <g transform={`translate(${boxCenterX - 105}, ${boxLabelY - 12})`}>
                    <rect
                      x="0"
                      y="0"
                      width="210"
                      height="22"
                      rx="5"
                      fill="#0B1120"
                      stroke={isGain ? '#22C55E' : '#EF4444'}
                      strokeWidth="1"
                    />
                    <text
                      x="105"
                      y="14.5"
                      textAnchor="middle"
                      fill={isGain ? '#4ADE80' : '#FB7185'}
                      fontSize="10"
                      fontWeight="700"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {labelText}
                    </text>
                  </g>
                </g>
              );
            })()}

          {/* Live Price Tag */}
          {currentDisplayPrice > 0 &&
            (() => {
              const yCurrent = Math.max(12, Math.min(chartHeight - 12, priceToY(currentDisplayPrice)));
              const accent = isUpSession ? '#22C55E' : '#EF4444';

              return (
                <g>
                  <line
                    x1="0"
                    y1={yCurrent}
                    x2={plotW}
                    y2={yCurrent}
                    stroke={accent}
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity={0.75}
                  />
                  <rect
                    x={plotW + 4}
                    y={yCurrent - 10}
                    width={priceAxisWidth - 8}
                    height="20"
                    rx="5"
                    fill={accent}
                    style={{ filter: `drop-shadow(0 2px 6px ${accent}55)` }}
                  />
                  <text
                    x={plotW + 8}
                    y={yCurrent + 3.5}
                    fill="#070B14"
                    fontSize="10"
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    ${fmtAxisPrice(currentDisplayPrice)}
                  </text>
                </g>
              );
            })()}

          {/* Crosshair & Hover Candle HUD */}
          {hoverIndex !== null &&
            visibleCandles[hoverIndex] &&
            (() => {
              const hovered = visibleCandles[hoverIndex];
              const slotW = plotW / visibleCandles.length;
              const xHover = (hoverIndex + 0.5) * slotW;
              const yHover = priceToY(hovered.close);
              const isUpHover = hovered.close >= hovered.open;

              return (
                <g className="pointer-events-none">
                  <line
                    x1={xHover}
                    y1="0"
                    x2={xHover}
                    y2={chartHeight}
                    stroke="rgba(56,189,248,0.4)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1="0"
                    y1={yHover}
                    x2={plotW}
                    y2={yHover}
                    stroke="rgba(56,189,248,0.4)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <circle cx={xHover} cy={yHover} r="7" fill="rgba(56,189,248,0.18)" />
                  <circle
                    cx={xHover}
                    cy={yHover}
                    r="3.5"
                    fill="#070B14"
                    stroke="#38BDF8"
                    strokeWidth="2"
                  />
                  <g transform="translate(10, 10)">
                    <rect
                      x="0"
                      y="0"
                      width="336"
                      height="24"
                      rx="6"
                      fill="rgba(7, 11, 20, 0.88)"
                      stroke={isUpHover ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}
                    />
                    <text
                      x="10"
                      y="15.5"
                      fill="#CBD5E1"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      O {fmtAxisPrice(hovered.open)} · H {fmtAxisPrice(hovered.high)} · L{' '}
                      {fmtAxisPrice(hovered.low)} · C{' '}
                      <tspan fill={isUpHover ? '#4ADE80' : '#FB7185'} fontWeight="700">
                        {fmtAxisPrice(hovered.close)}
                      </tspan>
                    </text>
                  </g>
                </g>
              );
            })()}

          {/* Live Cursor Price Readout on Right Axis (Fullscreen / Drawing Modes) */}
          {hoverY !== null &&
            hoverY >= 0 &&
            hoverY <= chartHeight &&
            (isFullscreen || drawTool !== 'cursor') && (
              <g className="pointer-events-none">
                <line
                  x1="0"
                  y1={hoverY}
                  x2={plotW}
                  y2={hoverY}
                  stroke="rgba(148,163,184,0.28)"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                <rect
                  x={plotW + 4}
                  y={Math.max(2, Math.min(chartHeight - 18, hoverY - 9))}
                  width={priceAxisWidth - 8}
                  height="18"
                  rx="4"
                  fill="#1E293B"
                  stroke="#38BDF8"
                  strokeWidth="0.75"
                />
                <text
                  x={plotW + 8}
                  y={Math.max(14, Math.min(chartHeight - 5, hoverY + 3.5))}
                  fill="#E2E8F0"
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="JetBrains Mono, monospace"
                >
                  ${fmtAxisPrice(yToPrice(hoverY))}
                </text>
              </g>
            )}

          {/* Time Axis Bar */}
          <line
            x1="0"
            y1={chartHeight}
            x2={canvasWidth}
            y2={chartHeight}
            stroke="rgba(148,163,184,0.12)"
            strokeWidth="1"
          />
          {visibleCandles.map((c, i) => {
            const labelBudget = Math.max(3, Math.floor(plotW / 120));
            const step = Math.max(1, Math.floor(visibleCandles.length / labelBudget));
            if (i % step !== 0 && i !== visibleCandles.length - 1) return null;

            const slotW = plotW / visibleCandles.length;
            const x = (i + 0.5) * slotW;
            const d = new Date(c.ts);
            const isToday = d.toDateString() === new Date().toDateString();
            const isRightmost = i === visibleCandles.length - 1;

            let label: string;
            if (isRightmost) {
              label = d.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              });
            } else if (resolution === 'D') {
              label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
            } else if (isToday) {
              label = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            } else {
              label = `${d.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
              })} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
            }

            return (
              <text
                key={`time-${i}`}
                x={Math.min(plotW - 28, Math.max(28, x))}
                y={chartHeight + 17}
                fill={isRightmost ? '#38BDF8' : '#64748b'}
                fontWeight={isRightmost ? '600' : '400'}
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                textAnchor="middle"
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-2.5 border-t border-subtle text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#070B14] border border-subtle text-slate-300">
            <Zap className="w-3 h-3 text-amber-400" />
            {isFullscreen
              ? 'Molette pour zoomer · Glisser en mode Curseur · Esc pour quitter'
              : "Molette pour zoomer · Glisser pour parcourir l'historique"}
          </span>
        </div>

        {(onBuy || onSell) && (!isFullscreen || !showOrderDock) && (
          <div className="flex items-center gap-2">
            {onBuy && (
              <button
                onClick={onBuy}
                className="px-3.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-lg font-semibold text-xs transition"
              >
                Buy {symbol.split(':')[1] || symbol}
              </button>
            )}
            {onSell && (
              <button
                onClick={onSell}
                className="px-3.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-lg font-semibold text-xs transition"
              >
                Sell {symbol.split(':')[1] || symbol}
              </button>
            )}
          </div>
        )}
      </div>
        </div>

        {/* Fullscreen Right-Hand Live Order Ticket & Position Dock */}
        {isFullscreen && showOrderDock && (
          <FullscreenOrderDock
            symbol={symbol}
            watchlist={watchlist}
            onSelectSymbol={onSelectSymbol}
            lastPrice={currentDisplayPrice > 0 ? currentDisplayPrice : null}
            currentQuote={currentQuote}
            rsi14={rsi14}
            portfolioCash={portfolioCash}
            position={symbolPosition}
            onOrderExecuted={onOrderExecuted}
          />
        )}
      </div>
    </div>
  );
};
