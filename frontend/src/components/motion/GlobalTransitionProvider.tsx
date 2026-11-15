import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { QuantOrbitalLoader, QuantOrbitalTone } from './QuantOrbitalLoader';
import { EASE_INSTITUTIONAL } from './presets';
import { Activity, BarChart3, Bot, Newspaper, ShieldAlert, Globe, FileSpreadsheet, ShieldCheck } from 'lucide-react';

interface SectionMeta {
  label: string;
  section: string;
  subtitle: string;
  tone: QuantOrbitalTone;
  icon: React.ComponentType<{ className?: string }>;
}

const ROUTE_META: Array<{ match: (p: string) => boolean; meta: SectionMeta }> = [
  {
    match: (p) => p.startsWith('/app/backtesting'),
    meta: {
      label: 'Quantitative Backtesting',
      section: 'Quantitative Research',
      subtitle: 'Préparation du moteur de simulation historique...',
      tone: 'cyan',
      icon: BarChart3,
    },
  },
  {
    match: (p) => p.startsWith('/app/strategies'),
    meta: {
      label: 'Strategy Lab & Auto-Agents',
      section: 'Algorithmic Execution',
      subtitle: 'Synchronisation des stratégies et signaux STOMP...',
      tone: 'violet',
      icon: Bot,
    },
  },
  {
    match: (p) => p.startsWith('/app/news'),
    meta: {
      label: 'Financial News & FinBERT',
      section: 'AI NLP Intelligence',
      subtitle: 'Ouverture du flux d’actualités et moteur FinBERT...',
      tone: 'violet',
      icon: Newspaper,
    },
  },
  {
    match: (p) => p.startsWith('/app/stress-testing'),
    meta: {
      label: 'AI Stress Testing & SHAP',
      section: 'Banking Risk Intelligence',
      subtitle: 'Chargement du laboratoire de risque et explicabilité SHAP...',
      tone: 'violet',
      icon: ShieldAlert,
    },
  },
  {
    match: (p) => p.startsWith('/app/markets'),
    meta: {
      label: 'Marchés Multi-Actifs (Forex • Bonds • Cmdty)',
      section: 'Cross-Asset Trading Desk',
      subtitle: 'Connexion aux flux interbancaires BCE et obligations souveraines...',
      tone: 'amber',
      icon: Globe,
    },
  },
  {
    match: (p) => p.startsWith('/app/fundamentals'),
    meta: {
      label: 'Analyse Fondamentale & États Financiers SEC',
      section: 'Corporate SEC Intelligence',
      subtitle: 'Extraction des bilans, ratios financiers et flux de trésorerie...',
      tone: 'emerald',
      icon: FileSpreadsheet,
    },
  },
  {
    match: (p) => p.startsWith('/app/actuary'),
    meta: {
      label: 'Laboratoire d’Actuariat & Modélisation',
      section: 'Actuarial & Risk Intelligence',
      subtitle: 'Tarification GLM, simulations Monte Carlo et provisions Chain-Ladder...',
      tone: 'violet',
      icon: ShieldCheck,
    },
  },
  {
    match: (p) => p === '/app' || p === '/app/',
    meta: {
      label: 'Terminal Live & Paper Desk',
      section: 'Overview & Trading',
      subtitle: 'Retour à la salle de marché temps réel...',
      tone: 'cyan',
      icon: Activity,
    },
  },
];

function resolveSectionMeta(pathname: string): SectionMeta | null {
  if (!pathname.startsWith('/app')) return null;
  for (const entry of ROUTE_META) {
    if (entry.match(pathname)) return entry.meta;
  }
  return null;
}

interface PageTransitionContextValue {
  isTransitioning: boolean;
  activeMeta: SectionMeta | null;
}

const PageTransitionContext = createContext<PageTransitionContextValue>({
  isTransitioning: false,
  activeMeta: null,
});

/**
 * Centered, serene rotating orbital transition across authenticated MarketSim modules.
 * Runs smoothly without floating over the top edge or resetting persistent state/WebSockets.
 */
export const GlobalTransitionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { pathname } = useLocation();
  const prefersReduced = useReducedMotion();
  const prevPathRef = useRef<string>(pathname);
  const timerRef = useRef<number | null>(null);

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeMeta, setActiveMeta] = useState<SectionMeta | null>(null);

  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;

    // Only animate intra-terminal transitions (/app/* -> /app/*), not initial /login -> /app handoff
    if (prev === pathname || !prev.startsWith('/app') || !pathname.startsWith('/app')) {
      return;
    }

    const meta = resolveSectionMeta(pathname);
    if (!meta) return;

    if (prefersReduced) return;

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    setActiveMeta(meta);
    setIsTransitioning(true);

    // Deliberate, unhurried 900ms rotation showcase + smooth exit fade
    timerRef.current = window.setTimeout(() => {
      setIsTransitioning(false);
      timerRef.current = null;
    }, 900);
  }, [pathname, prefersReduced]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <PageTransitionContext.Provider value={{ isTransitioning, activeMeta }}>
      {children}

      {/* Centered Rotating Orbital Transition Backdrop */}
      <AnimatePresence>
        {isTransitioning && activeMeta && (
          <motion.div
            key={`route-orbital-${pathname}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.34, ease: EASE_INSTITUTIONAL }}
            className="pointer-events-none fixed inset-0 z-[75] flex items-center justify-center bg-[#070B14]/88 backdrop-blur-md p-6"
          >
            <div className="workstation-panel-elevated rounded-3xl px-8 py-9 border border-slate-700/45 shadow-[0_28px_90px_rgba(2,6,23,0.9)] bg-[#0B1220]/90">
              <QuantOrbitalLoader
                size="lg"
                tone={activeMeta.tone}
                icon={activeMeta.icon}
                badge={activeMeta.section}
                title={activeMeta.label}
                subtitle={activeMeta.subtitle}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransitionContext.Provider>
  );
};

export function usePageTransition() {
  return useContext(PageTransitionContext);
}
