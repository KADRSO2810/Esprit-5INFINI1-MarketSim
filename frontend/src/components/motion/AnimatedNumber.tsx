import React, { useEffect, useState } from 'react';
import { useMotionValue, useReducedMotion, useSpring } from 'framer-motion';

interface AnimatedNumberProps {
  value: number | null | undefined;
  format?: (val: number) => string;
  fallback?: string;
  className?: string;
}

const defaultFormat = (val: number) =>
  val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Smoothly interpolates numeric financial metrics using Framer Motion springs
 * while snapping immediately when prefers-reduced-motion is enabled.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  format = defaultFormat,
  fallback = '—',
  className = '',
}) => {
  const prefersReduced = useReducedMotion();
  const isValid = value !== null && value !== undefined && Number.isFinite(value);
  const initialVal = isValid ? value : 0;

  const motionVal = useMotionValue(initialVal);
  const springVal = useSpring(motionVal, {
    stiffness: 170,
    damping: 26,
    mass: 0.7,
  });

  const [display, setDisplay] = useState<number>(initialVal);

  useEffect(() => {
    if (!isValid) return;
    if (prefersReduced) {
      motionVal.jump(value);
      setDisplay(value);
      return;
    }
    motionVal.set(value);
  }, [value, isValid, prefersReduced, motionVal]);

  useEffect(() => {
    if (prefersReduced) return;
    const unsubscribe = springVal.on('change', (latest) => {
      setDisplay(latest);
    });
    return unsubscribe;
  }, [springVal, prefersReduced]);

  if (!isValid) {
    return <span className={`tabular-nums ${className}`}>{fallback}</span>;
  }

  return <span className={`tabular-nums ${className}`}>{format(display)}</span>;
};
