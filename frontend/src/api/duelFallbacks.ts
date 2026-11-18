import { DuelScenario } from '../types/duel';

export const FALLBACK_DUEL_SCENARIOS: DuelScenario[] = [
  {
    id: 'BTC_2017',
    codeName: 'ACTIF MYSTÈRE : DELTA-9',
    category: 'Hyper-Croissance & Volatilité Extrême',
    difficulty: 'EXTREME',
    description: "Un actif inconnu connaît une explosion parabolique sans précédent, suivie d'un retournement féroce. Sortez au sommet avant la purge.",
    durationSeconds: 120,
    initialCapital: 50000,
    realAssetSymbol: 'BTC/USD',
    realAssetName: 'Bitcoin (Rally Historique 2017)',
    realPeriod: 'Septembre - Décembre 2017',
    historicalContext: "La première frénésie mondiale crypto propulsant le Bitcoin de 4 000$ à 19 800$ avant une correction de -40% en quelques jours.",
    priceTrajectory: Array.from({ length: 120 }, (_, i) => {
      const base = 4300;
      const drift = i < 90 ? 1 + i * 0.026 : 3.34 - (i - 90) * 0.045;
      const noise = Math.sin(i * 0.7) * 0.03;
      const p = Math.round(base * (drift + noise) * 100) / 100;
      return {
        step: i + 1,
        open: Math.round(p * 0.995 * 100) / 100,
        high: Math.round(p * 1.015 * 100) / 100,
        low: Math.round(p * 0.985 * 100) / 100,
        close: p,
        volume: Math.floor(15000 + Math.random() * 40000),
        hint: i === 88 ? 'ATH Majeur détecté - Volume en divergence' : (i === 95 ? 'Cascade de liquidations - Support brisé' : undefined),
      };
    }),
  },
  {
    id: 'NVDA_AI_2023',
    codeName: 'ACTIF MYSTÈRE : SILICON-AI',
    category: 'Technologie & Super-Cycle IA',
    difficulty: 'NORMAL',
    description: "Une action technologique bénéficie d'une rupture technologique historique. Surfez la tendance avec discipline.",
    durationSeconds: 120,
    initialCapital: 50000,
    realAssetSymbol: 'NVDA',
    realAssetName: "NVIDIA Corporation (Boom de l'IA Générative)",
    realPeriod: 'Janvier - Juin 2023',
    historicalContext: "Le trimestre record propulsé par la demande mondiale pour les puces H100 et ChatGPT, transformant Nvidia en géant du trillion de dollars.",
    priceTrajectory: Array.from({ length: 120 }, (_, i) => {
      const base = 145;
      const jump = i >= 40 ? 0.22 : 0;
      const drift = 1 + jump + i * 0.008;
      const noise = Math.cos(i * 0.5) * 0.015;
      const p = Math.round(base * (drift + noise) * 100) / 100;
      return {
        step: i + 1,
        open: Math.round(p * 0.998 * 100) / 100,
        high: Math.round(p * 1.008 * 100) / 100,
        low: Math.round(p * 0.992 * 100) / 100,
        close: p,
        volume: Math.floor(45000 + Math.random() * 80000),
        hint: i === 40 ? 'EARNINGS GAP +22% - Demande institutionnelle massive' : undefined,
      };
    }),
  },
  {
    id: 'TSLA_2020',
    codeName: 'ACTIF MYSTÈRE : QUANTUM-DRIVE',
    category: 'Short Squeeze & Momentum',
    difficulty: 'HARD',
    description: 'Vendeurs à découvert piégés et ruée des traders particuliers. Le levier est à double tranchant.',
    durationSeconds: 120,
    initialCapital: 50000,
    realAssetSymbol: 'TSLA',
    realAssetName: 'Tesla Inc. (Short Squeeze & Split)',
    realPeriod: 'Année 2020',
    historicalContext: "La hausse stratosphérique de plus de +700% sur l'année 2020 détruisant les fonds de hedge funds short.",
    priceTrajectory: Array.from({ length: 120 }, (_, i) => {
      const base = 85;
      const drift = i < 80 ? 1 + i * 0.02 : 2.6 - (i - 80) * 0.01;
      const noise = Math.sin(i * 0.9) * 0.025;
      const p = Math.round(base * (drift + noise) * 100) / 100;
      return {
        step: i + 1,
        open: Math.round(p * 0.99 * 100) / 100,
        high: Math.round(p * 1.02 * 100) / 100,
        low: Math.round(p * 0.98 * 100) / 100,
        close: p,
        volume: Math.floor(70000 + Math.random() * 100000),
        hint: i === 55 ? 'Short-Squeeze en cours : Rachat forcé des positions vendeuses' : undefined,
      };
    }),
  },
  {
    id: 'EURUSD_BREXIT_2016',
    codeName: 'ACTIF MYSTÈRE : TITAN-FOREX',
    category: 'Devises & Choc Géopolitique',
    difficulty: 'HARD',
    description: "Une devise majeure s'effondre pendant la nuit suite à un vote géopolitique historique. Jouez la baisse ou protégez vos arrières.",
    durationSeconds: 120,
    initialCapital: 50000,
    realAssetSymbol: 'GBP/USD',
    realAssetName: 'Livre Sterling vs Dollar US (Nuit du Brexit)',
    realPeriod: '23 - 24 Juin 2016',
    historicalContext: "Le vote historique des Britanniques pour quitter l'UE provoquant l'effondrement de 12% de la livre en quelques heures.",
    priceTrajectory: Array.from({ length: 120 }, (_, i) => {
      const base = 1.4850;
      const drop = i >= 45 ? 0.12 : 0;
      const drift = 1 - drop - (i >= 45 ? (i - 45) * 0.001 : 0);
      const noise = Math.sin(i * 1.2) * 0.006;
      const p = Math.round(base * (drift + noise) * 10000) / 10000;
      return {
        step: i + 1,
        open: Math.round(p * 0.999 * 10000) / 10000,
        high: Math.round(p * 1.004 * 10000) / 10000,
        low: Math.round(p * 0.996 * 10000) / 10000,
        close: p,
        volume: Math.floor(150000 + Math.random() * 200000),
        hint: i === 46 ? 'FLASH EVENT GÉOPOLITIQUE : Résultats du dépouillement en direct' : undefined,
      };
    }),
  },
];
