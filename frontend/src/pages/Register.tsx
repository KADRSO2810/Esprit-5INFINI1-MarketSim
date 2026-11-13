import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { registerUser, loginUser } from '../api/auth';
import { OrbitalSpinner, useToast } from '../components/ui';
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
  CheckCircle2,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';
import axios from 'axios';

export const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);
  const timerRef = useRef<number | null>(null);

  const { login } = useAuth();
  const { beginTradingEntrance } = useAuthTransition();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || authSuccess) return;
    setError(null);

    if (!email.trim() || !password) {
      setError('Veuillez renseigner tous les champs obligatoires.');
      return;
    }

    if (password.length < 8) {
      setError('Le mot de passe doit comporter au moins 8 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);
    try {
      const trimmedEmail = email.trim();
      await registerUser({ email: trimmedEmail, password });
      const loginRes = await loginUser({ email: trimmedEmail, password });
      await login(loginRes.accessToken);
      setAuthSuccess(true);
      toast.success('Compte trader créé', 'Portefeuille initial de $100,000 provisionné.');

      const reduced =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      timerRef.current = window.setTimeout(() => {
        beginTradingEntrance(() => navigate('/app', { replace: true }));
      }, reduced ? 240 : 820);
    } catch (err: unknown) {
      setAuthSuccess(false);
      if (axios.isAxiosError(err)) {
        if (err.response?.data?.message) {
          setError(err.response.data.message);
        } else if (err.response?.data?.validationErrors) {
          const firstErr = Object.values(err.response.data.validationErrors)[0] as string;
          setError(firstErr || 'Données invalides.');
        } else {
          setError('Erreur lors de l’inscription.');
        }
      } else {
        setError('Une erreur inattendue est survenue.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <CinematicLoginBackground />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex items-center justify-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-sky-500/30 flex items-center justify-center shadow-glow-cyan">
            <TrendingUp className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <span className="text-xl font-bold text-white tracking-tight">MarketSim</span>
            <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
              QUANT AI
            </span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="workstation-panel-elevated rounded-2xl p-7 sm:p-8 backdrop-blur-2xl bg-[#0D1424]/82 border border-slate-700/45 shadow-[0_24px_80px_rgba(2,6,23,0.75)] relative overflow-hidden"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent"
          />
          <AnimatePresence mode="wait">
            {authSuccess ? (
              <AuthenticationSuccessAnimation key="reg-success" email={email.trim()} />
            ) : (
              <motion.div
                key="reg-form"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.985 }}
                transition={{ duration: 0.25 }}
              >
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-mono mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              CAPITAL INITIAL PAPER : $100,000
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Créer un compte trader</h2>
            <p className="text-xs text-slate-400 mt-1">
              Provisionnement instantané du terminal et portefeuille simulé
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-300 font-medium leading-relaxed">{error}</p>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="reg-email"
                className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Adresse Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="trader@market.local"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-[#070B14] border border-subtle rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/40 text-sm transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="reg-password"
                className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Mot de Passe (8 caractères minimum)
              </label>
              <div className="relative rounded-xl transition-shadow focus-within:shadow-[0_0_24px_-8px_rgba(56,189,248,0.45)]">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="reg-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 bg-[#070B14] border border-subtle rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/40 text-sm transition"
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

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Confirmer le Mot de Passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-[#070B14] border border-subtle rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/40 text-sm transition"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#070B14]/70 border border-subtle space-y-1.5 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${password.length >= 8 ? 'text-emerald-400' : 'text-slate-600'}`}
                />
                <span className={password.length >= 8 ? 'text-slate-200' : ''}>
                  Minimum 8 caractères requis
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${
                    password && password === confirmPassword ? 'text-emerald-400' : 'text-slate-600'
                  }`}
                />
                <span className={password && password === confirmPassword ? 'text-slate-200' : ''}>
                  Correspondance des mots de passe
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-950 btn-primary-cyan focus:outline-none focus:ring-2 focus:ring-sky-400/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.985]"
            >
              {isSubmitting ? (
                <>
                  <OrbitalSpinner size="xs" tone="slate" />
                  <span>Création du compte...</span>
                </>
              ) : (
                <>
                  <span>Créer mon compte</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-subtle flex items-center justify-between text-xs">
            <span className="text-slate-400">Déjà enregistré ?</span>
            <Link
              to="/login"
              className="font-semibold text-sky-400 hover:text-sky-300 transition flex items-center gap-1"
            >
              Se connecter <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};
