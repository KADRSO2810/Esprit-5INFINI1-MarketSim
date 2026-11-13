import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
  X,
  Zap,
  Sparkles,
} from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'trade' | 'ai';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  notify: (type: ToastType, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  trade: (title: string, message?: string) => void;
  ai: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (type: ToastType, title: string, message?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-4), { id, type, title, message }]);
      setTimeout(() => {
        remove(id);
      }, 4500);
    },
    [remove]
  );

  const value: ToastContextValue = {
    notify,
    success: (title, msg) => notify('success', title, msg),
    error: (title, msg) => notify('error', title, msg),
    info: (title, msg) => notify('info', title, msg),
    warning: (title, msg) => notify('warning', title, msg),
    trade: (title, msg) => notify('trade', title, msg),
    ai: (title, msg) => notify('ai', title, msg),
  };

  const styles: Record<
    ToastType,
    { border: string; bg: string; bar: string; badge: string; icon: React.ReactNode }
  > = {
    success: {
      border: 'border-emerald-500/35',
      bg: 'bg-[#091815]/95',
      bar: 'bg-emerald-400',
      badge: 'bg-emerald-500/15',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    },
    error: {
      border: 'border-rose-500/35',
      bg: 'bg-[#190B12]/95',
      bar: 'bg-rose-400',
      badge: 'bg-rose-500/15',
      icon: <AlertCircle className="w-4 h-4 text-rose-400" />,
    },
    warning: {
      border: 'border-amber-500/35',
      bg: 'bg-[#1A140A]/95',
      bar: 'bg-amber-400',
      badge: 'bg-amber-500/15',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    },
    info: {
      border: 'border-sky-500/35',
      bg: 'bg-[#0A1526]/95',
      bar: 'bg-sky-400',
      badge: 'bg-sky-500/15',
      icon: <Info className="w-4 h-4 text-sky-400" />,
    },
    trade: {
      border: 'border-emerald-400/40',
      bg: 'bg-[#081A1A]/95',
      bar: 'bg-gradient-to-r from-emerald-400 to-sky-400',
      badge: 'bg-emerald-500/20',
      icon: <Zap className="w-4 h-4 text-emerald-300" />,
    },
    ai: {
      border: 'border-violet-400/40',
      bg: 'bg-[#110D24]/95',
      bar: 'bg-gradient-to-r from-violet-400 to-sky-400',
      badge: 'bg-violet-500/20',
      icon: <Sparkles className="w-4 h-4 text-violet-300" />,
    },
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast viewport */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2.5 w-full max-w-sm pointer-events-none px-4 sm:px-0"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const st = styles[t.type];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.96 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className={`pointer-events-auto relative overflow-hidden flex items-start gap-3 p-3.5 rounded-xl border backdrop-blur-md shadow-2xl ${st.bg} ${st.border}`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${st.badge}`}>
                  {st.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white leading-tight">{t.title}</p>
                  {t.message && (
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">{t.message}</p>
                  )}
                </div>
                <button
                  onClick={() => remove(t.id)}
                  className="text-slate-500 hover:text-slate-200 transition p-0.5 rounded"
                  aria-label="Fermer la notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Auto-dismiss countdown progress */}
                <span
                  className={`absolute bottom-0 left-0 right-0 h-[2px] origin-left animate-toast-progress ${st.bar}`}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
