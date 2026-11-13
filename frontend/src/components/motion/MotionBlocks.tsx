import React from 'react';
import { motion } from 'framer-motion';
import {
  EASE_INSTITUTIONAL,
  pageRevealVariants,
  staggerItemVariants,
} from './presets';

export const MotionReveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay, ease: EASE_INSTITUTIONAL }}
    className={className}
  >
    {children}
  </motion.div>
);

export const MotionCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ children, className = '', onClick }) => (
  <motion.div
    variants={staggerItemVariants}
    onClick={onClick}
    className={`workstation-panel card-interactive rounded-xl ${className}`}
  >
    {children}
  </motion.div>
);

export const MotionPageShell: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <motion.div
    variants={pageRevealVariants}
    initial="hidden"
    animate="visible"
    className={className}
  >
    {children}
  </motion.div>
);
