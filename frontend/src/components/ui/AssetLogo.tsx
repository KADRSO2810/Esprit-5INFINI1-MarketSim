import React, { useState, useEffect, useMemo } from 'react';

export type AssetLogoSize = 'xs' | 'sm' | 'md' | 'lg';

interface AssetLogoProps {
  symbol: string;
  size?: AssetLogoSize;
  className?: string;
}

const SIZE_CLASSES: Record<AssetLogoSize, { box: string; text: string }> = {
  xs: { box: 'w-4 h-4', text: 'text-[8px]' },
  sm: { box: 'w-5 h-5', text: 'text-[9px]' },
  md: { box: 'w-7 h-7', text: 'text-[10px]' },
  lg: { box: 'w-9 h-9', text: 'text-xs' },
};

const CRYPTO_SET = new Set([
  'BTC',
  'ETH',
  'SOL',
  'XRP',
  'BNB',
  'AVAX',
  'DOGE',
  'ADA',
  'DOT',
  'MATIC',
  'LINK',
  'LTC',
  'UNI',
  'ATOM',
  'NEAR',
  'APT',
  'ARB',
  'OP',
  'SHIB',
  'TON',
  'PEPE',
  'SUI',
  'TRX',
  'BCH',
  'XLM',
  'ALGO',
  'FIL',
  'AAVE',
  'POL',
]);

const EQUITY_DOMAINS: Record<string, string> = {
  AAPL: 'apple.com',
  MSFT: 'microsoft.com',
  TSLA: 'tesla.com',
  NVDA: 'nvidia.com',
  AMZN: 'amazon.com',
  GOOGL: 'google.com',
  GOOG: 'google.com',
  META: 'meta.com',
  NFLX: 'netflix.com',
  AMD: 'amd.com',
  INTC: 'intel.com',
  JPM: 'jpmorganchase.com',
  BABA: 'alibaba.com',
  DIS: 'disney.com',
  SPY: 'ssga.com',
  QQQ: 'invesco.com',
  DIA: 'ssga.com',
  BA: 'boeing.com',
  GS: 'goldmansachs.com',
  V: 'visa.com',
  MA: 'mastercard.com',
  PYPL: 'paypal.com',
  CRM: 'salesforce.com',
  ORCL: 'oracle.com',
  IBM: 'ibm.com',
  UBER: 'uber.com',
  COIN: 'coinbase.com',
  PLTR: 'palantir.com',
  KO: 'coca-cola.com',
  PEP: 'pepsico.com',
  WMT: 'walmart.com',
  NKE: 'nike.com',
  ADBE: 'adobe.com',
  CSCO: 'cisco.com',
  COST: 'costco.com',
  SBUX: 'starbucks.com',
  MCD: 'mcdonalds.com',
};

const BRAND_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  BTC: { bg: '#F7931A', fg: '#FFFFFF', border: '#FDBA74' },
  ETH: { bg: '#627EEA', fg: '#FFFFFF', border: '#93C5FD' },
  SOL: { bg: '#0F172A', fg: '#14F195', border: '#14F195' },
  XRP: { bg: '#1E293B', fg: '#38BDF8', border: '#38BDF8' },
  BNB: { bg: '#F3BA2F', fg: '#0F172A', border: '#FDE68A' },
  AVAX: { bg: '#E84142', fg: '#FFFFFF', border: '#FCA5A5' },
  DOGE: { bg: '#C2A633', fg: '#FFFFFF', border: '#FDE047' },
  ADA: { bg: '#0033AD', fg: '#FFFFFF', border: '#60A5FA' },
  DOT: { bg: '#E6007A', fg: '#FFFFFF', border: '#F472B6' },
  MATIC: { bg: '#8247E5', fg: '#FFFFFF', border: '#C4B5FD' },
  LINK: { bg: '#2A5ADA', fg: '#FFFFFF', border: '#93C5FD' },
  LTC: { bg: '#345D9D', fg: '#FFFFFF', border: '#93C5FD' },
  AAPL: { bg: '#1E293B', fg: '#F8FAFC', border: '#94A3B8' },
  MSFT: { bg: '#00A4EF', fg: '#FFFFFF', border: '#7DD3FC' },
  TSLA: { bg: '#CC0000', fg: '#FFFFFF', border: '#FCA5A5' },
  NVDA: { bg: '#76B900', fg: '#FFFFFF', border: '#BEF264' },
  AMZN: { bg: '#FF9900', fg: '#0F172A', border: '#FDE68A' },
  GOOGL: { bg: '#4285F4', fg: '#FFFFFF', border: '#93C5FD' },
  GOOG: { bg: '#4285F4', fg: '#FFFFFF', border: '#93C5FD' },
  META: { bg: '#0668E1', fg: '#FFFFFF', border: '#60A5FA' },
  NFLX: { bg: '#E50914', fg: '#FFFFFF', border: '#FCA5A5' },
  AMD: { bg: '#0F172A', fg: '#F8FAFC', border: '#38BDF8' },
  INTC: { bg: '#0071C5', fg: '#FFFFFF', border: '#7DD3FC' },
  JPM: { bg: '#117ACA', fg: '#FFFFFF', border: '#7DD3FC' },
  BABA: { bg: '#FF6A00', fg: '#FFFFFF', border: '#FDBA74' },
  DIS: { bg: '#113CCF', fg: '#FFFFFF', border: '#93C5FD' },
  SPY: { bg: '#0F766E', fg: '#FFFFFF', border: '#5EEAD4' },
};

export function parseAssetSymbol(rawSymbol: string): { base: string; isCrypto: boolean } {
  const upper = (rawSymbol || '').trim().toUpperCase();
  const hasExchange = upper.includes(':');
  const afterExchange = hasExchange ? upper.split(':')[1] || upper : upper;

  let base = afterExchange.split('-')[0].split('/')[0];
  if (
    hasExchange ||
    base.endsWith('USDT') ||
    base.endsWith('USDC') ||
    base.endsWith('BUSD') ||
    (base.endsWith('USD') && base.length > 5)
  ) {
    base = base.replace(/(USDT|USDC|BUSD|EUR|USD)$/, '');
  }

  const isCrypto =
    hasExchange ||
    CRYPTO_SET.has(base) ||
    upper.endsWith('USDT') ||
    upper.includes('/USD') ||
    upper.includes('-USD');

  return { base: base || upper, isCrypto };
}

function buildLogoCandidates(symbol: string): { urls: string[]; base: string; isCrypto: boolean } {
  const { base, isCrypto } = parseAssetSymbol(symbol);
  const lower = base.toLowerCase();

  if (isCrypto) {
    return {
      base,
      isCrypto,
      urls: [
        `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${lower}.png`,
        `https://assets.coincap.io/assets/icons/${lower}@2x.png`,
        `https://raw.githubusercontent.com/ErikThiart/cryptocurrency-icons/master/128/${lower}.png`,
      ],
    };
  }

  const domain = EQUITY_DOMAINS[base];
  const urls = [`https://assets.parqet.com/logos/symbol/${encodeURIComponent(base)}?format=png`];
  if (domain) {
    urls.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
  }

  return { base, isCrypto, urls };
}

export const AssetLogo: React.FC<AssetLogoProps> = ({
  symbol,
  size = 'md',
  className = '',
}) => {
  const { urls, base, isCrypto } = useMemo(() => buildLogoCandidates(symbol), [symbol]);
  const [urlIndex, setUrlIndex] = useState(0);

  useEffect(() => {
    setUrlIndex(0);
  }, [symbol]);

  const dim = SIZE_CLASSES[size];
  const activeUrl = urlIndex < urls.length ? urls[urlIndex] : null;
  const brand = BRAND_COLORS[base];

  if (activeUrl) {
    return (
      <span
        className={`relative inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden border ${
          isCrypto
            ? 'bg-[#0B1220] border-slate-700/70'
            : 'bg-white border-white/25 p-[2px]'
        } ${dim.box} ${className}`}
        title={symbol}
      >
        <img
          src={activeUrl}
          alt={base}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setUrlIndex((idx) => idx + 1)}
          className="w-full h-full object-contain rounded-full"
        />
      </span>
    );
  }

  // Fallback styled monogram badge with signature brand color
  const fallbackBg = brand?.bg ?? (isCrypto ? '#7C3AED' : '#0284C7');
  const fallbackFg = brand?.fg ?? '#FFFFFF';
  const fallbackBorder = brand?.border ?? (isCrypto ? '#C4B5FD' : '#7DD3FC');
  const initials = base.slice(0, base.length > 3 ? 3 : base.length);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 font-mono font-extrabold tracking-tighter select-none border ${dim.box} ${dim.text} ${className}`}
      style={{
        backgroundColor: fallbackBg,
        color: fallbackFg,
        borderColor: fallbackBorder,
      }}
      title={symbol}
    >
      {initials}
    </span>
  );
};
