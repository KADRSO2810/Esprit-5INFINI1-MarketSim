import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { TradingSessionLoader } from './auth';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requiredRole?: 'ADMIN' | 'USER';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070B14] flex flex-col items-center justify-center p-6 text-slate-300 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 45%, rgba(6,182,212,0.12), transparent 55%)',
          }}
        />
        <TradingSessionLoader
          title="MarketSim Quant Terminal"
          subtitle="Vérification de la session sécurisée JWT..."
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole === 'ADMIN' && user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-[#070B14] flex items-center justify-center p-6 relative overflow-hidden select-none">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 40%, rgba(244,63,94,0.12), transparent 60%)',
          }}
        />
        <div className="relative z-10 max-w-md w-full rounded-3xl border border-rose-500/30 bg-[#0B1220]/95 p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/10 text-rose-400 shadow-lg shadow-rose-500/20">
            <ShieldAlert className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-mono font-bold text-rose-300">
              ERREUR 403 · ACCÈS RESTREINT
            </span>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Privilèges Administrateur Requis
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Votre compte actuel (<strong className="text-slate-200">{user?.email}</strong>) dispose du rôle <strong className="text-emerald-400">TRADER (Simple Utilisateur)</strong>.
              Ce module est réservé à la supervision institutionnelle et à la gestion de la salle de marché (Section 5 du Cahier des Charges).
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              onClick={() => navigate('/app')}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-500/20 hover:brightness-110 transition active:scale-[0.98]"
            >
              <ArrowLeft className="h-4 w-4" />
              Retourner au Terminal de Trading
            </button>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <LogOut className="h-4 w-4" />
              Changer de compte
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
};
