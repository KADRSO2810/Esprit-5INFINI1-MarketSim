import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Upload,
  Brain,
  Sliders,
  Play,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  BarChart2,
  Building2,
  Eye,
  RefreshCw,
  Layers,
  Sparkles,
  Activity,
} from 'lucide-react';
import {
  stressApi,
  Bank,
  BankImportStats,
  StressModel,
  StressScenario,
  StressRun,
  StressRunDetail,
  StressResult,
  LocalXaiExplanation,
  XaiExplanationResponse,
} from '../api/stress';
import { XaiWaterfallModal } from '../components/XaiWaterfallModal';
import { AppShell } from '../components/layout/AppShell';
import {
  PageTransition,
  StatCard,
  StressTestSkeleton,
  SkeletonTable,
  AnimatedTabs,
  AnimatedMarketLoader,
  OrbitalSpinner,
  MotionStagger,
  MotionItem,
  EmptyState,
  useToast,
} from '../components/ui';

type StressTab = 'runs' | 'scenarios' | 'models' | 'import';

export const StressTesting: React.FC = () => {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<StressTab>('runs');

  // Data Import State
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState<BankImportStats | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ML Models State
  const [models, setModels] = useState<StressModel[]>([]);
  const [modelName, setModelName] = useState('RandomForest-Risk-v1');
  const [modelType, setModelType] = useState('RANDOM_FOREST');
  const [targetKey, setTargetKey] = useState('expected_loss');
  const [training, setTraining] = useState(false);
  const [trainError, setTrainError] = useState<string | null>(null);

  // Scenarios State
  const [scenarios, setScenarios] = useState<StressScenario[]>([]);
  const [scenarioName, setScenarioName] = useState('Crise Stagflation 2026');
  const [scenarioDesc, setScenarioDesc] = useState(
    'Choc de taux +300bps et récession PIB -3%'
  );
  const [shockRates, setShockRates] = useState<Record<string, number>>({
    interest_rate: 0.03,
    inflation_rate: 0.04,
    gdp_growth: -0.03,
    unemployment_rate: 0.025,
  });
  const [savingScenario, setSavingScenario] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  // Stress Runs & Results State
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | ''>('');
  const [selectedModelId, setSelectedModelId] = useState<number | ''>('');
  const [runs, setRuns] = useState<StressRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [runDetail, setRunDetail] = useState<StressRunDetail | null>(null);
  const [runResults, setRunResults] = useState<StressResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [launchingRun, setLaunchingRun] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  // Local XAI Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalBankResult, setModalBankResult] = useState<StressResult | null>(null);
  const [modalExplanation, setModalExplanation] = useState<LocalXaiExplanation | null>(null);
  const [loadingXai, setLoadingXai] = useState(false);

  useEffect(() => {
    loadBanks();
    loadModels();
    loadScenarios();
    loadRuns();
  }, []);

  // Poll running/queued stress runs
  useEffect(() => {
    const isDetailRunning =
      runDetail && (runDetail.status === 'RUNNING' || runDetail.status === 'QUEUED');
    const hasRunningInList = runs.some(
      (r) => r.status === 'RUNNING' || r.status === 'QUEUED'
    );
    if (!isDetailRunning && !hasRunningInList) return;

    const interval = setInterval(async () => {
      try {
        await loadRuns();
        if (selectedRunId) {
          await loadRunDetail(selectedRunId);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [runs, selectedRunId, runDetail?.status]);

  const loadBanks = async () => {
    try {
      const data = await stressApi.getBanks();
      setBanks(data);
    } catch (err) {
      console.error('Failed to load banks', err);
    }
  };

  const loadModels = async () => {
    try {
      const data = await stressApi.getModels();
      setModels(data);
      if (data.length > 0 && selectedModelId === '') {
        setSelectedModelId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load models', err);
    }
  };

  const loadScenarios = async () => {
    try {
      const data = await stressApi.getScenarios();
      setScenarios(data);
      if (data.length > 0 && selectedScenarioId === '') {
        setSelectedScenarioId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load scenarios', err);
    }
  };

  const loadRuns = async () => {
    try {
      const data = await stressApi.getRuns();
      setRuns(data);
      if (data.length > 0 && selectedRunId === null) {
        setSelectedRunId(data[0].id);
        loadRunDetail(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load runs', err);
    }
  };

  const loadRunDetail = async (id: number) => {
    setLoadingResults(true);
    try {
      const detail = await stressApi.getRunDetail(id);
      setRunDetail(detail);
      if (detail.status === 'DONE') {
        const results = await stressApi.getRunResults(id);
        setRunResults(results);
      }
    } catch (err) {
      console.error('Failed to load run detail', err);
    } finally {
      setLoadingResults(false);
    }
  };

  // Import handlers
  const handleDownloadTemplate = async () => {
    try {
      const blob = await stressApi.downloadTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bank_stress_template.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.info('Template CSV téléchargé.');
    } catch {
      setImportError('Erreur lors du téléchargement du template CSV.');
      toast.error('Impossible de télécharger le template CSV.');
    }
  };

  const handleImportCsv = async () => {
    if (!file) {
      setImportError('Veuillez sélectionner un fichier CSV.');
      return;
    }
    setImporting(true);
    setImportError(null);
    setImportStats(null);
    try {
      const stats = await stressApi.importCsv(file);
      setImportStats(stats);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadBanks();
      toast.success(`${stats.importedRows} observations bancaires importées.`);
    } catch (err: any) {
      const msg =
        err.response?.data?.message || err.message || "Erreur lors de l'importation du CSV.";
      setImportError(msg);
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  // Training handler
  const handleTrainModel = async () => {
    setTraining(true);
    setTrainError(null);
    try {
      const trained = await stressApi.trainModel({
        name: modelName,
        modelType,
        targetKey,
      });
      await loadModels();
      setSelectedModelId(trained.id);
      setActiveTab('models');
      toast.ai(`Modèle "${trained.name}" calibré`, 'Métriques R² / MAE et arbre SHAP prêts.');
    } catch (err: any) {
      const msg =
        err.response?.data?.message || err.message || "Erreur lors de l'entraînement du modèle.";
      setTrainError(msg);
      toast.error(msg);
    } finally {
      setTraining(false);
    }
  };

  // Scenario handlers
  const handleSaveScenario = async () => {
    setSavingScenario(true);
    setScenarioError(null);
    try {
      const created = await stressApi.createScenario({
        name: scenarioName,
        description: scenarioDesc,
        shocks: shockRates,
      });
      await loadScenarios();
      setSelectedScenarioId(created.id);
      setActiveTab('runs');
      toast.success(`Scénario "${created.name}" enregistré.`);
    } catch (err: any) {
      const msg =
        err.response?.data?.message || err.message || 'Erreur lors de la création du scénario.';
      setScenarioError(msg);
      toast.error(msg);
    } finally {
      setSavingScenario(false);
    }
  };

  const applyPreset = (preset: 'stagflation' | 'rates' | 'real_estate') => {
    if (preset === 'stagflation') {
      setScenarioName('Crise Stagflationniste 2026');
      setScenarioDesc(
        'Forte inflation persistante (+4%) avec hausse brutale des taux (+300bps) et contraction du PIB (-3%)'
      );
      setShockRates({
        interest_rate: 0.03,
        inflation_rate: 0.04,
        gdp_growth: -0.03,
        unemployment_rate: 0.025,
      });
    } else if (preset === 'rates') {
      setScenarioName('Choc Taux Directeur (+350 bps)');
      setScenarioDesc(
        'Hausse continue des taux directeurs réduisant la marge nette et augmentant le coût du refinancement'
      );
      setShockRates({
        interest_rate: 0.035,
        deposit_growth: -0.04,
        loan_growth: -0.02,
      });
    } else {
      setScenarioName('Crise Immobilière & Défauts Crédit');
      setScenarioDesc(
        'Effondrement des prix immobiliers, hausse des créances douteuses (NPL +4%) et récession'
      );
      setShockRates({
        npl_ratio: 0.04,
        gdp_growth: -0.035,
        unemployment_rate: 0.03,
        fx_change: 0.05,
      });
    }
  };

  // Run launch handler
  const handleLaunchRun = async () => {
    if (!selectedScenarioId || !selectedModelId) {
      setRunError('Veuillez sélectionner à la fois un scénario et un modèle.');
      toast.warning('Sélectionnez un scénario et un modèle ML.');
      return;
    }
    setLaunchingRun(true);
    setRunError(null);
    try {
      const newRun = await stressApi.launchRun({
        scenarioId: Number(selectedScenarioId),
        modelId: Number(selectedModelId),
      });
      await loadRuns();
      setSelectedRunId(newRun.id);
      await loadRunDetail(newRun.id);
      toast.ai(`Stress test #${newRun.id} lancé`, 'Calcul des deltas macroéconomiques & attributions SHAP.');
    } catch (err: any) {
      const msg =
        err.response?.data?.message || err.message || 'Erreur lors du lancement du stress test.';
      setRunError(msg);
      toast.error(msg);
    } finally {
      setLaunchingRun(false);
    }
  };

  // XAI Modal handler
  const handleExplainBank = async (bankResult: StressResult) => {
    if (!selectedRunId) return;
    setModalBankResult(bankResult);
    setModalExplanation(null);
    setIsModalOpen(true);
    setLoadingXai(true);
    try {
      const xaiRes: XaiExplanationResponse = await stressApi.getRunXai(
        selectedRunId,
        'LOCAL',
        bankResult.bankId
      );
      if (xaiRes.content?.local_explanations && xaiRes.content.local_explanations.length > 0) {
        setModalExplanation(xaiRes.content.local_explanations[0]);
      } else if (xaiRes.content?.contributions) {
        setModalExplanation({
          id: bankResult.bankId,
          base_value: xaiRes.content.base_value ?? 0,
          predicted_value: Number(
            bankResult.stressed?.[runDetail?.targetKey || 'target'] ??
              bankResult.stressed?.['expected_loss'] ??
              0
          ),
          contributions: xaiRes.content.contributions,
        });
      }
    } catch (err) {
      console.error('Failed to load XAI explanation', err);
      toast.error('Impossible de charger les contributions SHAP.');
    } finally {
      setLoadingXai(false);
    }
  };

  const tabItems: Array<{ id: StressTab; label: string; icon: React.ElementType; count?: number }> = [
    { id: 'runs', label: 'Simulations', icon: Play, count: runs.length },
    { id: 'scenarios', label: 'Scénarios', icon: Sliders, count: scenarios.length },
    { id: 'models', label: 'Modèles ML', icon: Brain, count: models.length },
    { id: 'import', label: 'Import CSV', icon: Upload, count: banks.length },
  ];

  return (
    <AppShell
      title="AI Banking Stress Testing"
      section="AI Intelligence"
      badge="SHAP XAI"
      topbarActions={
        <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <span className="px-2.5 py-1 rounded-lg bg-[#0B1220] border border-subtle">
            {banks.length} banques
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[#0B1220] border border-subtle">
            {models.length} modèles
          </span>
        </div>
      }
    >
      <PageTransition className="space-y-6">
        {/* Top Command Header & Navigation Tabs */}
        <div className="workstation-panel rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Stress Testing Bancaire & IA Explicable (SHAP)
                </h2>
                <span className="hidden sm:inline text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25">
                  Microservice FastAPI
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Importez vos bilans réels, entraînez un régresseur supervisé, appliquez des chocs macroéconomiques et auditez la vulnérabilité de chaque établissement via SHAP.
              </p>
            </div>
          </div>

          <AnimatedTabs
            layoutId="stress-testing-tabs"
            activeId={activeTab}
            onChange={setActiveTab}
            accent="violet"
            tabs={tabItems.map((t) => ({
              id: t.id,
              label: t.label,
              icon: t.icon as React.ComponentType<{ className?: string }>,
              badge: t.count,
            }))}
            className="shrink-0"
          />
        </div>

        {/* =================================================================== */}
        {/* TAB 1: DATA IMPORT */}
        {/* =================================================================== */}
        {activeTab === 'import' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 workstation-panel rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-violet-400" />
                  <span>Données Observées (CSV)</span>
                </h3>
                <button
                  onClick={handleDownloadTemplate}
                  className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 bg-sky-500/10 px-2.5 py-1.5 rounded-lg border border-sky-500/25 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Template
                </button>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Importez un dataset CSV contenant les ratios financiers historiques réels par établissement et par période.
              </p>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-strong hover:border-violet-400 bg-[#0B1220] rounded-xl p-6 text-center cursor-pointer transition-colors"
              >
                <Upload className="w-7 h-7 text-violet-400 mx-auto mb-2" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <span className="text-xs font-semibold text-slate-200 block truncate">
                  {file ? file.name : 'Sélectionner un fichier .csv'}
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Séparateur virgule ou point-virgule
                </span>
              </div>

              {importError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}

              {importStats && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Importation réussie</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 font-mono tabular-nums text-slate-300">
                    <div>
                      Lignes : <strong className="text-white">{importStats.importedRows} / {importStats.totalRows}</strong>
                    </div>
                    <div>
                      Banques : <strong className="text-white">+{importStats.newBanksCount}</strong>
                    </div>
                  </div>
                  {importStats.detectedFeatures.length > 0 && (
                    <div className="text-[11px] font-mono text-slate-400">
                      Features : {importStats.detectedFeatures.slice(0, 6).join(', ')}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleImportCsv}
                disabled={!file || importing}
                className="w-full py-2.5 btn-ai disabled:opacity-45 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.985] flex items-center justify-center gap-2"
              >
                {importing ? <OrbitalSpinner size="xs" tone="cyan" /> : <Upload className="w-4 h-4" />}
                <span>{importing ? 'Importation…' : 'Valider & Importer'}</span>
              </button>
            </div>

            <div className="lg:col-span-8 workstation-panel rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4 border-b border-subtle pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-sky-400" />
                  <span>Banques Enregistrées ({banks.length})</span>
                </h3>
                <button
                  onClick={loadBanks}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Rafraîchir
                </button>
              </div>

              {banks.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="Aucune banque en base"
                  description="Téléchargez le template CSV et importez des observations réelles pour alimenter les modèles ML."
                />
              ) : (
                <div className="border border-subtle rounded-xl overflow-x-auto bg-[#0B1220]/50">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0B1220] text-slate-400 uppercase text-[10px] tracking-wider border-b border-subtle">
                      <tr>
                        <th className="px-4 py-3">Établissement</th>
                        <th className="px-4 py-3">Pays</th>
                        <th className="px-4 py-3">Catégorie</th>
                        <th className="px-4 py-3 text-right">Observations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-slate-300">
                      {banks.map((b) => (
                        <tr key={b.id} className="hover:bg-[#142035]/60 transition-colors">
                          <td className="px-4 py-3 font-semibold text-white">{b.name}</td>
                          <td className="px-4 py-3 text-slate-400">{b.country || 'N/A'}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                b.bankType === 'CONVENTIONAL'
                                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/25'
                                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                              }`}
                            >
                              {b.bankType === 'CONVENTIONAL' ? 'Conventionnelle' : 'Non-Conventionnelle'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-white">
                            {b.observationCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: ML MODELS */}
        {/* =================================================================== */}
        {activeTab === 'models' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 ai-surface rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-violet-400" />
                <span>Entraîner un Régresseur ML</span>
              </h3>

              <p className="text-xs text-slate-400 leading-relaxed">
                Le microservice FastAPI calibre le modèle sélectionné sur vos séries bancaires importées et calcule automatiquement ses métriques de validation (<strong className="text-slate-200">R²</strong>, <strong className="text-slate-200">MAE</strong>).
              </p>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 font-medium block mb-1.5">Nom du modèle</label>
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="w-full bg-[#0B1220] border border-subtle focus:border-violet-500 rounded-xl px-3.5 py-2 text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-medium block mb-1.5">Algorithme</label>
                  <select
                    value={modelType}
                    onChange={(e) => setModelType(e.target.value)}
                    className="w-full bg-[#0B1220] border border-subtle focus:border-violet-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="RANDOM_FOREST">Random Forest Regressor</option>
                    <option value="GRADIENT_BOOSTING">Gradient Boosting Regressor</option>
                    <option value="RIDGE">Ridge Linear Regression</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-medium block mb-1.5">
                    Variable Cible (Target)
                  </label>
                  <input
                    type="text"
                    value={targetKey}
                    onChange={(e) => setTargetKey(e.target.value)}
                    placeholder="ex: expected_loss, cet1_ratio, npl_ratio"
                    className="w-full bg-[#0B1220] border border-subtle focus:border-violet-500 rounded-xl px-3.5 py-2 text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              {trainError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{trainError}</span>
                </div>
              )}

              <button
                onClick={handleTrainModel}
                disabled={training}
                className="w-full py-2.5 btn-ai disabled:opacity-45 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.985] flex items-center justify-center gap-2"
              >
                {training ? <OrbitalSpinner size="xs" tone="cyan" /> : <Brain className="w-4 h-4" />}
                <span>{training ? 'Entraînement en cours…' : 'Lancer l’Entraînement IA'}</span>
              </button>
              {training && (
                <AnimatedMarketLoader
                  mode="ai"
                  variant="inline"
                  badge="ML CALIBRATION"
                  title="Calibration Scikit-learn en cours…"
                  subtitle="Validation croisée, calcul R² / MAE et construction TreeExplainer SHAP."
                />
              )}
            </div>

            <div className="lg:col-span-8 workstation-panel rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4 border-b border-subtle pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>Modèles Entraînés ({models.length})</span>
                </h3>
                <button
                  onClick={loadModels}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Rafraîchir
                </button>
              </div>

              {models.length === 0 ? (
                <EmptyState
                  icon={Brain}
                  title="Aucun modèle entraîné"
                  description="Entraînez votre premier modèle de régression à gauche pour prédire l'impact des chocs macroéconomiques."
                />
              ) : (
                <div className="space-y-3">
                  {models.map((m) => (
                    <div
                      key={m.id}
                      className="p-4 bg-[#0B1220] rounded-xl border border-subtle hover:border-strong transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <span className="font-bold text-white text-sm block">{m.name}</span>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span className="text-[10px] bg-[#142035] border border-subtle text-slate-300 px-2 py-0.5 rounded font-mono">
                            {m.modelType}
                          </span>
                          <span className="text-[11px] text-violet-300 font-mono">
                            Target: {m.targetKey}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 font-mono tabular-nums">
                        <div className="px-3 py-1.5 rounded-lg bg-[#101A2B] border border-subtle text-right">
                          <span className="text-[9px] uppercase text-slate-500 block">MAE Test</span>
                          <span className="text-xs font-bold text-sky-300">
                            {m.metrics?.mae != null ? Number(m.metrics.mae).toFixed(4) : 'N/A'}
                          </span>
                        </div>
                        <div className="px-3 py-1.5 rounded-lg bg-[#101A2B] border border-subtle text-right">
                          <span className="text-[9px] uppercase text-slate-500 block">R² Score</span>
                          <span
                            className={`text-xs font-bold ${
                              Number(m.metrics?.r2 ?? 0) >= 0.7 ? 'text-emerald-400' : 'text-amber-300'
                            }`}
                          >
                            {m.metrics?.r2 != null ? Number(m.metrics.r2).toFixed(4) : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: SCENARIOS */}
        {/* =================================================================== */}
        {activeTab === 'scenarios' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 workstation-panel rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-violet-400" />
                <span>Générateur de Scénario Macro</span>
              </h3>

              <div>
                <span className="text-[11px] text-slate-400 block mb-2 font-medium uppercase tracking-wider">
                  Préréglages Institutionnels
                </span>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => applyPreset('stagflation')}
                    className="text-left p-3 bg-[#0B1220] hover:bg-[#142035] border border-subtle hover:border-amber-500/40 rounded-xl text-xs transition-colors"
                  >
                    <span className="font-bold text-amber-300 block">Stagflation 2026</span>
                    <span className="text-[11px] text-slate-400">
                      Taux +300bps · Inflation +4% · PIB -3%
                    </span>
                  </button>
                  <button
                    onClick={() => applyPreset('rates')}
                    className="text-left p-3 bg-[#0B1220] hover:bg-[#142035] border border-subtle hover:border-sky-500/40 rounded-xl text-xs transition-colors"
                  >
                    <span className="font-bold text-sky-300 block">Choc Taux BCE (+350 bps)</span>
                    <span className="text-[11px] text-slate-400">
                      Hausse des taux · Contraction dépôts & crédit
                    </span>
                  </button>
                  <button
                    onClick={() => applyPreset('real_estate')}
                    className="text-left p-3 bg-[#0B1220] hover:bg-[#142035] border border-subtle hover:border-rose-500/40 rounded-xl text-xs transition-colors"
                  >
                    <span className="font-bold text-rose-300 block">Crise Immobilière & Défauts</span>
                    <span className="text-[11px] text-slate-400">
                      NPL +4% · PIB -3.5% · Chômage +3%
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-xs pt-3 border-t border-subtle">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Nom du Scénario</label>
                  <input
                    type="text"
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    className="w-full bg-[#0B1220] border border-subtle focus:border-violet-500 rounded-xl px-3.5 py-2 text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-medium block mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={scenarioDesc}
                    onChange={(e) => setScenarioDesc(e.target.value)}
                    className="w-full bg-[#0B1220] border border-subtle focus:border-violet-500 rounded-xl px-3.5 py-2 text-white focus:outline-none"
                  />
                </div>

                <div>
                  <span className="text-slate-400 font-medium block mb-2">
                    Chocs appliqués (Deltas Δ)
                  </span>
                  <div className="space-y-2">
                    {Object.entries(shockRates).map(([k, v]) => (
                      <div
                        key={k}
                        className="flex items-center justify-between bg-[#0B1220] px-3 py-2 rounded-xl border border-subtle"
                      >
                        <span className="font-mono text-slate-300 text-[11px]">{k}</span>
                        <input
                          type="number"
                          step="0.005"
                          value={v}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setShockRates((prev) => ({ ...prev, [k]: val }));
                          }}
                          className="w-24 bg-[#101A2B] border border-subtle focus:border-amber-400 rounded-lg px-2.5 py-1 text-right text-amber-300 font-mono tabular-nums text-xs focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {scenarioError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{scenarioError}</span>
                </div>
              )}

              <button
                onClick={handleSaveScenario}
                disabled={savingScenario}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-[#142035] text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                {savingScenario ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>{savingScenario ? 'Enregistrement…' : 'Enregistrer le Scénario'}</span>
              </button>
            </div>

            <div className="lg:col-span-7 workstation-panel rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4 border-b border-subtle pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-sky-400" />
                  <span>Scénarios Configurés ({scenarios.length})</span>
                </h3>
                <button
                  onClick={loadScenarios}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Rafraîchir
                </button>
              </div>

              {scenarios.length === 0 ? (
                <EmptyState
                  icon={Sliders}
                  title="Aucun scénario défini"
                  description="Utilisez un préréglage ou personnalisez vos deltas macroéconomiques à gauche."
                />
              ) : (
                <div className="space-y-3">
                  {scenarios.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 bg-[#0B1220] rounded-xl border border-subtle hover:border-strong transition-colors space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white text-sm">{s.name}</span>
                        <span className="text-[11px] font-mono text-slate-500">
                          {new Date(s.createdAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      {s.description && (
                        <p className="text-xs text-slate-400 leading-relaxed">{s.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(s.shocks).map(([k, v]) => (
                          <span
                            key={k}
                            className="px-2 py-0.5 bg-[#101A2B] text-amber-300 font-mono tabular-nums text-[11px] rounded-md border border-subtle"
                          >
                            {k}: {v > 0 ? `+${v}` : v}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: SIMULATIONS & SHAP RESULTS */}
        {/* =================================================================== */}
        {activeTab === 'runs' && (
          <div className="space-y-6">
            {/* Launcher Bar */}
            <div className="workstation-panel rounded-2xl p-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="text-[11px] text-slate-400 font-medium block mb-1.5">
                    Scénario de Choc Macro
                  </label>
                  <select
                    value={selectedScenarioId}
                    onChange={(e) => setSelectedScenarioId(Number(e.target.value))}
                    className="w-full bg-[#0B1220] border border-subtle focus:border-violet-500 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                  >
                    <option value="">Sélectionner un scénario…</option>
                    {scenarios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 font-medium block mb-1.5">
                    Modèle Prédictif ML
                  </label>
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(Number(e.target.value))}
                    className="w-full bg-[#0B1220] border border-subtle focus:border-violet-500 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                  >
                    <option value="">Sélectionner un modèle…</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.targetKey})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 font-medium block mb-1.5">
                    Historique des Exécutions
                  </label>
                  <select
                    value={selectedRunId ?? ''}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      setSelectedRunId(id);
                      if (id) loadRunDetail(id);
                    }}
                    className="w-full bg-[#0B1220] border border-subtle focus:border-violet-500 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none"
                  >
                    <option value="">Consulter un run…</option>
                    {runs.map((r) => (
                      <option key={r.id} value={r.id}>
                        Run #{r.id} · {r.scenarioName} ({r.status})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleLaunchRun}
                  disabled={!selectedScenarioId || !selectedModelId || launchingRun}
                  className="w-full py-2.5 px-4 btn-ai disabled:opacity-45 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.985] flex items-center justify-center gap-2"
                >
                  {launchingRun ? (
                    <OrbitalSpinner size="xs" tone="cyan" />
                  ) : (
                    <Play className="w-4 h-4 fill-white" />
                  )}
                  <span>{launchingRun ? 'Exécution…' : 'Lancer le Stress Test'}</span>
                </button>
              </div>

              {runError && (
                <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{runError}</span>
                </div>
              )}
            </div>

            {loadingResults && !runDetail ? (
              <StressTestSkeleton />
            ) : !runDetail ? (
              <div className="workstation-panel rounded-2xl p-8">
                <EmptyState
                  icon={Sparkles}
                  title="Aucune simulation sélectionnée"
                  description="Choisissez un scénario de choc et un modèle ML ci-dessus, puis lancez le Stress Test pour visualiser la résilience bancaire et les valeurs SHAP."
                />
              </div>
            ) : (
              <div className="space-y-6">
                {(runDetail.status === 'RUNNING' || runDetail.status === 'QUEUED') && (
                  <AnimatedMarketLoader
                    mode="ai"
                    variant="inline"
                    badge={`RUN #${runDetail.id} · ${runDetail.status}`}
                    title={
                      runDetail.status === 'QUEUED'
                        ? "Stress Test en file d'attente · Initialisation IA…"
                        : 'Inférence IA & Calcul SHAP en cours…'
                    }
                    subtitle="Application des chocs macroéconomiques aux bilans observés et décomposition des facteurs critiques."
                  />
                )}

                {runDetail.status === 'FAILED' && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-300 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      Échec du run : {runDetail.errorMessage || "Erreur interne pendant l'exécution."}
                    </span>
                  </div>
                )}

                {runDetail.status === 'DONE' && (
                  <>
                    {/* Top 4 Quantitative KPIs */}
                    <MotionStagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <MotionItem>
                        <StatCard
                          label="Échantillon Observé"
                          value={`${runDetail.totalBanksCount ?? 0} banques`}
                          subValue="Bilans CSV réels importés"
                          icon={Building2}
                          accent="cyan"
                        />
                      </MotionItem>
                      <MotionItem>
                        <StatCard
                          label={`Impact Moyen (Δ ${runDetail.targetKey || 'Impact'})`}
                          value={
                            <span className="text-amber-300">
                              {Number(runDetail.avgDelta ?? 0) >= 0 ? '+' : ''}
                              {Number(runDetail.avgDelta ?? 0).toFixed(4)}
                            </span>
                          }
                          subValue={`Base ${Number(runDetail.avgBaseline ?? 0).toFixed(4)} → Stress ${Number(
                            runDetail.avgStressed ?? 0
                          ).toFixed(4)}`}
                          icon={Activity}
                          accent="warning"
                        />
                      </MotionItem>
                      <MotionItem>
                        <StatCard
                          label="Banque la Plus Exposée"
                          value={
                            <span className="text-rose-400 truncate block">
                              {runDetail.mostImpactedBankName || 'N/A'}
                            </span>
                          }
                          subValue={`Choc max : +${Number(runDetail.maxDelta ?? 0).toFixed(4)}`}
                          icon={ShieldAlert}
                          accent="bearish"
                        />
                      </MotionItem>
                      <MotionItem>
                        <StatCard
                          label="Scénario & Modèle ML"
                          value={<span className="text-sm truncate block">{runDetail.scenarioName}</span>}
                          subValue={runDetail.modelName || 'Régresseur IA'}
                          icon={Brain}
                          accent="violet"
                        />
                      </MotionItem>
                    </MotionStagger>

                    {/* Resilience Comparison & Global SHAP */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Conventional vs Non-Conventional */}
                      <div className="workstation-panel rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-subtle pb-3">
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <BarChart2 className="w-4 h-4 text-sky-400" />
                            <span>Conventionnelles vs Non-Conventionnelles</span>
                          </h3>
                          <span className="text-[11px] font-mono text-slate-400">
                            Impact moyen sous stress
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="p-4 bg-[#0B1220] border border-sky-500/25 rounded-xl space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-sky-400">Conventionnelles</span>
                              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                                ({runDetail.conventionalStats?.count ?? 0})
                              </span>
                            </div>
                            <div className="text-xl font-bold font-mono tabular-nums text-white">
                              {Number(runDetail.conventionalStats?.avgDelta ?? 0) >= 0 ? '+' : ''}
                              {Number(runDetail.conventionalStats?.avgDelta ?? 0).toFixed(4)}
                            </div>
                            <div className="text-[11px] font-mono tabular-nums text-slate-400">
                              Base {Number(runDetail.conventionalStats?.avgBaseline ?? 0).toFixed(4)} →{' '}
                              {Number(runDetail.conventionalStats?.avgStressed ?? 0).toFixed(4)}
                            </div>
                          </div>

                          <div className="p-4 bg-[#0B1220] border border-emerald-500/25 rounded-xl space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-emerald-400">
                                Non-Conventionnelles
                              </span>
                              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                                ({runDetail.nonConventionalStats?.count ?? 0})
                              </span>
                            </div>
                            <div className="text-xl font-bold font-mono tabular-nums text-white">
                              {Number(runDetail.nonConventionalStats?.avgDelta ?? 0) >= 0 ? '+' : ''}
                              {Number(runDetail.nonConventionalStats?.avgDelta ?? 0).toFixed(4)}
                            </div>
                            <div className="text-[11px] font-mono tabular-nums text-slate-400">
                              Base {Number(runDetail.nonConventionalStats?.avgBaseline ?? 0).toFixed(4)} →{' '}
                              {Number(runDetail.nonConventionalStats?.avgStressed ?? 0).toFixed(4)}
                            </div>
                          </div>
                        </div>

                        <div className="text-xs text-slate-300 leading-relaxed bg-[#0B1220] p-3.5 rounded-xl border border-subtle">
                          {runDetail.conventionalStats &&
                          runDetail.nonConventionalStats &&
                          runDetail.conventionalStats.count > 0 &&
                          runDetail.nonConventionalStats.count > 0 ? (
                            runDetail.nonConventionalStats.avgDelta <
                            runDetail.conventionalStats.avgDelta ? (
                              <span>
                                Les banques <strong className="text-emerald-400">non-conventionnelles</strong> affichent une résilience supérieure de{' '}
                                <strong className="font-mono text-white">
                                  {(
                                    (1 -
                                      runDetail.nonConventionalStats.avgDelta /
                                        Math.max(0.001, runDetail.conventionalStats.avgDelta)) *
                                    100
                                  ).toFixed(1)}
                                  %
                                </strong>{' '}
                                face à ce scénario macroéconomique.
                              </span>
                            ) : (
                              <span>
                                Les banques <strong className="text-sky-400">conventionnelles</strong> absorbent mieux ce choc avec un delta prédit inférieur.
                              </span>
                            )
                          ) : (
                            <span>
                              Échantillon analysé :{' '}
                              <strong className="text-white">{runDetail.totalBanksCount ?? 0} banque(s)</strong> importée(s).
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Global SHAP Importance */}
                      <div className="ai-surface rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-subtle pb-3">
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Brain className="w-4 h-4 text-violet-400" />
                            <span>XAI Global : Facteurs Macro (SHAP)</span>
                          </h3>
                          <span className="text-[11px] font-mono text-slate-400">
                            Mean |SHAP|
                          </span>
                        </div>

                        {runDetail.globalFeatureImportance &&
                        runDetail.globalFeatureImportance.length > 0 ? (
                          <div className="space-y-3">
                            {runDetail.globalFeatureImportance.slice(0, 6).map((feat, idx) => {
                              const pct = Math.min(
                                100,
                                Math.round(Number(feat.importance ?? 0) * 100)
                              );
                              return (
                                <div key={`${feat.feature}-${idx}`} className="space-y-1.5">
                                  <div className="flex justify-between text-xs text-slate-300">
                                    <span className="font-mono font-semibold">{feat.feature}</span>
                                    <span className="font-mono tabular-nums text-violet-300">
                                      {(Number(feat.importance ?? 0) * 100).toFixed(1)}% (
                                      {Number(feat.mean_abs_shap ?? 0).toFixed(4)})
                                    </span>
                                  </div>
                                  <div className="w-full bg-[#0B1220] h-2 rounded-full overflow-hidden border border-subtle">
                                    <div
                                      className="bg-gradient-to-r from-violet-500 to-sky-400 h-full rounded-full transition-all duration-500"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <EmptyState
                            icon={Brain}
                            title="Attribution globale indisponible"
                            description="Les facteurs SHAP globaux apparaîtront ici dès que l'analyse du run sera finalisée."
                            compact
                          />
                        )}
                      </div>
                    </div>

                    {/* Bank Results Table */}
                    <div className="workstation-panel rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-violet-400" />
                          <span>Résultats Prédites & Attributions par Banque</span>
                        </h3>
                        <span className="text-xs font-mono text-slate-400 tabular-nums">
                          {runResults.length} établissements
                        </span>
                      </div>

                      {loadingResults ? (
                        <SkeletonTable rows={6} cols={6} />
                      ) : runResults.length === 0 ? (
                        <EmptyState
                          icon={Building2}
                          title="Aucun résultat détaillé"
                          description="Les prédictions individuelles par établissement ne sont pas encore disponibles pour ce run."
                          compact
                        />
                      ) : (
                        <div className="border border-subtle rounded-xl overflow-x-auto bg-[#0B1220]/50">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#0B1220] text-slate-400 uppercase text-[10px] tracking-wider border-b border-subtle">
                              <tr>
                                <th className="px-4 py-3">Banque</th>
                                <th className="px-4 py-3">Catégorie</th>
                                <th className="px-4 py-3 text-right">Baseline (Obs.)</th>
                                <th className="px-4 py-3 text-right">Sous Stress (ML)</th>
                                <th className="px-4 py-3 text-right">Impact (Δ)</th>
                                <th className="px-4 py-3 text-center">Explication XAI</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/40 text-slate-300">
                              {runResults.map((res) => {
                                const target = runDetail.targetKey || 'target';
                                const bVal = Number(
                                  res.baseline?.[target] ?? res.baseline?.['expected_loss'] ?? 0
                                );
                                const sVal = Number(
                                  res.stressed?.[target] ?? res.stressed?.['expected_loss'] ?? 0
                                );
                                const dVal = Number(
                                  res.delta?.[target] ?? res.delta?.['expected_loss'] ?? sVal - bVal
                                );

                                return (
                                  <tr
                                    key={res.id}
                                    className="hover:bg-[#142035]/60 transition-colors"
                                  >
                                    <td className="px-4 py-3">
                                      <div className="font-semibold text-white">{res.bankName}</div>
                                      <div className="text-[10px] text-slate-500">
                                        {res.country || 'N/A'}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                          res.bankType === 'CONVENTIONAL'
                                            ? 'bg-sky-500/15 text-sky-300 border-sky-500/25'
                                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                                        }`}
                                      >
                                        {res.bankType === 'CONVENTIONAL'
                                          ? 'Conventionnelle'
                                          : 'Non-Conv.'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                                      {bVal.toFixed(4)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono tabular-nums text-amber-300 font-bold">
                                      {sVal.toFixed(4)}
                                    </td>
                                    <td
                                      className={`px-4 py-3 text-right font-mono tabular-nums font-bold ${
                                        dVal >= 0 ? 'text-rose-400' : 'text-emerald-400'
                                      }`}
                                    >
                                      {dVal >= 0 ? '+' : ''}
                                      {dVal.toFixed(4)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <button
                                        onClick={() => handleExplainBank(res)}
                                        className="px-2.5 py-1 bg-violet-500/15 hover:bg-violet-500/30 text-violet-300 hover:text-white border border-violet-500/30 rounded-lg text-[11px] font-semibold transition-colors inline-flex items-center gap-1"
                                      >
                                        <Eye className="w-3 h-3" />
                                        <span>SHAP</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </PageTransition>

      <XaiWaterfallModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        bankResult={modalBankResult}
        localExplanation={modalExplanation}
        targetKey={runDetail?.targetKey || 'Impact'}
        isLoading={loadingXai}
      />
    </AppShell>
  );
};
