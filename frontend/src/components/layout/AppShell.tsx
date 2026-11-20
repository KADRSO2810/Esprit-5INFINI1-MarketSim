import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { CommandPalette, LivePulseDot } from '../ui';
import { usePageTransition } from '../motion';
import {
  TrendingUp,
  BarChart3,
  Bot,
  Newspaper,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Menu,
  X,
  Radio,
  Clock,
  ChevronRight,
  ExternalLink,
  Activity,
  Command,
  FileSpreadsheet,
  Globe,
  ShieldCheck,
  GraduationCap,
  Flame,
  Swords,
} from 'lucide-react';

export interface AppShellProps {
  children: React.ReactNode;
  title: string;
  section?: string;
  badge?: string;
  wsStatus?: {
    connected: boolean;
    label?: string;
  };
  equityBadge?: number | null;
  topbarSlot?: React.ReactNode;
  topbarActions?: React.ReactNode;
  maxWidthClass?: string;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  matchPrefix?: string;
  accent?: string;
}

interface NavSection {
  group: string;
  adminOnly?: boolean;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    group: 'Overview & Trading',
    items: [
      { to: '/app', label: 'Terminal Live', icon: Activity, accent: 'text-sky-400' },
      { to: '/app/markets', label: 'Marchés Multi-Actifs', icon: Globe, matchPrefix: '/app/markets', accent: 'text-amber-400' },
    ],
  },
  {
    group: 'Quantitative',
    items: [
      { to: '/app/backtesting', label: 'Backtesting', icon: BarChart3, matchPrefix: '/app/backtesting', accent: 'text-blue-400' },
      { to: '/app/strategies', label: 'Strategy Lab', icon: Bot, matchPrefix: '/app/strategies', accent: 'text-violet-400' },
    ],
  },
  {
    group: 'AI Intelligence',
    items: [
      { to: '/app/signals', label: 'Signaux Experts (VIP)', icon: Radio, matchPrefix: '/app/signals', accent: 'text-amber-400' },
      { to: '/app/news', label: 'News & FinBERT', icon: Newspaper, matchPrefix: '/app/news', accent: 'text-cyan-400' },
      { to: '/app/stress-testing', label: 'AI Stress Testing', icon: ShieldAlert, matchPrefix: '/app/stress-testing', accent: 'text-violet-400' },
    ],
  },
  {
    group: 'Research & Fundamentals',
    items: [
      { to: '/app/fundamentals', label: 'Analyse Fondamentale', icon: FileSpreadsheet, matchPrefix: '/app/fundamentals', accent: 'text-emerald-400' },
    ],
  },
  {
    group: 'Actuariat & Assurance',
    items: [
      { to: '/app/actuary', label: 'Laboratoire Actuariel', icon: ShieldCheck, matchPrefix: '/app/actuary', accent: 'text-purple-400' },
    ],
  },
  {
    group: 'Formation & Apprentissage',
    items: [
      { to: '/app/academy', label: 'Académie Financière', icon: GraduationCap, matchPrefix: '/app/academy', accent: 'text-indigo-400' },
    ],
  },
  {
    group: 'E-Sport & Défis',
    items: [
      { to: '/app/arena', label: 'Flash Crash Arena', icon: Flame, matchPrefix: '/app/arena', accent: 'text-rose-400' },
      { to: '/app/duels', label: 'Duels 1v1 Blind Replay', icon: Swords, matchPrefix: '/app/duels', accent: 'text-cyan-400' },
    ],
  },
  {
    group: 'Supervision & Contrôle',
    adminOnly: true,
    items: [
      { to: '/app/admin', label: 'Console d\'Administration', icon: ShieldCheck, matchPrefix: '/app/admin', accent: 'text-violet-400' },
    ],
  },
];

function isUSMarketOpen(): boolean {
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return minutes >= 14 * 60 + 30 && minutes < 21 * 60;
}

const LiveClock: React.FC = () => {
  const [nowStr, setNowStr] = useState(() =>
    new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setNowStr(
        new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return <span>{nowStr}</span>;
};

export const AppShell: React.FC<AppShellProps> = ({
  children,
  title,
  section = 'Workstation',
  badge,
  wsStatus,
  equityBadge,
  topbarSlot,
  topbarActions,
  maxWidthClass = 'max-w-[1680px]',
}) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isTransitioning } = usePageTransition();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Global Ctrl+K / Cmd+K quick navigation launcher
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const isActive = (item: NavItem) => {
    if (item.to === '/app') {
      return location.pathname === '/app' || location.pathname === '/app/';
    }
    return item.matchPrefix
      ? location.pathname.startsWith(item.matchPrefix)
      : location.pathname === item.to;
  };

  const usOpen = isUSMarketOpen();
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'TR';

  const renderSidebarContent = (isMobile = false) => {
    const isCompact = collapsed && !isMobile;

    return (
      <div className="flex flex-col h-full bg-[#0B1220] border-r border-subtle select-none">
        {/* Brand Header */}
        <div
          className={`h-14 flex items-center border-b border-subtle px-3.5 ${
            isCompact ? 'justify-center' : 'justify-between'
          }`}
        >
          <Link to="/app" className="flex items-center gap-2.5 min-w-0 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-sky-500/35 flex items-center justify-center shrink-0 shadow-glow-cyan group-hover:border-sky-400/70 transition-all">
              <TrendingUp className="w-4 h-4 text-sky-400" />
            </div>
            {!isCompact && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-white tracking-tight">MarketSim</span>
                  <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    QUANT
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-mono truncate">AI Risk Terminal</p>
              </div>
            )}
          </Link>

          {!isMobile ? (
            <button
              onClick={toggleCollapse}
              className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#142035] transition ${
                isCompact ? 'hidden' : ''
              }`}
              title="Réduire la barre latérale"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#142035]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Expand button in compact mode */}
        {isCompact && (
          <div className="px-2 pt-2.5 flex justify-center">
            <button
              onClick={toggleCollapse}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#142035] transition"
              title="Déplier la barre latérale"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5">
          {NAV_SECTIONS.filter((sec) => !sec.adminOnly || user?.role === 'ADMIN').map((sec) => (
            <div key={sec.group}>
              {!isCompact ? (
                <div className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  {sec.group}
                </div>
              ) : (
                <div className="border-t border-subtle my-2 mx-2" />
              )}

              <div className="space-y-1">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`group relative z-0 flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 active:scale-95 ${
                        isCompact ? 'justify-center' : ''
                      } ${
                        active
                          ? 'text-white'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-[#101A2B]/80'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId={isMobile ? 'sidebarActivePillMobile' : 'sidebarActivePill'}
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                          className="pointer-events-none absolute inset-0 rounded-lg bg-[#142035] border border-strong shadow-sm -z-10"
                        />
                      )}
                      {active && (
                        <motion.span
                          layoutId={isMobile ? 'sidebarActiveRailMobile' : 'sidebarActiveRail'}
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                          className="pointer-events-none absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gradient-to-b from-sky-400 to-violet-400"
                        />
                      )}

                      <Icon
                        className={`w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                          active
                            ? item.accent || 'text-sky-400'
                            : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />
                      {!isCompact && <span className="truncate">{item.label}</span>}

                      {/* Tooltip in collapsed mode */}
                      {isCompact && (
                        <span className="pointer-events-none opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-[#142035] border border-strong text-xs font-medium text-white whitespace-nowrap shadow-xl z-50">
                          {item.label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Utility & User Profile */}
        <div className="p-2.5 border-t border-subtle space-y-2">
          {!isCompact && (
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-white hover:bg-[#101A2B] border border-transparent hover:border-subtle transition"
            >
              <span className="flex items-center gap-2">
                <Command className="w-3.5 h-3.5 text-sky-400" />
                Navigation rapide
              </span>
              <kbd className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[#070B14] border border-subtle text-slate-400">
                Ctrl K
              </kbd>
            </button>
          )}

          {!isCompact && (
            <a
              href="http://localhost:8081/swagger-ui/index.html"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-slate-200 hover:bg-[#101A2B] transition"
            >
              <span className="flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                API Swagger
              </span>
              <span className="font-mono text-[9px] text-slate-500">:8081</span>
            </a>
          )}

          <div
            className={`flex items-center gap-2.5 p-2 rounded-xl bg-[#101A2B] border border-subtle hover:border-strong transition-colors ${
              isCompact ? 'justify-center flex-col py-2.5' : ''
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500/25 to-violet-500/25 border border-sky-500/35 flex items-center justify-center text-xs font-bold font-mono text-sky-300 shrink-0">
              {initials}
            </div>
            {!isCompact && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">
                  {user?.email || 'Trader'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                      user?.role === 'ADMIN'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    {user?.role === 'ADMIN' ? '👑 ADMIN' : '⚡ TRADER'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">Paper Desk</span>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              title="Déconnexion"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex bg-[#070B14] text-slate-100">
      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 sticky top-0 h-screen transition-[width] duration-200 ease-out z-30 ${
          collapsed ? 'w-[72px]' : 'w-[244px]'
        }`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Slide-Over Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 36 }}
              className="relative w-64 max-w-[80vw] h-full z-10"
            >
              {renderSidebarContent(true)}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="relative h-14 glass-header sticky top-0 z-20 px-4 sm:px-6 flex items-center justify-between gap-3">
          {isTransitioning && (
            <div className="absolute inset-x-0 top-0 h-[2.5px] bg-[#142035] overflow-hidden z-50">
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 0.9, ease: 'easeInOut' }}
                className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-emerald-400 shadow-[0_0_12px_rgba(245,158,11,0.8)]"
              />
            </div>
          )}
          {/* Left: Mobile Trigger + Breadcrumb + Page Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded-lg bg-[#101A2B] border border-subtle text-slate-300 hover:text-white transition"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${section}-${title}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-2 min-w-0"
              >
                <span className="hidden sm:inline text-[11px] font-medium text-slate-500">
                  {section}
                </span>
                <ChevronRight className="hidden sm:inline w-3.5 h-3.5 text-slate-600 shrink-0" />
                <h1 className="text-sm font-semibold text-white tracking-tight truncate">
                  {title}
                </h1>
                {badge && (
                  <span className="hidden md:inline-flex items-center text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-[#142035] text-sky-300 border border-sky-500/25 shrink-0">
                    {badge}
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Center slot (e.g. search) */}
          {topbarSlot && <div className="hidden md:flex flex-1 max-w-xs mx-2">{topbarSlot}</div>}

          {/* Right: Telemetry Pills + Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* User Role Badge in Top Bar */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold ${
                user?.role === 'ADMIN'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
              }`}
            >
              <span>{user?.role === 'ADMIN' ? '👑 ADMIN' : '⚡ TRADER'}</span>
            </div>

            {equityBadge != null && (
              <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#101A2B] border border-subtle text-[11px] font-mono tabular-nums">
                <span className="text-slate-400">EQUITY</span>
                <span className="text-white font-semibold">
                  ${equityBadge.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {/* Market status */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono ${
                usOpen
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                  : 'bg-[#101A2B] border-subtle text-slate-400'
              }`}
              title="Horaires NYSE/NASDAQ : 15h30 - 22h00 Paris"
            >
              {usOpen ? (
                <>
                  <LivePulseDot color="emerald" />
                  <span>NYSE OPEN</span>
                </>
              ) : (
                <>
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>NYSE CLOSED</span>
                </>
              )}
            </div>

            {/* WebSocket Status Pill */}
            {wsStatus && (
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono tabular-nums transition-colors ${
                  wsStatus.connected
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                }`}
              >
                {wsStatus.connected ? (
                  <LivePulseDot color="emerald" />
                ) : (
                  <Radio className="w-3 h-3 text-rose-400" />
                )}
                <span className="hidden sm:inline">
                  {wsStatus.label || (wsStatus.connected ? 'STOMP LIVE' : 'OFFLINE')}
                </span>
              </div>
            )}

            {/* Institutional Clock */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#101A2B] border border-subtle text-[11px] font-mono tabular-nums text-slate-300">
              <LiveClock />
            </div>

            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#101A2B] hover:bg-[#192841] border border-subtle text-[10px] font-mono text-slate-400 hover:text-white transition"
              title="Palette de navigation (Ctrl+K)"
            >
              <Command className="w-3 h-3 text-sky-400" />
              <span>K</span>
            </button>

            {topbarActions}
          </div>
        </header>

        {/* Page Body */}
        <main className={`flex-1 w-full ${maxWidthClass} mx-auto px-4 sm:px-6 py-5`}>
          {children}
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
};
