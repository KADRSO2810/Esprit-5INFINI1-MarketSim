import { useEffect, useState, useRef } from 'react';
import { Client, IMessage } from '@stomp/stompjs';
import { StrategySignal } from '../api/strategies';

export const useStrategyWebSocket = (strategyId: number | null) => {
  const [latestSignal, setLatestSignal] = useState<StrategySignal | null>(null);
  const [signalsHistory, setSignalsHistory] = useState<StrategySignal[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    if (!strategyId) return;

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

        // 1. Abonnement aux signaux émis en direct
        client.subscribe(`/topic/strategies/${strategyId}/signals`, (message: IMessage) => {
          try {
            const signal: StrategySignal = JSON.parse(message.body);
            setLatestSignal(signal);
            setSignalsHistory((prev) => [signal, ...prev.slice(0, 99)]);
          } catch (err) {
            console.error('Error parsing strategy signal STOMP:', err);
          }
        });

        // 2. Abonnement aux statuts et alertes
        client.subscribe(`/topic/strategies/${strategyId}/status`, (message: IMessage) => {
          try {
            const data = JSON.parse(message.body);
            setStatusMessage(data.status || 'UPDATED');
          } catch (err) {
            console.error('Error parsing strategy status STOMP:', err);
          }
        });
      },
      onDisconnect: () => {
        setIsConnected(false);
      },
      onStompError: (frame) => {
        console.error('STOMP error:', frame);
        setIsConnected(false);
      }
    });

    client.activate();
    clientRef.current = client;

    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate();
      }
    };
  }, [strategyId]);

  return {
    latestSignal,
    signalsHistory,
    statusMessage,
    isConnected,
    clearHistory: () => setSignalsHistory([])
  };
};
