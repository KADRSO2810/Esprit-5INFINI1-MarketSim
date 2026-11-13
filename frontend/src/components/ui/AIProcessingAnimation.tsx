import React from 'react';
import { motion } from 'framer-motion';
import { Cpu } from 'lucide-react';

interface AIProcessingAnimationProps {
  title?: string;
  subtitle?: string;
  accent?: 'violet' | 'cyan';
  compact?: boolean;
  className?: string;
}

/**
 * Futuristic neural-ring AI processing indicator used during FinBERT sentiment scoring,
 * ML inference, SHAP explanations, and stress-testing runs.
 */
export const AIProcessingAnimation: React.FC<AIProcessingAnimationProps> = ({
  title = 'Intelligence Artificielle en cours...',
  subtitle = 'Inférence & calcul des tenseurs quantitatifs',
  accent = 'violet',
  compact = false,
  className = '',
}) => {
  const isViolet = accent === 'violet';
  const borderClass = isViolet ? 'border-violet-500/30' : 'border-cyan-500/30';
  const bgClass = isViolet
    ? 'from-violet-950/50 via-[#0E1629]/95 to-cyan-950/30'
    : 'from-cyan-950/50 via-[#0E1629]/95 to-blue-950/30';
  const iconColor = isViolet ? 'text-violet-300' : 'text-cyan-300';
  const ringPrimary = isViolet ? '#8B5CF6' : '#06B6D4';
  const ringSecondary = isViolet ? '#06B6D4' : '#3B82F6';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25 }}
      className={`relative overflow-hidden rounded-xl border ${borderClass} bg-gradient-to-r ${bgClass} ${
        compact ? 'px-3.5 py-2.5' : 'px-4 py-3.5'
      } shadow-lg ${className}`}
    >
      {/* Top animated neural sweep */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[1.5px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${ringPrimary}, ${ringSecondary}, transparent)`,
        }}
        animate={{ x: ['-60%', '60%'] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 flex items-center gap-3.5">
        {/* Dual counter-rotating orbital neural rings */}
        <div
          className={`relative flex shrink-0 items-center justify-center ${
            compact ? 'h-9 w-9' : 'h-11 w-11'
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute inset-0 rounded-full blur-md ${
              isViolet ? 'bg-violet-500/25' : 'bg-cyan-500/25'
            }`}
          />
          <motion.svg
            viewBox="0 0 44 44"
            className="h-full w-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'linear' }}
          >
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              stroke={ringPrimary}
              strokeOpacity="0.22"
              strokeWidth="2"
            />
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              stroke={ringPrimary}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeDasharray="34 80"
            />
          </motion.svg>
          <motion.svg
            viewBox="0 0 44 44"
            className="absolute inset-0 h-full w-full"
            animate={{ rotate: -360 }}
            transition={{ duration: 2.3, repeat: Infinity, ease: 'linear' }}
          >
            <circle
              cx="22"
              cy="22"
              r="12"
              fill="none"
              stroke={ringSecondary}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeDasharray="20 56"
            />
          </motion.svg>
          <Cpu className={`absolute ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} ${iconColor}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs sm:text-sm font-semibold text-slate-100">
              {title}
            </span>
            <span
              className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                isViolet
                  ? 'bg-violet-500/15 text-violet-300 border border-violet-500/25'
                  : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              Neural Active
            </span>
          </div>
          {subtitle && (
            <p className="mt-0.5 truncate text-[11px] text-slate-400">{subtitle}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};
