import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trophy, ShieldCheck, ArrowUpRight } from 'lucide-react';

interface TradeCelebrationFXProps {
  show: boolean;
  message?: string;
  amount?: number;
  type?: 'PROFIT' | 'TAKE_PROFIT' | 'SOLVENCY' | 'VICTORY';
  onComplete?: () => void;
}

export const TradeCelebrationFX: React.FC<TradeCelebrationFXProps> = ({
  show,
  message = 'Take-Profit Atteint !',
  amount,
  type = 'PROFIT',
  onComplete,
}) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ type: 'spring', stiffness: 450, damping: 28 }}
          onAnimationComplete={() => {
            if (onComplete) {
              const timer = setTimeout(onComplete, 2500);
              return () => clearTimeout(timer);
            }
          }}
          className="fixed bottom-8 right-8 z-50 pointer-events-none select-none"
        >
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/60 bg-gradient-to-r from-emerald-950/90 via-[#0B1220] to-emerald-950/90 p-4 shadow-[0_0_35px_rgba(34,197,94,0.45)] backdrop-blur-md flex items-center gap-3.5">
            {/* Glowing Icon */}
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shadow-inner">
              {type === 'VICTORY' ? (
                <Trophy className="w-6 h-6 text-amber-400" />
              ) : type === 'SOLVENCY' ? (
                <ShieldCheck className="w-6 h-6 text-purple-400" />
              ) : (
                <ArrowUpRight className="w-6 h-6 text-emerald-400" />
              )}
            </div>

            {/* Notification Text */}
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                <Sparkles className="w-3 h-3 text-emerald-400 animate-spin" />
                <span>EXÉCUTION GAGNANTE</span>
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">{message}</h4>
              {amount != null && (
                <div className="text-base font-mono font-black text-emerald-400 mt-0.5">
                  +{amount > 0 ? '$' : ''}
                  {amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
            </div>

            {/* Background radiant ripple */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0.6 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.4, ease: 'easeOut' }}
              className="absolute -inset-2 rounded-2xl border-2 border-emerald-400/40 pointer-events-none"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
