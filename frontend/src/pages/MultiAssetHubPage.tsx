import React, { useState, useEffect, useMemo } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { OrderModal } from '../components/OrderModal';
import {
  multiAssetApi,
  ForexQuote,
  BondInstrument,
  CommodityInstrument,
  AssetAllocationBreakdown,
  CurrencyConversion,
} from '../api/multiAsset';
import {
  Globe,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowRightLeft,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Calendar,
  Flame,
  Landmark,
  RefreshCw,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { useToast, PageTransition, QuantOrbitalLoader } from '../components/ui';

export const MultiAssetHubPage: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'ALL' | 'FOREX' | 'BOND' | 'COMMODITY' | 'PORTFOLIO'>('ALL');

  // Market data states
  const [forexQuotes, setForexQuotes] = useState<ForexQuote[]>([]);
  const [bonds, setBonds] = useState<BondInstrument[]>([]);
  const [commodities, setCommodities] = useState<CommodityInstrument[]>([]);
  const [allocation, setAllocation] = useState<AssetAllocationBreakdown | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Currency Converter states
  const [convAmount, setConvAmount] = useState<number>(10000);
  const [convFrom, setConvFrom] = useState<string>('EUR');
  const [convTo, setConvTo] = useState<string>('USD');
  const [convResult, setConvResult] = useState<CurrencyConversion | null>(null);
  const [convLoading, setConvLoading] = useState<boolean>(false);

  // Order modal state
  const [orderState, setOrderState] = useState<{
    isOpen: boolean;
    symbol: string;
    side: 'BUY' | 'SELL';
    price: number | null;
  }>({
    isOpen: false,
    symbol: 'EUR/USD',
    side: 'BUY',
    price: null,
  });

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [fxData, bondData, cmdData, allocData] = await Promise.all([
        multiAssetApi.getAllForexQuotes(),
        multiAssetApi.getAllBonds(),
        multiAssetApi.getAllCommodities(),
        multiAssetApi.getPortfolioAllocation(0).catch(() => null),
      ]);
      setForexQuotes(fxData);
      setBonds(bondData);
      setCommodities(cmdData);
      setAllocation(allocData);
    } catch (err: any) {
      toast.error('Erreur de chargement multi-actifs', err?.message || 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Run currency conversion
  const handleConvert = async () => {
    if (convAmount <= 0) return;
    setConvLoading(true);
    try {
      const res = await multiAssetApi.convertCurrency(convAmount, convFrom, convTo);
      setConvResult(res);
    } catch (err: any) {
      toast.error('Erreur conversion', err?.message || 'Calcul impossible');
    } finally {
      setConvLoading(false);
    }
  };

  useEffect(() => {
    handleConvert();
  }, [convFrom, convTo]);

  const handleOpenOrder = (symbol: string, side: 'BUY' | 'SELL', price: number) => {
    setOrderState({
      isOpen: true,
      symbol,
      side,
      price,
    });
  };

  const isForexOpen = useMemo(() => {
    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    if (day === 6) return false;
    if (day === 0 && hour < 21) return false;
    if (day === 5 && hour >= 21) return false;
    return true;
  }, []);

  return (
    <AppShell title="Marchés Multi-Actifs" section="Trading Multi-Classes" badge="Forex • Bonds • Cmdty">
      <PageTransition className="space-y-6 pb-12">
        {/* Top Header & Market Clocks */}
        <div className="relative overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-r from-[#0B1220] via-[#0E172B] to-[#101A2B] p-6 shadow-2xl backdrop-blur-md">
          <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
          <div className="absolute left-1/3 bottom-0 -mb-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 ring-1 ring-sky-400/30">
                  <Globe className="h-5 w-5" />
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                  Terminal Multi-Actifs Institutionnel
                </h1>
              </div>
              <p className="mt-1.5 text-sm text-slate-400 max-w-2xl">
                Accès direct aux paires de devises Forex (BCE 24/5), aux obligations souveraines & benchmarks (YTM, duration)
                et aux matières premières physiques & énergies avec exécution Bid/Ask et ventilation d'allocation.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#070B14]/80 px-3.5 py-2 text-xs backdrop-blur-sm">
                <span className={`h-2.5 w-2.5 rounded-full ${isForexOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                <span className="text-slate-400">Forex 24/5:</span>
                <span className={isForexOpen ? 'font-semibold text-emerald-400' : 'font-semibold text-rose-400'}>
                  {isForexOpen ? 'OUVERT (Interbancaire)' : 'FERMÉ (Week-end)'}
                </span>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#070B14]/80 px-3.5 py-2 text-xs backdrop-blur-sm">
                <Clock className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-slate-400">Dette US (100$ Par):</span>
                <span className="font-semibold text-indigo-300">Clean / Dirty Price</span>
              </div>

              <button
                onClick={loadAllData}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2 text-xs font-medium text-sky-300 transition-all hover:bg-sky-500/20"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
            </div>
          </div>

          {/* Navigation Filter Tabs */}
          <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-800/80 pt-4">
            {[
              { id: 'ALL', label: 'Vue d\'Ensemble', icon: Layers },
              { id: 'FOREX', label: 'Devises Forex (8 Paires)', icon: ArrowRightLeft },
              { id: 'BOND', label: 'Obligations & Courbe des Taux (7 Benchmarks)', icon: Landmark },
              { id: 'COMMODITY', label: 'Matières Premières & Énergie (7 Actifs)', icon: Flame },
              { id: 'PORTFOLIO', label: 'Allocation & Diversification Portefeuille', icon: PieChartIcon },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25 ring-1 ring-sky-400'
                      : 'border border-slate-800 bg-[#070B14]/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── CHARGEMENT ANIMÉ INSTITUTIONNEL ─────────────────────────────── */}
        {loading ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-amber-500/25 bg-[#0B1220]/95 p-8 shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden backdrop-blur-md">
              <div className="absolute inset-x-0 top-0 h-[3px] bg-slate-800 overflow-hidden">
                <div className="h-full w-1/3 bg-gradient-to-r from-amber-500 via-sky-400 to-emerald-400 animate-pulse rounded-full" />
              </div>
              <QuantOrbitalLoader
                size="lg"
                tone="amber"
                icon={Globe}
                badge="SYNCHRONISATION DES MARCHÉS EN COURS"
                title="Chargement des Marchés Multi-Actifs..."
                subtitle="Interrogation des taux interbancaires BCE (EUR/USD, GBP/USD), des obligations US (TLT, IEF) et des matières premières physiques..."
              />
            </div>

            {/* Skeletons preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="rounded-2xl border border-slate-800/80 bg-[#0B1220] p-4 space-y-3 animate-pulse">
                  <div className="flex justify-between items-center">
                    <div className="h-4 w-20 bg-slate-800 rounded" />
                    <div className="h-4 w-12 bg-slate-800 rounded" />
                  </div>
                  <div className="h-6 w-28 bg-slate-800 rounded" />
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="h-8 bg-slate-800/60 rounded-xl" />
                    <div className="h-8 bg-slate-800/60 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* ── CONVERTISSEUR DEVISES EN DIRECT (BCE) ───────────────────────── */}
        <div className="rounded-2xl border border-slate-800 bg-[#0B1220]/90 p-5 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                <DollarSign className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Convertisseur Devises Réel (Banque Centrale Européenne)</h3>
                <p className="text-xs text-slate-400">Taux de change officiels BCE avec actualisation continue</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#070B14] px-3 py-1.5">
                <span className="text-xs text-slate-400">Montant :</span>
                <input
                  type="number"
                  value={convAmount}
                  onChange={e => setConvAmount(Number(e.target.value))}
                  className="w-28 bg-transparent text-right font-mono text-sm font-bold text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  value={convFrom}
                  onChange={e => setConvFrom(e.target.value)}
                  className="rounded-xl border border-slate-800 bg-[#070B14] px-3 py-1.5 font-mono text-xs font-semibold text-emerald-400 focus:outline-none"
                >
                  {['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ArrowRightLeft className="h-3.5 w-3.5 text-slate-500" />
                <select
                  value={convTo}
                  onChange={e => setConvTo(e.target.value)}
                  className="rounded-xl border border-slate-800 bg-[#070B14] px-3 py-1.5 font-mono text-xs font-semibold text-sky-400 focus:outline-none"
                >
                  {['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleConvert}
                disabled={convLoading}
                className="rounded-xl bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-950 transition-all hover:bg-emerald-400"
              >
                {convLoading ? 'Calcul...' : 'Convertir'}
              </button>
            </div>
          </div>

          {convResult && (
            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-300">
                  {convResult.amount.toLocaleString()} {convResult.fromCurrency} =
                </span>
                <span className="font-mono text-base font-bold text-emerald-400">
                  {convResult.convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {convResult.toCurrency}
                </span>
                <span className="text-slate-400">
                  (1 {convResult.fromCurrency} = {convResult.exchangeRate} {convResult.toCurrency})
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <Calendar className="h-3 w-3" />
                <span>Date de référence BCE : {convResult.rateDate}</span>
                <span>•</span>
                <span>{convResult.marketDataSource}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── SECTION 1 : FOREX MARKET ────────────────────────────────────── */}
        {(activeTab === 'ALL' || activeTab === 'FOREX') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                  <ArrowRightLeft className="h-4 w-4" />
                </span>
                <h2 className="text-lg font-bold text-white">Bureau Devises Forex • Spreads & Négociation 24/5</h2>
              </div>
              <span className="text-xs text-slate-400">
                Source : Banque Centrale Européenne (BCE) • Exécution Bid (Vente) / Ask (Achat)
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {forexQuotes.map(fx => (
                <div
                  key={fx.symbol}
                  className="group relative overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0B1220] p-4 transition-all hover:border-sky-500/40 hover:shadow-xl hover:shadow-sky-500/5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-bold text-white group-hover:text-sky-300">
                          {fx.symbol}
                        </span>
                        <span className="rounded-md border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
                          {fx.spreadPips} pips
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate max-w-[160px]">{fx.displayName}</p>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-base font-extrabold text-white">
                        {fx.midPrice.toFixed(fx.pipSize < 0.001 ? 4 : 2)}
                      </div>
                      <div
                        className={`flex items-center justify-end gap-1 text-[11px] font-semibold ${
                          fx.change24hPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {fx.change24hPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        <span>{fx.change24hPct >= 0 ? '+' : ''}{fx.change24hPct.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Bid & Ask Execution Buttons */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleOpenOrder(fx.symbol, 'SELL', fx.bid)}
                      className="group/btn flex flex-col items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 py-2 transition-all hover:bg-rose-500 hover:text-white"
                    >
                      <span className="text-[10px] font-bold text-rose-400 group-hover/btn:text-white">VENTE (BID)</span>
                      <span className="font-mono text-xs font-extrabold text-white">
                        {fx.bid.toFixed(fx.pipSize < 0.001 ? 4 : 2)}
                      </span>
                    </button>

                    <button
                      onClick={() => handleOpenOrder(fx.symbol, 'BUY', fx.ask)}
                      className="group/btn flex flex-col items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 transition-all hover:bg-emerald-500 hover:text-white"
                    >
                      <span className="text-[10px] font-bold text-emerald-400 group-hover/btn:text-white">ACHAT (ASK)</span>
                      <span className="font-mono text-xs font-extrabold text-white">
                        {fx.ask.toFixed(fx.pipSize < 0.001 ? 4 : 2)}
                      </span>
                    </button>
                  </div>

                  {/* Pip value & Session metadata */}
                  <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-[10px] text-slate-400">
                    <span>Valeur pip : <strong className="text-slate-200">${fx.pipValueUsd.toFixed(2)}</strong></span>
                    <span className="flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${fx.sessionStatus === 'OPEN' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                      {fx.sessionStatus === 'OPEN' ? '24/5 Actif' : 'Marché fermé'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SECTION 2 : FIXED INCOME / OBLIGATIONS ──────────────────────── */}
        {(activeTab === 'ALL' || activeTab === 'BOND') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Landmark className="h-4 w-4" />
                </span>
                <h2 className="text-lg font-bold text-white">Obligations & Courbe des Taux (Fixed Income)</h2>
              </div>
              <span className="text-xs text-slate-400">
                Calculs certifiés : Rendement actuel, YTM approximé, Macaulay & Modified Duration
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0B1220] shadow-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#070B14]/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3.5">Instrument / Émetteur</th>
                    <th className="px-3 py-3.5 text-right">Cours Propre (Clean)</th>
                    <th className="px-3 py-3.5 text-right">Cours Sale (Dirty)</th>
                    <th className="px-3 py-3.5 text-right">Coupon Annuel</th>
                    <th className="px-3 py-3.5 text-right">Rendement Actuel</th>
                    <th className="px-3 py-3.5 text-right">YTM (À Échéance)</th>
                    <th className="px-3 py-3.5 text-right">Duration Modifiée</th>
                    <th className="px-3 py-3.5 text-center">Échéance</th>
                    <th className="px-4 py-3.5 text-center">Négociation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {bonds.map(b => (
                    <tr key={b.symbol} className="transition-colors hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-sans">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 font-mono text-xs font-bold text-indigo-400">
                            {b.symbol}
                          </span>
                          <div>
                            <div className="font-semibold text-white">{b.displayName}</div>
                            <div className="text-[10px] text-slate-400">{b.issuerName}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3 text-right font-bold text-white">
                        ${b.cleanPrice.toFixed(2)}
                      </td>

                      <td className="px-3 py-3 text-right text-indigo-300">
                        ${b.dirtyPrice.toFixed(2)}
                        <span className="block text-[10px] text-slate-500">+{b.accruedInterest.toFixed(2)}$ courus</span>
                      </td>

                      <td className="px-3 py-3 text-right text-slate-300 font-sans">
                        <span className="font-mono font-semibold text-white">{b.couponRate.toFixed(2)}%</span>
                        <span className="block text-[10px] text-slate-500">{b.paymentFrequency}</span>
                      </td>

                      <td className="px-3 py-3 text-right text-emerald-400 font-bold">
                        {b.currentYield.toFixed(2)}%
                      </td>

                      <td className="px-3 py-3 text-right text-amber-400 font-bold">
                        {b.yieldToMaturity.toFixed(2)}%
                      </td>

                      <td className="px-3 py-3 text-right text-indigo-400 font-semibold">
                        {b.modifiedDuration.toFixed(2)} ans
                        <span className="block text-[10px] text-slate-500">Mac: {b.macaulayDuration.toFixed(1)}a</span>
                      </td>

                      <td className="px-3 py-3 text-center text-slate-300">
                        {b.maturityYears.toFixed(1)} ans
                      </td>

                      <td className="px-4 py-3 text-center font-sans">
                        <button
                          onClick={() => handleOpenOrder(b.symbol, 'BUY', b.cleanPrice)}
                          className="rounded-xl border border-indigo-500/40 bg-indigo-500/20 px-3 py-1.5 text-xs font-semibold text-indigo-300 transition-all hover:bg-indigo-500 hover:text-white"
                        >
                          Passer Ordre
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── SECTION 3 : COMMODITIES / MATIÈRES PREMIÈRES ────────────────── */}
        {(activeTab === 'ALL' || activeTab === 'COMMODITY') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-500/20 text-pink-400">
                  <Flame className="h-4 w-4" />
                </span>
                <h2 className="text-lg font-bold text-white">Matières Premières, Énergie & Agriculture</h2>
              </div>
              <span className="text-xs text-slate-400">
                Contrats Spot physiques & indices à terme de référence (Finnhub Quotes)
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {commodities.map(c => {
                const groupColor =
                  c.commodityGroup === 'PRECIOUS_METALS'
                    ? 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                    : c.commodityGroup === 'ENERGY'
                    ? 'border-rose-500/30 text-rose-400 bg-rose-500/10'
                    : c.commodityGroup === 'INDUSTRIAL_METALS'
                    ? 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10'
                    : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10';

                return (
                  <div
                    key={c.symbol}
                    className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#0B1220] p-4 transition-all hover:border-pink-500/40 hover:shadow-xl"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold ${groupColor}`}>
                            {c.commodityGroup}
                          </span>
                          <h3 className="mt-2 font-mono text-base font-bold text-white">{c.symbol}</h3>
                          <p className="text-xs text-slate-300 font-medium">{c.displayName}</p>
                        </div>

                        <div className="text-right">
                          <div className="font-mono text-base font-extrabold text-white">${c.currentPrice.toFixed(2)}</div>
                          <div
                            className={`flex items-center justify-end gap-1 text-[11px] font-semibold ${
                              c.change24hPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {c.change24hPct >= 0 ? '+' : ''}{c.change24hPct.toFixed(2)}%
                          </div>
                        </div>
                      </div>

                      {/* Physical backing description */}
                      <div className="mt-3 rounded-xl border border-slate-800/80 bg-[#070B14]/70 p-2.5 text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-300">Sous-jacent & Unité : </span>
                        {c.unit} • {c.physicalBacking}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 border-t border-slate-800/80 pt-3">
                      <button
                        onClick={() => handleOpenOrder(c.symbol, 'SELL', c.bid)}
                        className="flex-1 rounded-xl border border-rose-500/30 bg-rose-500/10 py-1.5 text-center font-mono text-xs font-bold text-rose-300 transition-all hover:bg-rose-500 hover:text-white"
                      >
                        Vendre ${c.bid.toFixed(2)}
                      </button>
                      <button
                        onClick={() => handleOpenOrder(c.symbol, 'BUY', c.ask)}
                        className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-center font-mono text-xs font-bold text-emerald-300 transition-all hover:bg-emerald-500 hover:text-white"
                      >
                        Acheter ${c.ask.toFixed(2)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SECTION 4 : ALLOCATION MULTI-ACTIFS & RISQUE ─────────────────── */}
        {(activeTab === 'ALL' || activeTab === 'PORTFOLIO') && allocation && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
                  <PieChartIcon className="h-4 w-4" />
                </span>
                <h2 className="text-lg font-bold text-white">Allocation & Diversification Multi-Actifs</h2>
              </div>
              <span className="text-xs text-slate-400">
                Pondération en temps réel à travers les 5 classes d'actifs et les liquidités
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Summary & Commentary Card */}
              <div className="rounded-2xl border border-slate-800 bg-[#0B1220] p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Santé de la Diversification</h3>
                  <div className="mt-3 flex items-center gap-2.5">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        allocation.isDiversified ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {allocation.isDiversified ? <ShieldCheck className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                    </span>
                    <div>
                      <div className="text-base font-bold text-white">
                        {allocation.isDiversified ? 'Portefeuille Bien Diversifié' : 'Diversification Partielle'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {allocation.isDiversified ? 'Conforme aux limites institutionnelles' : 'Concentration sectorielle élevée'}
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 rounded-xl border border-slate-800 bg-[#070B14] p-3 text-xs leading-relaxed text-slate-300">
                    {allocation.riskCommentary}
                  </p>

                  {allocation.concentrationAlerts && allocation.concentrationAlerts.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {allocation.concentrationAlerts.map((alert, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2">
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>{alert}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 border-t border-slate-800 pt-4">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Valeur Totale Portefeuille :</span>
                    <span className="font-mono font-bold text-white">${allocation.totalPortfolioValue.toLocaleString()}</span>
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs text-slate-400">
                    <span>Liquidités Disponibles (Cash) :</span>
                    <span className="font-mono font-bold text-emerald-400">
                      ${allocation.cashBalance.toLocaleString()} ({allocation.cashWeightPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Slices & Asset Classes Table */}
              <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-[#0B1220] p-5 shadow-xl">
                <h3 className="text-sm font-semibold text-white mb-3">Répartition par Classe d'Actif</h3>

                {/* Progress Allocation Bar */}
                <div className="mb-4 flex h-3.5 w-full overflow-hidden rounded-full bg-slate-800/80 p-0.5">
                  {allocation.slices.map(slice => {
                    if (slice.weightPct <= 0) return null;
                    return (
                      <div
                        key={slice.assetClass}
                        style={{ width: `${slice.weightPct}%`, backgroundColor: slice.colorCode }}
                        className="h-full first:rounded-l-full last:rounded-r-full transition-all"
                        title={`${slice.label}: ${slice.weightPct}%`}
                      />
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {allocation.slices.map(slice => (
                    <div
                      key={slice.assetClass}
                      className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-[#070B14]/60 p-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: slice.colorCode }}
                        />
                        <div>
                          <div className="text-xs font-semibold text-white">{slice.label}</div>
                          <div className="text-[10px] text-slate-400">{slice.positionsCount} position(s) ouverte(s)</div>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <div className="text-xs font-bold text-white">${slice.marketValue.toLocaleString()}</div>
                        <div className="text-[11px] font-semibold text-sky-400">{slice.weightPct.toFixed(1)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
          </>
        )}

        {/* Modal d'Ordre pour tous les actifs */}
        {orderState.isOpen && (
          <OrderModal
            isOpen={orderState.isOpen}
            symbol={orderState.symbol}
            lastPrice={orderState.price}
            initialSide={orderState.side}
            sessionId={0}
            onClose={() => setOrderState(prev => ({ ...prev, isOpen: false }))}
            onFilled={() => {
              loadAllData();
              setOrderState(prev => ({ ...prev, isOpen: false }));
              toast.success('Ordre exécuté', `Ordre sur ${orderState.symbol} exécuté avec succès.`);
            }}
          />
        )}
      </PageTransition>
    </AppShell>
  );
};
