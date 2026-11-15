import React, { useState, useEffect } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { useToast, PageTransition, QuantOrbitalLoader } from '../components/ui';
import { adminApi, PlatformOverview, UserSummary } from '../api/admin';
import {
  ShieldCheck,
  Users,
  Activity,
  Server,
  Cpu,
  HelpCircle,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

export const AdminPage: React.FC = () => {
  const toast = useToast();
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);

  const fetchAdminData = async () => {
    try {
      const [ov, usrs] = await Promise.all([
        adminApi.getOverview(),
        adminApi.getUsers(),
      ]);
      setOverview(ov);
      setUsers(usrs);
    } catch (err: any) {
      toast.error('Erreur Administration', err?.message || 'Accès réservé aux administrateurs ou serveur indisponible');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleToggleRole = async (user: UserSummary) => {
    const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    try {
      setUpdatingUserId(user.id);
      await adminApi.updateUserRole(user.id, newRole);
      toast.success('Rôle mis à jour', `L'utilisateur ${user.email} est désormais ${newRole}.`);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
    } catch (err: any) {
      toast.error('Erreur', err?.message || 'Impossible de modifier le rôle');
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <AppShell title="Console d'Administration" section="Supervision & Contrôle">
      <PageTransition>
        {loading ? (
          <div className="py-24 flex justify-center">
            <QuantOrbitalLoader
              tone="violet"
              title="Console de Supervision & Administration"
              subtitle="Chargement des métriques globales, état des flux et gestion des comptes..."
            />
          </div>
        ) : (
          <div className="space-y-6">

            {/* Header */}
            <div className="relative overflow-hidden rounded-3xl border border-violet-500/30 bg-gradient-to-br from-[#0B1220] via-[#070B14] to-[#120D24] p-6 shadow-2xl">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-500/40 bg-violet-500/10 text-violet-400">
                      <ShieldCheck className="h-7 w-7" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        Supervision & Administration de la Salle de Marché
                        <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-bold text-violet-300">
                          Section 5 ESPRIT
                        </span>
                      </h1>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Surveillance temps réel des flux de marché, volume d'exécution, états financiers SEC et gestion des privilèges.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setRefreshing(true);
                    fetchAdminData();
                  }}
                  disabled={refreshing}
                  className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#070B14] px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Actualiser les Données
                </button>
              </div>
            </div>

            {/* Platform Metrics KPI Grid */}
            {overview && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-4 text-center">
                  <div className="flex justify-center mb-1 text-sky-400"><Users className="h-5 w-5" /></div>
                  <span className="text-[10px] uppercase text-slate-400 font-medium">Utilisateurs</span>
                  <div className="font-mono text-xl font-bold text-white mt-0.5">{overview.totalUsers}</div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-4 text-center">
                  <div className="flex justify-center mb-1 text-emerald-400"><TrendingUp className="h-5 w-5" /></div>
                  <span className="text-[10px] uppercase text-slate-400 font-medium">Portefeuilles</span>
                  <div className="font-mono text-xl font-bold text-white mt-0.5">{overview.totalPortfolios}</div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-4 text-center">
                  <div className="flex justify-center mb-1 text-amber-400"><Activity className="h-5 w-5" /></div>
                  <span className="text-[10px] uppercase text-slate-400 font-medium">Transactions</span>
                  <div className="font-mono text-xl font-bold text-white mt-0.5">{overview.totalTrades}</div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-4 text-center">
                  <div className="flex justify-center mb-1 text-violet-400"><Server className="h-5 w-5" /></div>
                  <span className="text-[10px] uppercase text-slate-400 font-medium">Stress Runs</span>
                  <div className="font-mono text-xl font-bold text-white mt-0.5">{overview.totalStressRuns}</div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-4 text-center">
                  <div className="flex justify-center mb-1 text-indigo-400"><HelpCircle className="h-5 w-5" /></div>
                  <span className="text-[10px] uppercase text-slate-400 font-medium">Quiz QCM</span>
                  <div className="font-mono text-xl font-bold text-white mt-0.5">{overview.totalQuizAttempts}</div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-4 text-center">
                  <div className="flex justify-center mb-1 text-rose-400"><Cpu className="h-5 w-5" /></div>
                  <span className="text-[10px] uppercase text-slate-400 font-medium">Modèles IA</span>
                  <div className="font-mono text-xl font-bold text-white mt-0.5">{overview.totalAiModels}</div>
                </div>
              </div>
            )}

            {/* Service Health Monitor */}
            {overview && (
              <div className="rounded-3xl border border-slate-800 bg-[#0B1220] p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Server className="h-5 w-5 text-emerald-400" />
                    État des Services & Connecteurs Temps Réel
                  </h3>
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Tous les services opérationnels (100% SLA)
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(overview.serviceHealth).map(([serviceName, isOk]) => (
                    <div
                      key={serviceName}
                      className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-800 bg-[#070B14]"
                    >
                      <span className="text-xs text-slate-300 font-medium">{serviceName}</span>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <span className="text-[11px] font-mono text-emerald-400 font-bold">
                          {isOk ? 'ACTIF' : 'HORS LIGNE'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gestion des Comptes Utilisateurs */}
            <div className="rounded-3xl border border-slate-800 bg-[#0B1220] p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-sky-400" />
                    Gestion des Comptes & Autorisations
                  </h3>
                  <p className="text-xs text-slate-400">
                    Contrôle des privilèges d'accès aux modules institutionnels et d'administration.
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {users.length} comptes enregistrés
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#070B14] text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">ID</th>
                      <th className="py-3 px-4">Identifiant / Email</th>
                      <th className="py-3 px-4">Rôle Actuel</th>
                      <th className="py-3 px-4">Date de Création</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {users.map((u) => {
                      const isAdmin = u.role === 'ADMIN';
                      const isUpdating = updatingUserId === u.id;

                      return (
                        <tr key={u.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 px-4 text-slate-400">#{u.id}</td>
                          <td className="py-3 px-4 text-white font-medium">{u.email}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              isAdmin
                                ? 'border-violet-500/40 bg-violet-500/15 text-violet-300'
                                : 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                            }`}>
                              {isAdmin ? <ShieldCheck className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {u.createdAt ? new Date(u.createdAt).toLocaleString('fr-FR') : 'Initialisé'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleToggleRole(u)}
                              disabled={isUpdating}
                              className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition ${
                                isAdmin
                                  ? 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:border-slate-600'
                                  : 'border-violet-500/40 bg-violet-500/20 text-violet-300 hover:bg-violet-500/30'
                              }`}
                            >
                              {isUpdating ? (
                                <RefreshCw className="h-3 w-3 animate-spin inline mr-1" />
                              ) : null}
                              {isAdmin ? 'Rétrograder en USER' : 'Promouvoir ADMIN'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </PageTransition>
    </AppShell>
  );
};
