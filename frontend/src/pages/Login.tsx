import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { loginUser } from '../api/auth';
import {
  MotionStagger,
  MotionItem,
  OrbitalSpinner,
  LivePulseDot,
  useToast,
} from '../components/ui';
import {
  AuthenticationSuccessAnimation,
  CinematicLoginBackground,
  useAuthTransition,
} from '../components/auth';
import {
  TrendingUp,
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Bot,
  Activity,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import axios from 'axios';

type AuthPhase = 'idle' | 'authenticating' | 'success';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authPhase, setAuthPhase] = useState<AuthPhase>('idle');
  const transitionTimerRef = useRef<number | null>(null);

  const { login } = useAuth();
  const { beginTradingEntrance } = useAuthTransition();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/app';

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || authPhase !== 'idle') return;
    setError(null);

    if (!email.trim() || !password) {
      setError('Veuillez renseigner votre email et votre mot de passe.');
      return;
    }

    setIsSubmitting(true);
    setAuthPhase('authenticating');
    try {
      const trimmedEmail = email.trim();
      const response = await loginUser({ email: trimmedEmail, password });
      await login(response.accessToken);
      setAuthPhase('success');
      toast.success('Session authentifiée', 'Connexion au terminal MarketSim Quant établie.');

      const reduced =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      // Phase 1 -> Phase 2 handoff after authentic confirmation animation
      transitionTimerRef.current = window.setTimeout(() => {
        beginTradingEntrance(() => navigate(from, { replace: true }));
      }, reduced ? 240 : 820);
    } catch (err: unknown) {
      setAuthPhase('idle');
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          setError('Email ou mot de passe incorrect.');
        } else if (err.response?.data?.message) {
          setError(err.response.data.message);
        } else {
          setError('Impossible de se connecter au serveur backend.');
        }
      } else {
        setError('Une erreur inattendue est survenue.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] flex relative overflow-hidden">
      {/* Cinematic animated candlestick chart & institutional atmosphere */}
      <CinematicLoginBackground />

      <div className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center px-6 py-12">
        {/* Left Institutional Showcase */}
        <div className="hidden lg:flex lg:col-span-6 flex-col justify-center space-y-8 pr-6">
          <div className="inline-flex items-center gap-2.5 w-fit px-3 py-1.5 rounded-full bg-[#101A2B] border border-subtle text-[11px] font-mono text-sky-300">
            <LivePulseDot color="emerald" active size="sm" />
            INSTITUTIONAL QUANT WORKSTATION · V2.0
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-sky-500/30 flex items-center justify-center shadow-glow-cyan">
                <TrendingUp className="w-6 h-6 text-sky-400" />
              </div>
              <div>
                <span className="text-2xl font-bold tracking-tight text-white">MarketSim</span>
                <span className="ml-2 text-xs font-mono font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  QUANT AI
                </span>
              </div>
            </div>

            <h1 className="text-3xl xl:text-4xl font-bold tracking-tight text-white leading-[1.15]">
              Trading Algorithmique, Gestion du Risque &{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-violet-400">
                IA Explicable
              </span>
            </h1>

            <p className="text-sm text-slate-400 leading-relaxed max-w-lg">
              Plateforme unifiée combinant flux marché temps réel STOMP, paper trading sous contrôle de VaR 95%,
              backtesting quantitatif et stress testing bancaire par Random Forest &amp; SHAP.
            </p>
          </div>

          <MotionStagger className="grid grid-cols-2 gap-3 pt-2">
            {[
              {
                icon: Activity,
                color: 'text-sky-400',
                title: 'Live Market & Paper Desk',
                desc: 'Ticks WebSocket, chandeliers OHLC et contrôle VaR 95%',
              },
              {
                icon: ShieldAlert,
                color: 'text-violet-400',
                title: 'AI Stress Testing & SHAP',
                desc: 'Modèles ML Bâle III / IFRS 9 et explicabilité locale',
              },
              {
                icon: Sparkles,
                color: 'text-cyan-400',
                title: 'FinBERT Sentiment NLP',
                desc: 'Scoring temps réel des actualités Finnhub par IA',
              },
              {
                icon: Bot,
                color: 'text-emerald-400',
                title: 'Autonomous Strategy Lab',
                desc: 'Agents SMA Cross, RSI & filtres hybrides sentiment',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <MotionItem key={item.title}>
                  <div className="workstation-panel rounded-xl p-3.5 card-interactive h-full">
                    <Icon className={`w-4 h-4 ${item.color} mb-2`} />
                    <div className="text-xs font-semibold text-white">{item.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{item.desc}</div>
                  </div>
                </MotionItem>
              );
            })}
          </MotionStagger>
        </div>

        {/* Right Login Form */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          {/* Mobile Brand Header */}
          <div className="lg:hidden flex items-center justify-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-sky-500/30 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <span className="text-xl font-bold text-white tracking-tight">MarketSim</span>
              <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                QUANT
              </span>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="workstation-panel-elevated rounded-2xl p-7 sm:p-8 backdrop-blur-2xl bg-[#0D1424]/82 border border-slate-700/45 shadow-[0_24px_80px_rgba(2,6,23,0.75)] relative overflow-hidden"
          >
            {/* Subtle top cyan edge reflection */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent"
            />

            <AnimatePresence mode="wait">
              {authPhase === 'success' ? (
                <AuthenticationSuccessAnimation key="auth-success" email={email.trim()} />
              ) : (
                <motion.div
                  key="auth-form"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.985 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-white tracking-tight">Connexion au Terminal</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Authentification sécurisée JWT · Accès Salle de Marché
                    </p>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-rose-300 font-medium leading-relaxed">{error}</p>
                    </motion.div>
                  )}

                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                      >
                        Adresse Email
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                          <Mail className="h-4 w-4" />
                        </div>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          disabled={isSubmitting || authPhase !== 'idle'}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="trader@market.local"
                          className="block w-full pl-10 pr-3.5 py-2.5 bg-[#070B14]/90 border border-subtle rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/40 text-sm transition disabled:opacity-60"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="password"
                        className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                      >
                        Mot de Passe
                      </label>
                      <div className="relative rounded-xl transition-shadow focus-within:shadow-[0_0_24px_-8px_rgba(56,189,248,0.45)]">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                          <Lock className="h-4 w-4" />
                        </div>
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          required
                          disabled={isSubmitting || authPhase !== 'idle'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="block w-full pl-10 pr-10 py-2.5 bg-[#070B14]/90 border border-subtle rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/40 text-sm transition disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-200 transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || authPhase !== 'idle'}
                      className="w-full mt-2 flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-950 btn-primary-cyan focus:outline-none focus:ring-2 focus:ring-sky-400/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.985]"
                    >
                      {isSubmitting ? (
                        <>
                          <OrbitalSpinner size="xs" tone="slate" />
                          <span>Authentification...</span>
                        </>
                      ) : (
                        <>
                          <span>Accéder au Terminal</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="mt-6 pt-5 border-t border-subtle flex items-center justify-between text-xs">
                    <span className="text-slate-400">Nouveau sur la plateforme ?</span>
                    <Link
                      to="/register"
                      className="font-semibold text-sky-400 hover:text-sky-300 transition flex items-center gap-1"
                    >
                      Créer un compte <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
