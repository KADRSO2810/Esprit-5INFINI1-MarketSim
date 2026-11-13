import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AnimatedMarketLoader,
  MarketLoaderMode,
} from './AnimatedMarketLoader';
import { EASE_INSTITUTIONAL } from './presets';

export type OverlayScope = 'fullscreen' | 'section' | 'modal' | 'inline';

interface MarketLoadingOverlayProps {
  isOpen: boolean;
  scope?: OverlayScope;
  mode?: MarketLoaderMode;
  title?: string;
  subtitle?: string;
  badge?: string;
  className?: string;
}

export const MarketLoadingOverlay: React.FC<MarketLoadingOverlayProps> = ({
  isOpen,
  scope = 'section',
  mode = 'candlestick',
  title,
  subtitle,
  badge,
  className = '',
}) => {
  if (scope === 'inline') {
    return (
      <AnimatePresence>
        {isOpen && (
          <AnimatedMarketLoader
            mode={mode}
            variant="inline"
            title={title}
            subtitle={subtitle}
            badge={badge}
            className={className}
          />
        )}
      </AnimatePresence>
    );
  }

  const containerClass =
    scope === 'fullscreen'
      ? 'fixed inset-0 z-[85] bg-[#050811]/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6'
      : scope === 'modal'
        ? 'absolute inset-0 z-30 bg-[#050811]/82 backdrop-blur-sm flex items-center justify-center p-4 rounded-2xl'
        : 'relative w-full py-6 flex items-center justify-center';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: EASE_INSTITUTIONAL }}
          className={`${containerClass} ${className}`}
        >
          <AnimatedMarketLoader
            mode={mode}
            variant={scope === 'fullscreen' ? 'fullscreen' : 'centerpiece'}
            title={title}
            subtitle={subtitle}
            badge={badge}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
