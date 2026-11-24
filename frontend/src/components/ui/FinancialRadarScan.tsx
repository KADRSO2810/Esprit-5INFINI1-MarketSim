import React from 'react';
import { motion } from 'framer-motion';

interface FinancialRadarScanProps {
  label?: string;
  detectedCount?: number;
  tone?: 'cyan' | 'purple' | 'amber' | 'emerald';
  size?: 'sm' | 'md' | 'lg';
}

const TONE_COLORS = {
  cyan: {
    ring: 'border-cyan-500/30',
    ping: 'bg-cyan-400',
    text: 'text-cyan-300',
    beam: 'rgba(56, 189, 248, 0.35)',
  },
  purple: {
    ring: 'border-purple-500/30',
    ping: 'bg-purple-400',
    text: 'text-purple-300',
    beam: 'rgba(168, 85, 247, 0.35)',
  },
  amber: {
    ring: 'border-amber-500/30',
    ping: 'bg-amber-400',
    text: 'text-amber-300',
    beam: 'rgba(245, 158, 11, 0.35)',
  },
  emerald: {
    ring: 'border-emerald-500/30',
    ping: 'bg-emerald-400',
    text: 'text-emerald-300',
    beam: 'rgba(34, 197, 94, 0.35)',
  },
};

const SIZES = {
  sm: 'w-20 h-20',
  md: 'w-28 h-28',
  lg: 'w-36 h-36',
};

export const FinancialRadarScan: React.FC<FinancialRadarScanProps> = ({
  label = 'Radar Marché',
  detectedCount = 5,
  tone = 'cyan',
  size = 'md',
}) => {
  const currentTone = TONE_COLORS[tone];
  const currentSize = SIZES[size];

  return (
    <div className="flex flex-col items-center justify-center gap-2 select-none">
      {/* Radar Container */}
      <div
        className={`relative ${currentSize} rounded-full border ${currentTone.ring} bg-[#070B14]/80 flex items-center justify-center overflow-hidden shadow-inner`}
      >
        {/* Concentric rings */}
        <div className={`absolute w-3/4 h-3/4 rounded-full border ${currentTone.ring}`} />
        <div className={`absolute w-1/2 h-1/2 rounded-full border ${currentTone.ring}`} />
        <div className={`absolute w-1/4 h-1/4 rounded-full border ${currentTone.ring}`} />

        {/* Crosshairs */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-slate-800" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-slate-800" />

        {/* Rotating Radar Sweep Cone */}
        <div
          className="absolute inset-0 rounded-full radar-sweep-cone"
          style={{
            background: `conic-gradient(from 0deg, transparent 0deg, ${currentTone.beam} 60deg, transparent 90deg)`,
          }}
        />

        {/* Detected Signal Blips */}
        <motion.div
          animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
          className={`absolute top-1/3 right-1/4 w-2 h-2 rounded-full ${currentTone.ping} shadow-[0_0_8px_currentColor]`}
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.9, 0.4] }}
          transition={{ repeat: Infinity, duration: 2.2, delay: 0.6 }}
          className={`absolute bottom-1/4 left-1/3 w-1.5 h-1.5 rounded-full ${currentTone.ping} shadow-[0_0_6px_currentColor]`}
        />

        {/* Center Pivot Point */}
        <div className={`relative z-10 w-2.5 h-2.5 rounded-full ${currentTone.ping} ring-2 ring-slate-900 shadow-glow-cyan`} />
      </div>

      {/* Label & Telemetry */}
      {label && (
        <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${currentTone.ping} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${currentTone.ping}`} />
          </span>
          <span className="text-slate-300">{label}</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#142035] ${currentTone.text} border border-slate-700`}>
            {detectedCount} actifs
          </span>
        </div>
      )}
    </div>
  );
};
