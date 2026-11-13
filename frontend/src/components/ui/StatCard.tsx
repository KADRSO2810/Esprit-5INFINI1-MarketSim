import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  icon?: LucideIcon;
  accent?: 'cyan' | 'violet' | 'bullish' | 'bearish' | 'warning' | 'neutral';
  className?: string;
}

const ACCENT_MAP = {
  cyan: 'text-sky-400 bg-sky-500/10 border-sky-500/25',
  violet: 'text-violet-400 bg-violet-500/10 border-violet-500/25',
  bullish: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  bearish: 'text-rose-400 bg-rose-500/10 border-rose-500/25',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  neutral: 'text-slate-400 bg-slate-500/10 border-slate-500/25',
};

const TOP_GLOW_MAP = {
  cyan: 'via-sky-400/35',
  violet: 'via-violet-400/35',
  bullish: 'via-emerald-400/35',
  bearish: 'via-rose-400/35',
  warning: 'via-amber-400/35',
  neutral: 'via-slate-400/15',
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  icon: Icon,
  accent = 'neutral',
  className = '',
}) => (
  <div
    className={`workstation-panel card-interactive rounded-xl px-4 py-3.5 relative overflow-hidden group ${className}`}
  >
    {/* Subtle hairline illumination on hover */}
    <span
      className={`pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent ${TOP_GLOW_MAP[accent]} to-transparent opacity-60 group-hover:opacity-100 transition-opacity`}
    />

    <div className="flex items-center justify-between gap-2 mb-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 truncate">
        {label}
      </span>
      {Icon && (
        <span
          className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${ACCENT_MAP[accent]}`}
        >
          <Icon className="w-3.5 h-3.5" />
        </span>
      )}
    </div>
    <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-white tracking-tight leading-snug">
      {value}
    </div>
    {subValue && (
      <div className="text-[11px] font-mono tabular-nums text-slate-400 mt-1 truncate">
        {subValue}
      </div>
    )}
  </div>
);
