import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

interface AuthenticationSuccessAnimationProps {
  email?: string;
}

export const AuthenticationSuccessAnimation: React.FC<AuthenticationSuccessAnimationProps> = ({
  email,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="py-8 px-4 flex flex-col items-center justify-center text-center relative"
    >
      {/* Subtle radial cyan/emerald bloom */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1.4, opacity: 0.25 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="w-40 h-40 rounded-full bg-gradient-to-tr from-sky-500/40 to-emerald-400/40 blur-2xl"
        />
      </div>

      {/* Concentric Cyan Energy Pulse + Checkmark */}
      <div className="relative w-20 h-20 flex items-center justify-center mb-5">
        <motion.span
          initial={{ scale: 0.7, opacity: 0.85 }}
          animate={{ scale: 1.75, opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut', repeat: Infinity, repeatDelay: 0.25 }}
          className="absolute inset-0 rounded-full border border-sky-400/50"
        />
        <motion.span
          initial={{ scale: 0.8, opacity: 0.7 }}
          animate={{ scale: 1.4, opacity: 0 }}
          transition={{ duration: 0.85, ease: 'easeOut', delay: 0.15, repeat: Infinity, repeatDelay: 0.25 }}
          className="absolute inset-0 rounded-full border border-emerald-400/50"
        />

        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          className="relative w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500/20 to-sky-500/20 border border-emerald-400/50 flex items-center justify-center shadow-[0_0_28px_-4px_rgba(16,185,129,0.55)]"
        >
          <svg viewBox="0 0 36 36" className="w-8 h-8">
            <motion.path
              d="M9 18.5 L15.5 25 L27.5 11.5"
              fill="none"
              stroke="#34D399"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.42, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.3 }}
        className="space-y-1.5 relative z-10"
      >
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono font-semibold text-emerald-300 uppercase tracking-wider mb-1">
          <ShieldCheck className="w-3 h-3" />
          JWT AUTH VERIFIED
        </div>
        <h3 className="text-lg font-bold text-white tracking-tight">
          Authentication successful
        </h3>
        <p className="text-xs text-slate-300">
          {email ? (
            <>
              Session établie pour <span className="font-mono text-sky-300">{email}</span>
            </>
          ) : (
            'Session sécurisée vérifiée · Ouverture du terminal...'
          )}
        </p>
      </motion.div>
    </motion.div>
  );
};
