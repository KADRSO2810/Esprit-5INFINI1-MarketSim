import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AnimatedNumber } from '../motion/AnimatedNumber';

type FlashDirection = 'up' | 'down' | null;

interface AnimatedPriceIndicatorProps {
  /** Numeric value to track and format. Non-finite values render fallback. */
  value: number | null | undefined;
  /** Optional custom formatter (defaults to USD currency). */
  formatValue?: (val: number) => string;
  /** Fallback text when value is null/undefined/NaN. */
  fallback?: string;
  /** Optional base text color class (e.g. "text-white", "text-emerald-400"). */
  className?: string;
  /** Show subtle directional chevron briefly on tick changes. */
  showTrendBadge?: boolean;
}

const defaultCurrencyFormat = (val: number) =>
  val.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Displays live financial prices or KPIs in tabular-nums with a smooth transient
 * emerald/rose glow highlight whenever the value ticks up or down.
 */
export const AnimatedPriceIndicator: React.FC<AnimatedPriceIndicatorProps> = ({
  value,
  formatValue = defaultCurrencyFormat,
  fallback = '—',
  className = 'text-white',
  showTrendBadge = false,
}) => {
  const prevRef = useRef<number | null>(null);
  const [flash, setFlash] = useState<FlashDirection>(null);

  useEffect(() => {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return;
    }

    const prev = prevRef.current;
    prevRef.current = value;

    if (prev === null || Math.abs(value - prev) < 1e-9) {
      return;
    }

    setFlash(value > prev ? 'up' : 'down');
    const timer = window.setTimeout(() => setFlash(null), 700);
    return () => window.clearTimeout(timer);
  }, [value]);

  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className={`tabular-nums ${className}`}>{fallback}</span>;
  }

  const flashClass =
    flash === 'up'
      ? 'text-emerald-300 drop-shadow-[0_0_10px_rgba(16,185,129,0.55)]'
      : flash === 'down'
        ? 'text-rose-300 drop-shadow-[0_0_10px_rgba(244,63,94,0.55)]'
        : className;

  return (
    <motion.span
      key={flash ? `flash-${flash}` : 'steady'}
      initial={flash ? { scale: 1.02 } : false}
      animate={{ scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={`inline-flex items-center gap-1.5 tabular-nums transition-colors duration-500 ${flashClass}`}
    >
      <AnimatedNumber value={value} format={formatValue} fallback={fallback} />
      {showTrendBadge && flash && (
        <span
          aria-hidden="true"
          className={`text-[10px] font-bold leading-none ${
            flash === 'up' ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {flash === 'up' ? '▲' : '▼'}
        </span>
      )}
    </motion.span>
  );
};
