/**
 * Market Hours & US Trading Sessions:
 * All times calculated relative to New York (EST/EDT) and Paris (CET/CEST).
 *
 * Regular NYSE/NASDAQ: 09:30 - 16:00 EST  (15:30 - 22:00 Paris)
 * Pre-Market:          04:00 - 09:30 EST  (10:00 - 15:30 Paris)
 * After-Hours:         16:00 - 20:00 EST  (22:00 - 02:00 Paris)
 * Closed:              Weekends & 20:00 - 04:00 EST (02:00 - 10:00 Paris)
 */

export type USSessionType = 'REGULAR' | 'PRE_MARKET' | 'AFTER_HOURS' | 'CLOSED';

export interface USMarketSession {
  isOpen: boolean;            // true if regular session is open (15:30 - 22:00)
  isExtendedOpen: boolean;    // true if pre-market, regular, or after-hours is active
  session: USSessionType;
  label: string;
  shortLabel: string;
  description: string;
  badgeClass: string;
}

export function getUSMarketSession(): USMarketSession {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday, 6 = Saturday

  if (day === 0 || day === 6) {
    return {
      isOpen: false,
      isExtendedOpen: false,
      session: 'CLOSED',
      label: 'NYSE FERMÉ (WEEK-END)',
      shortLabel: 'Fermé',
      description: 'Les marchés d’actions américains sont fermés le week-end. Réouverture lundi 15h30 Paris.',
      badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
    };
  }

  // Time in UTC minutes
  const totalUtcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  // 04:00 EST = 09:00 UTC = 540 min (10:00 Paris)
  // 09:30 EST = 14:30 UTC = 870 min (15:30 Paris)
  // 16:00 EST = 21:00 UTC = 1260 min (22:00 Paris)
  // 20:00 EST = 01:00 UTC next day (02:00 Paris)

  if (totalUtcMinutes >= 870 && totalUtcMinutes < 1260) {
    // 15h30 - 22h00 Paris : Regular NYSE / NASDAQ
    return {
      isOpen: true,
      isExtendedOpen: true,
      session: 'REGULAR',
      label: 'NYSE LIVE (15h30 - 22h00)',
      shortLabel: 'NYSE LIVE',
      description: 'Séance régulière en cours sur les marchés d’actions américains (NYSE & NASDAQ).',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    };
  } else if (totalUtcMinutes >= 540 && totalUtcMinutes < 870) {
    // 10h00 - 15h30 Paris : US Pre-Market
    return {
      isOpen: false,
      isExtendedOpen: true,
      session: 'PRE_MARKET',
      label: 'PRÉ-MARCHÉ US (10h - 15h30)',
      shortLabel: 'Pré-Marché',
      description: 'Session officielle de Pré-Marché américaine active. Les transactions électroniques (ECN) sont ouvertes avant la cloche de 15h30.',
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    };
  } else if (totalUtcMinutes >= 1260 && totalUtcMinutes < 1440) {
    // 22h00 - 24h00 Paris : US After-Hours
    return {
      isOpen: false,
      isExtendedOpen: true,
      session: 'AFTER_HOURS',
      label: 'POST-MARCHÉ US (22h - 02h)',
      shortLabel: 'After-Hours',
      description: 'Session de Post-Marché (After-Hours). Les publications de résultats financiers et transactions tardives ont lieu.',
      badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    };
  } else {
    // Night closed
    return {
      isOpen: false,
      isExtendedOpen: false,
      session: 'CLOSED',
      label: 'NYSE FERMÉ',
      shortLabel: 'Fermé',
      description: 'Marché fermé. Prochaine session Pré-Marché à 10h00, séance principale à 15h30 Paris.',
      badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
    };
  }
}

export function isUSMarketOpen(): boolean {
  return getUSMarketSession().isOpen;
}
