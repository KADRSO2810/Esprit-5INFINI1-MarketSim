import { useEffect, useState, useRef, useCallback } from 'react';
import { Client, IMessage } from '@stomp/stompjs';
import { MarketQuote } from '../api/market';

export interface LiveQuote extends MarketQuote {
  change?: number; // différence par rapport au prix précédent
  changePercent?: number;
  flash?: 'up' | 'down' | null;
}

export interface PricePoint {
  price: number;
  time: string;
}

export interface SlTpTriggerEvent {
  userId: number;
  sessionId: number;
  symbol: string;
  triggerType: 'STOP_LOSS' | 'TAKE_PROFIT';
  triggerPrice: number;
  executionPrice: number;
  quantity: number;
  realizedPnl: number;
  cashAfter: number;
  message: string;
  timestamp: string;
}

interface UseMarketWebSocketOptions {
  onSlTpTrigger?: (event: SlTpTriggerEvent) => void;
}

export const useMarketWebSocket = (options?: UseMarketWebSocketOptions) => {
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [history, setHistory] = useState<Record<string, PricePoint[]>>({});
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [tickCount, setTickCount] = useState<number>(0);
  const clientRef = useRef<Client | null>(null);
  const onSlTpTriggerRef = useRef(options?.onSlTpTrigger);

  useEffect(() => {
    onSlTpTriggerRef.current = options?.onSlTpTrigger;
  }, [options?.onSlTpTrigger]);

  // Initialisation initiale avec les derniers quotes connus reçus via REST
  const initializeQuotes = useCallback((initialQuotes: MarketQuote[]) => {
    setQuotes((prev) => {
      const next = { ...prev };
      initialQuotes.forEach((q) => {
        if (!next[q.symbol]) {
          next[q.symbol] = { ...q, flash: null };
        }
      });
      return next;
    });

    setHistory((prev) => {
      const next = { ...prev };
      initialQuotes.forEach((q) => {
        if (!next[q.symbol] || next[q.symbol].length === 0) {
          next[q.symbol] = [{ price: q.price, time: new Date(q.ts).toLocaleTimeString() }];
        }
      });
      return next;
    });
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    const wsUrl = `${protocol}//${host}:8081/ws`;

    const client = new Client({
      brokerURL: wsUrl,
      reconnectDelay: 3000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: () => {},
      onConnect: () => {
        setIsConnected(true);

        client.subscribe('/topic/quotes', (message: IMessage) => {
          try {
            const quote: MarketQuote = JSON.parse(message.body);
            setTickCount((c) => c + 1);

            setQuotes((prev) => {
              const current = prev[quote.symbol];
              let change = 0;
              let changePercent = 0;
              let flash: 'up' | 'down' | null = null;

              if (current && current.price > 0) {
                change = quote.price - current.price;
                changePercent = (change / current.price) * 100;
                if (change > 0) flash = 'up';
                else if (change < 0) flash = 'down';
              }

              return {
                ...prev,
                [quote.symbol]: {
                  ...quote,
                  change,
                  changePercent,
                  flash,
                },
              };
            });

            // Mise à jour de l'historique glissant des 50 derniers points
            const timeStr = new Date(quote.ts).toLocaleTimeString();
            setHistory((prev) => {
              const symbolHistory = prev[quote.symbol] || [];
              const updatedHistory = [...symbolHistory, { price: quote.price, time: timeStr }];
              if (updatedHistory.length > 50) {
                updatedHistory.shift();
              }
              return {
                ...prev,
                [quote.symbol]: updatedHistory,
              };
            });
          } catch (err) {
            console.error('Erreur parsing quote STOMP:', err);
          }
        });

        // 2. Écoute des déclenchements automatiques Stop-Loss & Take-Profit
        client.subscribe('/topic/sl-tp-triggers', (message: IMessage) => {
          try {
            const triggerEvent: SlTpTriggerEvent = JSON.parse(message.body);
            onSlTpTriggerRef.current?.(triggerEvent);
          } catch (err) {
            console.error('Erreur parsing SL/TP trigger STOMP:', err);
          }
        });
      },
      onDisconnect: () => {
        setIsConnected(false);
      },
      onStompError: () => {
        setIsConnected(false);
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
    };
  }, []);

  return {
    quotes,
    history,
    isConnected,
    tickCount,
    initializeQuotes,
  };
};
