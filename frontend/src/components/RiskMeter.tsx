import React from 'react';
import { RiskMetrics } from '../api/trading';
import { MetricCardSkeleton, EmptyState } from './ui';
import { ShieldAlert, ShieldCheck, Activity, Gauge, Info } from 'lucide-react';

interface RiskMeterProps {
  metrics: RiskMetrics | null;
  loading: boolean;
}

const fmt2 = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ArcGauge: React.FC<{ value: number; max: number; color: string; label: string }> = ({
  value,
  max,
  color,
  label,
}) => {
  const pct = Math.max(0, Math.min(value / max, 1));
  const r = 32;
  const cx = 44;
  const cy = 42;
  const start = -Math.PI * 0.8;
  const end = Math.PI * 0.8;
  const angle = start + pct * (end - start);
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(angle);
  const y2 = cy + r * Math.sin(angle);
  const big = pct > 0.5 ? 1 : 0;

  return (
    <svg viewBox="0 0 88 64" className="w-24 h-16">
      <path
        d={`M ${cx + r * Math.cos(start)} ${cy + r * Math.sin(start)} A ${r} ${r} 0 1 1 ${
          cx + r * Math.cos(end)
        } ${cy + r * Math.sin(end)}`}
        fill="none"
        stroke="rgba(148,163,184,0.12)"
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      {pct > 0 && (
        <path
          d={`M ${x1} ${y1} A ${r} ${r} 0 ${big} 1 ${x2} ${y2}`}
          fill="none"
          stroke={color}
          strokeWidth="6.5"
          strokeLinecap="round"
        />
      )}
      <text
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        fontSize="10"
        fill="#F8FAFC"
        fontFamily="JetBrains Mono, monospace"
        fontWeight="700"
      >
        {label}
      </text>
    </svg>
  );
};

export const RiskMeter: React.FC<RiskMeterProps> = ({ metrics, loading }) => {
  if (loading && !metrics) {
    return (
      <div className="workstation-panel rounded-xl p-4 space-y-3">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
    );
  }

  const noPositions =
    !metrics || metrics.portfolioEquity === 0 || metrics.exposureBySymbol.length === 0;

  return (
    <div className="workstation-panel rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
            Risk Intelligence
          </h3>
        </div>
        {!noPositions && (
          <span className="text-[10px] font-mono text-slate-400">VaR 95% · Max DD</span>
        )}
      </div>

      {noPositions ? (
        <EmptyState
          compact
          icon={ShieldCheck}
          title="Exposition nulle"
          description={
            metrics?.message ??
            'Aucune position ouverte. La VaR 95% et le drawdown s’activeront dès votre premier ordre.'
          }
        />
      ) : (
        <div className="p-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {/* VaR 95% */}
            <div className="rounded-xl bg-[#070B14]/70 border border-subtle p-3 flex flex-col items-center card-interactive">
              {metrics!.var95 != null ? (
                <>
                  <ArcGauge
                    value={metrics!.var95}
                    max={Math.max(metrics!.portfolioEquity * 0.1, 1)}
                    color={
                      metrics!.var95 / metrics!.portfolioEquity > 0.05 ? '#EF4444' : '#F59E0B'
                    }
                    label={`$${
                      metrics!.var95 > 999
                        ? (metrics!.var95 / 1000).toFixed(1) + 'k'
                        : Math.round(metrics!.var95)
                    }`}
                  />
                  <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
                    VaR 95%
                  </span>
                  <span className="text-[11px] text-slate-200 font-mono tabular-nums mt-0.5">
                    ${fmt2(metrics!.var95)}
                  </span>
                </>
              ) : (
                <div className="py-4 flex flex-col items-center gap-1.5 text-center">
                  <Gauge className="w-6 h-6 text-slate-600" />
                  <span className="text-[10px] text-slate-400 font-medium">VaR 95%</span>
                  <span className="text-[10px] text-slate-500">Collecte ticks…</span>
                </div>
              )}
            </div>

            {/* Max Drawdown */}
            <div className="rounded-xl bg-[#070B14]/70 border border-subtle p-3 flex flex-col items-center card-interactive">
              {metrics!.maxDrawdown != null ? (
                <>
                  <ArcGauge
                    value={metrics!.maxDrawdown * 100}
                    max={20}
                    color={
                      metrics!.maxDrawdown > 0.1
                        ? '#EF4444'
                        : metrics!.maxDrawdown > 0.05
                        ? '#F59E0B'
                        : '#22C55E'
                    }
                    label={`${(metrics!.maxDrawdown * 100).toFixed(1)}%`}
                  />
                  <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
                    Max Drawdown
                  </span>
                  <span className="text-[11px] text-slate-200 font-mono tabular-nums mt-0.5">
                    {(metrics!.maxDrawdown * 100).toFixed(2)}%
                  </span>
                </>
              ) : (
                <div className="py-4 flex flex-col items-center gap-1.5 text-center">
                  <Gauge className="w-6 h-6 text-slate-600" />
                  <span className="text-[10px] text-slate-400 font-medium">Max Drawdown</span>
                  <span className="text-[10px] text-slate-500">Accumulation…</span>
                </div>
              )}
            </div>
          </div>

          {/* Exposure Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-sky-400" />
                Exposition par actif
              </span>
              <span className="text-[10px] font-mono text-slate-500">Top 5</span>
            </div>
            <div className="flex flex-col gap-2">
              {metrics!.exposureBySymbol.slice(0, 5).map((e) => {
                const pct = Math.min(Number(e.weight) * 100, 100);
                return (
                  <div key={e.symbol} className="group flex items-center gap-2.5">
                    <span className="text-[11px] font-mono text-slate-300 group-hover:text-white transition-colors w-24 truncate">
                      {e.symbol}
                    </span>
                    <div className="flex-1 bg-[#070B14] border border-subtle rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-400 to-blue-500 shadow-[0_0_8px_rgba(56,189,248,0.45)] transition-all duration-700 ease-out"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-slate-200 w-11 text-right">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Telemetry Footer */}
          <div className="border-t border-subtle pt-2.5 grid grid-cols-2 gap-y-1 text-[10px] font-mono tabular-nums text-slate-400">
            <span>Quotes fenêtre</span>
            <span className="text-right text-slate-200">{metrics!.quoteWindowUsed}</span>
            <span>Snapshots equity</span>
            <span className="text-right text-slate-200">{metrics!.snapshotWindowUsed}</span>
          </div>

          {metrics?.message && (
            <div className="flex items-start gap-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
              <span>{metrics.message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
