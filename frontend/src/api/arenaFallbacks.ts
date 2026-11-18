import { ArenaBoss, ArenaCrisisEvent, ArenaLeaderboardEntry, ArenaPricePoint } from './arena';

function generateCrisisTrajectory(
  initialPrice: number,
  targetMaxDrop: number,
  maxVix: number,
  totalSeconds: number = 180,
  intradayVol: number = 0.08
): ArenaPricePoint[] {
  const trajectory: ArenaPricePoint[] = [];
  let seed = 42;
  const pseudoRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let t = 0; t <= totalSeconds; t++) {
    const progress = t / totalSeconds;
    let dropShape: number;

    if (progress <= 0.7) {
      const normalizedT = progress / 0.7;
      dropShape = targetMaxDrop * Math.pow(normalizedT, 1.35);
    } else {
      const reboundT = (progress - 0.7) / 0.3;
      const bottomDrop = targetMaxDrop;
      const reboundRecovery = Math.abs(targetMaxDrop) * 0.35 * Math.sin(reboundT * (Math.PI / 2.0));
      dropShape = bottomDrop + reboundRecovery;
    }

    const noise = (pseudoRandom() - 0.48) * intradayVol * (1.0 + Math.abs(dropShape) * 2.0);
    const totalReturn = dropShape + noise;
    const currentPrice = initialPrice * (1.0 + totalReturn);

    const vixBase = 18.0;
    const vixStress = Math.abs(dropShape) * (maxVix - vixBase) * 2.2;
    const vix = Math.min(maxVix, Math.max(vixBase, vixBase + vixStress + (pseudoRandom() - 0.5) * 4.0));
    const liquidity = Math.max(0.05, 1.0 - (Math.abs(dropShape) / Math.abs(targetMaxDrop)) * 0.9);

    trajectory.push({
      timeSec: t,
      price: Math.round(currentPrice * 100) / 100,
      vix: Math.round(vix * 10) / 10,
      marketReturnPct: Math.round(totalReturn * 10000) / 100,
      liquidityIndex: Math.round(liquidity * 100) / 100,
    });
  }

  return trajectory;
}

const LEHMAN_EVENTS: ArenaCrisisEvent[] = [
  {
    timeSec: 15,
    headline: 'ALERTE ROUGE : Lehman Brothers dépose le Bilan sous le Chapitre 11 !',
    severity: 'COLLAPSE',
    source: 'BLOOMBERG WIRES',
    shockMultiplier: 1.4,
    hint: 'Le secteur bancaire plonge. Basculez une partie de votre capital vers l\'Or (GLD) !',
  },
  {
    timeSec: 45,
    headline: 'AIG en détresse de liquidité : Demande d\'un sauvetage fédéral de $85 Mds.',
    severity: 'CRITICAL',
    source: 'REUTERS EMERGENCY',
    shockMultiplier: 1.6,
    hint: 'Les CDS explosent. Activez le Panic Short pour capturer la cascade baissière.',
  },
  {
    timeSec: 85,
    headline: 'GEL DU MARCHÉ DU CRÉDIT : Le spread TED explose à 460 points de base.',
    severity: 'PANIC',
    source: 'FEDERAL RESERVE DESK',
    shockMultiplier: 2.0,
    hint: 'Liquidité au point mort. Le Flight to Cash permet de sécuriser vos gains.',
  },
  {
    timeSec: 125,
    headline: 'REJET DU PLAN PAULSON : La Chambre des Représentants vote NON au plan de sauvetage !',
    severity: 'COLLAPSE',
    source: 'WALL STREET JOURNAL',
    shockMultiplier: 2.3,
    hint: 'Pire chute historique en points du Dow Jones (-777 pts). Ne restez pas acheteur !',
  },
  {
    timeSec: 155,
    headline: 'Adoption finale du plan Paulson revisité ($700 Mds) : Fin de l\'hémorragie immédiate.',
    severity: 'INTERVENTION',
    source: 'CONGRESS PRESS',
    shockMultiplier: 0.7,
    hint: 'Point d\'inflexion potentiel : Déclenchez \'Buy The Dip\' pour maximiser votre score SSS !',
  },
];

const COVID_EVENTS: ArenaCrisisEvent[] = [
  {
    timeSec: 20,
    headline: 'L\'OMS déclare la Pandémie Mondiale de Covid-19 : Fermeture des frontières.',
    severity: 'CRITICAL',
    source: 'WHO BRIEFING',
    shockMultiplier: 1.5,
    hint: 'Confinement global en vue. Les flux de cash se tarissent.',
  },
  {
    timeSec: 50,
    headline: 'CIRCUIT BREAKER ACTIVÉ : S&P 500 suspendu 15 minutes après -7% à l\'ouverture !',
    severity: 'COLLAPSE',
    source: 'NYSE DISPATCH',
    shockMultiplier: 1.8,
    hint: 'Ordres bloqués. Préparez un Short ou du Cash dès la réouverture.',
  },
  {
    timeSec: 95,
    headline: 'GUERRE DES PRIX DU PÉTROLE : L\'Arabie Saoudite inonde le marché, brut à $20.',
    severity: 'PANIC',
    source: 'ENERGY INTELLIGENCE',
    shockMultiplier: 2.2,
    hint: 'Double choc offre/demande. Volatilité record sur le VIX (>80).',
  },
  {
    timeSec: 135,
    headline: 'BAZOOKA DE LA FED : QE ILLIMITÉ et rachat direct de dettes d\'entreprises !',
    severity: 'INTERVENTION',
    source: 'FEDERAL RESERVE WIRES',
    shockMultiplier: 0.5,
    hint: 'Injections monétaires massives : Moment idéal pour un \'Buy The Dip\' agressif !',
  },
  {
    timeSec: 165,
    headline: 'Rebond vertigineux \'V-Shape\' : Les valeurs technologiques mènent la charge.',
    severity: 'INTERVENTION',
    source: 'MARKET PULSE',
    shockMultiplier: 0.4,
    hint: 'Accélération haussière brutale vers la clôture de la séance.',
  },
];

const STAGFLATION_EVENTS: ArenaCrisisEvent[] = [
  {
    timeSec: 20,
    headline: 'OFFENSIVE GÉOPOLITIQUE : Début des hostilités en Ukraine, le gaz s\'envole.',
    severity: 'COLLAPSE',
    source: 'EUROPEAN DISPATCH',
    shockMultiplier: 1.4,
    hint: 'L\'énergie explose. Les valeurs de croissance subissent des ventes massives.',
  },
  {
    timeSec: 60,
    headline: 'SANCTIONS FINANCIÈRES : Gel des réserves de la Banque Centrale de Russie.',
    severity: 'CRITICAL',
    source: 'BRUSSELS PRESS',
    shockMultiplier: 1.6,
    hint: 'Rupture de chaînes d\'approvisionnement des métaux et engrais.',
  },
  {
    timeSec: 100,
    headline: 'INFLATION RECORD À 9.1% : La Fed monte ses taux de 75 bps en urgence.',
    severity: 'PANIC',
    source: 'BLS INFLATION REPORT',
    shockMultiplier: 2.1,
    hint: 'Krach obligataire simultané : Le portefeuille 60/40 traditionnel ne protège plus.',
  },
  {
    timeSec: 140,
    headline: 'Menace de pénurie énergétique majeure en Europe et arrêt de Nord Stream.',
    severity: 'PANIC',
    source: 'ENERGY CRISIS DESK',
    shockMultiplier: 1.7,
    hint: 'Refuge impératif sur les matières premières ou 100% Cash.',
  },
  {
    timeSec: 165,
    headline: 'Remplissage des stocks européens à 90% et pic d\'inflation atteint.',
    severity: 'INTERVENTION',
    source: 'COMMODITIES DAILY',
    shockMultiplier: 0.6,
    hint: 'Soulagement macroéconomique et rebond technique de fin de séance.',
  },
];

const BLACK_MONDAY_EVENTS: ArenaCrisisEvent[] = [
  {
    timeSec: 15,
    headline: 'OUVERTURE DU LUNDI NOIR : Ordres de vente massifs non exécutés sur le NYSE.',
    severity: 'CRITICAL',
    source: 'AP WALL STREET',
    shockMultiplier: 1.6,
    hint: 'Les téléscripteurs ont 2 heures de retard. N\'achetez pas à l\'aveugle !',
  },
  {
    timeSec: 50,
    headline: 'BOUCLE DE RÉTROACTION ALGOS : La \'Portfolio Insurance\' vend des contrats à tout prix.',
    severity: 'COLLAPSE',
    source: 'CHICAGO MERCANTILE EXCHANGE',
    shockMultiplier: 2.5,
    hint: 'Cascade mécanique d\'arbitrage. Chute libre sans acheteurs en face.',
  },
  {
    timeSec: 95,
    headline: 'PANIC SELLING TOTAL : Le Dow Jones plonge de plus de 500 points (-22.6%).',
    severity: 'PANIC',
    source: 'FINANCIAL NEWS NETWORK',
    shockMultiplier: 2.8,
    hint: 'Pire séance journalière de l\'histoire moderne.',
  },
  {
    timeSec: 140,
    headline: 'Alan Greenspan prépare le \'Greenspan Put\' : Promesse de liquidités illimitées.',
    severity: 'INTERVENTION',
    source: 'FEDERAL RESERVE SPECIAL',
    shockMultiplier: 0.4,
    hint: 'Naissance de la politique de soutien systématique de la Réserve Fédérale.',
  },
  {
    timeSec: 165,
    headline: 'Fin de panique : Les acheteurs institutionnels de valeur reviennent à la clôture.',
    severity: 'INTERVENTION',
    source: 'NYSE DISPATCH',
    shockMultiplier: 0.5,
    hint: 'Rebond technique de clôture.',
  },
];

export const FALLBACK_BOSSES: ArenaBoss[] = [
  {
    id: 'LEHMAN_2008',
    name: 'Faillite Lehman Brothers',
    subtitle: 'Choc Systémique de Liquidité Interbancaire & Débâcle des Subprimes',
    year: 2008,
    difficulty: 'LÉGENDAIRE',
    themeColor: 'rose',
    initialEquity: 100000.0,
    durationSeconds: 180,
    lore: '15 Septembre 2008. 158 ans d\'histoire balayés en 24h. Le système financier mondial est à quelques centimètres d\'un arrêt total des paiements.',
    mechanicsDescription: 'Choc de liquidité asymétrique, débouclage violent de levier, spreads de marché décuplés et faux rebonds trompeurs.',
    historicalMaxDrawdown: 56.8,
    vixSpike: 89.5,
    assetName: 'Banking & Financials Index (XLF)',
    initialPrice: 1250.0,
    events: LEHMAN_EVENTS,
    priceTrajectory: generateCrisisTrajectory(1250.0, -0.42, 89.5, 180, 0.08),
  },
  {
    id: 'COVID_2020',
    name: 'Flash Crash Covid-19',
    subtitle: 'Arrêt Cardiaque de l\'Économie Mondiale & VIX Parabolique',
    year: 2020,
    difficulty: 'EXTRÊME',
    themeColor: 'amber',
    initialEquity: 100000.0,
    durationSeconds: 180,
    lore: 'Mars 2020. La baisse boursière la plus rapide de 30% de toute l\'histoire contemporaine, suivie par les plus monumentales injections de liquidité jamais vues.',
    mechanicsDescription: 'Volatilité supersonique, suspensions de cotations, puis rallye de rebond en V extrêmement violent soutenu par la Fed.',
    historicalMaxDrawdown: 35.4,
    vixSpike: 82.7,
    assetName: 'S&P 500 Index (SPX)',
    initialPrice: 3380.0,
    events: COVID_EVENTS,
    priceTrajectory: generateCrisisTrajectory(3380.0, -0.34, 82.7, 180, 0.12),
  },
  {
    id: 'STAGFLATION_2022',
    name: 'Choc Stagflation & Ukraine',
    subtitle: 'Crise Énergétique, Rupture Géopolitique et Resserrement Monétaire Express',
    year: 2022,
    difficulty: 'HARDCORE',
    themeColor: 'purple',
    initialEquity: 100000.0,
    durationSeconds: 180,
    lore: '2022. Le retour du spectre de 1970 : inflation à deux chiffres, baril de brut à $130 et fin brutale de l\'ère de l\'argent gratuit.',
    mechanicsDescription: 'Corrélation positive toxique actions/obligations, krach de la Tech, flambée brutale des rendements obligataires.',
    historicalMaxDrawdown: 25.2,
    vixSpike: 36.4,
    assetName: 'Tech & Energy Global Basket',
    initialPrice: 410.0,
    events: STAGFLATION_EVENTS,
    priceTrajectory: generateCrisisTrajectory(410.0, -0.26, 36.4, 180, 0.05),
  },
  {
    id: 'BLACK_MONDAY_1987',
    name: 'Le Krach du Lundi Noir',
    subtitle: 'Le Premier Bug Systémique des Algorithmes de Portfolio Insurance',
    year: 1987,
    difficulty: 'ÉPIQUE',
    themeColor: 'red',
    initialEquity: 100000.0,
    durationSeconds: 180,
    lore: '19 Octobre 1987. -22.6% en quelques heures. La démonstration historique qu\'un algorithme sans garde-fous de liquidité peut pulvériser un marché.',
    mechanicsDescription: 'Déconnexion cash/futures, slippage monstrueux, carnet d\'ordres totalement vidé côté acheteur.',
    historicalMaxDrawdown: 22.6,
    vixSpike: 150.0,
    assetName: 'Dow Jones Industrial Average (DJIA)',
    initialPrice: 2246.0,
    events: BLACK_MONDAY_EVENTS,
    priceTrajectory: generateCrisisTrajectory(2246.0, -0.226, 150.0, 180, 0.15),
  },
];

export const FALLBACK_LEADERBOARD: ArenaLeaderboardEntry[] = [
  {
    rank: 1,
    runId: 9001,
    traderName: 'Yassine Mansour (Quant Desk)',
    bossId: 'LEHMAN_2008',
    bossName: 'Faillite Lehman Brothers (2008)',
    finalEquity: 118450.0,
    netPnl: 18450.0,
    returnPct: 18.45,
    maxDrawdownPct: 7.8,
    survivalSeconds: 180,
    survived: true,
    rankGrade: 'SSS',
    score: 4820,
    date: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    rank: 2,
    runId: 9002,
    traderName: 'Sarra Trabelsi (Risk & Solvency)',
    bossId: 'COVID_2020',
    bossName: 'Flash Crash Covid-19 (2020)',
    finalEquity: 109200.0,
    netPnl: 9200.0,
    returnPct: 9.2,
    maxDrawdownPct: 11.4,
    survivalSeconds: 180,
    survived: true,
    rankGrade: 'S',
    score: 4350,
    date: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    rank: 3,
    runId: 9003,
    traderName: 'Amine Ben Salem (Forex Desk)',
    bossId: 'STAGFLATION_2022',
    bossName: 'Choc Stagflation & Ukraine (2022)',
    finalEquity: 94500.0,
    netPnl: -5500.0,
    returnPct: -5.5,
    maxDrawdownPct: 16.2,
    survivalSeconds: 180,
    survived: true,
    rankGrade: 'A',
    score: 3720,
    date: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
];
