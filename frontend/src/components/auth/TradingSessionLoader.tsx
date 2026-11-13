import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { QuantOrbitalLoader } from '../motion/QuantOrbitalLoader';
export { MarketLoadingScreen } from './MarketLoadingScreen';

interface TradingSessionLoaderProps {
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

/**
 * Compact embeddable terminal session loader card (e.g. for route hydration / ProtectedRoute).
 * Uses the rotating QuantOrbitalLoader in the MarketSim obsidian/cyan/violet theme.
 */
export const TradingSessionLoader: React.FC<TradingSessionLoaderProps> = ({
  title = 'Market Simulator Terminal',
  subtitle = 'Vérification de la session sécurisée JWT...',
  compact = false,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.3, 1] }}
      className={`workstation-panel-elevated relative flex flex-col items-center justify-center rounded-2xl shadow-2xl ${
        compact ? 'px-6 py-6 gap-3' : 'px-8 py-8 gap-4'
      }`}
    >
      <QuantOrbitalLoader
        size={compact ? 'sm' : 'md'}
        tone="cyan"
        title={title}
        subtitle={subtitle}
      />

      <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-cyan-300">
        <ShieldCheck className="w-3 h-3 text-cyan-400" />
        <span>Chiffrement TLS · JWT</span>
      </div>
    </motion.div>
  );
};
