import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { EASE_INSTITUTIONAL } from './presets';

export type QuantOrbitalTone = 'cyan' | 'violet' | 'emerald' | 'rose' | 'amber';
export type QuantOrbitalSize = 'sm' | 'md' | 'lg';

interface QuantOrbitalLoaderProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  tone?: QuantOrbitalTone;
  size?: QuantOrbitalSize;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

const TONE_COLORS: Record<
  QuantOrbitalTone,
  {
    primary: string;
    secondary: string;
    glow: string;
    border: string;
    badgeText: string;
    iconText: string;
  }
> = {
  cyan: {
    primary: '#38BDF8',
    secondary: '#8B5CF6',
    glow: 'from-sky-500/20 via-cyan-500/10 to-violet-500/20',
    border: 'border-sky-500/30',
    badgeText: 'text-sky-300',
    iconText: 'text-sky-400',
  },
  violet: {
    primary: '#8B5CF6',
    secondary: '#38BDF8',
    glow: 'from-violet-500/20 via-indigo-500/10 to-sky-500/20',
    border: 'border-violet-500/30',
    badgeText: 'text-violet-300',
    iconText: 'text-violet-400',
  },
  emerald: {
    primary: '#22C55E',
    secondary: '#38BDF8',
    glow: 'from-emerald-500/20 via-cyan-500/10 to-sky-500/20',
    border: 'border-emerald-500/30',
    badgeText: 'text-emerald-300',
    iconText: 'text-emerald-400',
  },
  rose: {
    primary: '#EF4444',
    secondary: '#F59E0B',
    glow: 'from-rose-500/20 via-amber-500/10 to-violet-500/15',
    border: 'border-rose-500/30',
    badgeText: 'text-rose-300',
    iconText: 'text-rose-400',
  },
  amber: {
    primary: '#F59E0B',
    secondary: '#38BDF8',
    glow: 'from-amber-500/20 via-orange-500/10 to-sky-500/15',
    border: 'border-amber-500/30',
    badgeText: 'text-amber-300',
    iconText: 'text-amber-400',
  },
};

const SIZE_PX: Record<QuantOrbitalSize, { box: string; icon: string; core: string }> = {
  sm: { box: 'w-14 h-14', icon: 'w-4 h-4', core: 'w-7 h-7' },
  md: { box: 'w-20 h-20', icon: 'w-5 h-5', core: 'w-10 h-10' },
  lg: { box: 'w-28 h-28', icon: 'w-6 h-6', core: 'w-12 h-12' },
};

/**
 * Centered rotating orbital loader styled in the MarketSim dark obsidian,
 * cyan and violet visual system with deliberate, serene rotation speeds.
 */
export const QuantOrbitalLoader: React.FC<QuantOrbitalLoaderProps> = ({
  title,
  subtitle,
  badge,
  tone = 'cyan',
  size = 'lg',
  icon: Icon = TrendingUp,
  className = '',
}) => {
  const prefersReduced = useReducedMotion();
  const palette = TONE_COLORS[tone];
  const dims = SIZE_PX[size];
  const gradId = `orbital-grad-${tone}-${size}`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, ease: EASE_INSTITUTIONAL }}
      className={`flex flex-col items-center justify-center text-center select-none ${className}`}
    >
      <div className={`relative flex items-center justify-center ${dims.box}`}>
        {/* Ambient radial halo */}
        <div
          aria-hidden="true"
          className={`absolute -inset-4 rounded-full bg-gradient-to-tr ${palette.glow} blur-2xl opacity-75`}
        />

        {/* Ring 1: Slow outer precision telemetry ticks */}
        <motion.svg
          viewBox="0 0 120 120"
          className="absolute inset-0 w-full h-full"
          animate={prefersReduced ? undefined : { rotate: 360 }}
          transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
        >
          <circle
            cx="60"
            cy="60"
            r="56"
            fill="none"
            stroke="rgba(148, 163, 184, 0.2)"
            strokeWidth="1.2"
            strokeDasharray="2 7"
          />
        </motion.svg>

        {/* Ring 2: Main sweeping gradient arc + orbital node */}
        <motion.svg
          viewBox="0 0 120 120"
          className="absolute inset-0 w-full h-full"
          animate={prefersReduced ? undefined : { rotate: 360 }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={palette.primary} stopOpacity="1" />
              <stop offset="65%" stopColor={palette.secondary} stopOpacity="0.85" />
              <stop offset="100%" stopColor={palette.primary} stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle
            cx="60"
            cy="60"
            r="46"
            fill="none"
            stroke="rgba(148, 163, 184, 0.08)"
            strokeWidth="2.5"
          />
          <circle
            cx="60"
            cy="60"
            r="46"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeDasharray="115 175"
          />
          {/* Leading orbital pulse node */}
          <circle cx="60" cy="14" r="3.2" fill={palette.primary} />
        </motion.svg>

        {/* Ring 3: Counter-rotating inner secondary arc */}
        <motion.svg
          viewBox="0 0 120 120"
          className="absolute inset-0 w-full h-full"
          animate={prefersReduced ? undefined : { rotate: -360 }}
          transition={{ duration: 3.8, repeat: Infinity, ease: 'linear' }}
        >
          <circle
            cx="60"
            cy="60"
            r="35"
            fill="none"
            stroke={palette.secondary}
            strokeOpacity="0.55"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="52 168"
          />
        </motion.svg>

        {/* Center Institutional Glass Core */}
        <div
          className={`relative z-10 ${dims.core} rounded-2xl bg-[#0B1220]/95 border ${palette.border} flex items-center justify-center shadow-[0_0_28px_-6px_rgba(56,189,248,0.35)]`}
        >
          <Icon className={`${dims.icon} ${palette.iconText}`} />
        </div>
      </div>

      {(badge || title || subtitle) && (
        <div className="mt-5 space-y-1.5 max-w-xs px-4">
          {badge && (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#101A2B]/90 border ${palette.border} text-[10px] font-mono font-semibold uppercase tracking-widest ${palette.badgeText}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              <span>{badge}</span>
            </div>
          )}
          {title && (
            <p className="text-sm sm:text-base font-semibold text-white tracking-tight">
              {title}
            </p>
          )}
          {subtitle && (
            <p className="text-xs text-slate-400 leading-relaxed">{subtitle}</p>
          )}
        </div>
      )}
    </motion.div>
  );
};
