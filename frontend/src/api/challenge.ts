import axios from './axios';
import {
  ChallengeLeaderboardEntry,
  CreateCustomChallengePayload,
  CustomChallenge,
  SubmitChallengeRunPayload,
} from '../types/challenge';

export const FALLBACK_CUSTOM_CHALLENGE: CustomChallenge = {
  id: 1,
  creatorId: 1,
  creatorName: 'Admin ESPRIT',
  assetName: 'Actif X : Quantum Energy',
  assetSymbol: 'QNTX',
  category: 'Technologie de Rupture & Énergie',
  description: "Scénario officiel créé par l'Admin. 15 minutes d'intense trading sur un actif synthétique mêlant accumulation, flash dump et short squeeze parabolique.",
  durationMinutes: 15,
  initialPrice: 100.0,
  initialCapital: 50000,
  maxLeverage: 5,
  status: 'ACTIVE',
  createdAt: new Date().toISOString(),
  phases: [
    {
      phaseOrder: 1,
      name: 'Accumulation & Test du Marché',
      startMinute: 0,
      endMinute: 4,
      trendType: 'BULLISH',
      targetPriceChangePct: 8.0,
      volatilityLevel: 'LOW',
      breakingNewsHeadline: "Introduction en bourse de l'Actif X sous forte demande",
      breakingNewsSeverity: 'INFO',
    },
    {
      phaseOrder: 2,
      name: 'Choc Surprise & Flash Dump',
      startMinute: 4,
      endMinute: 8,
      trendType: 'PARABOLIC_CRASH',
      targetPriceChangePct: -28.0,
      volatilityLevel: 'EXTREME',
      breakingNewsHeadline: "Alerte de liquidité : Vente massive d'un investisseur institutionnel",
      breakingNewsSeverity: 'PANIC',
    },
    {
      phaseOrder: 3,
      name: 'Zone Piège & Whipsaws',
      startMinute: 8,
      endMinute: 11,
      trendType: 'VOLATILE_RANGE',
      targetPriceChangePct: 4.0,
      volatilityLevel: 'HIGH',
      breakingNewsHeadline: 'Bataille féroce entre acheteurs et vendeurs sur le support clé',
      breakingNewsSeverity: 'WARNING',
    },
    {
      phaseOrder: 4,
      name: 'Short Squeeze & Rally Final',
      startMinute: 11,
      endMinute: 15,
      trendType: 'RECOVERY_SQUEEZE',
      targetPriceChangePct: 45.0,
      volatilityLevel: 'HIGH',
      breakingNewsHeadline: "Annonce d'un partenariat technologique mondial : Rachat forcé des vendeurs",
      breakingNewsSeverity: 'EUPHORIA',
    },
  ],
  trajectory: Array.from({ length: 120 }, (_, i) => {
    const base = 100;
    const progress = i / 120;
    let factor = 1.0;
    if (progress < 0.25) {
      factor = 1.0 + progress * 0.32;
    } else if (progress < 0.5) {
      factor = 1.08 - (progress - 0.25) * 1.12;
    } else if (progress < 0.75) {
      factor = 0.8 + Math.sin(i * 0.8) * 0.05;
    } else {
      factor = 0.82 + (progress - 0.75) * 1.8;
    }
    const noise = Math.sin(i * 1.1) * 0.015;
    const p = Math.round(base * (factor + noise) * 100) / 100;
    return {
      step: i + 1,
      open: Math.round(p * 0.995 * 100) / 100,
      high: Math.round(p * 1.012 * 100) / 100,
      low: Math.round(p * 0.988 * 100) / 100,
      close: p,
      volume: Math.floor(20000 + Math.random() * 50000),
      hint: i === 30 ? "🔴 NEWS OFFICIELLE : Vente massive d'un institutionnel (-28%)" : (i === 90 ? "🚀 BREAKING NEWS : Rachat massif et Short Squeeze (+45%)" : undefined),
    };
  }),
};

export const getActiveCustomChallenges = async (): Promise<CustomChallenge[]> => {
  try {
    const response = await axios.get<CustomChallenge[]>('/api/challenges/active');
    if (response.data && response.data.length > 0) {
      return response.data;
    }
    return [FALLBACK_CUSTOM_CHALLENGE];
  } catch (err) {
    console.warn('[CHALLENGES] Repli sur le dataset offline:', err);
    return [FALLBACK_CUSTOM_CHALLENGE];
  }
};

export const getCustomChallengeById = async (id: number): Promise<CustomChallenge> => {
  try {
    const response = await axios.get<CustomChallenge>(`/api/challenges/${id}`);
    return response.data;
  } catch (err) {
    return FALLBACK_CUSTOM_CHALLENGE;
  }
};

export const createCustomChallenge = async (payload: CreateCustomChallengePayload): Promise<CustomChallenge> => {
  const response = await axios.post<CustomChallenge>('/api/challenges/admin/create', payload);
  return response.data;
};

export const deleteCustomChallenge = async (id: number): Promise<void> => {
  await axios.delete(`/api/challenges/admin/${id}`);
};

export const submitChallengeRun = async (payload: SubmitChallengeRunPayload): Promise<void> => {
  await axios.post(`/api/challenges/${payload.challengeId}/submit`, payload);
};

export const getChallengeLeaderboard = async (id: number): Promise<ChallengeLeaderboardEntry[]> => {
  try {
    const response = await axios.get<ChallengeLeaderboardEntry[]>(`/api/challenges/${id}/leaderboard`);
    return response.data;
  } catch (err) {
    return [];
  }
};
