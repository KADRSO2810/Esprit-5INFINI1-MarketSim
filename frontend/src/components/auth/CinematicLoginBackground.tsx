import React from 'react';
import { motion } from 'framer-motion';
import { AnimatedCandlestickBackground } from './AnimatedCandlestickBackground';

const FLOATING_BADGES = [
  { label: 'BTC/USDT', delta: '+2.41%', up: true, pos: 'top-10 left-8' },
  { label: 'SHAP XAI', delta: 'READY', up: true, pos: 'bottom-12 left-10' },
  { label: 'FinBERT NLP', delta: '0.94 CONF', up: true, pos: 'top-12 right-10' },
];

export const CinematicLoginBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none select-none z-0 bg-[#050811]">
      {/* Architectural perspective grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #94A3B8 1px, transparent 1px), linear-gradient(to bottom, #94A3B8 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />

      {/* Atmospheric cyan, blue & violet blooms */}
      <div className="absolute -top-48 left-[15%] w-[620px] h-[620px] bg-sky-500/[0.11] rounded-full blur-[130px]" />
      <div className="absolute -bottom-48 right-[15%] w-[560px] h-[560px] bg-violet-500/[0.11] rounded-full blur-[130px]" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[520px] h-[300px] bg-blue-600/[0.08] rounded-full blur-[110px]" />

      {/* Live Animated Financial Candlestick Layer */}
      <div className="absolute inset-0 opacity-90">
        <AnimatedCandlestickBackground variant="ambient" />
      </div>

      {/* Deep radial vignette protecting form contrast */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 60% 50%, rgba(5,8,17,0.28) 0%, rgba(5,8,17,0.72) 65%, rgba(5,8,17,0.92) 100%)',
        }}
      />

      {/* Subtle floating market telemetry chips on XL screens */}
      <div className="hidden xl:block">
        {FLOATING_BADGES.map((badge, idx) => (
          <motion.div
            key={badge.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{
              opacity: [0.42, 0.72, 0.42],
              y: [0, -6, 0],
            }}
            transition={{
              duration: 5.5 + idx * 1.1,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className={`absolute ${badge.pos} px-2.5 py-1.5 rounded-lg bg-[#0B1220]/70 border border-subtle backdrop-blur-md flex items-center gap-2 text-[10px] font-mono`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-slate-300 font-semibold">{badge.label}</span>
            <span className={badge.up ? 'text-emerald-400' : 'text-rose-400'}>
              {badge.delta}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
