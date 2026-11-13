import React, { useEffect, useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bot,
  Newspaper,
  ShieldAlert,
  Search,
  CornerDownLeft,
  X,
} from 'lucide-react';

// =========================================================================
// STAGGERED CONTAINER & ITEM (FAST, GPU-COMPOSITED)
// =========================================================================
const STAGGER_CONTAINER = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.02,
    },
  },
};

const STAGGER_ITEM = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.26,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

export const MotionStagger: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <motion.div
    variants={STAGGER_CONTAINER}
    initial="hidden"
    animate="visible"
    className={className}
  >
    {children}
  </motion.div>
);

export const MotionItem: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <motion.div variants={STAGGER_ITEM} className={className}>
    {children}
  </motion.div>
);

// =========================================================================
// ANIMATED MODAL (BACKDROP FADE + SPRING SCALE + ESCAPE SUPPORT)
// =========================================================================
interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
  panelClassName?: string;
}

export const AnimatedModal: React.FC<AnimatedModalProps> = ({
  isOpen,
  onClose,
  children,
  maxWidthClass = 'max-w-lg',
  panelClassName = '',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            key="modal-panel"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={`workstation-panel-elevated rounded-2xl shadow-2xl w-full ${maxWidthClass} overflow-hidden flex flex-col max-h-[90vh] ${panelClassName}`}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// =========================================================================
// ANIMATED TABS WITH SHARED-ELEMENT SLIDING PILL (layoutId)
// =========================================================================
export interface TabOption<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

interface AnimatedTabsProps<T extends string = string> {
  tabs: TabOption<T>[];
  activeId: T;
  onChange: (id: T) => void;
  layoutId: string;
  accent?: 'cyan' | 'violet' | 'rose' | 'bullish';
  className?: string;
}

const TAB_ACCENT: Record<NonNullable<AnimatedTabsProps['accent']>, string> = {
  cyan: 'bg-sky-500/15 border-sky-400/35 text-sky-300',
  violet: 'bg-violet-500/20 border-violet-400/35 text-violet-200',
  rose: 'bg-rose-500/15 border-rose-400/35 text-rose-200',
  bullish: 'bg-emerald-500/15 border-emerald-400/35 text-emerald-300',
};

export function AnimatedTabs<T extends string = string>({
  tabs,
  activeId,
  onChange,
  layoutId,
  accent = 'cyan',
  className = '',
}: AnimatedTabsProps<T>) {
  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#0B1220] border border-subtle ${className}`}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 z-0 ${
              active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                className={`pointer-events-none absolute inset-0 rounded-lg border -z-10 ${TAB_ACCENT[accent]}`}
              />
            )}
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded ${
                  active ? 'bg-white/10 text-white' : 'bg-[#142035] text-slate-400'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// =========================================================================
// COMMAND PALETTE (CTRL+K / CMD+K)
// =========================================================================
interface CommandRoute {
  path: string;
  label: string;
  section: string;
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}

const COMMAND_ROUTES: CommandRoute[] = [
  {
    path: '/app',
    label: 'Terminal Live & Paper Desk',
    section: 'Overview & Trading',
    keywords: 'dashboard trading terminal portfolio var orders chart',
    icon: Activity,
    accent: 'text-sky-400',
  },
  {
    path: '/app/backtesting',
    label: 'Quantitative Backtesting',
    section: 'Quantitative',
    keywords: 'backtest sma crossover sharpe drawdown equity',
    icon: BarChart3,
    accent: 'text-blue-400',
  },
  {
    path: '/app/strategies',
    label: 'Strategy Lab & Auto-Agents',
    section: 'Quantitative',
    keywords: 'strategy bot autonomous signals rsi sma finbert',
    icon: Bot,
    accent: 'text-violet-400',
  },
  {
    path: '/app/news',
    label: 'Financial News & FinBERT NLP',
    section: 'AI Intelligence',
    keywords: 'news finbert sentiment nlp articles',
    icon: Newspaper,
    accent: 'text-cyan-400',
  },
  {
    path: '/app/stress-testing',
    label: 'AI Banking Stress Testing & SHAP',
    section: 'AI Intelligence',
    keywords: 'stress test xai shap random forest banks basel',
    icon: ShieldAlert,
    accent: 'text-violet-400',
  },
];

export const CommandPalette: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMAND_ROUTES;
    return COMMAND_ROUTES.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.section.toLowerCase().includes(q) ||
        r.keywords.includes(q)
    );
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedIndex >= matches.length) setSelectedIndex(0);
  }, [matches.length, selectedIndex]);

  const go = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (matches.length ? (i + 1) % matches.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (matches.length ? (i - 1 + matches.length) % matches.length : 0));
    } else if (e.key === 'Enter' && matches[selectedIndex]) {
      e.preventDefault();
      go(matches[selectedIndex].path);
    }
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidthClass="max-w-lg">
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-subtle bg-[#0B1220]">
        <Search className="w-4 h-4 text-sky-400 shrink-0" />
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Accéder à un module (Terminal, Backtesting, SHAP, News…)"
          className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
        />
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-[#192841] transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-2 max-h-80 overflow-y-auto space-y-1">
        {matches.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">
            Aucun module ne correspond à « {query} ».
          </div>
        ) : (
          matches.map((item, idx) => {
            const Icon = item.icon;
            const active = idx === selectedIndex;
            return (
              <button
                key={item.path}
                type="button"
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => go(item.path)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-colors ${
                  active
                    ? 'bg-[#192841] border border-sky-500/30 text-white'
                    : 'border border-transparent text-slate-300 hover:bg-[#142035]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#0B1220] border border-subtle flex items-center justify-center shrink-0">
                    <Icon className={`w-4 h-4 ${item.accent}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{item.label}</div>
                    <div className="text-[10px] font-mono text-slate-500">{item.section}</div>
                  </div>
                </div>
                {active && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-sky-400">
                    <CornerDownLeft className="w-3 h-3" /> Ouvrir
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="px-4 py-2 border-t border-subtle bg-[#0B1220]/90 flex items-center justify-between text-[10px] font-mono text-slate-500">
        <span>↑ ↓ Naviguer · ↵ Ouvrir</span>
        <span>ESC Fermer</span>
      </div>
    </AnimatedModal>
  );
};
