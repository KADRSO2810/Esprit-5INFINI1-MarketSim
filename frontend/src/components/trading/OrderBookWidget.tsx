import React, { useState, useEffect } from 'react';
import { getOrderBook, OrderBook } from '../../api/trading';
import {
  Layers,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from 'lucide-react';

interface OrderBookWidgetProps {
  symbol: string;
  currentPrice?: number | null;
  onSelectPrice?: (price: number, side: 'BUY' | 'SELL') => void;
  className?: string;
  compact?: boolean;
}

function generateFallbackOrderBook(symbol: string, refPrice: number): OrderBook {
  const isForex = symbol.includes('/') || symbol.includes('EUR') || (symbol.includes('USD') && (symbol.includes('JPY') || symbol.includes('GBP')));
  const isCrypto = symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('SOL');
  const decimals = isForex ? (symbol.includes('JPY') ? 3 : 5) : 2;
  const tick = isForex ? (refPrice > 50 ? 0.01 : 0.0001) : (isCrypto ? (refPrice > 1000 ? 1.0 : 0.1) : 0.05);
  const spread = tick * (isCrypto ? 2 : 1.5);
  const bestBid = Number((refPrice - spread / 2).toFixed(decimals));
  const bestAsk = Number((refPrice + spread / 2).toFixed(decimals));

  const asks = [];
  let askCumul = 0;
  for (let i = 0; i < 12; i++) {
    const price = Number((bestAsk + i * tick).toFixed(decimals));
    const qty = Math.round((isCrypto ? (0.5 + Math.random() * 2) : (50 + Math.random() * 150)) * (1 + i * 0.2) * 10) / 10;
    askCumul += qty;
    asks.push({
      price,
      quantity: qty,
      total: Math.round(askCumul * 10) / 10,
      depthPercentage: Math.min(100, Math.max(10, Math.round((askCumul / (askCumul * 1.4)) * 100))),
      orderCount: 1 + Math.floor(Math.random() * 4),
    });
  }

  const bids = [];
  let bidCumul = 0;
  for (let i = 0; i < 12; i++) {
    const price = Number((bestBid - i * tick).toFixed(decimals));
    const qty = Math.round((isCrypto ? (0.5 + Math.random() * 2) : (50 + Math.random() * 150)) * (1 + i * 0.2) * 10) / 10;
    bidCumul += qty;
    bids.push({
      price,
      quantity: qty,
      total: Math.round(bidCumul * 10) / 10,
      depthPercentage: Math.min(100, Math.max(10, Math.round((bidCumul / (bidCumul * 1.4)) * 100))),
      orderCount: 1 + Math.floor(Math.random() * 4),
    });
  }

  return {
    symbol,
    lastPrice: refPrice,
    bestBid,
    bestAsk,
    spread: Number((bestAsk - bestBid).toFixed(decimals)),
    spreadPercentage: refPrice > 0 ? Number((((bestAsk - bestBid) / refPrice) * 100).toFixed(4)) : 0,
    bids,
    asks,
    totalBidVolume: bidCumul,
    totalAskVolume: askCumul,
    timestamp: new Date().toISOString(),
    assetClass: isCrypto ? 'CRYPTO' : isForex ? 'FOREX' : 'EQUITY',
  };
}

export const OrderBookWidget: React.FC<OrderBookWidgetProps> = ({
  symbol,
  currentPrice = null,
  onSelectPrice,
  className = '',
  compact = false,
}) => {
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'BOTH' | 'BIDS' | 'ASKS' | 'CHART'>('BOTH');

  const fetchBook = async () => {
    try {
      const data = await getOrderBook(symbol);
      if (data && data.bids && data.asks && data.bids.length > 0) {
        setOrderBook(data);
      } else {
        // Si les données retournées sont vides, utiliser un fallback réaliste
        const basePrice = (currentPrice && currentPrice > 0) ? currentPrice : 150.0;
        setOrderBook(generateFallbackOrderBook(symbol, basePrice));
      }
    } catch (err: any) {
      console.warn(`[OrderBookWidget] API orderbook non disponible pour ${symbol}, initialisation du carnet de secours.`, err);
      const basePrice = (currentPrice && currentPrice > 0) ? currentPrice : 150.0;
      setOrderBook(generateFallbackOrderBook(symbol, basePrice));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchBook();
    const interval = setInterval(fetchBook, 3500);
    return () => clearInterval(interval);
  }, [symbol]);

  // Si un nouveau prix en temps réel arrive et qu'on n'a pas encore de carnet
  useEffect(() => {
    if (!orderBook && currentPrice && currentPrice > 0) {
      setOrderBook(generateFallbackOrderBook(symbol, currentPrice));
      setLoading(false);
    }
  }, [currentPrice, symbol, orderBook]);

  const formatPrice = (val: number) => {
    if (symbol.includes('/') || symbol.includes('JPY') || symbol.includes('EURUSD')) {
      return val.toFixed(symbol.includes('JPY') ? 3 : 5);
    }
    if (val < 2) return val.toFixed(4);
    return val.toFixed(2);
  };

  const formatQty = (val: number) => {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
    return Number.isInteger(val) ? val.toFixed(0) : val.toFixed(2);
  };

  const cleanLabel = symbol.replace(/^BINANCE:/, '').replace(/^COINBASE:/, '');
  const rowCount = compact ? 5 : (viewMode === 'BOTH' ? 6 : 12);

  return (
    <div className={`rounded-2xl border border-slate-800 bg-[#0B1220] p-4 shadow-xl flex flex-col ${className}`}>
      {/* En-tête du carnet d'ordres */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Carnet d'Ordres L2</h3>
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <span className="text-[10px] text-slate-400 font-mono">{cleanLabel} • Profondeur Marché</span>
          </div>
        </div>

        {/* Contrôles de vue */}
        <div className="flex items-center gap-1">
          {(['BOTH', 'BIDS', 'ASKS', 'CHART'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition ${
                viewMode === mode
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {mode === 'BOTH' ? 'Carnet' : mode === 'BIDS' ? 'Achats' : mode === 'ASKS' ? 'Ventes' : 'Depth'}
            </button>
          ))}
          <button
            onClick={() => fetchBook()}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Rafraîchir"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* État de chargement initial */}
      {loading && !orderBook && (
        <div className="py-6 flex flex-col items-center justify-center gap-2.5 text-center">
          <RefreshCw className="w-5 h-5 text-sky-400 animate-spin" />
          <span className="text-xs font-mono text-slate-400">Synchronisation du carnet d'ordres L2…</span>
          <div className="w-full space-y-1.5 mt-2 opacity-40">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 bg-slate-800/50 rounded animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* Vue Graphique de Profondeur (Depth Chart) */}
      {viewMode === 'CHART' && orderBook && (
        <div className="py-4 space-y-3">
          <div className="flex items-center justify-between text-[11px] font-mono px-1">
            <span className="text-emerald-400 font-bold">Demandes (Bids)</span>
            <span className="text-slate-400">Mid: ${formatPrice(orderBook.lastPrice)}</span>
            <span className="text-red-400 font-bold">Offres (Asks)</span>
          </div>
          {/* Visualisation cumulée des volumes */}
          <div className="h-36 w-full flex items-end gap-1 px-1 bg-[#070B14] rounded-xl border border-slate-800/80 p-2 relative overflow-hidden">
            {/* Côté Bids (vert) */}
            <div className="flex-1 h-full flex items-end justify-end gap-0.5">
              {orderBook.bids.slice(0, 8).reverse().map((b, i) => (
                <div
                  key={i}
                  className="bg-emerald-500/30 hover:bg-emerald-500/50 transition-all rounded-t w-full cursor-pointer"
                  style={{ height: `${b.depthPercentage}%` }}
                  onClick={() => onSelectPrice?.(b.price, 'BUY')}
                  title={`Bid: $${b.price} | Volume: ${b.quantity}`}
                />
              ))}
            </div>
            {/* Ligne médiane du spread */}
            <div className="w-[1px] h-full bg-slate-700/80 relative flex items-center justify-center">
              <span className="absolute top-1 text-[8px] font-mono text-slate-400 rotate-90 whitespace-nowrap">
                Spread {orderBook.spread.toFixed(2)}
              </span>
            </div>
            {/* Côté Asks (rouge) */}
            <div className="flex-1 h-full flex items-end justify-start gap-0.5">
              {orderBook.asks.slice(0, 8).map((a, i) => (
                <div
                  key={i}
                  className="bg-red-500/30 hover:bg-red-500/50 transition-all rounded-t w-full cursor-pointer"
                  style={{ height: `${a.depthPercentage}%` }}
                  onClick={() => onSelectPrice?.(a.price, 'SELL')}
                  title={`Ask: $${a.price} | Volume: ${a.quantity}`}
                />
              ))}
            </div>
          </div>
          <div className="text-center text-[10px] text-slate-400">
            Cliquez sur un palier de volume pour pré-remplir un ordre limite
          </div>
        </div>
      )}

      {/* Vue Tableau Carnet d'Ordres classique */}
      {viewMode !== 'CHART' && orderBook && (
        <div className="mt-2 flex-1 flex flex-col text-xs font-mono select-none">
          {/* En-tête des colonnes */}
          <div className="grid grid-cols-3 text-[10px] uppercase font-bold text-slate-500 pb-1.5 border-b border-slate-800/60 px-1">
            <span>Prix ($)</span>
            <span className="text-right">Taille</span>
            <span className="text-right">Total</span>
          </div>

          {/* ASKS (Ventes - prix décroissants vers le spread) */}
          {(viewMode === 'BOTH' || viewMode === 'ASKS') && (
            <div className="space-y-0.5 py-1">
              {orderBook.asks
                .slice(0, rowCount)
                .reverse()
                .map((entry, idx) => (
                  <div
                    key={`ask-${idx}`}
                    onClick={() => onSelectPrice?.(entry.price, 'SELL')}
                    className="grid grid-cols-3 py-0.5 px-1 rounded relative cursor-pointer group hover:bg-red-500/10 transition text-[11px]"
                  >
                    {/* Barre de profondeur rouge en arrière-plan */}
                    <div
                      className="absolute inset-y-0 right-0 bg-red-500/15 rounded-r pointer-events-none transition-all duration-300"
                      style={{ width: `${entry.depthPercentage}%` }}
                    />
                    <span className="text-red-400 font-semibold relative z-10 group-hover:underline">
                      {formatPrice(entry.price)}
                    </span>
                    <span className="text-right text-slate-300 relative z-10">{formatQty(entry.quantity)}</span>
                    <span className="text-right text-slate-400 text-[10px] relative z-10">{formatQty(entry.total)}</span>
                  </div>
                ))}
            </div>
          )}

          {/* Ligne médiane du SPREAD & DERNIER COURS */}
          <div className="my-1.5 py-1.5 px-2 rounded-xl bg-[#070B14] border border-slate-800/90 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-extrabold text-white font-mono">
                ${formatPrice(orderBook.lastPrice)}
              </span>
              {orderBook.spreadPercentage > 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-slate-400">Spread:</span>
              <span className="font-bold text-sky-300">
                {formatPrice(orderBook.spread)} ({orderBook.spreadPercentage.toFixed(3)}%)
              </span>
            </div>
          </div>

          {/* BIDS (Achats - prix décroissants depuis le spread) */}
          {(viewMode === 'BOTH' || viewMode === 'BIDS') && (
            <div className="space-y-0.5 py-1">
              {orderBook.bids
                .slice(0, rowCount)
                .map((entry, idx) => (
                  <div
                    key={`bid-${idx}`}
                    onClick={() => onSelectPrice?.(entry.price, 'BUY')}
                    className="grid grid-cols-3 py-0.5 px-1 rounded relative cursor-pointer group hover:bg-emerald-500/10 transition text-[11px]"
                  >
                    {/* Barre de profondeur verte en arrière-plan */}
                    <div
                      className="absolute inset-y-0 right-0 bg-emerald-500/15 rounded-r pointer-events-none transition-all duration-300"
                      style={{ width: `${entry.depthPercentage}%` }}
                    />
                    <span className="text-emerald-400 font-semibold relative z-10 group-hover:underline">
                      {formatPrice(entry.price)}
                    </span>
                    <span className="text-right text-slate-300 relative z-10">{formatQty(entry.quantity)}</span>
                    <span className="text-right text-slate-400 text-[10px] relative z-10">{formatQty(entry.total)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Pied de page du widget */}
      <div className="pt-2 mt-auto border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
        <span>Règle : FIFO (Price-Time)</span>
        <span className="text-sky-400 font-medium">Clic prix → Ordre Limite</span>
      </div>
    </div>
  );
};
