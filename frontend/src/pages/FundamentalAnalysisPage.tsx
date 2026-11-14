import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Building2,
  TrendingUp,
  BarChart3,
  DollarSign,
  ShieldAlert,
  ShieldCheck,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  Info,
  AlertTriangle,
  X,
  Plus,
  Printer,
  Download,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import {
  CompanyFundamentalOverview,
  CompanyFinancialStatements,
  CompanyComparison,
  CompanySearchItem,
  getCompanyOverview,
  getCompanyFinancialStatements,
  compareCompanies,
  searchCompanies,
} from '../api/fundamentals';
import { AssetLogo, OrbitalSpinner, useToast } from '../components/ui';

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'AMZN', 'META', 'TSLA', 'JPM', 'NFLX', 'AMD'];

export const FundamentalAnalysisPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSymbol = searchParams.get('symbol') || 'AAPL';
  const toast = useToast();

  const [symbol, setSymbol] = useState<string>(initialSymbol.toUpperCase());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<CompanySearchItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const [mode, setMode] = useState<'deepdive' | 'compare'>('deepdive');
  const [data, setData] = useState<CompanyFundamentalOverview | null>(null);
  const [statements, setStatements] = useState<CompanyFinancialStatements | null>(null);
  const [statementFreq, setStatementFreq] = useState<'ANNUAL' | 'QUARTERLY'>('ANNUAL');
  const [activeStatementTab, setActiveStatementTab] = useState<'income' | 'balance' | 'cashflow'>('income');
  const [activeMainTab, setActiveMainTab] = useState<'statements' | 'ratios' | 'charts'>('statements');

  // Multi-Company Comparison state
  const [compareSymbols, setCompareSymbols] = useState<string[]>(['AAPL', 'MSFT', 'GOOGL']);
  const [comparisonData, setComparisonData] = useState<CompanyComparison | null>(null);
  const [compareLoading, setCompareLoading] = useState<boolean>(false);
  const [newCompareTicker, setNewCompareTicker] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Company Overview
  const fetchOverview = useCallback(async (sym: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await getCompanyOverview(sym);
      setData(res);

      // Fetch corresponding statements for frequency
      const stmtRes = await getCompanyFinancialStatements(sym, statementFreq);
      setStatements(stmtRes);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Erreur lors de la récupération des données fondamentales.";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statementFreq]);

  // Fetch comparison
  const fetchComparison = useCallback(async (syms: string[]) => {
    if (syms.length < 2) return;
    setCompareLoading(true);
    try {
      const res = await compareCompanies(syms);
      setComparisonData(res);
    } catch (err: unknown) {
      toast.error('Erreur de comparaison', "Impossible de charger la comparaison d'entreprises.");
    } finally {
      setCompareLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (mode === 'deepdive') {
      fetchOverview(symbol);
    } else {
      fetchComparison(compareSymbols);
    }
  }, [symbol, mode, fetchOverview, fetchComparison, compareSymbols]);

  // Switch frequency
  const handleFrequencyChange = async (freq: 'ANNUAL' | 'QUARTERLY') => {
    setStatementFreq(freq);
    try {
      const stmtRes = await getCompanyFinancialStatements(symbol, freq);
      setStatements(stmtRes);
    } catch (err) {
      toast.error('Erreur', "Impossible de charger les états financiers.");
    }
  };

  // Search input change
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.trim().length > 0) {
      setIsSearching(true);
      try {
        const results = await searchCompanies(q);
        setSearchResults(results);
      } catch (err) {
        setSearchResults([]);
      }
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  const selectSymbol = (sym: string) => {
    setSymbol(sym);
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
    setSearchParams({ symbol: sym });
  };

  const handleAddCompareSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    const s = newCompareTicker.trim().toUpperCase();
    if (!s) return;
    if (compareSymbols.includes(s)) {
      toast.info('Déjà présent', `${s} est déjà dans la comparaison.`);
      setNewCompareTicker('');
      return;
    }
    if (compareSymbols.length >= 5) {
      toast.warning('Limite atteinte', 'Vous pouvez comparer jusqu’à 5 entreprises simultanément.');
      return;
    }
    const updated = [...compareSymbols, s];
    setCompareSymbols(updated);
    setNewCompareTicker('');
    fetchComparison(updated);
  };

  const handleRemoveCompareSymbol = (sym: string) => {
    if (compareSymbols.length <= 2) {
      toast.warning('Minimum requis', 'La comparaison nécessite au moins 2 entreprises.');
      return;
    }
    const updated = compareSymbols.filter((s) => s !== sym);
    setCompareSymbols(updated);
    fetchComparison(updated);
  };

  const formatBillion = (val?: number | null) => {
    if (val == null) return 'N/A';
    const b = val / 1_000_000_000;
    return `$${b.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}B`;
  };

  const formatMillion = (val?: number | null) => {
    if (val == null) return 'N/A';
    const m = val / 1_000_000;
    return `$${m.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
  };

  // Helper pour télécharger du texte/CSV avec BOM UTF-8 (compatibilité universelle Excel/Sheets)
  const downloadBlob = (content: string, filename: string, mimeType = 'text/csv;charset=utf-8;') => {
    const blob = new Blob(['\uFEFF' + content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export Excel structuré (.csv haute fidélité)
  const handleExportExcel = () => {
    try {
      let csv = 'sep=;\r\n'; // Séparateur explicite pour Microsoft Excel

      if (mode === 'deepdive') {
        if (!data || !data.available) {
          toast.warning('Export impossible', "Aucune donnée fondamentale valide disponible pour l'export.");
          return;
        }

        const dateStr = new Date().toLocaleString('fr-FR');
        csv += `RAPPORT D'ANALYSE FONDAMENTALE INSTITUTIONNELLE;MARKET SIMULATOR\r\n`;
        csv += `Société;${data.profile?.name || symbol} (${symbol})\r\n`;
        csv += `Bourse;${data.profile?.exchange || 'US'}\r\n`;
        csv += `Secteur;${data.profile?.finnhubIndustry || data.profile?.sector || 'Général'}\r\n`;
        csv += `Cours Live;$${data.currentPrice != null ? data.currentPrice.toFixed(2) : 'N/A'}\r\n`;
        csv += `Capitalisation;$${data.profile?.marketCapitalization != null ? (data.profile.marketCapitalization / 1000).toFixed(2) + 'B' : 'N/A'}\r\n`;
        csv += `Source Certifiée;Finnhub Stock API & US SEC EDGAR Filings (Forms 10-K & 10-Q)\r\n`;
        csv += `Fréquence Déclarative;${statementFreq === 'ANNUAL' ? 'Form 10-K (Annuel)' : 'Form 10-Q (Trimestriel)'}\r\n`;
        csv += `Date d'Extraction;${dateStr}\r\n\r\n`;

        // KPIs
        csv += `--- INDICATEURS CLÉS DE PERFORMANCE (KPIS) ---\r\n`;
        csv += `Indicateur;Valeur;Unité;Description\r\n`;
        csv += `Chiffre d'Affaires;$${data.latestRevenue != null ? (data.latestRevenue / 1_000_000_000).toFixed(2) + 'B' : 'N/A'};USD;Chiffre d'affaires annuel le plus récent\r\n`;
        csv += `Résultat Net;$${data.latestNetIncome != null ? (data.latestNetIncome / 1_000_000_000).toFixed(2) + 'B' : 'N/A'};USD;Bénéfice net attribuable aux actionnaires\r\n`;
        csv += `Bénéfice par Action (EPS);$${data.latestEps != null ? data.latestEps.toFixed(2) : 'N/A'};USD;BPA dilué\r\n`;
        csv += `P/E Ratio;${data.peRatio != null ? data.peRatio.toFixed(2) + 'x' : 'N/A'};Multiple;Cours / Bénéfice\r\n`;
        csv += `ROE (Return on Equity);${data.roe != null ? (data.roe * 100).toFixed(2) + '%' : 'N/A'};%;Rendement des capitaux propres\r\n`;
        csv += `Debt-to-Equity (D/E);${data.debtToEquity != null ? data.debtToEquity.toFixed(2) : 'N/A'};Ratio;Dette totale / Capitaux propres\r\n`;
        csv += `Croissance CA YoY;${data.revenueGrowthYoY != null ? (data.revenueGrowthYoY * 100).toFixed(2) + '%' : 'N/A'};%;Croissance sur 12 mois\r\n`;
        csv += `Free Cash Flow (FCF);$${data.freeCashFlow != null ? (data.freeCashFlow / 1_000_000_000).toFixed(2) + 'B' : 'N/A'};USD;Flux de trésorerie disponible\r\n\r\n`;

        // Income Statement
        if (statements?.incomeStatements && statements.incomeStatements.length > 0) {
          const periods = statements.incomeStatements.map((s) => s.periodLabel);
          csv += `--- COMPTE DE RÉSULTAT (EN MILLIONS USD) ---\r\n`;
          csv += `Ligne / Métrique;${periods.join(';')}\r\n`;
          csv += `Chiffre d'Affaires (CA);${statements.incomeStatements.map((s) => s.revenue != null ? (s.revenue / 1_000_000).toFixed(1) : 'N/A').join(';')}\r\n`;
          csv += `Marge Brute;${statements.incomeStatements.map((s) => s.grossProfit != null ? (s.grossProfit / 1_000_000).toFixed(1) : 'N/A').join(';')}\r\n`;
          csv += `Résultat d'Exploitation;${statements.incomeStatements.map((s) => s.operatingIncome != null ? (s.operatingIncome / 1_000_000).toFixed(1) : 'N/A').join(';')}\r\n`;
          csv += `EBITDA;${statements.incomeStatements.map((s) => s.ebitda != null ? (s.ebitda / 1_000_000).toFixed(1) : 'N/A').join(';')}\r\n`;
          csv += `Résultat Net;${statements.incomeStatements.map((s) => s.netIncome != null ? (s.netIncome / 1_000_000).toFixed(1) : 'N/A').join(';')}\r\n`;
          csv += `BPA Dilué (EPS);${statements.incomeStatements.map((s) => s.epsDiluted != null ? s.epsDiluted.toFixed(2) : 'N/A').join(';')}\r\n`;
          csv += `Marge Brute (%);${statements.incomeStatements.map((s) => s.grossMarginPct != null ? (s.grossMarginPct * 100).toFixed(1) + '%' : 'N/A').join(';')}\r\n`;
          csv += `Marge d'Exploitation (%);${statements.incomeStatements.map((s) => s.operatingMarginPct != null ? (s.operatingMarginPct * 100).toFixed(1) + '%' : 'N/A').join(';')}\r\n`;
          csv += `Marge Nette (%);${statements.incomeStatements.map((s) => s.netMarginPct != null ? (s.netMarginPct * 100).toFixed(1) + '%' : 'N/A').join(';')}\r\n\r\n`;
        }

        // Balance Sheet
        if (statements?.balanceSheets && statements.balanceSheets.length > 0) {
          const periods = statements.balanceSheets.map((s) => s.periodLabel);
          csv += `--- BILAN (EN MILLIONS USD) ---\r\n`;
          csv += `Ligne / Métrique;${periods.join(';')}\r\n`;
          csv += `Actif Total;${statements.balanceSheets.map((s) => s.totalAssets != null ? (s.totalAssets / 1_000_000).toFixed(1) : 'N/A').join(';')}\r\n`;
          csv += `Passif Total;${statements.balanceSheets.map((s) => s.totalLiabilities != null ? (s.totalLiabilities / 1_000_000).toFixed(1) : 'N/A').join(';')}\r\n`;
          csv += `Capitaux Propres;${statements.balanceSheets.map((s) => s.totalStockholdersEquity != null ? (s.totalStockholdersEquity / 1_000_000).toFixed(1) : 'N/A').join(';')}\r\n`;
          csv += `Dette Totale;${statements.balanceSheets.map((s) => s.totalDebt != null ? (s.totalDebt / 1_000_000).toFixed(1) : 'N/A').join(';')}\r\n`;
          csv += `Trésorerie & Équivalents;${statements.balanceSheets.map((s) => s.cashAndEquivalents != null ? (s.cashAndEquivalents / 1_000_000).toFixed(1) : 'N/A').join(';')}\r\n`;
          csv += `Actif Circulant;${statements.balanceSheets.map((s) => s.currentAssets != null ? (s.currentAssets / 1_000_000).toFixed(1) : 'N/A').join(';')}\r\n`;
          csv += `Passif Circulant;${statements.balanceSheets.map((s) => s.currentLiabilities != null ? (s.currentLiabilities / 1_000_000).toFixed(1) : 'N/A').join(';')}\r\n\r\n`;
        }

        // Cash Flow
        if (statements?.cashFlowStatements && statements.cashFlowStatements.length > 0) {
          const periods = statements.cashFlowStatements.map((s) => s.periodLabel);
          csv += `--- FLUX DE TRÉSORERIE (EN MILLIONS USD) ---\r\n`;
          csv += `Ligne / Métrique;${periods.join(';')}\r\n`;
          csv += `Flux Opérationnel (OCF);${statements.cashFlowStatements.map((s) => s.operatingCashFlow != null ? (s.operatingCashFlow / 1_000_000).toFixed(1) : 'N/A').join(';')}\r\n`;
          csv += `Flux d'Investissement;${statements.cashFlowStatements.map((s) => s.investingCashFlow != null ? (s.investingCashFlow / 1_000_000).toFixed(1) : 'N/A').join(';')}\r\n`;
          csv += `Flux de Financement;${statements.cashFlowStatements.map((s) => s.financingCashFlow != null ? (s.financingCashFlow / 1_000_000).toFixed(1) : 'N/A').join(';')}\r\n`;
          csv += `CapEx;${statements.cashFlowStatements.map((s) => s.capitalExpenditures != null ? (s.capitalExpenditures / 1_000_000).toFixed(1) : 'N/A').join(';')}\r\n`;
          csv += `Free Cash Flow (FCF);${statements.cashFlowStatements.map((s) => s.freeCashFlow != null ? (s.freeCashFlow / 1_000_000).toFixed(1) : 'N/A').join(';')}\r\n\r\n`;
        }

        // Ratios
        if (data.ratios) {
          csv += `--- GRILLE COMPLÈTE DES RATIOS FINANCIERS ---\r\n`;
          csv += `Catégorie;Code Ratio;Nom;Valeur;Unité;Benchmark;Statut;Formule;Interprétation\r\n`;
          const allRatios = [
            ...(data.ratios.valuationRatios || []),
            ...(data.ratios.profitabilityRatios || []),
            ...(data.ratios.healthRatios || []),
            ...(data.ratios.growthRatios || []),
          ];
          allRatios.forEach((r) => {
            csv += `"${r.category}";"${r.key}";"${r.label}";"${r.formattedValue}";"${r.unit}";"${r.benchmarkText || 'N/A'}";"${r.status}";"${r.formula || ''}";"${r.tooltip?.replace(/"/g, '""') || ''}"\r\n`;
          });
        }

        const fileName = `${symbol}_Analyse_Fondamentale_${statementFreq}_${new Date().toISOString().slice(0, 10)}.csv`;
        downloadBlob(csv, fileName);
        toast.success('Export Excel réussi', `Fichier généré : ${fileName}`);
      } else {
        // Mode Comparatif
        if (!comparisonData || comparisonData.symbols.length === 0) {
          toast.warning('Export impossible', "Aucune donnée de comparaison disponible.");
          return;
        }

        const syms = comparisonData.symbols;
        csv += `MATRICE COMPARATIVE MULTI-ENTREPRISES;MARKET SIMULATOR INSTITUTIONAL\r\n`;
        csv += `Date d'Extraction;${new Date().toLocaleString('fr-FR')}\r\n`;
        csv += `Sociétés Comparées;${syms.join(';')}\r\n`;
        csv += `Source Certifiée;Finnhub Stock Metrics & SEC Filings\r\n\r\n`;

        csv += `Indicateur Financier;Catégorie;Unité;${syms.join(';')};Meilleure Performance (Best)\r\n`;
        comparisonData.comparisonRows.forEach((row) => {
          const values = syms.map((s) => row.valuesBySymbol[s] || 'N/A').join(';');
          const best = row.bestSymbol ? `${row.bestSymbol} (${row.valuesBySymbol[row.bestSymbol] || ''})` : 'N/A';
          csv += `"${row.label}";"${row.category}";"${row.unit}";${values};"${best}"\r\n`;
        });

        const fileName = `Comparaison_${syms.join('_')}_${new Date().toISOString().slice(0, 10)}.csv`;
        downloadBlob(csv, fileName);
        toast.success('Export Excel réussi', `Matrice comparative exportée : ${fileName}`);
      }
    } catch (err) {
      toast.error("Erreur d'export", "Impossible de générer le fichier Excel.");
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <AppShell
      title="Analyse Fondamentale & États Financiers"
      section="Research & Fundamentals"
      badge="SEC 10-K / 10-Q"
      maxWidthClass="max-w-7xl"
    >
      <style>{`
        @media print {
          /* Masquer la navigation globale de l'app, le header et les contrôles interactifs */
          aside, header, nav, .no-print {
            display: none !important;
          }
          body, main {
            background-color: #070B14 !important;
            color: #F8FAFC !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          /* Éviter de couper les cartes et sections en plein milieu d'une page */
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          /* Afficher l'intégralité des tableaux sans scrollbars */
          .overflow-x-auto {
            overflow: visible !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Bannière d'en-tête pour l'impression / PDF */}
      <div className="hidden print:block pb-5 mb-5 border-b border-slate-700 font-mono">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">RAPPORT OFFICIEL D'ANALYSE FONDAMENTALE</h1>
            <p className="text-xs text-emerald-400 font-semibold">Market Simulator Institutional Quant Terminal</p>
          </div>
          <div className="text-right text-[11px] text-slate-300">
            <div>Date : {new Date().toLocaleDateString('fr-FR')} {new Date().toLocaleTimeString('fr-FR')}</div>
            <div className="text-slate-400">Source : SEC Forms 10-K/10-Q & Finnhub Live</div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Top Header & Search Bar */}
        <div className="bg-[#0B1220] border border-subtle rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_-4px_rgba(34,197,94,0.4)]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                  Moteur d'Analyse Fondamentale
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  Données Certifiées SEC
                </span>
              </div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                États Financiers, Ratios & Santé des Entreprises
              </h1>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {/* Mode Switcher */}
            <div className="flex items-center bg-[#070B14] p-1 rounded-xl border border-subtle">
              <button
                onClick={() => setMode('deepdive')}
                className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg transition-all ${
                  mode === 'deepdive'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Fiche Entreprise
              </button>
              <button
                onClick={() => setMode('compare')}
                className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg transition-all ${
                  mode === 'compare'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Comparateur (2 à 5)
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => mode === 'deepdive' ? fetchOverview(symbol, true) : fetchComparison(compareSymbols)}
              disabled={refreshing || compareLoading}
              className="p-2 rounded-xl bg-[#070B14] hover:bg-[#101A2B] border border-subtle text-slate-300 hover:text-white text-xs transition disabled:opacity-40"
              title="Rafraîchir les données"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing || compareLoading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            {/* Export Excel (.csv structuré) Button */}
            <button
              onClick={handleExportExcel}
              disabled={loading || compareLoading || (mode === 'deepdive' && !data?.available)}
              className="px-3 py-1.5 rounded-xl bg-[#070B14] hover:bg-[#101A2B] border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 text-xs font-mono font-medium transition flex items-center gap-1.5 shadow-sm disabled:opacity-40"
              title="Exporter les données financières complètes sous format Excel (.csv)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export Excel</span>
            </button>

            {/* Print / PDF Button */}
            <button
              onClick={handlePrintPdf}
              disabled={loading || compareLoading || (mode === 'deepdive' && !data?.available)}
              className="px-3 py-1.5 rounded-xl bg-[#070B14] hover:bg-[#101A2B] border border-sky-500/30 text-sky-300 hover:text-sky-200 text-xs font-mono font-medium transition flex items-center gap-1.5 shadow-sm disabled:opacity-40"
              title="Imprimer ou enregistrer au format PDF"
            >
              <Printer className="w-3.5 h-3.5 text-sky-400" />
              <span>Imprimer / PDF</span>
            </button>
          </div>
        </div>

        {/* Ticker Search & Quick Pills (Only in deepdive mode) */}
        {mode === 'deepdive' && (
          <div className="bg-[#0B1220] border border-subtle rounded-2xl p-4 space-y-3 no-print">
            <div className="relative">
              <div className="flex items-center gap-2 bg-[#070B14] border border-subtle focus-within:border-emerald-400/50 rounded-xl px-3.5 py-2.5 transition">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Rechercher par ticker ou nom (ex: AAPL, Microsoft, NVDA, Alphabet)..."
                  className="bg-transparent text-xs font-mono text-white placeholder-slate-500 focus:outline-none w-full"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setSearchResults([]); setIsSearching(false); }}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              <AnimatePresence>
                {isSearching && searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute top-full left-0 right-0 mt-1 bg-[#0B1220] border border-subtle rounded-xl shadow-2xl z-30 overflow-hidden divide-y divide-slate-800/80 max-h-60 overflow-y-auto"
                  >
                    {searchResults.map((item) => (
                      <div
                        key={item.symbol}
                        onClick={() => selectSymbol(item.symbol)}
                        className="px-4 py-2.5 hover:bg-slate-800/50 cursor-pointer flex items-center justify-between transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <AssetLogo symbol={item.symbol} size="sm" />
                          <div>
                            <div className="text-xs font-bold text-white font-mono">{item.symbol}</div>
                            <div className="text-[11px] text-slate-400">{item.name}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 no-print">
                          <span className="text-[10px] font-mono text-slate-500 uppercase">{item.exchange}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold ${
                              item.fundamentalSupported
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {item.fundamentalSupported ? '10-K / 10-Q' : 'Crypto (Sans 10-K)'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Popular Tickers Pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
              <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">Valeurs Populaires :</span>
              {POPULAR_TICKERS.map((t) => (
                <button
                  key={t}
                  onClick={() => selectSymbol(t)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition border ${
                    symbol === t
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                      : 'bg-[#070B14] hover:bg-slate-800 border-subtle text-slate-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center min-h-[380px] p-8 text-center bg-[#070B14] rounded-2xl border border-subtle">
            <OrbitalSpinner size="lg" tone="cyan" />
            <p className="mt-4 text-xs font-mono text-slate-300 font-semibold">
              Récupération des états financiers officiels SEC pour {symbol}...
            </p>
            <p className="mt-1 text-[11px] font-mono text-slate-500">
              Extraction des bilans, comptes de résultats et calcul des ratios financiers en cours...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="p-8 text-center bg-[#070B14] rounded-2xl border border-rose-500/20">
            <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
            <h3 className="text-white font-bold text-sm mb-1">Données fondamentales indisponibles</h3>
            <p className="text-slate-400 text-xs font-mono mb-4">{error}</p>
            <button
              onClick={() => fetchOverview(symbol)}
              className="px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-mono font-medium inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Réessayer
            </button>
          </div>
        )}

        {/* MODE 1: FICHE ENTREPRISE COMPLÈTE */}
        {mode === 'deepdive' && data && !loading && (
          <div className="space-y-6">
            {/* Unavailable Crypto Notice Banner */}
            {!data.available && (
              <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white font-mono">Actif non assujetti aux déclarations SEC</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">{data.message}</p>
                  <p className="text-[11px] text-slate-500 mt-2 font-mono">
                    Sélectionnez une action cotée (ex: AAPL, MSFT, NVDA) pour consulter les comptes de résultat et bilans comptables.
                  </p>
                </div>
              </div>
            )}

            {data.available && (
              <>
                {/* Company Header Identity Card */}
                <div className="bg-[#0B1220] border border-subtle rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
                  <div className="flex items-center gap-4">
                    <AssetLogo symbol={data.symbol} size="lg" />
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-xl font-bold text-white tracking-tight">{data.profile?.name || data.symbol}</h2>
                        <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
                          {data.symbol}
                        </span>
                        <span className="text-xs font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                          {data.profile?.exchange || 'NASDAQ'}
                        </span>
                      </div>
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs font-mono text-slate-400 mt-1.5">
                        <span>Secteur : <strong className="text-slate-200">{data.profile?.finnhubIndustry || 'Technologie'}</strong></span>
                        <span>·</span>
                        <span>Devise : <strong className="text-slate-200">{data.profile?.currency || 'USD'}</strong></span>
                        <span>·</span>
                        <span>Pays : <strong className="text-slate-200">{data.profile?.country || 'US'}</strong></span>
                        {data.profile?.weburl && (
                          <>
                            <span>·</span>
                            <a
                              href={data.profile.weburl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 transition"
                            >
                              <span>Site Officiel</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Market Cap & Price Pill */}
                  <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-5">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-400 block">Capitalisation Boursière</span>
                      <span className="text-base font-bold font-mono text-white">
                        {data.profile?.marketCapitalization != null
                          ? `$${(data.profile.marketCapitalization / 1000).toFixed(2)}B`
                          : 'N/A'}
                      </span>
                    </div>
                    {data.currentPrice != null && (
                      <div className="text-right">
                        <span className="text-[10px] font-mono uppercase text-slate-400 block">Cours de Marché</span>
                        <span className="text-base font-bold font-mono text-emerald-400">
                          ${data.currentPrice.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Executive Summary KPIs Grid (8 Cards) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                  {/* CA */}
                  <div className="bg-[#0B1220] border border-subtle rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-[10px] font-mono uppercase text-slate-400">Chiffre d'Affaires</span>
                    <div className="text-sm font-bold font-mono text-white mt-1">
                      {formatBillion(data.latestRevenue)}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 mt-1">{data.reportingPeriod}</span>
                  </div>

                  {/* Résultat Net */}
                  <div className="bg-[#0B1220] border border-subtle rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-[10px] font-mono uppercase text-slate-400">Résultat Net</span>
                    <div className="text-sm font-bold font-mono text-emerald-400 mt-1">
                      {formatBillion(data.latestNetIncome)}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 mt-1">Bénéfice net annuel</span>
                  </div>

                  {/* BPA / EPS */}
                  <div className="bg-[#0B1220] border border-subtle rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-[10px] font-mono uppercase text-slate-400">BPA (EPS Dilué)</span>
                    <div className="text-sm font-bold font-mono text-white mt-1">
                      {data.latestEps != null ? `$${data.latestEps.toFixed(2)}` : 'N/A'}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 mt-1">Par action</span>
                  </div>

                  {/* P/E Ratio */}
                  <div className="bg-[#0B1220] border border-subtle rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-[10px] font-mono uppercase text-slate-400">P/E Ratio</span>
                    <div className="text-sm font-bold font-mono text-sky-400 mt-1">
                      {data.peRatio != null ? `${data.peRatio.toFixed(2)}x` : 'N/A'}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 mt-1">Multiple de cours</span>
                  </div>

                  {/* ROE */}
                  <div className="bg-[#0B1220] border border-subtle rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-[10px] font-mono uppercase text-slate-400">ROE (Capitaux)</span>
                    <div className="text-sm font-bold font-mono text-emerald-400 mt-1">
                      {data.roe != null ? `${data.roe.toFixed(1)}%` : 'N/A'}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 mt-1">Rentabilité nette</span>
                  </div>

                  {/* Debt to Equity */}
                  <div className="bg-[#0B1220] border border-subtle rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-[10px] font-mono uppercase text-slate-400">Debt / Equity</span>
                    <div className="text-sm font-bold font-mono text-amber-400 mt-1">
                      {data.debtToEquity != null ? `${data.debtToEquity.toFixed(2)}x` : 'N/A'}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 mt-1">Levier financier</span>
                  </div>

                  {/* Croissance CA YoY */}
                  <div className="bg-[#0B1220] border border-subtle rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-[10px] font-mono uppercase text-slate-400">Croissance CA</span>
                    <div className="text-sm font-bold font-mono text-sky-300 mt-1">
                      {data.revenueGrowthYoY != null ? `${data.revenueGrowthYoY >= 0 ? '+' : ''}${data.revenueGrowthYoY.toFixed(1)}%` : 'N/A'}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 mt-1">Sur 1 an (YoY)</span>
                  </div>

                  {/* Free Cash Flow */}
                  <div className="bg-[#0B1220] border border-subtle rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-[10px] font-mono uppercase text-slate-400">Free Cash Flow</span>
                    <div className="text-sm font-bold font-mono text-emerald-400 mt-1">
                      {formatBillion(data.freeCashFlow)}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 mt-1">Flux de trésorerie</span>
                  </div>
                </div>

                {/* Sub-Navigation Tabs */}
                <div className="flex items-center justify-between border-b border-subtle gap-2 overflow-x-auto no-scrollbar no-print">
                  <div className="flex items-center gap-1">
                    {[
                      { id: 'statements', label: 'États Financiers Officiels', icon: FileSpreadsheet },
                      { id: 'ratios', label: 'Ratios Fondamentaux & Santé', icon: ShieldCheck },
                      { id: 'charts', label: 'Évolution & Graphiques', icon: BarChart3 },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeMainTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveMainTab(tab.id as typeof activeMainTab)}
                          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-semibold border-b-2 transition whitespace-nowrap ${
                            isActive
                              ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5'
                              : 'border-transparent text-slate-400 hover:text-white hover:border-slate-700'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Frequency Toggle in Statements tab */}
                  {activeMainTab === 'statements' && (
                    <div className="flex items-center bg-[#070B14] p-1 rounded-xl border border-subtle my-1">
                      <button
                        onClick={() => handleFrequencyChange('ANNUAL')}
                        className={`px-3 py-1 text-xs font-mono font-semibold rounded-lg transition-all ${
                          statementFreq === 'ANNUAL'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Annuel (10-K)
                      </button>
                      <button
                        onClick={() => handleFrequencyChange('QUARTERLY')}
                        className={`px-3 py-1 text-xs font-mono font-semibold rounded-lg transition-all ${
                          statementFreq === 'QUARTERLY'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Trimestriel (10-Q)
                      </button>
                    </div>
                  )}
                </div>

                {/* TAB 1: ÉTATS FINANCIERS DÉTAILLÉS */}
                {activeMainTab === 'statements' && statements && (
                  <div className="bg-[#0B1220] border border-subtle rounded-2xl p-5 space-y-4">
                    {/* Statement Type Pills */}
                    <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-subtle">
                      <div className="flex items-center gap-2 no-print">
                        {[
                          { id: 'income', label: 'Compte de Résultat (Income Statement)' },
                          { id: 'balance', label: 'Bilan Comptable (Balance Sheet)' },
                          { id: 'cashflow', label: 'Flux de Trésorerie (Cash Flow)' },
                        ].map((st) => (
                          <button
                            key={st.id}
                            onClick={() => setActiveStatementTab(st.id as typeof activeStatementTab)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition ${
                              activeStatementTab === st.id
                                ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                                : 'bg-[#070B14] hover:bg-slate-800 text-slate-300'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>

                      <div className="text-[11px] font-mono text-slate-400">
                        Source : {statements.dataFreshness || 'SEC Edgar Form 10-K / 10-Q'}
                      </div>
                    </div>

                    {/* Statement Table Content */}
                    <div className="overflow-x-auto">
                      {activeStatementTab === 'income' && statements.incomeStatements && (
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="border-b border-subtle text-slate-400 text-[11px]">
                              <th className="py-2.5 px-3 min-w-[220px]">Poste Comptable (En Millions USD)</th>
                              {statements.incomeStatements.map((ic) => (
                                <th key={ic.periodLabel} className="py-2.5 px-3 text-right text-white font-bold min-w-[120px]">
                                  {ic.periodLabel}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            <tr>
                              <td className="py-2.5 px-3 text-white font-bold">Chiffre d'Affaires Total (Revenues)</td>
                              {statements.incomeStatements.map((ic) => (
                                <td key={ic.periodLabel} className="py-2.5 px-3 text-right font-bold text-white tabular-nums">
                                  {formatMillion(ic.revenue)}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-400">Coût des Ventes (COGS)</td>
                              {statements.incomeStatements.map((ic) => (
                                <td key={ic.periodLabel} className="py-2 px-3 text-right text-slate-300 tabular-nums">
                                  {formatMillion(ic.costOfGoodsSold)}
                                </td>
                              ))}
                            </tr>
                            <tr className="bg-emerald-950/15">
                              <td className="py-2.5 px-3 text-emerald-300 font-bold">Marge Brute (Gross Profit)</td>
                              {statements.incomeStatements.map((ic) => (
                                <td key={ic.periodLabel} className="py-2.5 px-3 text-right font-bold text-emerald-300 tabular-nums">
                                  {formatMillion(ic.grossProfit)}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-400 pl-6">Recherche & Développement (R&D)</td>
                              {statements.incomeStatements.map((ic) => (
                                <td key={ic.periodLabel} className="py-2 px-3 text-right text-slate-300 tabular-nums">
                                  {formatMillion(ic.researchAndDevelopment)}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-400 pl-6">Frais de Vente & Administratifs (SG&A)</td>
                              {statements.incomeStatements.map((ic) => (
                                <td key={ic.periodLabel} className="py-2 px-3 text-right text-slate-300 tabular-nums">
                                  {formatMillion(ic.sellingGeneralAdmin)}
                                </td>
                              ))}
                            </tr>
                            <tr className="bg-sky-950/15">
                              <td className="py-2.5 px-3 text-sky-300 font-bold">Résultat d'Exploitation (Operating Income / EBIT)</td>
                              {statements.incomeStatements.map((ic) => (
                                <td key={ic.periodLabel} className="py-2.5 px-3 text-right font-bold text-sky-300 tabular-nums">
                                  {formatMillion(ic.operatingIncome)}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-400">Impôts sur les Bénéfices</td>
                              {statements.incomeStatements.map((ic) => (
                                <td key={ic.periodLabel} className="py-2 px-3 text-right text-slate-300 tabular-nums">
                                  {formatMillion(ic.incomeTax)}
                                </td>
                              ))}
                            </tr>
                            <tr className="bg-emerald-950/25 border-t border-b border-emerald-500/30">
                              <td className="py-3 px-3 text-white font-extrabold text-sm">Résultat Net Attribuable (Net Income)</td>
                              {statements.incomeStatements.map((ic) => (
                                <td key={ic.periodLabel} className="py-3 px-3 text-right font-extrabold text-emerald-400 text-sm tabular-nums">
                                  {formatMillion(ic.netIncome)}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-300">Bénéfice par Action (BPA Dilué)</td>
                              {statements.incomeStatements.map((ic) => (
                                <td key={ic.periodLabel} className="py-2 px-3 text-right font-bold text-white tabular-nums">
                                  {ic.epsDiluted != null ? `$${ic.epsDiluted.toFixed(2)}` : 'N/A'}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-400">Marge Brute (%)</td>
                              {statements.incomeStatements.map((ic) => (
                                <td key={ic.periodLabel} className="py-2 px-3 text-right text-emerald-400 font-semibold tabular-nums">
                                  {ic.grossMarginPct != null ? `${ic.grossMarginPct.toFixed(2)}%` : 'N/A'}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-400">Marge Opérationnelle (%)</td>
                              {statements.incomeStatements.map((ic) => (
                                <td key={ic.periodLabel} className="py-2 px-3 text-right text-sky-400 font-semibold tabular-nums">
                                  {ic.operatingMarginPct != null ? `${ic.operatingMarginPct.toFixed(2)}%` : 'N/A'}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-400">Marge Nette (%)</td>
                              {statements.incomeStatements.map((ic) => (
                                <td key={ic.periodLabel} className="py-2 px-3 text-right text-emerald-400 font-semibold tabular-nums">
                                  {ic.netMarginPct != null ? `${ic.netMarginPct.toFixed(2)}%` : 'N/A'}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      )}

                      {activeStatementTab === 'balance' && statements.balanceSheets && (
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="border-b border-subtle text-slate-400 text-[11px]">
                              <th className="py-2.5 px-3 min-w-[220px]">Poste de Bilan (En Millions USD)</th>
                              {statements.balanceSheets.map((bs) => (
                                <th key={bs.periodLabel} className="py-2.5 px-3 text-right text-white font-bold min-w-[120px]">
                                  {bs.periodLabel}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            <tr className="bg-slate-900/40">
                              <td colSpan={statements.balanceSheets.length + 1} className="py-1.5 px-3 text-[10px] uppercase font-bold text-sky-400 tracking-wider">
                                ACTIFS (ASSETS)
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-300">Trésorerie & Équivalents (Cash)</td>
                              {statements.balanceSheets.map((bs) => (
                                <td key={bs.periodLabel} className="py-2 px-3 text-right text-white tabular-nums">
                                  {formatMillion(bs.cashAndEquivalents)}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-400">Placements à Court Terme</td>
                              {statements.balanceSheets.map((bs) => (
                                <td key={bs.periodLabel} className="py-2 px-3 text-right text-slate-300 tabular-nums">
                                  {formatMillion(bs.shortTermInvestments)}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-400">Créances Clients (Receivables)</td>
                              {statements.balanceSheets.map((bs) => (
                                <td key={bs.periodLabel} className="py-2 px-3 text-right text-slate-300 tabular-nums">
                                  {formatMillion(bs.accountsReceivable)}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-400">Stocks & Inventaires</td>
                              {statements.balanceSheets.map((bs) => (
                                <td key={bs.periodLabel} className="py-2 px-3 text-right text-slate-300 tabular-nums">
                                  {formatMillion(bs.inventory)}
                                </td>
                              ))}
                            </tr>
                            <tr className="bg-sky-950/15">
                              <td className="py-2 px-3 text-sky-300 font-bold">Total Actifs Circulants (Current Assets)</td>
                              {statements.balanceSheets.map((bs) => (
                                <td key={bs.periodLabel} className="py-2 px-3 text-right font-bold text-sky-300 tabular-nums">
                                  {formatMillion(bs.currentAssets)}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-400">Immobilisations Corporelles Nettes (PP&E)</td>
                              {statements.balanceSheets.map((bs) => (
                                <td key={bs.periodLabel} className="py-2 px-3 text-right text-slate-300 tabular-nums">
                                  {formatMillion(bs.propertyPlantEquipmentNet)}
                                </td>
                              ))}
                            </tr>
                            <tr className="bg-sky-950/25 border-t border-b border-sky-500/30">
                              <td className="py-3 px-3 text-white font-bold text-sm">TOTAL DES ACTIFS</td>
                              {statements.balanceSheets.map((bs) => (
                                <td key={bs.periodLabel} className="py-3 px-3 text-right font-bold text-white text-sm tabular-nums">
                                  {formatMillion(bs.totalAssets)}
                                </td>
                              ))}
                            </tr>

                            <tr className="bg-slate-900/40">
                              <td colSpan={statements.balanceSheets.length + 1} className="py-1.5 px-3 text-[10px] uppercase font-bold text-rose-400 tracking-wider">
                                PASSIFS & ENDETTEMENT (LIABILITIES & DEBT)
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-300">Dettes Fournisseurs (Accounts Payable)</td>
                              {statements.balanceSheets.map((bs) => (
                                <td key={bs.periodLabel} className="py-2 px-3 text-right text-white tabular-nums">
                                  {formatMillion(bs.accountsPayable)}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-400">Dettes Financières à Court Terme</td>
                              {statements.balanceSheets.map((bs) => (
                                <td key={bs.periodLabel} className="py-2 px-3 text-right text-slate-300 tabular-nums">
                                  {formatMillion(bs.shortTermDebt)}
                                </td>
                              ))}
                            </tr>
                            <tr className="bg-rose-950/15">
                              <td className="py-2 px-3 text-rose-300 font-bold">Total Passif Circulant (Current Liabilities)</td>
                              {statements.balanceSheets.map((bs) => (
                                <td key={bs.periodLabel} className="py-2 px-3 text-right font-bold text-rose-300 tabular-nums">
                                  {formatMillion(bs.currentLiabilities)}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-400">Dette à Long Terme (Long-Term Debt)</td>
                              {statements.balanceSheets.map((bs) => (
                                <td key={bs.periodLabel} className="py-2 px-3 text-right text-slate-300 tabular-nums">
                                  {formatMillion(bs.longTermDebt)}
                                </td>
                              ))}
                            </tr>
                            <tr className="bg-amber-950/15">
                              <td className="py-2 px-3 text-amber-300 font-bold">Dette Totale Brute (Total Debt)</td>
                              {statements.balanceSheets.map((bs) => (
                                <td key={bs.periodLabel} className="py-2 px-3 text-right font-bold text-amber-300 tabular-nums">
                                  {formatMillion(bs.totalDebt)}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-400">Total Passifs (Total Liabilities)</td>
                              {statements.balanceSheets.map((bs) => (
                                <td key={bs.periodLabel} className="py-2 px-3 text-right text-slate-300 tabular-nums">
                                  {formatMillion(bs.totalLiabilities)}
                                </td>
                              ))}
                            </tr>

                            <tr className="bg-slate-900/40">
                              <td colSpan={statements.balanceSheets.length + 1} className="py-1.5 px-3 text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                                CAPITAUX PROPRES (STOCKHOLDERS' EQUITY)
                              </td>
                            </tr>
                            <tr className="bg-emerald-950/25 border-t border-b border-emerald-500/30">
                              <td className="py-3 px-3 text-white font-bold text-sm">Total Capitaux Propres (Shareholders' Equity)</td>
                              {statements.balanceSheets.map((bs) => (
                                <td key={bs.periodLabel} className="py-3 px-3 text-right font-bold text-emerald-300 text-sm tabular-nums">
                                  {formatMillion(bs.totalStockholdersEquity)}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-300">Fonds de Roulement Net (Working Capital)</td>
                              {statements.balanceSheets.map((bs) => (
                                <td key={bs.periodLabel} className="py-2 px-3 text-right font-semibold text-white tabular-nums">
                                  {formatMillion(bs.workingCapital)}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      )}

                      {activeStatementTab === 'cashflow' && statements.cashFlowStatements && (
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="border-b border-subtle text-slate-400 text-[11px]">
                              <th className="py-2.5 px-3 min-w-[220px]">Flux de Trésorerie (En Millions USD)</th>
                              {statements.cashFlowStatements.map((cf) => (
                                <th key={cf.periodLabel} className="py-2.5 px-3 text-right text-white font-bold min-w-[120px]">
                                  {cf.periodLabel}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            <tr className="bg-emerald-950/15">
                              <td className="py-2.5 px-3 text-emerald-300 font-bold">Flux Opérationnel (Operating Cash Flow)</td>
                              {statements.cashFlowStatements.map((cf) => (
                                <td key={cf.periodLabel} className="py-2.5 px-3 text-right font-bold text-emerald-400 tabular-nums">
                                  {formatMillion(cf.operatingCashFlow)}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-rose-300 pl-6">Dépenses d'Investissement (CapEx)</td>
                              {statements.cashFlowStatements.map((cf) => (
                                <td key={cf.periodLabel} className="py-2 px-3 text-right text-rose-300 tabular-nums">
                                  {cf.capitalExpenditures != null ? `-${formatMillion(cf.capitalExpenditures)}` : 'N/A'}
                                </td>
                              ))}
                            </tr>
                            <tr className="bg-emerald-950/25 border-t border-b border-emerald-500/30">
                              <td className="py-3 px-3 text-white font-extrabold text-sm">FREE CASH FLOW (Flux Disponible Réel)</td>
                              {statements.cashFlowStatements.map((cf) => (
                                <td key={cf.periodLabel} className="py-3 px-3 text-right font-extrabold text-emerald-400 text-sm tabular-nums">
                                  {formatMillion(cf.freeCashFlow)}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-400">Flux d'Investissement (Investing Cash Flow)</td>
                              {statements.cashFlowStatements.map((cf) => (
                                <td key={cf.periodLabel} className="py-2 px-3 text-right text-slate-300 tabular-nums">
                                  {formatMillion(cf.investingCashFlow)}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-400 pl-6">Rachat d'Actions (Share Buybacks)</td>
                              {statements.cashFlowStatements.map((cf) => (
                                <td key={cf.periodLabel} className="py-2 px-3 text-right text-slate-300 tabular-nums">
                                  {cf.commonStockRepurchase != null ? formatMillion(cf.commonStockRepurchase) : 'N/A'}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-slate-400 pl-6">Dividendes Versés aux Actionnaires</td>
                              {statements.cashFlowStatements.map((cf) => (
                                <td key={cf.periodLabel} className="py-2 px-3 text-right text-slate-300 tabular-nums">
                                  {cf.dividendsPaid != null ? formatMillion(cf.dividendsPaid) : 'N/A'}
                                </td>
                              ))}
                            </tr>
                            <tr className="bg-slate-900/40">
                              <td className="py-2 px-3 text-slate-300 font-bold">Flux de Financement (Financing Cash Flow)</td>
                              {statements.cashFlowStatements.map((cf) => (
                                <td key={cf.periodLabel} className="py-2 px-3 text-right font-bold text-slate-200 tabular-nums">
                                  {formatMillion(cf.financingCashFlow)}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: RATIOS FONDAMENTAUX & SANTÉ FINANCIÈRE */}
                {activeMainTab === 'ratios' && data.ratios && (
                  <div className="space-y-6">
                    {/* Valuation & Profitability */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Valuation Ratios Card */}
                      <div className="bg-[#0B1220] border border-subtle rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-subtle">
                          <DollarSign className="w-4 h-4 text-sky-400" />
                          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                            Ratios de Valorisation
                          </h3>
                        </div>
                        <div className="space-y-3">
                          {data.ratios.valuationRatios.map((r) => (
                            <div key={r.key} className="bg-[#070B14] border border-subtle rounded-xl p-3 flex flex-col justify-between">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                                  {r.label}
                                  <span className="text-[10px] text-slate-500 font-normal">({r.formula})</span>
                                </span>
                                <span className="text-sm font-bold font-mono text-sky-400 tabular-nums">
                                  {r.formattedValue}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 leading-relaxed">{r.tooltip}</p>
                              {r.benchmarkText && (
                                <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] font-mono text-slate-500">
                                  Repère marché : <span className="text-slate-300">{r.benchmarkText}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Profitability Ratios Card */}
                      <div className="bg-[#0B1220] border border-subtle rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-subtle">
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                            Ratios de Rentabilité & Marges
                          </h3>
                        </div>
                        <div className="space-y-3">
                          {data.ratios.profitabilityRatios.map((r) => (
                            <div key={r.key} className="bg-[#070B14] border border-subtle rounded-xl p-3 flex flex-col justify-between">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                                  {r.label}
                                  <span className="text-[10px] text-slate-500 font-normal">({r.formula})</span>
                                </span>
                                <span className="text-sm font-bold font-mono text-emerald-400 tabular-nums">
                                  {r.formattedValue}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 leading-relaxed">{r.tooltip}</p>
                              {r.benchmarkText && (
                                <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] font-mono text-slate-500">
                                  Repère marché : <span className="text-slate-300">{r.benchmarkText}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Financial Health & Growth */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Financial Health Card */}
                      <div className="bg-[#0B1220] border border-subtle rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-subtle">
                          <ShieldAlert className="w-4 h-4 text-amber-400" />
                          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                            Structure Financière & Liquidité
                          </h3>
                        </div>
                        <div className="space-y-3">
                          {data.ratios.healthRatios.map((r) => (
                            <div key={r.key} className="bg-[#070B14] border border-subtle rounded-xl p-3 flex flex-col justify-between">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                                  {r.label}
                                  <span className="text-[10px] text-slate-500 font-normal">({r.formula})</span>
                                </span>
                                <span className="text-sm font-bold font-mono text-amber-400 tabular-nums">
                                  {r.formattedValue}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 leading-relaxed">{r.tooltip}</p>
                              {r.benchmarkText && (
                                <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] font-mono text-slate-500">
                                  Repère marché : <span className="text-slate-300">{r.benchmarkText}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Growth Metrics Card */}
                      <div className="bg-[#0B1220] border border-subtle rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-subtle">
                          <BarChart3 className="w-4 h-4 text-violet-400" />
                          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                            Dynamique de Croissance (YoY)
                          </h3>
                        </div>
                        <div className="space-y-3">
                          {data.ratios.growthRatios.map((r) => (
                            <div key={r.key} className="bg-[#070B14] border border-subtle rounded-xl p-3 flex flex-col justify-between">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                                  {r.label}
                                  <span className="text-[10px] text-slate-500 font-normal">({r.formula})</span>
                                </span>
                                <span className="text-sm font-bold font-mono text-violet-300 tabular-nums">
                                  {r.formattedValue}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 leading-relaxed">{r.tooltip}</p>
                              {r.benchmarkText && (
                                <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] font-mono text-slate-500">
                                  Repère marché : <span className="text-slate-300">{r.benchmarkText}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: GRAPHIQUES HISTORIQUES D'ÉVOLUTION */}
                {activeMainTab === 'charts' && data.historicalAnnual && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Chart 1: Revenue vs Net Income */}
                      <div className="bg-[#0B1220] border border-subtle rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-white font-mono uppercase">
                            Trajectoire CA vs Résultat Net ($B)
                          </h3>
                          <div className="flex items-center gap-3 text-[10px] font-mono">
                            <span className="flex items-center gap-1 text-sky-400"><span className="w-2 h-2 rounded-full bg-sky-400" /> CA</span>
                            <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Résultat Net</span>
                          </div>
                        </div>

                        {data.historicalAnnual.length > 1 ? (
                          <div className="h-48 w-full pt-4">
                            <svg className="w-full h-full" viewBox="0 0 500 160" preserveAspectRatio="none">
                              {(() => {
                                const pts = data.historicalAnnual;
                                const maxVal = Math.max(...pts.map((p) => (p.revenue || 0) / 1_000_000_000)) * 1.15 || 100;
                                const stepX = 500 / (pts.length - 1 || 1);

                                const revPoints = pts.map((p, i) => `${i * stepX},${140 - ((p.revenue || 0) / 1_000_000_000 / maxVal) * 120}`).join(' ');
                                const netPoints = pts.map((p, i) => `${i * stepX},${140 - ((p.netIncome || 0) / 1_000_000_000 / maxVal) * 120}`).join(' ');

                                return (
                                  <>
                                    <line x1="0" y1="20" x2="500" y2="20" stroke="#1E293B" strokeDasharray="3 3" />
                                    <line x1="0" y1="80" x2="500" y2="80" stroke="#1E293B" strokeDasharray="3 3" />
                                    <line x1="0" y1="140" x2="500" y2="140" stroke="#1E293B" />

                                    <polyline fill="none" stroke="#38BDF8" strokeWidth="2.5" points={revPoints} />
                                    <polyline fill="none" stroke="#22C55E" strokeWidth="2.5" points={netPoints} />

                                    {pts.map((p, i) => (
                                      <g key={i}>
                                        <circle cx={i * stepX} cy={140 - ((p.revenue || 0) / 1_000_000_000 / maxVal) * 120} r="3.5" fill="#38BDF8" />
                                        <circle cx={i * stepX} cy={140 - ((p.netIncome || 0) / 1_000_000_000 / maxVal) * 120} r="3.5" fill="#22C55E" />
                                        <text x={i * stepX} y="156" fill="#64748B" fontSize="9" textAnchor="middle" fontFamily="monospace">
                                          {p.year}
                                        </text>
                                      </g>
                                    ))}
                                  </>
                                );
                              })()}
                            </svg>
                          </div>
                        ) : (
                          <div className="py-12 text-center text-slate-500 font-mono text-xs">Historique insuffisant pour tracer le graphique.</div>
                        )}
                      </div>

                      {/* Chart 2: Margins Trend (%) */}
                      <div className="bg-[#0B1220] border border-subtle rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-white font-mono uppercase">
                            Évolution des Marges Opérationnelle & Nette (%)
                          </h3>
                          <div className="flex items-center gap-3 text-[10px] font-mono">
                            <span className="flex items-center gap-1 text-sky-400"><span className="w-2 h-2 rounded-full bg-sky-400" /> Marge Op.</span>
                            <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Marge Nette</span>
                          </div>
                        </div>

                        {data.historicalAnnual.length > 1 ? (
                          <div className="h-48 w-full pt-4">
                            <svg className="w-full h-full" viewBox="0 0 500 160" preserveAspectRatio="none">
                              {(() => {
                                const pts = data.historicalAnnual;
                                const maxVal = 60; // 60% max
                                const stepX = 500 / (pts.length - 1 || 1);

                                const opPoints = pts.map((p, i) => `${i * stepX},${140 - ((p.operatingMarginPct || 0) / maxVal) * 120}`).join(' ');
                                const netPoints = pts.map((p, i) => `${i * stepX},${140 - ((p.netMarginPct || 0) / maxVal) * 120}`).join(' ');

                                return (
                                  <>
                                    <line x1="0" y1="20" x2="500" y2="20" stroke="#1E293B" strokeDasharray="3 3" />
                                    <line x1="0" y1="80" x2="500" y2="80" stroke="#1E293B" strokeDasharray="3 3" />
                                    <line x1="0" y1="140" x2="500" y2="140" stroke="#1E293B" />

                                    <polyline fill="none" stroke="#38BDF8" strokeWidth="2.5" points={opPoints} />
                                    <polyline fill="none" stroke="#22C55E" strokeWidth="2.5" points={netPoints} />

                                    {pts.map((p, i) => (
                                      <g key={i}>
                                        <circle cx={i * stepX} cy={140 - ((p.operatingMarginPct || 0) / maxVal) * 120} r="3.5" fill="#38BDF8" />
                                        <circle cx={i * stepX} cy={140 - ((p.netMarginPct || 0) / maxVal) * 120} r="3.5" fill="#22C55E" />
                                        <text x={i * stepX} y="156" fill="#64748B" fontSize="9" textAnchor="middle" fontFamily="monospace">
                                          {p.year}
                                        </text>
                                      </g>
                                    ))}
                                  </>
                                );
                              })()}
                            </svg>
                          </div>
                        ) : (
                          <div className="py-12 text-center text-slate-500 font-mono text-xs">Historique insuffisant pour tracer le graphique.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* MODE 2: COMPARATEUR MULTI-ENTREPRISES (2 à 5) */}
        {mode === 'compare' && (
          <div className="space-y-6">
            {/* Symbol Management Bar */}
            <div className="bg-[#0B1220] border border-subtle rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                  Sélection des Entreprises à Comparer
                </span>
                <div className="flex items-center flex-wrap gap-2 mt-2">
                  {compareSymbols.map((s) => (
                    <div
                      key={s}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#070B14] border border-subtle text-xs font-mono font-bold text-white shadow-sm"
                    >
                      <AssetLogo symbol={s} size="sm" />
                      <span>{s}</span>
                      <button
                        onClick={() => handleRemoveCompareSymbol(s)}
                        className="text-slate-400 hover:text-rose-400 transition"
                        title={`Retirer ${s}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add Ticker Input */}
              <form onSubmit={handleAddCompareSymbol} className="flex items-center gap-2 no-print">
                <input
                  type="text"
                  value={newCompareTicker}
                  onChange={(e) => setNewCompareTicker(e.target.value)}
                  placeholder="Ajouter ticker (ex: NVDA, TSLA)..."
                  className="bg-[#070B14] border border-subtle focus:border-sky-400 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none w-52"
                />
                <button
                  type="submit"
                  disabled={compareSymbols.length >= 5}
                  className="px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 text-sky-300 text-xs font-mono font-semibold flex items-center gap-1.5 transition disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
              </form>
            </div>

            {/* Comparison Loading */}
            {compareLoading && (
              <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center bg-[#070B14] rounded-2xl border border-subtle">
                <OrbitalSpinner size="lg" tone="cyan" />
                <p className="mt-4 text-xs font-mono text-slate-300 font-semibold">
                  Agrégation et normalisation des métriques comparatives...
                </p>
              </div>
            )}

            {/* Comparison Table */}
            {!compareLoading && comparisonData && (
              <div className="bg-[#0B1220] border border-subtle rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-subtle">
                  <div>
                    <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                      Matrice Comparative & Valorisation
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Comparaison directe des métriques financières certifiées SEC
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    {comparisonData.symbols.length} entreprises sélectionnées
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-subtle text-slate-400 text-[11px]">
                        <th className="py-3 px-3 min-w-[220px]">Indicateur Clé</th>
                        {comparisonData.symbols.map((sym) => (
                          <th key={sym} className="py-3 px-3 text-center min-w-[130px]">
                            <div className="flex flex-col items-center gap-1">
                              <AssetLogo symbol={sym} size="sm" />
                              <span className="font-bold text-white text-xs">{sym}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {comparisonData.comparisonRows.map((row) => (
                        <tr key={row.key} className="hover:bg-slate-800/20 transition">
                          <td className="py-3 px-3">
                            <div className="font-bold text-white">{row.label}</div>
                            <div className="text-[10px] text-slate-500">{row.description}</div>
                          </td>
                          {comparisonData.symbols.map((sym) => {
                            const valStr = row.valuesBySymbol[sym] || 'N/A';
                            const isBest = row.bestSymbol === sym;
                            return (
                              <td key={sym} className="py-3 px-3 text-center">
                                <span
                                  className={`inline-block px-2 py-1 rounded text-xs font-mono tabular-nums font-semibold ${
                                    isBest
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm font-bold'
                                      : valStr === 'N/A'
                                      ? 'text-slate-500'
                                      : 'text-slate-200'
                                  }`}
                                >
                                  {valStr}
                                  {isBest && ' ★'}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
};
