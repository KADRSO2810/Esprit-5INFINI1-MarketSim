import api from './axios';

export interface UserSummary {
  id: number;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt?: string;
}

export interface PlatformOverview {
  totalUsers: number;
  totalPortfolios: number;
  totalTrades: number;
  totalStressRuns: number;
  totalQuizAttempts: number;
  totalAiModels: number;
  serviceHealth: Record<string, boolean>;
  recentUsers: UserSummary[];
}

export const adminApi = {
  getOverview: async (): Promise<PlatformOverview> => {
    const res = await api.get<PlatformOverview>('/api/admin/platform/overview');
    return res.data;
  },

  getUsers: async (): Promise<UserSummary[]> => {
    const res = await api.get<UserSummary[]>('/api/admin/platform/users');
    return res.data;
  },

  updateUserRole: async (userId: number, role: 'USER' | 'ADMIN'): Promise<UserSummary> => {
    const res = await api.put<UserSummary>(`/api/admin/platform/users/${userId}/role?role=${role}`);
    return res.data;
  },
};
