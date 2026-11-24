import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';

export type GlowTheme = 'trading' | 'actuary' | 'bank' | 'vip' | 'neutral' | 'bullish' | 'bearish';

interface FinancialGlowCardProps {
  children: React.ReactNode;
  theme?: GlowTheme;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
  animatedBorder?: boolean;
}

const THEME_STYLES: Record<GlowTheme, { border: string; glow: string; spotlight: string }> = {
  trading: {
    border: 'border-sky-500/30 hover:border-sky-400/60',
    glow: 'hover:shadow-[0_0_24px_-4px_rgba(56,189,248,0.3)]',
    spotlight: 'rgba(56, 189, 248, 0.12)',
  },
  actuary: {
    border: 'border-purple-500/35 hover:border-purple-400/70',
    glow: 'hover:shadow-[0_0_28px_-4px_rgba(168,85,247,0.35)]',
    spotlight: 'rgba(168, 85, 247, 0.14)',
  },
  bank: {
    border: 'border-cyan-500/30 hover:border-cyan-400/60',
    glow: 'hover:shadow-[0_0_24px_-4px_rgba(6,182,212,0.3)]',
    spotlight: 'rgba(6, 182, 212, 0.12)',
  },
  vip: {
    border: 'border-amber-500/35 hover:border-amber-400/70',
    glow: 'hover:shadow-[0_0_28px_-4px_rgba(245,158,11,0.35)]',
    spotlight: 'rgba(245, 158, 11, 0.14)',
  },
  bullish: {
    border: 'border-emerald-500/35 hover:border-emerald-400/70',
    glow: 'hover:shadow-[0_0_24px_-4px_rgba(34,197,94,0.35)]',
    spotlight: 'rgba(34, 197, 94, 0.12)',
  },
  bearish: {
    border: 'border-rose-500/35 hover:border-rose-400/70',
    glow: 'hover:shadow-[0_0_24px_-4px_rgba(239,68,68,0.35)]',
    spotlight: 'rgba(239, 68, 68, 0.12)',
  },
  neutral: {
    border: 'border-slate-800 hover:border-slate-700',
    glow: 'hover:shadow-lg',
    spotlight: 'rgba(148, 163, 184, 0.08)',
  },
};

export const FinancialGlowCard: React.FC<FinancialGlowCardProps> = ({
  children,
  theme = 'trading',
  className = '',
  onClick,
  interactive = true,
  animatedBorder = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const themeStyle = THEME_STYLES[theme];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseLeave = () => {
    setMousePos(null);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      whileHover={interactive ? { y: -2, transition: { duration: 0.18 } } : undefined}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#101A2B] to-[#0B1220] p-5 transition-all duration-200 border shadow-panel ${
        themeStyle.border
      } ${themeStyle.glow} ${animatedBorder ? 'glow-border-animated' : ''} ${
        interactive ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {/* Dynamic Cursor Spotlight Radial Glow */}
      {interactive && mousePos && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-0"
          style={{
            background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, ${themeStyle.spotlight}, transparent 65%)`,
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};
