import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { MarketLoadingScreen } from './MarketLoadingScreen';

interface AuthTransitionContextValue {
  /** True while the Phase 2 full-screen MarketLoadingScreen overlay is mounted. */
  isEntranceActive: boolean;
  /** Monotonic counter incremented when Phase 2 completes so Dashboard can play Phase 3 entrance. */
  revealKey: number;
  /** Opens Phase 2 MarketLoadingScreen immediately and triggers navigation behind the curtain. */
  beginTradingEntrance: (navigateCallback: () => void) => void;
  /** Signals that initial dashboard market/portfolio data has resolved. */
  markDashboardReady: () => void;
}

const AuthTransitionContext = createContext<AuthTransitionContextValue | undefined>(undefined);

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

export const AuthTransitionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isEntranceActive, setIsEntranceActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dashboardReady, setDashboardReady] = useState(false);
  const [minWindowElapsed, setMinWindowElapsed] = useState(false);
  const [revealKey, setRevealKey] = useState(0);

  const timersRef = useRef<number[]>([]);
  const progressRafRef = useRef<number | null>(null);

  const clearScheduled = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    if (progressRafRef.current !== null) {
      window.cancelAnimationFrame(progressRafRef.current);
      progressRafRef.current = null;
    }
  }, []);

  const finishEntrance = useCallback(() => {
    clearScheduled();
    setProgress(100);
    const closeDelay = prefersReducedMotion() ? 60 : 260;
    const t = window.setTimeout(() => {
      setIsEntranceActive(false);
      setRevealKey((k) => k + 1);
    }, closeDelay);
    timersRef.current.push(t);
  }, [clearScheduled]);

  const beginTradingEntrance = useCallback(
    (navigateCallback: () => void) => {
      clearScheduled();
      const reduced = prefersReducedMotion();

      setDashboardReady(false);
      setMinWindowElapsed(false);
      setProgress(reduced ? 70 : 14);
      setIsEntranceActive(true);

      // Navigate slightly after the curtain mounts so route swap happens invisibly behind it
      const navTimer = window.setTimeout(() => {
        navigateCallback();
      }, reduced ? 20 : 120);

      // Minimum visual showcase window so the user experiences Phase 2 smoothly
      const minTimer = window.setTimeout(() => {
        setMinWindowElapsed(true);
      }, reduced ? 220 : 1550);

      // Hard ceiling timeout so slow networks never trap the user in the loader
      const ceilingTimer = window.setTimeout(() => {
        setDashboardReady(true);
        setMinWindowElapsed(true);
      }, reduced ? 420 : 2400);

      timersRef.current.push(navTimer, minTimer, ceilingTimer);

      if (!reduced) {
        const start = performance.now();
        const duration = 1750;
        const step = (now: number) => {
          const ratio = Math.min(1, (now - start) / duration);
          // Ease out to ~92% until dashboardReady lifts it to 100%
          const eased = 14 + (1 - Math.pow(1 - ratio, 2.4)) * 78;
          setProgress((prev) => (eased > prev ? Math.round(eased) : prev));
          if (ratio < 1) {
            progressRafRef.current = window.requestAnimationFrame(step);
          }
        };
        progressRafRef.current = window.requestAnimationFrame(step);
      }
    },
    [clearScheduled],
  );

  const markDashboardReady = useCallback(() => {
    setDashboardReady((prev) => (prev ? prev : true));
  }, []);

  useEffect(() => {
    if (isEntranceActive && dashboardReady && minWindowElapsed) {
      finishEntrance();
    }
  }, [isEntranceActive, dashboardReady, minWindowElapsed, finishEntrance]);

  useEffect(() => clearScheduled, [clearScheduled]);

  return (
    <AuthTransitionContext.Provider
      value={{
        isEntranceActive,
        revealKey,
        beginTradingEntrance,
        markDashboardReady,
      }}
    >
      {children}
      <MarketLoadingScreen
        isOpen={isEntranceActive}
        progress={progress}
        dashboardReady={dashboardReady}
      />
    </AuthTransitionContext.Provider>
  );
};

export function useAuthTransition(): AuthTransitionContextValue {
  const ctx = useContext(AuthTransitionContext);
  if (!ctx) {
    throw new Error('useAuthTransition must be used within AuthTransitionProvider');
  }
  return ctx;
}
