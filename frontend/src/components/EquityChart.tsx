import React, { useState, useRef, useEffect } from 'react';
import { BacktestEquityPoint } from '../api/backtest';
import { EmptyState } from './ui';
import { TrendingUp } from 'lucide-react';

interface RunSeries {
  label: string;
  color: string;
  points: BacktestEquityPoint[];
}

interface EquityChartProps {
  series: RunSeries[];
  height?: number;
}

export const EquityChart: React.FC<EquityChartProps> = ({ series, height = 320 }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [width, setWidth] = useState<number>(800);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const activeSeries = series.filter((s) => s.points && s.points.length > 0);

  if (activeSeries.length === 0) {
    return (
      <div
        className="w-full workstation-panel rounded-xl flex items-center justify-center"
        style={{ height }}
      >
        <EmptyState
          compact
          icon={TrendingUp}
          title="Aucune courbe d'equity"
          description="Lancez un backtest ou sélectionnez une simulation terminée pour visualiser l'évolution du capital."
        />
      </div>
    );
  }

  let allMin = Infinity;
  let allMax = -Infinity;

  activeSeries.forEach((s) => {
    s.points.forEach((p) => {
      if (p.equity < allMin) allMin = p.equity;
      if (p.equity > allMax) allMax = p.equity;
    });
  });

  if (allMin === Infinity || allMax === -Infinity) {
    allMin = 0;
    allMax = 100000;
  }

  const range = allMax - allMin || 1;
  const paddingY = range * 0.08;
  const yMin = Math.max(0, allMin - paddingY);
  const yMax = allMax + paddingY;
  const yRange = yMax - yMin;

  const padLeft = 64;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 34;
  const plotWidth = Math.max(200, width - padLeft - padRight);
  const plotHeight = Math.max(120, height - padTop - padBottom);

  const primaryPoints = activeSeries[0].points;
  const n = primaryPoints.length;

  const getCoordinates = (points: BacktestEquityPoint[]) => {
    if (points.length === 0) return '';
    return points
      .map((p, i) => {
        const x = padLeft + (i / Math.max(points.length - 1, 1)) * plotWidth;
        const y = padTop + plotHeight - ((p.equity - yMin) / yRange) * plotHeight;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  };

  const hoveredPoint =
    hoverIndex !== null && hoverIndex >= 0 && hoverIndex < n ? primaryPoints[hoverIndex] : null;

  const hoveredX =
    hoverIndex !== null ? padLeft + (hoverIndex / Math.max(n - 1, 1)) * plotWidth : null;

  return (
    <div className="w-full workstation-panel rounded-xl p-4 flex flex-col gap-3">
      {/* Legend & Interactive Hover Readout */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          {activeSeries.map((s) => {
            const val =
              hoverIndex !== null
                ? s.points[Math.min(hoverIndex, s.points.length - 1)]?.equity
                : s.points[s.points.length - 1]?.equity;
            return (
              <div key={s.label} className="flex items-center gap-2 font-mono tabular-nums text-[11px]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-slate-300 font-medium">{s.label}</span>
                <span className="text-white font-bold">
                  ${val?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            );
          })}
        </div>

        {hoveredPoint && (
          <div className="text-[10px] font-mono tabular-nums text-sky-300 bg-[#070B14] px-2.5 py-1 rounded-md border border-sky-500/25">
            {new Date(hoveredPoint.ts).toLocaleString('fr-FR')}
          </div>
        )}
      </div>

      {/* SVG Canvas */}
      <div ref={containerRef} className="relative w-full bg-[#070B14]/60 rounded-lg border border-subtle overflow-hidden select-none">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * width;
            const boundedX = Math.max(padLeft, Math.min(width - padRight, relX));
            const frac = (boundedX - padLeft) / plotWidth;
            const idx = Math.round(frac * (n - 1));
            setHoverIndex(idx);
          }}
        >
          <defs>
            {activeSeries.map((s, idx) => (
              <linearGradient key={idx} id={`eqAreaGrad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.0" />
              </linearGradient>
            ))}
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
            const y = padTop + plotHeight * (1 - frac);
            const val = yMin + yRange * frac;
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="rgba(148,163,184,0.1)"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  ${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Initial Capital Baseline */}
          {primaryPoints.length > 0 &&
            (() => {
              const baseVal = primaryPoints[0].equity;
              const baseY = padTop + plotHeight - ((baseVal - yMin) / yRange) * plotHeight;
              return (
                <line
                  x1={padLeft}
                  y1={baseY}
                  x2={width - padRight}
                  y2={baseY}
                  stroke="rgba(56,189,248,0.22)"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              );
            })()}

          {activeSeries.map((s, idx) => {
            const coords = getCoordinates(s.points);
            const firstX = padLeft;
            const lastX = padLeft + plotWidth;
            const bottomY = padTop + plotHeight;
            const areaPath = `M ${coords.split(' ')[0]} L ${coords} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;
            const lastPt = s.points[s.points.length - 1];
            const lastPtY = lastPt
              ? padTop + plotHeight - ((lastPt.equity - yMin) / yRange) * plotHeight
              : bottomY;

            return (
              <g key={idx}>
                {idx === 0 && <path d={areaPath} fill={`url(#eqAreaGrad-${idx})`} />}
                <polyline
                  points={coords}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={idx === 0 ? '2.2' : '1.8'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={100}
                  className="animate-draw-line"
                  style={idx === 0 ? { filter: `drop-shadow(0 0 6px ${s.color}55)` } : undefined}
                />
                {lastPt && (
                  <>
                    <circle cx={lastX} cy={lastPtY} r="6.5" fill={s.color} opacity={0.18} />
                    <circle
                      cx={lastX}
                      cy={lastPtY}
                      r="3.2"
                      fill={s.color}
                      stroke="#070B14"
                      strokeWidth="1.5"
                    />
                  </>
                )}
              </g>
            );
          })}

          {hoveredX !== null && (
            <line
              x1={hoveredX}
              y1={padTop}
              x2={hoveredX}
              y2={padTop + plotHeight}
              stroke="rgba(148,163,184,0.45)"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
          )}

          {hoverIndex !== null &&
            activeSeries.map((s, idx) => {
              const pt = s.points[Math.min(hoverIndex, s.points.length - 1)];
              if (!pt) return null;
              const cx =
                padLeft +
                (Math.min(hoverIndex, s.points.length - 1) / Math.max(s.points.length - 1, 1)) *
                  plotWidth;
              const cy = padTop + plotHeight - ((pt.equity - yMin) / yRange) * plotHeight;
              return (
                <circle
                  key={idx}
                  cx={cx}
                  cy={cy}
                  r="4.5"
                  fill={s.color}
                  stroke="#070B14"
                  strokeWidth="2"
                />
              );
            })}

          {n > 1 && (
            <>
              <text
                x={padLeft}
                y={padTop + plotHeight + 20}
                textAnchor="start"
                fill="#64748b"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {new Date(primaryPoints[0].ts).toLocaleDateString('fr-FR')}
              </text>
              <text
                x={width - padRight}
                y={padTop + plotHeight + 20}
                textAnchor="end"
                fill="#64748b"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {new Date(primaryPoints[n - 1].ts).toLocaleDateString('fr-FR')}
              </text>
            </>
          )}
        </svg>
      </div>
    </div>
  );
};
