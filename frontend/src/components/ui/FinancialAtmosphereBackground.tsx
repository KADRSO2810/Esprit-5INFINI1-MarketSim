import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface FloatingGlyph {
  id: number;
  symbol: string;
  x: number;
  duration: number;
  delay: number;
  size: number;
  opacity: number;
  color: string;
}

const GLYPHS = ['$', '€', '₿', '📈', '🛡️', '⚡', '%', '🏛️', '¥', '£'];

export const FinancialAtmosphereBackground: React.FC = () => {
  // Generate deterministic floating glyphs
  const glyphs = useMemo<FloatingGlyph[]>(() => {
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      symbol: GLYPHS[i % GLYPHS.length],
      x: 4 + (i * 5.3) % 92, // distributed horizontally across screen
      duration: 16 + (i * 2.7) % 18, // 16s to 34s gentle drift
      delay: (i * 1.5) % 12,
      size: 14 + (i % 4) * 5, // 14px to 29px
      opacity: 0.05 + ((i % 5) * 0.02), // subtle 0.05 to 0.13
      color:
        i % 4 === 0
          ? 'text-sky-400'
          : i % 4 === 1
          ? 'text-emerald-400'
          : i % 4 === 2
          ? 'text-purple-400'
          : 'text-amber-400',
    }));
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden z-0 select-none"
    >
      {/* Dynamic Ambient Gradient Halos */}
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-gradient-to-br from-sky-500/10 via-cyan-500/5 to-transparent blur-3xl animate-pulse" />
      <div className="absolute top-1/3 -right-40 w-[30rem] h-[30rem] rounded-full bg-gradient-to-bl from-purple-600/10 via-violet-500/5 to-transparent blur-3xl" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 rounded-full bg-gradient-to-t from-emerald-500/5 via-teal-500/5 to-transparent blur-3xl" />

      {/* Subtle Financial Grid Texture with glowing points */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Floating Gentle Financial Glyphs */}
      {glyphs.map((g) => (
        <motion.div
          key={g.id}
          initial={{ y: '105vh', opacity: 0 }}
          animate={{
            y: '-10vh',
            opacity: [0, g.opacity, g.opacity, 0],
          }}
          transition={{
            duration: g.duration,
            delay: g.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{
            position: 'absolute',
            left: `${g.x}%`,
            fontSize: `${g.size}px`,
          }}
          className={`font-mono font-bold ${g.color} filter drop-shadow-[0_0_8px_rgba(56,189,248,0.25)]`}
        >
          {g.symbol}
        </motion.div>
      ))}
    </div>
  );
};
