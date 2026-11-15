import api from './axios';

export interface LearningLesson {
  id: string;
  moduleId: string;
  title: string;
  summary: string;
  contentMarkdown: string;
  keyTakeaways: string[];
  durationMinutes: number;
  orderIndex: number;
}

export interface LearningModule {
  id: string;
  title: string;
  description: string;
  category: 'TRADING' | 'QUANTITATIVE' | 'MULTI_ASSET' | 'FUNDAMENTALS' | 'RISK' | 'ACTUARY';
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  icon: string;
  durationMinutes: number;
  lessonsCount: number;
  quizId: string;
  lessons: LearningLesson[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex?: number | null;
  explanation?: string | null;
}

export interface Quiz {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  passingScorePct: number;
  questions: QuizQuestion[];
}

export interface QuizSubmission {
  quizId: string;
  answers: Record<string, number>; // questionId -> selectedOptionIndex
}

export interface UserBadge {
  badgeCode: string;
  title: string;
  description: string;
  category: string;
  unlockedAt: string;
  certificateId?: string;
  scorePercentage?: number;
}

export interface QuizResult {
  quizId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  feedback: string;
  correctAnswers: Record<string, number>;
  explanations: Record<string, string>;
  newlyUnlockedBadges: UserBadge[];
}

export interface MarketScenario {
  id: string;
  title: string;
  category: string;
  difficulty: 'NOVICE' | 'INTERMEDIATE' | 'EXPERT';
  context: string;
  eventTrigger: string;
  assetImpacts: Record<string, string>;
  targetObjective: string;
  recommendedAction: string;
  educationalTakeaways: string[];
  primarySymbol: string;
}

export interface UserLearningProfile {
  userId: number;
  completedLessonIds: string[];
  passedQuizIds: string[];
  quizBestScores: Record<string, number>;
  badges: UserBadge[];
  completedLessonsCount: number;
  totalLessonsCount: number;
  passedQuizzesCount: number;
  totalQuizzesCount: number;
  overallProgressPct: number;
  userTitle: string;
}

export const learningApi = {
  getModules: async (): Promise<LearningModule[]> => {
    const res = await api.get<LearningModule[]>('/api/learning/modules');
    return res.data;
  },

  getModuleById: async (id: string): Promise<LearningModule> => {
    const res = await api.get<LearningModule>(`/api/learning/modules/${id}`);
    return res.data;
  },

  getLessonById: async (lessonId: string): Promise<LearningLesson> => {
    const res = await api.get<LearningLesson>(`/api/learning/lessons/${lessonId}`);
    return res.data;
  },

  markLessonCompleted: async (lessonId: string): Promise<void> => {
    await api.post(`/api/learning/lessons/${lessonId}/complete`);
  },

  getQuizzes: async (): Promise<Quiz[]> => {
    const res = await api.get<Quiz[]>('/api/learning/quizzes');
    return res.data;
  },

  getQuizById: async (quizId: string): Promise<Quiz> => {
    const res = await api.get<Quiz>(`/api/learning/quizzes/${quizId}`);
    return res.data;
  },

  submitQuiz: async (quizId: string, answers: Record<string, number>): Promise<QuizResult> => {
    const res = await api.post<QuizResult>(`/api/learning/quizzes/${quizId}/submit`, {
      quizId,
      answers,
    });
    return res.data;
  },

  getMarketScenarios: async (): Promise<MarketScenario[]> => {
    const res = await api.get<MarketScenario[]>('/api/learning/scenarios');
    return res.data;
  },

  getUserProfile: async (): Promise<UserLearningProfile> => {
    const res = await api.get<UserLearningProfile>('/api/learning/profile');
    return res.data;
  },
};
