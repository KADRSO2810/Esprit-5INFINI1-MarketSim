import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE_INSTITUTIONAL } from '../motion/presets';

export const PageTransition: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReduced ? 0.14 : 0.34, ease: EASE_INSTITUTIONAL }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const PremiumPageTransition = PageTransition;
