import axios from './axios';
import {
  CreateAiDuelPayload,
  CreateFriendDuelPayload,
  DuelLeaderboardEntry,
  DuelMatch,
  DuelScenario,
  SubmitDuelRunPayload,
} from '../types/duel';
import { FALLBACK_DUEL_SCENARIOS } from './duelFallbacks';

export const getDuelScenarios = async (): Promise<DuelScenario[]> => {
  try {
    const response = await axios.get<DuelScenario[]>('/api/duels/scenarios');
    if (response.data && response.data.length > 0) {
      return response.data;
    }
    return FALLBACK_DUEL_SCENARIOS;
  } catch (err) {
    console.warn('[DUELS] Utilisation du dataset scénarios de repli offline/réseau:', err);
    return FALLBACK_DUEL_SCENARIOS;
  }
};

export const getDuelScenario = async (scenarioId: string): Promise<DuelScenario> => {
  try {
    const response = await axios.get<DuelScenario>(`/api/duels/scenarios/${scenarioId}`);
    return response.data;
  } catch (err) {
    const fallback = FALLBACK_DUEL_SCENARIOS.find((s) => s.id === scenarioId) || FALLBACK_DUEL_SCENARIOS[0];
    return fallback;
  }
};

export const createAiDuel = async (payload: CreateAiDuelPayload): Promise<DuelMatch> => {
  const response = await axios.post<DuelMatch>('/api/duels/ai', payload);
  return response.data;
};

export const createFriendDuel = async (payload: CreateFriendDuelPayload): Promise<DuelMatch> => {
  const response = await axios.post<DuelMatch>('/api/duels/friend', payload);
  return response.data;
};

export const submitDuelRun = async (payload: SubmitDuelRunPayload): Promise<DuelMatch> => {
  const response = await axios.post<DuelMatch>('/api/duels/submit', payload);
  return response.data;
};

export const getDuelMatch = async (matchId: number): Promise<DuelMatch> => {
  const response = await axios.get<DuelMatch>(`/api/duels/matches/${matchId}`);
  return response.data;
};

export const getDuelInvite = async (token: string): Promise<DuelMatch> => {
  const response = await axios.get<DuelMatch>(`/api/duels/invite/${token}`);
  return response.data;
};

export const getMyDuels = async (): Promise<DuelMatch[]> => {
  try {
    const response = await axios.get<DuelMatch[]>('/api/duels/my-duels');
    return response.data;
  } catch (err) {
    return [];
  }
};

export const getDuelLeaderboard = async (): Promise<DuelLeaderboardEntry[]> => {
  try {
    const response = await axios.get<DuelLeaderboardEntry[]>('/api/duels/leaderboard');
    return response.data;
  } catch (err) {
    return [];
  }
};
