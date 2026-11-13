import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, Brain, CheckCircle2, Lock, Radio, ShieldCheck, TrendingUp } from 'lucide-react';
import { AnimatedCandlestickBackground } from './AnimatedCandlestickBackground';
import { OrbitalSpinner } from '../ui/Loaders';

const LOADING_MESSAGES = [
  'Establishing secure trading session...',
  'Synchronizing market intelligence...',
  'Loading financial analytics...',
  'Preparing AI risk intelligence...',
  'Initializing market terminal...',
];

const SUBSYSTEMS = [
  { label: 'JWT Auth Session', icon: Lock, delay: 0 },
  { label: 'STOMP Live Feed', icon: Radio, delay: 22 },
  { label: 'VaR & Risk Engine', icon: ShieldCheck, delay: 48 },
  { label: 'FinBERT & SHAP AI', icon: Brain, delay: 72 },
];

interface MarketLoadingScreenProps {
  isOpen: boolean;
  progress: number;
  dashboardReady: boolean;
}

export const MarketLoadingScreen: React.FC<MarketLoadingScreenProps> = ({
  isOpen,
  progress,
  dashboardReady,
}) => {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setMsgIdx(0);
      return;
    }
    const timer = setInterval(() => {
      setMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 480);
    return () => clearInterval(timer);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="market-loading-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[90] bg-[#050811] flex flex-col items-center justify-center px-4 sm:px-6 overflow-hidden"
        >
          {/* Ambient radial glow */}
          <div className="pointer-events-none absolute -top-36 left-1/4 w-[520px] h-[520px] bg-sky-500/12 rounded-full blur-[140px]" />
          <div className="pointer-events-none absolute -bottom-36 right-1/4 w-[480px] h-[480px] bg-violet-500/12 rounded-full blur-[140px]" />

          {/* Main Terminal Visualization Container */}
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-4xl workstation-panel-elevated rounded-2xl overflow-hidden shadow-[0_28px_90px_-15px_rgba(0,0,0,0.9)]"
          >
            {/* Top Terminal Chrome Bar */}
            <div className="px-5 py-3.5 border-b border-subtle bg-[#070B14]/90 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-sky-500/30 flex items-center justify-center shadow-glow-cyan">
                  <TrendingUp className="w-4 h-4 text-sky-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white tracking-tight">
                      MarketSim Quant Terminal
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/25">
                      LIVE ROOM
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-slate-400">
                    SESSION INITIALIZATION · INSTITUTIONAL WORKSPACE
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 text-[11px] font-mono tabular-nums">
                <OrbitalSpinner size="sm" tone="cyan" />
                <span className="text-sky-300 font-semibold">{Math.round(progress)}%</span>
              </div>
            </div>

            {/* Visual Centerpiece: Animated Candlestick Terminal Chart */}
            <div className="relative h-64 sm:h-72 bg-[#070B14]/85 border-b border-subtle overflow-hidden">
              <AnimatedCandlestickBackground variant="centerpiece" />

              {/* Overlay HUD Legend */}
              <div className="pointer-events-none absolute top-3 left-4 right-4 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#0B1220]/85 border border-subtle backdrop-blur-sm">
                  <Activity className="w-3 h-3 text-emerald-400" />
                  <span className="text-slate-200 font-semibold">MARKET MATRIX</span>
                  <span className="text-sky-400">EMA12</span>
                  <span className="text-violet-400">EMA26</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0B1220]/85 border border-subtle text-slate-300 backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{dashboardReady ? 'FLUX SYNCHRONISÉ' : 'CONNEXION STOMP…'}</span>
                </div>
              </div>
            </div>

            {/* Bottom Telemetry Progress & Subsystem Checks */}
            <div className="p-5 sm:p-6 bg-[#0B1220]/90 space-y-4">
              {/* Rotating Loading Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-h-[28px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={LOADING_MESSAGES[msgIdx]}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.22 }}
                    className="flex items-center gap-2 text-xs sm:text-sm font-medium text-white"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    <span>{LOADING_MESSAGES[msgIdx]}</span>
                  </motion.div>
                </AnimatePresence>

                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  Préparation de votre salle de marché…
                </span>
              </div>

              {/* Sleek Linear Progress Bar */}
              <div className="h-1.5 w-full rounded-full bg-[#070B14] border border-subtle overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-violet-400 shadow-[0_0_12px_rgba(56,189,248,0.6)]"
                  initial={{ width: '4%' }}
                  animate={{ width: `${Math.min(100, Math.max(6, progress))}%` }}
                  transition={{ ease: 'easeOut', duration: 0.25 }}
                />
              </div>

              {/* Subsystem Readiness Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {SUBSYSTEMS.map((sub) => {
                  const Icon = sub.icon;
                  const ready = progress >= sub.delay + 18 || (dashboardReady && progress >= 60);
                  return (
                    <div
                      key={sub.label}
                      className={`px-3 py-2 rounded-xl border text-[11px] font-mono flex items-center justify-between gap-2 transition-colors ${
                        ready
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-[#070B14]/70 border-subtle text-slate-400'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{sub.label}</span>
                      </span>
                      {ready ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <OrbitalSpinner size="xs" tone="cyan" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
