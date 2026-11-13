import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Activity } from 'lucide-react';

export interface TradingScrollSection {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface TradingScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  viewportClassName?: string;
  side?: 'BUY' | 'SELL' | 'NEUTRAL';
  sections?: TradingScrollSection[];
  activeSectionId?: string;
  showScrollCue?: boolean;
  scrollCueLabel?: string;
  targetCueSectionId?: string;
}

/**
 * Institutional Trading Scroll Area
 * 
 * Replaces standard boring browser scrollbars with a custom Financial Market Candlestick Depth Ladder:
 * - Animated Candlestick Thumb with top/bottom wicks and live ticker pulse
 * - Dynamic Bullish (Emerald) vs Bearish (Rose) vs Neutral (Cyan) theme
 * - Orderbook depth tick graduation marks along the glass rail
 * - Interactive Telemetry HUD displaying depth % and active section
 * - Kinetic click-to-navigate on the price rail
 * - Holographic top/bottom gradient vignettes
 * - Animated bouncing scroll cue prompt ("Défiler vers le moteur de risque")
 */
export const TradingScrollArea: React.FC<TradingScrollAreaProps> = ({
  children,
  className = '',
  viewportClassName = '',
  side = 'BUY',
  sections,
  activeSectionId,
  showScrollCue = true,
  scrollCueLabel = 'Défiler vers le Risque & SL/TP',
  targetCueSectionId,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [canScroll, setCanScroll] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [currentSectionLabel, setCurrentSectionLabel] = useState<string | null>(null);

  const scrollTimerRef = useRef<number | null>(null);

  // Check scroll dimensions and update progress
  const updateScrollMetrics = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScroll = scrollHeight - clientHeight;
    const hasScroll = maxScroll > 8;

    setCanScroll(hasScroll);
    setCanScrollUp(scrollTop > 12);
    setCanScrollDown(scrollTop < maxScroll - 16);

    const progress = hasScroll ? Math.min(Math.max(scrollTop / maxScroll, 0), 1) : 0;
    setScrollProgress(progress);

    // Identify active section if sections provided
    if (sections && sections.length > 0) {
      if (activeSectionId) {
        const found = sections.find((s) => s.id === activeSectionId);
        if (found) {
          setCurrentSectionLabel(found.label);
          return;
        }
      }
      const idx = Math.min(
        Math.floor(progress * sections.length),
        sections.length - 1
      );
      setCurrentSectionLabel(sections[idx]?.label ?? null);
    }
  }, [sections, activeSectionId]);

  useEffect(() => {
    updateScrollMetrics();
    const el = viewportRef.current;
    if (!el) return;

    const handleScroll = () => {
      updateScrollMetrics();
      setIsScrolling(true);
      if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = window.setTimeout(() => {
        setIsScrolling(false);
      }, 900);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateScrollMetrics);

    // Periodic observer for dynamic child resize
    const resizeObserver = new ResizeObserver(() => {
      updateScrollMetrics();
    });
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateScrollMetrics);
      resizeObserver.disconnect();
      if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
    };
  }, [updateScrollMetrics]);

  // Click on rail to jump
  const handleRailClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rail = railRef.current;
    const viewport = viewportRef.current;
    if (!rail || !viewport) return;

    const rect = rail.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const ratio = Math.min(Math.max(clickY / rect.height, 0), 1);
    const maxScroll = viewport.scrollHeight - viewport.clientHeight;

    viewport.scrollTo({
      top: ratio * maxScroll,
      behavior: 'smooth',
    });
  };

  // Scroll to target cue section or down 250px
  const handleScrollCueClick = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    if (targetCueSectionId) {
      const targetEl = viewport.querySelector(`#${targetCueSectionId}`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    viewport.scrollBy({
      top: 280,
      behavior: 'smooth',
    });
  };

  // Color palette based on trading side
  const theme = {
    BUY: {
      candleBg: 'from-emerald-400 via-emerald-500 to-green-600',
      wickColor: 'bg-emerald-400',
      glow: 'shadow-[0_0_14px_rgba(34,197,94,0.75)]',
      border: 'border-emerald-300/60',
      hudBg: 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300',
      laserLine: 'rgba(34,197,94,0.22)',
      cueGlow: 'shadow-[0_0_16px_-2px_rgba(34,197,94,0.5)] border-emerald-500/40 hover:border-emerald-400',
      badgeBg: 'bg-emerald-500/15 text-emerald-300',
    },
    SELL: {
      candleBg: 'from-rose-400 via-rose-500 to-red-600',
      wickColor: 'bg-rose-400',
      glow: 'shadow-[0_0_14px_rgba(239,68,68,0.75)]',
      border: 'border-rose-300/60',
      hudBg: 'bg-rose-950/90 border-rose-500/40 text-rose-300',
      laserLine: 'rgba(239,68,68,0.22)',
      cueGlow: 'shadow-[0_0_16px_-2px_rgba(239,68,68,0.5)] border-rose-500/40 hover:border-rose-400',
      badgeBg: 'bg-rose-500/15 text-rose-300',
    },
    NEUTRAL: {
      candleBg: 'from-sky-400 via-cyan-500 to-blue-600',
      wickColor: 'bg-sky-400',
      glow: 'shadow-[0_0_14px_rgba(56,189,248,0.75)]',
      border: 'border-sky-300/60',
      hudBg: 'bg-sky-950/90 border-sky-500/40 text-sky-300',
      laserLine: 'rgba(56,189,248,0.22)',
      cueGlow: 'shadow-[0_0_16px_-2px_rgba(56,189,248,0.5)] border-sky-500/40 hover:border-sky-400',
      badgeBg: 'bg-sky-500/15 text-sky-300',
    },
  }[side];

  const pctDisplay = Math.round(scrollProgress * 100);

  return (
    <div
      className={`relative flex-1 min-h-0 overflow-hidden flex flex-col group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Top Holographic Edge Vignette */}
      <AnimatePresence>
        {canScrollUp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute top-0 inset-x-0 h-5 bg-gradient-to-b from-[#0B1220] via-[#0B1220]/70 to-transparent z-10 border-t border-sky-400/10"
          />
        )}
      </AnimatePresence>

      {/* Main Scrollable Viewport */}
      <div
        ref={viewportRef}
        className={`flex-1 min-h-0 overflow-y-auto pr-4 pl-5 py-4 space-y-4 no-scrollbar scroll-smooth ${viewportClassName}`}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {children}
      </div>

      {/* Bottom Holographic Edge Vignette */}
      <AnimatePresence>
        {canScrollDown && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-[#070B14] via-[#070B14]/80 to-transparent z-10"
          />
        )}
      </AnimatePresence>

      {/* Animated Trading Scroll Cue Prompt (Floats when user is at the top) */}
      <AnimatePresence>
        {showScrollCue && canScrollDown && scrollProgress < 0.12 && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-3 inset-x-0 flex justify-center z-20 pointer-events-none"
          >
            <button
              type="button"
              onClick={handleScrollCueClick}
              className={`pointer-events-auto px-3.5 py-1.5 rounded-full bg-[#0B1220]/95 backdrop-blur-md border text-[11px] font-mono font-medium flex items-center gap-2 transition-all duration-200 active:scale-95 ${theme.cueGlow}`}
            >
              {/* Mini Animated Candlestick Icon */}
              <div className="relative w-2 h-3.5 flex flex-col items-center justify-center">
                <span className={`w-[1px] h-3.5 ${theme.wickColor} opacity-70`} />
                <span className={`absolute w-1.5 h-2 rounded-xs bg-gradient-to-b ${theme.candleBg} ${theme.glow}`} />
              </div>

              <span className="text-slate-200 tracking-tight">{scrollCueLabel}</span>

              <motion.span
                animate={{ y: [0, 2.5, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                className={theme.badgeBg + ' p-0.5 rounded-full'}
              >
                <ChevronDown className="w-3 h-3" />
              </motion.span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Candlestick Depth Ladder Rail */}
      {canScroll && (
        <div
          ref={railRef}
          onClick={handleRailClick}
          className="absolute top-3.5 bottom-3.5 right-1.5 w-3 flex flex-col items-center z-20 cursor-pointer select-none group/rail"
          title={`Défilement Marché (${pctDisplay}%)`}
        >
          {/* Glass Rail Track with Depth Graduation Hash Marks */}
          <div className="relative w-1.5 h-full rounded-full bg-[#070B14]/80 border border-slate-800/80 overflow-hidden shadow-inner flex flex-col items-center">
            {/* Background Price Pip Tick Marks (SVG Pattern Simulation) */}
            <div
              className="absolute inset-0 opacity-25 group-hover/rail:opacity-45 transition-opacity"
              style={{
                backgroundImage: `repeating-linear-gradient(to bottom, #94A3B8 0px, #94A3B8 1px, transparent 1px, transparent 10px)`,
              }}
            />

            {/* Subtle Vertical Laser Wick Line */}
            <div
              className="absolute inset-y-0 w-[1px] transition-colors"
              style={{ backgroundColor: theme.laserLine }}
            />
          </div>

          {/* Animated Candlestick Thumb */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-2.5 transition-transform duration-75 flex flex-col items-center pointer-events-none"
            style={{
              top: `calc(${scrollProgress * 100}% - ${scrollProgress * 32}px)`,
            }}
          >
            {/* Top Wick */}
            <span
              className={`w-[1px] h-1.5 ${theme.wickColor} transition-all ${
                isScrolling || isHovered ? 'scale-y-125 opacity-100' : 'opacity-75'
              }`}
            />

            {/* Candlestick Body */}
            <div
              className={`relative w-2.5 h-6 rounded-xs bg-gradient-to-b ${theme.candleBg} ${theme.border} border transition-all duration-150 flex items-center justify-center ${
                isScrolling || isHovered ? theme.glow + ' scale-110' : 'shadow-md opacity-90'
              }`}
            >
              {/* Internal Tick Pulse Dot */}
              <span
                className={`w-1 h-1 rounded-full bg-white transition-opacity ${
                  isScrolling ? 'opacity-90 animate-ping' : 'opacity-40'
                }`}
              />
            </div>

            {/* Bottom Wick */}
            <span
              className={`w-[1px] h-1.5 ${theme.wickColor} transition-all ${
                isScrolling || isHovered ? 'scale-y-125 opacity-100' : 'opacity-75'
              }`}
            />

            {/* Telemetry HUD Pill (Slides out on active scroll or hover) */}
            <AnimatePresence>
              {(isScrolling || isHovered) && (
                <motion.div
                  initial={{ opacity: 0, x: 8, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 6, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md border text-[9px] font-mono font-bold whitespace-nowrap shadow-lg flex items-center gap-1.5 backdrop-blur-md z-30 ${theme.hudBg}`}
                >
                  <Activity className="w-2.5 h-2.5 animate-pulse" />
                  <span>{pctDisplay}%</span>
                  {currentSectionLabel && (
                    <>
                      <span className="opacity-40">|</span>
                      <span className="uppercase tracking-wider">{currentSectionLabel}</span>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
};
