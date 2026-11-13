import React, { useRef, useState, useEffect } from 'react';
import { PricePoint } from '../hooks/useMarketWebSocket';
import { EmptyState, LivePulseDot } from './ui';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface MiniChartProps {
  symbol: string;
  points: PricePoint[];
  currentPrice?: number;
}

export const MiniChart: React.FC<MiniChartProps> = ({ symbol, points, currentPrice }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      if (el.clientWidth > 0) setWidth(el.clientWidth);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!points || points.length < 2) {
    return (
      <div className="h-64 workstation-panel rounded-xl flex items-center justify-center">
        <EmptyState
          compact
          icon={Activity}
          title={`En attente de ticks pour ${symbol}`}
          description="Le graphique temps réel se construira automatiquement dès réception des cotations."
        />
      </div>
    );
  }

  const prices = points.map((p) => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 1;

  const firstPrice = prices[0];
  const latestPrice = currentPrice !== undefined ? currentPrice : prices[prices.length - 1];
  const isUp = latestPrice >= firstPrice;
  const strokeColor = isUp ? '#22C55E' : '#EF4444';

  const height = 190;
  const paddingY = 18;

  const coords = points.map((p, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - paddingY - ((p.price - minPrice) / range) * (height - 2 * paddingY);
    return { x, y };
  });

  const pathD = coords.reduce(
    (acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)},${c.y.toFixed(1)}`,
    ''
  );
  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

  const diff = latestPrice - firstPrice;
  const diffPercent = firstPrice > 0 ? (diff / firstPrice) * 100 : 0;

  return (
    <div className="workstation-panel rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white font-mono tracking-tight">{symbol}</h3>
            <span className="text-[10px] text-slate-400 font-mono">
              {points.length} ticks
            </span>
          </div>
          <div className="flex items-baseline gap-2.5 mt-1">
            <span className="text-2xl font-bold text-white font-mono tabular-nums">
              ${latestPrice.toFixed(2)}
            </span>
            <span
              className={`inline-flex items-center text-xs font-semibold font-mono tabular-nums px-2 py-0.5 rounded-md ${
                isUp
                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                  : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
              }`}
            >
              {isUp ? (
                <TrendingUp className="w-3.5 h-3.5 mr-1" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 mr-1" />
              )}
              {diff >= 0 ? '+' : ''}
              {diff.toFixed(2)} ({diffPercent >= 0 ? '+' : ''}
              {diffPercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        <div className="text-right text-[11px] font-mono tabular-nums text-slate-400 space-y-1">
          <div>
            Haut <span className="text-slate-200 font-semibold">${maxPrice.toFixed(2)}</span>
          </div>
          <div>
            Bas <span className="text-slate-200 font-semibold">${minPrice.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
          const idx = Math.round((relX / Math.max(rect.width, 1)) * (points.length - 1));
          setHoverIdx(Math.max(0, Math.min(points.length - 1, idx)));
        }}
        onMouseLeave={() => setHoverIdx(null)}
        className="relative w-full h-48 overflow-hidden rounded-lg bg-[#070B14]/60 border border-subtle cursor-crosshair"
      >
        {hoverIdx !== null && points[hoverIdx] && (
          <div className="pointer-events-none absolute top-2 left-2.5 z-10 px-2 py-1 rounded-md bg-[#0B1220]/95 border border-strong text-[10px] font-mono tabular-nums text-slate-200 shadow-lg">
            ${points[hoverIdx].price.toFixed(2)}{' '}
            <span className="text-slate-400">· {points[hoverIdx].time}</span>
          </div>
        )}
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-full block">
          <defs>
            <linearGradient id={`miniGrad-${symbol.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#miniGrad-${symbol.replace(/[^a-zA-Z0-9]/g, '')})`} />
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 5px ${strokeColor}55)` }}
          />
          {coords.length > 0 && (
            <>
              <circle
                cx={coords[coords.length - 1].x}
                cy={coords[coords.length - 1].y}
                r="6.5"
                fill={strokeColor}
                opacity={0.2}
              />
              <circle
                cx={coords[coords.length - 1].x}
                cy={coords[coords.length - 1].y}
                r="3.2"
                fill={strokeColor}
                stroke="#070B14"
                strokeWidth="1.5"
              />
            </>
          )}
          {hoverIdx !== null && coords[hoverIdx] && (
            <g className="pointer-events-none">
              <line
                x1={coords[hoverIdx].x}
                y1={0}
                x2={coords[hoverIdx].x}
                y2={height}
                stroke="rgba(148,163,184,0.4)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <circle
                cx={coords[hoverIdx].x}
                cy={coords[hoverIdx].y}
                r="4"
                fill="#070B14"
                stroke="#38BDF8"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      </div>

      <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono tabular-nums mt-2.5 pt-2 border-t border-subtle">
        <span>{points[0]?.time}</span>
        <span className="inline-flex items-center gap-1.5 text-emerald-400/90 font-semibold">
          <LivePulseDot color="emerald" active size="sm" />
          LIVE STREAM
        </span>
        <span>{points[points.length - 1]?.time}</span>
      </div>
    </div>
  );
};
