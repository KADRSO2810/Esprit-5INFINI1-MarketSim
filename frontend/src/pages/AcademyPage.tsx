import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AppShell } from '../components/layout/AppShell';
import { useToast, PageTransition, QuantOrbitalLoader } from '../components/ui';
import {
  learningApi,
  LearningModule,
  LearningLesson,
  Quiz,
  QuizResult,
  MarketScenario,
  UserLearningProfile,
} from '../api/learning';
import {
  GraduationCap,
  BookOpen,
  Award,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  Clock,
  Sparkles,
  ShieldCheck,
  Globe,
  BarChart3,
  FileSpreadsheet,
  ShieldAlert,
  Flame,
  X,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export const AcademyPage: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'COURS' | 'QUIZ' | 'SCENARIOS' | 'BADGES'>('COURS');

  const [modules, setModules] = useState<LearningModule[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [scenarios, setScenarios] = useState<MarketScenario[]>([]);
  const [profile, setProfile] = useState<UserLearningProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Active lesson reading modal
  const [activeLesson, setActiveLesson] = useState<LearningLesson | null>(null);
  const [completingLesson, setCompletingLesson] = useState<boolean>(false);

  // Active quiz playing state
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizSubmitting, setQuizSubmitting] = useState<boolean>(false);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);

  // Load initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [mods, qzs, scens, prof] = await Promise.all([
        learningApi.getModules(),
        learningApi.getQuizzes(),
        learningApi.getMarketScenarios(),
        learningApi.getUserProfile(),
      ]);
      setModules(mods);
      setQuizzes(qzs);
      setScenarios(scens);
      setProfile(prof);
    } catch (err: any) {
      toast.error('Erreur de chargement', err?.message || 'Impossible de joindre le serveur pédagogique');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Mark lesson completed
  const handleCompleteLesson = async (lessonId: string) => {
    try {
      setCompletingLesson(true);
      await learningApi.markLessonCompleted(lessonId);
      toast.success('Leçon validée !', 'Votre progression a été mise à jour.');
      const updatedProfile = await learningApi.getUserProfile();
      setProfile(updatedProfile);
    } catch (err: any) {
      toast.error('Erreur', err?.message || 'Impossible de valider la leçon');
    } finally {
      setCompletingLesson(false);
    }
  };

  // Start taking a quiz
  const handleStartQuiz = async (quizId: string) => {
    try {
      const q = await learningApi.getQuizById(quizId);
      setActiveQuiz(q);
      setSelectedAnswers({});
      setQuizResult(null);
      setActiveTab('QUIZ');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      toast.error('Erreur', err?.message || 'Impossible de charger le quiz');
    }
  };

  // Submit quiz answers
  const handleSubmitQuiz = async () => {
    if (!activeQuiz) return;
    const answeredCount = Object.keys(selectedAnswers).length;
    if (answeredCount < activeQuiz.questions.length) {
      toast.warning('Réponses incomplètes', `Veuillez répondre aux ${activeQuiz.questions.length} questions avant de soumettre.`);
      return;
    }

    try {
      setQuizSubmitting(true);
      const res = await learningApi.submitQuiz(activeQuiz.id, selectedAnswers);
      setQuizResult(res);

      if (res.passed) {
        toast.success('Félicitations !', `Quiz réussi avec ${res.percentage}% de bonnes réponses.`);
      } else {
        toast.warning('Échec au quiz', `Score : ${res.percentage}%. Le seuil requis est de ${activeQuiz.passingScorePct}%.`);
      }

      const updatedProfile = await learningApi.getUserProfile();
      setProfile(updatedProfile);
    } catch (err: any) {
      toast.error('Erreur de soumission', err?.message || 'Échec lors de la vérification du quiz');
    } finally {
      setQuizSubmitting(false);
    }
  };

  const getModuleIcon = (iconName: string) => {
    switch (iconName) {
      case 'Activity': return <TrendingUp className="h-5 w-5 text-sky-400" />;
      case 'BarChart3': return <BarChart3 className="h-5 w-5 text-blue-400" />;
      case 'Globe': return <Globe className="h-5 w-5 text-amber-400" />;
      case 'FileSpreadsheet': return <FileSpreadsheet className="h-5 w-5 text-emerald-400" />;
      case 'ShieldAlert': return <ShieldAlert className="h-5 w-5 text-red-400" />;
      case 'ShieldCheck': return <ShieldCheck className="h-5 w-5 text-violet-400" />;
      default: return <BookOpen className="h-5 w-5 text-cyan-400" />;
    }
  };

  const isLessonCompleted = (lessonId: string) => {
    return profile?.completedLessonIds?.includes(lessonId) ?? false;
  };

  const isQuizPassed = (quizId: string) => {
    return profile?.passedQuizIds?.includes(quizId) ?? false;
  };

  return (
    <AppShell title="Académie Financière & Quiz" section="Formation & Apprentissage">
      <PageTransition>
        {loading ? (
          <div className="py-24 flex justify-center">
            <QuantOrbitalLoader
              tone="cyan"
              title="Académie Financière & Salle de Marché"
              subtitle="Chargement du programme pédagogique, fiches de cours et quiz d'évaluation..."
            />
          </div>
        ) : (
          <div className="space-y-6">

          {/* ========================================================================= */}
          {/* HEADER PÉDAGOGIQUE & PROFIL D'APPRENTISSAGE */}
          {/* ========================================================================= */}
          <div className="relative overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-br from-[#0B1220] via-[#070B14] to-[#0B1528] p-6 shadow-2xl backdrop-blur-xl">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
            <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

            <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-500/10 text-sky-400 shadow-inner">
                    <GraduationCap className="h-7 w-7" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                      Académie des Marchés & Certifications
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300">
                        <Sparkles className="h-3 w-3" /> Section 3.3 ESPRIT
                      </span>
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Programme interactif de formation financière institutionnelle, validation d'acquis par QCM et scénarios de crise.
                    </p>
                  </div>
                </div>

                {/* Grade honorifique */}
                {profile && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300">
                      <Flame className="h-4 w-4 text-amber-400" />
                      <span>Rang Académique : <strong>{profile.userTitle}</strong></span>
                    </div>

                    <div className="text-xs text-slate-400">
                      Progression globale : <span className="font-mono font-bold text-white">{profile.overallProgressPct}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Statistiques clés en tuiles */}
              {profile && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-slate-800 bg-[#070B14]/70 p-3 text-center">
                    <span className="text-[10px] uppercase text-slate-400 block font-medium">Leçons</span>
                    <span className="text-lg font-bold font-mono text-sky-400">
                      {profile.completedLessonsCount} / {profile.totalLessonsCount}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-[#070B14]/70 p-3 text-center">
                    <span className="text-[10px] uppercase text-slate-400 block font-medium">Quiz Validés</span>
                    <span className="text-lg font-bold font-mono text-emerald-400">
                      {profile.passedQuizzesCount} / {profile.totalQuizzesCount}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-[#070B14]/70 p-3 text-center">
                    <span className="text-[10px] uppercase text-slate-400 block font-medium">Badges</span>
                    <span className="text-lg font-bold font-mono text-amber-400">
                      {profile.badges.length}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Global progress bar */}
            {profile && (
              <div className="relative mt-6">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <motion.div
                    className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${profile.overallProgressPct}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* TABS DE NAVIGATION */}
          {/* ========================================================================= */}
          <div className="flex border-b border-slate-800 gap-2 pb-1">
            <button
              onClick={() => setActiveTab('COURS')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'COURS'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              Modules de Formation ({modules.length})
            </button>

            <button
              onClick={() => setActiveTab('QUIZ')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'QUIZ'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <HelpCircle className="h-4 w-4" />
              Évaluations & Quiz QCM ({quizzes.length})
            </button>

            <button
              onClick={() => setActiveTab('SCENARIOS')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'SCENARIOS'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              Scénarios de Marché & Défis ({scenarios.length})
            </button>

            <button
              onClick={() => setActiveTab('BADGES')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'BADGES'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Award className="h-4 w-4" />
              Badges & Certifications ({profile?.badges?.length ?? 0})
            </button>
          </div>

          {/* ========================================================================= */}
          {/* CONTENU ONGLET 1: MODULES & LEÇONS */}
          {/* ========================================================================= */}
          {activeTab === 'COURS' && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {modules.map((mod) => {
                const completedInMod = mod.lessons.filter(l => isLessonCompleted(l.id)).length;
                const modProgressPct = mod.lessonsCount > 0 ? (completedInMod / mod.lessonsCount) * 100 : 0;
                const quizPassed = isQuizPassed(mod.quizId);

                return (
                  <motion.div
                    key={mod.id}
                    layout
                    className="flex flex-col justify-between rounded-3xl border border-slate-800 bg-[#0B1220] p-5 shadow-lg transition hover:border-slate-700"
                  >
                    <div>
                      {/* Top badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-[#070B14]">
                            {getModuleIcon(mod.icon)}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            mod.level === 'BEGINNER'
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                              : mod.level === 'INTERMEDIATE'
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                              : 'border-violet-500/30 bg-violet-500/10 text-violet-400'
                          }`}>
                            {mod.level}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                          <Clock className="h-3 w-3" />
                          <span>{mod.durationMinutes} min</span>
                        </div>
                      </div>

                      {/* Title & Desc */}
                      <h3 className="text-base font-bold text-white mb-1.5">{mod.title}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed mb-4">{mod.description}</p>

                      {/* Lessons list */}
                      <div className="space-y-2 mb-4">
                        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                          Leçons au programme ({completedInMod}/{mod.lessonsCount}) :
                        </span>
                        {mod.lessons.map((les) => {
                          const done = isLessonCompleted(les.id);
                          return (
                            <button
                              key={les.id}
                              onClick={() => setActiveLesson(les)}
                              className={`w-full flex items-center justify-between text-left p-2.5 rounded-xl border text-xs transition ${
                                done
                                  ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200 hover:bg-emerald-500/10'
                                  : 'border-slate-800 bg-[#070B14] text-slate-300 hover:border-slate-700 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                {done ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                ) : (
                                  <BookOpen className="h-4 w-4 text-slate-500 shrink-0" />
                                )}
                                <span className="truncate">{les.title}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 shrink-0 ml-2 font-mono">{les.durationMinutes}m</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Progress & Quiz trigger */}
                    <div className="border-t border-slate-800/80 pt-4 mt-2">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-slate-400">Progression module</span>
                        <span className="font-mono font-bold text-white">{modProgressPct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800 mb-3">
                        <div
                          className="h-full bg-sky-400 transition-all duration-500"
                          style={{ width: `${modProgressPct}%` }}
                        />
                      </div>

                      <button
                        onClick={() => handleStartQuiz(mod.quizId)}
                        className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                          quizPassed
                            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                            : 'border-sky-500/40 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25'
                        }`}
                      >
                        {quizPassed ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            Quiz Validé (Refaire l'évaluation)
                          </>
                        ) : (
                          <>
                            <HelpCircle className="h-4 w-4" />
                            Passer le Quiz de Validation
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ========================================================================= */}
          {/* CONTENU ONGLET 2: QUIZ & ÉVALUATIONS */}
          {/* ========================================================================= */}
          {activeTab === 'QUIZ' && (
            <div className="space-y-6">
              {/* Si aucun quiz actif sélectionné, afficher la liste des quiz */}
              {!activeQuiz && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {quizzes.map((q) => {
                    const passed = isQuizPassed(q.id);
                    const bestScore = profile?.quizBestScores?.[q.id];

                    return (
                      <div
                        key={q.id}
                        className={`rounded-3xl border p-5 shadow-lg flex flex-col justify-between ${
                          passed
                            ? 'border-emerald-500/30 bg-[#0B1220]'
                            : 'border-slate-800 bg-[#0B1220]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-mono text-slate-400">
                              {q.questions.length} Questions
                            </span>
                            {passed ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" /> Validé ({bestScore != null ? Number(bestScore).toFixed(0) : '100'}%)
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-400 font-semibold border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                                Seuil : {q.passingScorePct}%
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-bold text-white mb-1.5">{q.title}</h3>
                          <p className="text-xs text-slate-400 mb-4">{q.description}</p>
                        </div>

                        <button
                          onClick={() => handleStartQuiz(q.id)}
                          className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold border transition ${
                            passed
                              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                              : 'border-sky-500/40 bg-sky-500/20 text-sky-300 hover:bg-sky-500/30'
                          }`}
                        >
                          <HelpCircle className="h-4 w-4" />
                          {passed ? 'Repasser l\'évaluation' : 'Démarrer le Quiz'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quiz en cours de passage */}
              {activeQuiz && (
                <div className="max-w-3xl mx-auto rounded-3xl border border-sky-500/30 bg-[#0B1220] p-6 shadow-2xl space-y-6">
                  {/* Top Bar du quiz */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <span className="text-[11px] font-mono uppercase text-sky-400 font-semibold block">Évaluation QCM</span>
                      <h2 className="text-xl font-bold text-white">{activeQuiz.title}</h2>
                    </div>
                    <button
                      onClick={() => {
                        setActiveQuiz(null);
                        setQuizResult(null);
                      }}
                      className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:text-white hover:bg-slate-800"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Résultat après soumission */}
                  {quizResult && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`rounded-2xl border p-5 ${
                        quizResult.passed
                          ? 'border-emerald-500/40 bg-emerald-500/10'
                          : 'border-red-500/40 bg-red-500/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold flex items-center gap-2 text-white">
                          {quizResult.passed ? (
                            <>
                              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                              Module Validé avec Succès !
                            </>
                          ) : (
                            <>
                              <X className="h-5 w-5 text-red-400" />
                              Module Non Validé
                            </>
                          )}
                        </span>
                        <span className="font-mono text-xl font-extrabold text-white">
                          {quizResult.score} / {quizResult.totalQuestions} ({Number(quizResult.percentage).toFixed(0)}%)
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">{quizResult.feedback}</p>

                      {/* Nouveau badge débloqué */}
                      {quizResult.newlyUnlockedBadges && quizResult.newlyUnlockedBadges.length > 0 && (
                        <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/15 p-3 flex items-center gap-3">
                          <Award className="h-6 w-6 text-amber-400 shrink-0" />
                          <div>
                            <span className="text-xs font-bold text-amber-300 block">Nouveau Badge Débloqué !</span>
                            <span className="text-xs text-white font-medium">{quizResult.newlyUnlockedBadges[0].title} : </span>
                            <span className="text-xs text-slate-300">{quizResult.newlyUnlockedBadges[0].description}</span>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Liste des questions */}
                  <div className="space-y-6">
                    {activeQuiz.questions.map((q, qIndex) => {
                      const userChoice = selectedAnswers[q.id];
                      const isCorrect = quizResult?.correctAnswers?.[q.id] === userChoice;
                      const correctIdx = quizResult?.correctAnswers?.[q.id];
                      const explanation = quizResult?.explanations?.[q.id];

                      return (
                        <div
                          key={q.id}
                          className="rounded-2xl border border-slate-800 bg-[#070B14] p-5 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-xs font-bold text-sky-400 font-mono">
                              Question {qIndex + 1} / {activeQuiz.questions.length}
                            </span>
                            {quizResult && (
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                              }`}>
                                {isCorrect ? 'Correct' : 'Incorrect'}
                              </span>
                            )}
                          </div>

                          <h4 className="text-sm font-semibold text-white leading-relaxed">{q.question}</h4>

                          {/* Options */}
                          <div className="space-y-2 pt-1">
                            {q.options.map((opt, optIndex) => {
                              const isSelected = userChoice === optIndex;
                              let btnClass = 'border-slate-800 bg-[#0B1220] text-slate-300 hover:border-slate-700';

                              if (quizResult) {
                                if (optIndex === correctIdx) {
                                  btnClass = 'border-emerald-500 bg-emerald-500/20 text-emerald-200 font-medium';
                                } else if (isSelected && !isCorrect) {
                                  btnClass = 'border-red-500 bg-red-500/20 text-red-200';
                                }
                              } else if (isSelected) {
                                btnClass = 'border-sky-500 bg-sky-500/20 text-sky-200 font-medium';
                              }

                              return (
                                <button
                                  key={optIndex}
                                  disabled={!!quizResult}
                                  onClick={() => setSelectedAnswers(prev => ({ ...prev, [q.id]: optIndex }))}
                                  className={`w-full text-left p-3 rounded-xl border text-xs transition flex items-center gap-3 ${btnClass}`}
                                >
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 text-[10px] font-mono font-bold shrink-0">
                                    {String.fromCharCode(65 + optIndex)}
                                  </span>
                                  <span>{opt}</span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Explication pédagogique */}
                          {quizResult && explanation && (
                            <div className="mt-3 rounded-xl border border-slate-800 bg-[#0B1220] p-3 text-xs text-slate-300 flex items-start gap-2.5">
                              <BookOpen className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                              <p className="leading-relaxed"><strong className="text-sky-300">Explication : </strong>{explanation}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Boutons d'action */}
                  <div className="flex items-center justify-between border-t border-slate-800 pt-4">
                    <button
                      onClick={() => {
                        setActiveQuiz(null);
                        setQuizResult(null);
                      }}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Retour aux modules
                    </button>

                    {!quizResult ? (
                      <button
                        onClick={handleSubmitQuiz}
                        disabled={quizSubmitting}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
                      >
                        {quizSubmitting ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Validation en cours...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Soumettre mes Réponses
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedAnswers({});
                          setQuizResult(null);
                        }}
                        className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 transition"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Recommencer le Quiz
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* CONTENU ONGLET 3: SCÉNARIOS DE MARCHÉ & DÉFIS PRATIQUES */}
          {/* ========================================================================= */}
          {activeTab === 'SCENARIOS' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {scenarios.map((scen) => (
                <div
                  key={scen.id}
                  className="rounded-3xl border border-slate-800 bg-[#0B1220] p-6 shadow-xl flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        scen.difficulty === 'NOVICE'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          : scen.difficulty === 'INTERMEDIATE'
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                          : 'border-red-500/30 bg-red-500/10 text-red-400'
                      }`}>
                        Défi {scen.difficulty}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">{scen.category}</span>
                    </div>

                    <h3 className="text-lg font-bold text-white">{scen.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">{scen.context}</p>

                    {/* Déclencheur */}
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
                      <strong>Événement Déclencheur : </strong>{scen.eventTrigger}
                    </div>

                    {/* Table des impacts d'actifs */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Impacts de Marché Observés :
                      </span>
                      <div className="rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800">
                        {Object.entries(scen.assetImpacts).map(([asset, impact]) => (
                          <div key={asset} className="flex items-center justify-between p-2.5 text-xs bg-[#070B14]">
                            <span className="font-mono font-bold text-sky-400">{asset}</span>
                            <span className="text-slate-300 text-right">{impact}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Objectif & Action recommandée */}
                    <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 space-y-1.5">
                      <span className="text-xs font-bold text-sky-300 block">Objectif du Trader : {scen.targetObjective}</span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        <strong className="text-white">Action Recommandée : </strong>{scen.recommendedAction}
                      </p>
                    </div>

                    {/* Takeaways */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Enseignements clés :</span>
                      <ul className="list-disc pl-4 text-xs text-slate-400 space-y-0.5">
                        {scen.educationalTakeaways.map((takeaway, i) => (
                          <li key={i}>{takeaway}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Action vers le bon terminal */}
                  <div className="border-t border-slate-800 pt-4 mt-6">
                    <button
                      onClick={() => {
                        if (scen.id === 'SCENARIO_RATE_HIKE' || scen.id === 'SCENARIO_OIL_STAGFLATION') {
                          navigate('/app/markets');
                        } else if (scen.id === 'SCENARIO_ACTUARY_STORM') {
                          navigate('/app/actuary');
                        } else {
                          navigate('/app');
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/15 py-2.5 px-4 text-xs font-semibold text-sky-300 hover:bg-sky-500/25 transition"
                    >
                      <span>Simuler sur la Salle de Marché</span>
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ========================================================================= */}
          {/* CONTENU ONGLET 4: BADGES & CERTIFICATIONS */}
          {/* ========================================================================= */}
          {activeTab === 'BADGES' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-800 bg-[#0B1220] p-6">
                <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-400" />
                  Tableau d'Honneur & Certifications Professionnelles
                </h3>
                <p className="text-xs text-slate-400 mb-6">
                  Validez les leçons et réussissez les évaluations QCM avec un score supérieur à 75% pour débloquer ces accréditations officielles.
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { code: 'FIRST_LESSON', title: 'Premier Pas de Trader', desc: 'A validé sa première fiche de cours sur le simulateur.', cat: 'PEDAGOGY' },
                    { code: 'BADGE_BASICS', title: 'Opérateur de Bourse Qualifié', desc: 'Maîtrise des ordres au marché, limites et microstructure.', cat: 'TRADING' },
                    { code: 'BADGE_CHARTIST', title: 'Analyste Technique & Quant', desc: 'Validation certifiée des oscillateurs RSI, SMA et backtests.', cat: 'QUANTITATIVE' },
                    { code: 'BADGE_MULTI_ASSET', title: 'Stratège Multi-Actifs', desc: 'Expertise sur les devises Forex (BCE), obligations et matières premières.', cat: 'MULTI_ASSET' },
                    { code: 'BADGE_CFA_ANALYST', title: 'Analyste Financier Certifié', desc: 'Déchiffrage des bilans 10-K, ratios de valorisation et Free Cash Flow.', cat: 'FUNDAMENTALS' },
                    { code: 'BADGE_RISK_MANAGER', title: 'Risk Manager Bâle III & XAI', desc: 'Contrôle de la VaR, stress tests bancaires et explicabilité SHAP.', cat: 'RISK' },
                    { code: 'BADGE_ACTUARY', title: 'Actuaire & Modélisateur Agréé', desc: 'Tarification GLM, simulations Monte Carlo et provisions Chain-Ladder.', cat: 'ACTUARY' },
                    { code: 'BADGE_MASTER_MARKETS', title: 'Master de Salle de Marché', desc: 'Distinction suprême : a validé l\'intégralité des 6 modules du simulateur.', cat: 'EXCELLENCE' },
                  ].map((badgeDef) => {
                    const userBadge = profile?.badges?.find(b => b.badgeCode === badgeDef.code);
                    const isUnlocked = !!userBadge;

                    return (
                      <div
                        key={badgeDef.code}
                        className={`rounded-2xl border p-4 flex flex-col justify-between transition ${
                          isUnlocked
                            ? 'border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-[#070B14] shadow-lg shadow-amber-500/5'
                            : 'border-slate-800 bg-[#070B14]/50 opacity-60'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                              isUnlocked
                                ? 'border-amber-500/40 bg-amber-500/20 text-amber-400'
                                : 'border-slate-800 bg-slate-900 text-slate-600'
                            }`}>
                              <Award className="h-6 w-6" />
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isUnlocked ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-500'
                            }`}>
                              {isUnlocked ? 'OBTENU' : 'VERROUILLÉ'}
                            </span>
                          </div>

                          <h4 className={`text-sm font-bold mb-1 ${isUnlocked ? 'text-white' : 'text-slate-400'}`}>
                            {badgeDef.title}
                          </h4>
                          <p className="text-xs text-slate-400 leading-relaxed mb-3">
                            {badgeDef.desc}
                          </p>
                        </div>

                        {isUnlocked && userBadge.unlockedAt && (
                          <div className="border-t border-slate-800 pt-2 text-[10px] text-amber-400/80 font-mono">
                            Obtenu le {new Date(userBadge.unlockedAt).toLocaleDateString('fr-FR')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODAL DE LECTURE D'UNE LEÇON */}
          {/* ========================================================================= */}
          <AnimatePresence>
            {activeLesson && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-sky-500/30 bg-[#0B1220] p-6 shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-sky-400" />
                      <div>
                        <span className="text-[10px] font-mono uppercase text-sky-400 block">Fiche Pédagogique</span>
                        <h2 className="text-lg font-bold text-white">{activeLesson.title}</h2>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveLesson(null)}
                      className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:text-white hover:bg-slate-800"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Summary */}
                  <div className="rounded-xl border border-slate-800 bg-[#070B14] p-3 text-xs text-slate-300 italic mb-5">
                    {activeLesson.summary}
                  </div>

                  {/* Contenu Markdown simplifié */}
                  <div className="prose prose-invert max-w-none text-xs text-slate-300 space-y-3 leading-relaxed whitespace-pre-wrap font-sans">
                    {activeLesson.contentMarkdown}
                  </div>

                  {/* Points clés à retenir */}
                  {activeLesson.keyTakeaways && activeLesson.keyTakeaways.length > 0 && (
                    <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
                      <span className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        Points Clés à Retenir pour le Quiz :
                      </span>
                      <ul className="list-disc pl-5 text-xs text-slate-300 space-y-1">
                        {activeLesson.keyTakeaways.map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Footer actions */}
                  <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4">
                    <span className="text-xs text-slate-400 font-mono">
                      Durée estimée : {activeLesson.durationMinutes} minutes
                    </span>

                    <button
                      onClick={() => handleCompleteLesson(activeLesson.id)}
                      disabled={completingLesson || isLessonCompleted(activeLesson.id)}
                      className={`flex items-center gap-2 rounded-xl py-2 px-5 text-xs font-semibold border transition ${
                        isLessonCompleted(activeLesson.id)
                          ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300 cursor-default'
                          : 'border-sky-500/40 bg-sky-500 text-white hover:bg-sky-400'
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {isLessonCompleted(activeLesson.id) ? 'Leçon Déjà Validée' : 'Marquer comme Lu & Validé'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          </div>
        )}
      </PageTransition>
    </AppShell>
  );
};
