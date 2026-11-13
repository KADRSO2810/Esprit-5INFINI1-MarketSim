import type { Variants } from 'framer-motion';

export const EASE_INSTITUTIONAL = [0.22, 1, 0.36, 1] as const;
export const EASE_SNAPPY = [0.16, 1, 0.3, 1] as const;

export const SPRING_PILL = {
  type: 'spring' as const,
  stiffness: 440,
  damping: 34,
};

export const TIMING = {
  micro: 0.16,
  ui: 0.24,
  page: 0.36,
  auth: 0.72,
} as const;

export const pageRevealVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: TIMING.page,
      ease: EASE_INSTITUTIONAL,
    },
  },
};

export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.02,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.28,
      ease: EASE_INSTITUTIONAL,
    },
  },
};

export const modalBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.18, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.16, ease: 'easeIn' },
  },
};

export const modalPanelVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.24, ease: EASE_INSTITUTIONAL },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 8,
    transition: { duration: 0.16, ease: 'easeIn' },
  },
};
