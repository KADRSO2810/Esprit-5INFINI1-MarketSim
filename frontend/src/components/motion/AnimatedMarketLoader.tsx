import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Activity, BarChart3, Cpu } from 'lucide-react';
import { AnimatedCandlestickBackground } from '../auth/AnimatedCandlestickBackground';
import { EASE_INSTITUTIONAL } from './presets';

export type MarketLoaderMode = 'candlestick' | 'quant' | 'ai';
export type MarketLoaderVariant = 'minimal' | 'compact' | 'centerpiece' | 'fullscreen' | 'inline';

interface AnimatedMarketLoaderProps {
  mode?: MarketLoaderMode;
  variant?: MarketLoaderVariant;
  title?: string;
  subtitle?: string;
  badge?: string;
  className?: string;
}

const MODE_DEFAULTS: Record<
  MarketLoaderMode,
  {
    title: string;
    subtitle: string;
    badge: string;
    accentText: string;
    accentBorder: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  candlestick: {
    title: 'Synchronisation du terminal marché…',
    subtitle: 'Flux temps réel STOMP & carnet d’ordres',
    badge: 'MARKET STREAM',
    accentText: 'text-sky-300',
    accentBorder: 'border-sky-500/30',
    icon: Activity,
  },
  quant: {
    title: 'Moteur quantitatif en exécution…',
    subtitle: 'Calcul des séries historiques, croisements SMA & ratio de Sharpe',
    badge: 'QUANT ENGINE',
    accentText: 'text-sky-300',
    accentBorder: 'border-sky-500/30',
    icon: BarChart3,
  },
  ai: {
    title: 'Inférence IA & tenseurs explicables…',
    subtitle: 'Traitement FinBERT / Scikit-learn & décomposition SHAP',
    badge: 'NEURAL ENGINE',
    accentText: 'text-violet-300',
    accentBorder: 'border-violet-500/30',
    icon: Cpu,
  },
};

const QuantVisual: React.FC<{ compact?: boolean; reduced?: boolean | null }> = ({
  compact,
  reduced,
}) => (
  <svg
    viewBox="0 0 360 96"
    className={`w-full ${compact ? 'h-16' : 'h-24'} overflow-visible`}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="quantArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.28" />
        <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
      </linearGradient>
    </defs>
    {[24, 48, 72].map((y) => (
      <line
        key={y}
        x1="0"
        y1={y}
        x2="360"
        y2={y}
        stroke="rgba(148,163,184,0.1)"
        strokeDasharray="3 3"
      />
    ))}
    <path
      d="M 8 74 L 54 64 L 96 68 L 140 46 L 188 52 L 236 28 L 286 35 L 348 16 L 348 92 L 8 92 Z"
      fill="url(#quantArea)"
    />
    {/* Slow SMA guide */}
    <motion.path
      d="M 8 76 Q 115 62 205 46 T 348 24"
      fill="none"
      stroke="#8B5CF6"
      strokeWidth="1.6"
      strokeDasharray="4 4"
      initial={reduced ? false : { pathLength: 0.2, opacity: 0.5 }}
      animate={reduced ? undefined : { pathLength: [0.2, 1, 0.2], opacity: [0.45, 0.9, 0.45] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
    />
    {/* Primary equity draw */}
    <motion.path
      d="M 8 74 L 54 64 L 96 68 L 140 46 L 188 52 L 236 28 L 286 35 L 348 16"
      fill="none"
      stroke="#38BDF8"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={reduced ? false : { pathLength: 0 }}
      animate={reduced ? undefined : { pathLength: [0, 1] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: EASE_INSTITUTIONAL }}
    />
    {!reduced && (
      <motion.line
        y1="6"
        y2="88"
        stroke="rgba(56,189,248,0.45)"
        strokeWidth="1.2"
        strokeDasharray="2 2"
        animate={{ x1: [12, 344, 12], x2: [12, 344, 12] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />
    )}
  </svg>
);

const NeuralVisual: React.FC<{ compact?: boolean; reduced?: boolean | null }> = ({
  compact,
  reduced,
}) => {
  const nodes = [
    { cx: 36, cy: 26, c: '#38BDF8' },
    { cx: 36, cy: 70, c: '#38BDF8' },
    { cx: 132, cy: 18, c: '#8B5CF6' },
    { cx: 132, cy: 48, c: '#38BDF8' },
    { cx: 132, cy: 78, c: '#8B5CF6' },
    { cx: 228, cy: 30, c: '#8B5CF6' },
    { cx: 228, cy: 66, c: '#38BDF8' },
    { cx: 320, cy: 48, c: '#22C55E' },
  ];
  const edges = [
    [0, 2],
    [0, 3],
    [1, 3],
    [1, 4],
    [2, 5],
    [3, 5],
    [3, 6],
    [4, 6],
    [5, 7],
    [6, 7],
  ];

  return (
    <svg
      viewBox="0 0 360 96"
      className={`w-full ${compact ? 'h-16' : 'h-24'}`}
      aria-hidden="true"
    >
      {edges.map(([a, b], i) => (
        <motion.line
          key={`${a}-${b}`}
          x1={nodes[a].cx}
          y1={nodes[a].cy}
          x2={nodes[b].cx}
          y2={nodes[b].cy}
          stroke={i % 2 === 0 ? '#8B5CF6' : '#38BDF8'}
          strokeWidth="1.4"
          strokeOpacity={reduced ? 0.45 : undefined}
          animate={
            reduced
              ? undefined
              : {
                  strokeOpacity: [0.15, 0.75, 0.15],
                }
          }
          transition={{ duration: 1.8, delay: i * 0.12, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {nodes.map((n, idx) => (
        <g key={idx}>
          {!reduced && (
            <motion.circle
              cx={n.cx}
              cy={n.cy}
              r="7"
              fill={n.c}
              animate={{ opacity: [0.08, 0.28, 0.08], r: [5.5, 9, 5.5] }}
              transition={{ duration: 1.6, delay: idx * 0.14, repeat: Infinity }}
            />
          )}
          <circle cx={n.cx} cy={n.cy} r="3.8" fill={n.c} stroke="#070B14" strokeWidth="1.4" />
        </g>
      ))}
    </svg>
  );
};

export const AnimatedMarketLoader: React.FC<AnimatedMarketLoaderProps> = ({
  mode = 'candlestick',
  variant = 'centerpiece',
  title,
  subtitle,
  badge,
  className = '',
}) => {
  const prefersReduced = useReducedMotion();
  const cfg = MODE_DEFAULTS[mode];
  const Icon = cfg.icon;
  const resolvedTitle = title ?? cfg.title;
  const resolvedSubtitle = subtitle ?? cfg.subtitle;
  const resolvedBadge = badge ?? cfg.badge;

  if (variant === 'minimal') {
    return (
      <div
        className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#0B1220]/90 border ${cfg.accentBorder} text-xs font-mono ${className}`}
      >
        <span className="relative flex h-2.5 w-2.5">
          {!prefersReduced && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-60" />
          )}
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-400" />
        </span>
        <span className="text-slate-200 font-medium">{resolvedTitle}</span>
      </div>
    );
  }

  const isCompact = variant === 'compact' || variant === 'inline';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE_INSTITUTIONAL }}
      className={`workstation-panel-elevated rounded-2xl overflow-hidden relative ${
        variant === 'fullscreen' ? 'w-full max-w-2xl' : 'w-full'
      } ${className}`}
    >
      {/* Top indeterminate neural/market sweep */}
      <div className="h-[2px] w-full bg-[#142035] overflow-hidden">
        <div
          className={`h-full w-1/3 rounded-full animate-ai-sweep ${
            mode === 'ai'
              ? 'bg-gradient-to-r from-transparent via-violet-400 to-sky-400'
              : 'bg-gradient-to-r from-transparent via-sky-400 to-emerald-400'
          }`}
        />
      </div>

      <div className={isCompact ? 'p-4 space-y-3' : 'p-5 sm:p-6 space-y-4'}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl bg-[#070B14] border ${cfg.accentBorder} flex items-center justify-center shrink-0`}
            >
              <Icon className={`w-4 h-4 ${cfg.accentText}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-white truncate">
                {resolvedTitle}
              </p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">{resolvedSubtitle}</p>
            </div>
          </div>

          <span
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#070B14] border ${cfg.accentBorder} text-[10px] font-mono font-semibold ${cfg.accentText} shrink-0`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {resolvedBadge}
          </span>
        </div>

        <div className="relative rounded-xl bg-[#070B14]/85 border border-subtle overflow-hidden px-3 py-2">
          {mode === 'candlestick' ? (
            <div className={isCompact ? 'h-20 relative' : 'h-36 relative'}>
              <AnimatedCandlestickBackground variant={isCompact ? 'ambient' : 'centerpiece'} />
            </div>
          ) : mode === 'quant' ? (
            <QuantVisual compact={isCompact} reduced={prefersReduced} />
          ) : (
            <NeuralVisual compact={isCompact} reduced={prefersReduced} />
          )}
        </div>
      </div>
    </motion.div>
  );
};
