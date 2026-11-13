import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Cpu, Sparkles } from 'lucide-react';

interface OrbitalSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  tone?: 'cyan' | 'violet' | 'emerald' | 'rose' | 'slate';
  className?: string;
}

const TONE_MAP = {
  cyan: { ring: 'border-t-sky-400 border-r-sky-400/30', core: 'bg-sky-400' },
  violet: { ring: 'border-t-violet-400 border-r-violet-400/30', core: 'bg-violet-400' },
  emerald: { ring: 'border-t-emerald-400 border-r-emerald-400/30', core: 'bg-emerald-400' },
  rose: { ring: 'border-t-rose-400 border-r-rose-400/30', core: 'bg-rose-400' },
  slate: { ring: 'border-t-slate-950 border-r-slate-950/30', core: 'bg-slate-950' },
};

const SIZE_MAP = {
  xs: { outer: 'w-3.5 h-3.5 border-[1.5px]', inner: 'hidden', dot: 'w-1 h-1' },
  sm: { outer: 'w-4 h-4 border-2', inner: 'hidden', dot: 'w-1 h-1' },
  md: { outer: 'w-7 h-7 border-2', inner: 'w-4 h-4 border-[1.5px]', dot: 'w-1.5 h-1.5' },
  lg: { outer: 'w-11 h-11 border-2', inner: 'w-6 h-6 border-2', dot: 'w-2 h-2' },
};

export const OrbitalSpinner: React.FC<OrbitalSpinnerProps> = ({
  size = 'sm',
  tone = 'cyan',
  className = '',
}) => {
  const s = SIZE_MAP[size];
  const t = TONE_MAP[tone];

  return (
    <span className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <span
        className={`${s.outer} rounded-full border-transparent ${t.ring} animate-orbital-spin`}
      />
      {s.inner !== 'hidden' && (
        <span
          className={`absolute ${s.inner} rounded-full border-transparent border-b-sky-400/70 border-l-violet-400/40 animate-orbital-reverse`}
        />
      )}
      <span className={`absolute ${s.dot} rounded-full ${t.core} opacity-80`} />
    </span>
  );
};

interface LivePulseDotProps {
  color?: 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan';
  active?: boolean;
  size?: 'sm' | 'md';
}

const DOT_COLORS = {
  emerald: { ping: 'bg-emerald-400', solid: 'bg-emerald-400' },
  amber: { ping: 'bg-amber-400', solid: 'bg-amber-400' },
  rose: { ping: 'bg-rose-400', solid: 'bg-rose-400' },
  violet: { ping: 'bg-violet-400', solid: 'bg-violet-400' },
  cyan: { ping: 'bg-sky-400', solid: 'bg-sky-400' },
};

export const LivePulseDot: React.FC<LivePulseDotProps> = ({
  color = 'emerald',
  active = true,
  size = 'sm',
}) => {
  const c = DOT_COLORS[color];
  const dims = size === 'md' ? 'w-2.5 h-2.5' : 'w-2 h-2';

  return (
    <span className={`relative inline-flex ${dims} shrink-0 items-center justify-center`}>
      {active && (
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full ${c.ping} opacity-60`}
        />
      )}
      <span
        className={`relative inline-flex rounded-full ${dims} ${
          active ? c.solid : 'bg-slate-600'
        }`}
      />
    </span>
  );
};

interface AiProcessingBannerProps {
  title: string;
  subtitle?: string;
  badge?: string;
  tone?: 'violet' | 'cyan';
}

export const AiProcessingBanner: React.FC<AiProcessingBannerProps> = ({
  title,
  subtitle,
  badge = 'IA ENGINE ACTIVE',
  tone = 'violet',
}) => {
  const ringPrimary = tone === 'violet' ? '#8B5CF6' : '#06B6D4';
  const ringSecondary = tone === 'violet' ? '#06B6D4' : '#3B82F6';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="ai-surface rounded-2xl p-4 relative overflow-hidden"
    >
      {/* Animated top sweep line */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-[#142035] overflow-hidden">
        <div
          className={`h-full w-1/3 rounded-full animate-ai-sweep ${
            tone === 'violet'
              ? 'bg-gradient-to-r from-transparent via-violet-400 to-sky-400'
              : 'bg-gradient-to-r from-transparent via-sky-400 to-emerald-400'
          }`}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="relative w-10 h-10 rounded-xl bg-[#0B1220] border border-violet-500/30 flex items-center justify-center shrink-0 shadow-glow-violet">
            <motion.svg
              viewBox="0 0 40 40"
              className="absolute inset-0 w-full h-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 3.4, repeat: Infinity, ease: 'linear' }}
            >
              <circle
                cx="20"
                cy="20"
                r="15"
                fill="none"
                stroke={ringPrimary}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeDasharray="28 66"
              />
            </motion.svg>
            <motion.svg
              viewBox="0 0 40 40"
              className="absolute inset-0 w-full h-full"
              animate={{ rotate: -360 }}
              transition={{ duration: 2.3, repeat: Infinity, ease: 'linear' }}
            >
              <circle
                cx="20"
                cy="20"
                r="10"
                fill="none"
                stroke={ringSecondary}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray="16 48"
              />
            </motion.svg>
            <Cpu
              className={`w-3.5 h-3.5 relative z-10 ${
                tone === 'violet' ? 'text-violet-300' : 'text-sky-300'
              }`}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white truncate">{title}</span>
              <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0 animate-pulse" />
            </div>
            {subtitle && (
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2.5 py-1 rounded-lg bg-[#0B1220] border border-violet-500/30 text-violet-300 shrink-0">
          <Brain className="w-3 h-3" />
          {badge}
        </span>
      </div>
    </motion.div>
  );
};
