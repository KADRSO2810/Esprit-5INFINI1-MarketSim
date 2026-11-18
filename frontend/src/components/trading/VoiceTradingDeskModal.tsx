import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  AlertCircle,
  Sparkles,
  Zap,
  Shield,
  Clock,
  Radio,
  Play,
} from 'lucide-react';
import { parseVoiceTradingCommand, ParsedVoiceOrder } from '../../utils/voiceOrderParser';
import {
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
  speakWallStreetVoice,
} from '../../utils/voiceSpeechEngine';
import { placeMarketOrder, OrderFill } from '../../api/trading';
import { useToast } from '../ui';

export interface VoiceOrderExecutionParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  quantity: number;
  limitPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
}

interface VoiceTradingDeskModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSymbol?: string;
  onOpenOrderModal: (params: VoiceOrderExecutionParams) => void;
  onOrderFilled?: (fill: OrderFill) => void;
}

export const VoiceTradingDeskModal: React.FC<VoiceTradingDeskModalProps> = ({
  isOpen,
  onClose,
  selectedSymbol = 'AAPL',
  onOpenOrderModal,
  onOrderFilled,
}) => {
  const toast = useToast();

  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [parsedOrder, setParsedOrder] = useState<ParsedVoiceOrder | null>(null);
  const [voiceFeedbackEnabled, setVoiceFeedbackEnabled] = useState<boolean>(true);
  const [executionMode, setExecutionMode] = useState<'ASSISTED' | 'DIRECT'>('ASSISTED');
  const [lang, setLang] = useState<'fr-FR' | 'en-US'>('fr-FR');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [auditLog, setAuditLog] = useState<{
    id: number;
    rawText: string;
    parsed: ParsedVoiceOrder;
    status: 'EXECUTED' | 'PREFILLED' | 'ERROR';
    time: string;
  }[]>([]);

  const recognizerRef = useRef<any>(null);

  // Initialize Speech Recognizer
  const handleTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      setTranscript(text);
      const parsed = parseVoiceTradingCommand(text, selectedSymbol);
      if (parsed) {
        setParsedOrder(parsed);
      }

      if (isFinal && parsed && parsed.isComplete) {
        if (voiceFeedbackEnabled) {
          speakWallStreetVoice(parsed.feedbackSpeechFr, lang);
        }

        // Si mode Floor Trader direct activé
        if (executionMode === 'DIRECT') {
          handleExecuteDirect(parsed);
        }
      }
    },
    [selectedSymbol, voiceFeedbackEnabled, executionMode, lang]
  );

  const handleError = useCallback((err: string) => {
    setErrorMsg(err);
    setIsListening(false);
  }, []);

  const handleStatusChange = useCallback((listening: boolean) => {
    setIsListening(listening);
  }, []);

  // Start / Stop listening
  const toggleListening = () => {
    if (!isSpeechRecognitionSupported()) {
      setErrorMsg("La reconnaissance vocale n'est pas supportée par ce navigateur.");
      return;
    }

    if (isListening) {
      if (recognizerRef.current) {
        recognizerRef.current.stop();
      }
      setIsListening(false);
    } else {
      setErrorMsg(null);
      setTranscript('');
      setParsedOrder(null);
      try {
        const recognizer = createSpeechRecognizer(
          handleTranscript,
          handleError,
          handleStatusChange,
          lang
        );
        recognizerRef.current = recognizer;
        if (recognizer) {
          recognizer.start();
        }
      } catch (err: any) {
        console.warn('Erreur au démarrage du micro:', err);
        setErrorMsg('Impossible d\'activer le microphone. Vérifiez les autorisations.');
      }
    }
  };

  // Cleanup on unmount or modal close
  useEffect(() => {
    if (!isOpen && isListening && recognizerRef.current) {
      recognizerRef.current.stop();
      setIsListening(false);
    }
  }, [isOpen, isListening]);

  // Execute direct via API
  const handleExecuteDirect = async (orderToExec: ParsedVoiceOrder) => {
    setIsExecuting(true);
    try {
      const fill = await placeMarketOrder(
        orderToExec.symbol,
        orderToExec.side,
        orderToExec.quantity,
        0,
        orderToExec.stopLoss || null,
        orderToExec.takeProfit || null,
        orderToExec.orderType,
        orderToExec.limitPrice || null
      );

      toast.success(
        `⚡ Ordre Vocal Exécuté : ${orderToExec.side} ${orderToExec.quantity} ${orderToExec.symbol} @ $${fill.price.toFixed(2)}`
      );

      if (voiceFeedbackEnabled) {
        speakWallStreetVoice(
          `Ordre exécuté avec succès au prix de ${fill.price.toFixed(2)} dollars.`,
          lang
        );
      }

      setAuditLog((prev) => [
        {
          id: Date.now(),
          rawText: orderToExec.rawTranscript,
          parsed: orderToExec,
          status: 'EXECUTED',
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);

      if (onOrderFilled) {
        onOrderFilled(fill);
      }
    } catch (err: any) {
      console.error("Erreur d'exécution directe de l'ordre vocal:", err);
      toast.error("Échec de l'exécution automatique. Vérifiez vos fonds.");
    } finally {
      setIsExecuting(false);
    }
  };

  // Mode Assisté : Pré-remplir l'OrderModal
  const handlePrefillOrderModal = (order: ParsedVoiceOrder) => {
    onOpenOrderModal({
      symbol: order.symbol,
      side: order.side,
      orderType: order.orderType,
      quantity: order.quantity,
      limitPrice: order.limitPrice,
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit,
    });

    setAuditLog((prev) => [
      {
        id: Date.now(),
        rawText: order.rawTranscript,
        parsed: order,
        status: 'PREFILLED',
        time: new Date().toLocaleTimeString(),
      },
      ...prev,
    ]);

    onClose();
  };

  // Test with preset phrase
  const handleTestPhrase = (phrase: string) => {
    setTranscript(phrase);
    const parsed = parseVoiceTradingCommand(phrase, selectedSymbol);
    if (parsed) {
      setParsedOrder(parsed);
      if (voiceFeedbackEnabled) {
        speakWallStreetVoice(parsed.feedbackSpeechFr, lang);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="rounded-3xl bg-slate-900 border border-slate-700/80 max-w-2xl w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-sky-950/30 to-slate-900">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                <Mic className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white tracking-tight">
                    AI Voice Trading Desk
                  </h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    WALL STREET NLU
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Passez vos ordres à la voix en direct. Reconnaissance instantanée et feedback vocal.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Language Switcher */}
              <div className="flex items-center rounded-lg bg-slate-800 p-0.5 border border-slate-700 text-[11px] font-bold">
                <button
                  onClick={() => setLang('fr-FR')}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    lang === 'fr-FR' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🇫🇷 FR
                </button>
                <button
                  onClick={() => setLang('en-US')}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    lang === 'en-US' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🇺🇸 EN
                </button>
              </div>

              {/* Execution Mode Selector */}
              <button
                onClick={() => setExecutionMode(executionMode === 'ASSISTED' ? 'DIRECT' : 'ASSISTED')}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                  executionMode === 'DIRECT'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
                title={executionMode === 'DIRECT' ? 'Mode Exécution Directe (Floor Trader)' : 'Mode Copilote Assisté (Validation sur ticket)'}
              >
                {executionMode === 'DIRECT' ? '⚡ Floor Direct' : '🛡️ Assisté'}
              </button>

              {/* TTS Toggle */}
              <button
                onClick={() => setVoiceFeedbackEnabled(!voiceFeedbackEnabled)}
                className={`p-1.5 rounded-lg border text-xs transition-colors ${
                  voiceFeedbackEnabled
                    ? 'bg-slate-800 text-sky-400 border-sky-500/40'
                    : 'bg-slate-800/50 text-slate-500 border-slate-700'
                }`}
                title={voiceFeedbackEnabled ? 'Désactiver la voix TTS' : 'Activer la voix TTS'}
              >
                {voiceFeedbackEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Body */}
          <div className="p-6 space-y-6 overflow-y-auto">
            {/* Microphone Central Push-to-Talk HUD */}
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-950/70 border border-slate-800 relative overflow-hidden">
              {/* Audio Waveform Glow */}
              {isListening && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                  <div className="w-48 h-48 rounded-full bg-sky-500 animate-ping" />
                </div>
              )}

              {/* Big Mic Button */}
              <button
                onClick={toggleListening}
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all transform hover:scale-105 active:scale-95 ${
                  isListening
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-rose-600/50 ring-4 ring-rose-500/40 animate-pulse'
                    : 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-sky-600/40 hover:from-sky-500 hover:to-blue-500'
                }`}
              >
                {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
              </button>

              <div className="text-center mt-3 space-y-1">
                <div className="text-sm font-bold text-white flex items-center justify-center gap-2">
                  {isListening ? (
                    <>
                      <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
                      <span className="text-rose-400">À l'écoute du parquet... Parlez maintenant</span>
                    </>
                  ) : (
                    <span>Cliquez pour activer le micro</span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Exemple : "Achète 50 Apple au marché" ou "Vends 20 Tesla avec stop à 210"
                </p>
              </div>

              {errorMsg && (
                <div className="mt-3 px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Live Transcript & NLU Parsing Result */}
            <div className="rounded-2xl bg-slate-800/60 border border-slate-700/80 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  Transcription Vocale en Direct
                </span>
                <span className="text-slate-400 font-mono">
                  {transcript ? `${transcript.length} caractères` : 'En attente de voix'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 min-h-[56px] flex items-center">
                {transcript ? (
                  <p className="text-sm font-medium text-white italic">"{transcript}"</p>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    Dites clairement votre ordre : [Sens] + [Quantité] + [Actif] + [Options]...
                  </p>
                )}
              </div>

              {/* Parsed Structure Badge View */}
              {parsedOrder && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl bg-slate-900 border border-sky-500/40 p-4 space-y-3 shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Paramètres d'Ordre Extraits
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
                      Confiance : {(parsedOrder.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  {/* Pills Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 text-[10px] block">Sens :</span>
                      <span
                        className={`font-black text-xs ${
                          parsedOrder.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {parsedOrder.side === 'BUY' ? '▲ ACHAT (BUY)' : '▼ VENTE (SELL)'}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 text-[10px] block">Actif :</span>
                      <span className="font-bold text-white text-xs truncate block">
                        {parsedOrder.symbolDisplay}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 text-[10px] block">Quantité :</span>
                      <span className="font-mono font-bold text-amber-400 text-xs">
                        {parsedOrder.quantity} parts
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 text-[10px] block">Type :</span>
                      <span className="font-bold text-sky-400 text-xs">
                        {parsedOrder.orderType}
                        {parsedOrder.limitPrice ? ` ($${parsedOrder.limitPrice})` : ''}
                      </span>
                    </div>
                  </div>

                  {/* SL / TP row if present */}
                  {(parsedOrder.stopLoss || parsedOrder.takeProfit) && (
                    <div className="flex items-center gap-3 text-xs pt-1 border-t border-slate-800">
                      {parsedOrder.stopLoss && (
                        <span className="text-rose-300 font-mono">
                          Stop-Loss : <strong>${parsedOrder.stopLoss}</strong>
                        </span>
                      )}
                      {parsedOrder.takeProfit && (
                        <span className="text-emerald-300 font-mono">
                          Take-Profit : <strong>${parsedOrder.takeProfit}</strong>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action Execution Button */}
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      onClick={() => handlePrefillOrderModal(parsedOrder)}
                      className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-sky-600/30"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      Vérifier & Valider sur le Ticket d'Ordre
                    </button>

                    <button
                      disabled={isExecuting}
                      onClick={() => handleExecuteDirect(parsedOrder)}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {isExecuting ? 'Exécution...' : 'Exécuter Directement'}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Quick Test Phrases (No mic required) */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Phrases de Test Rapides (Clic Direct) :
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  'Achète 50 Apple au marché',
                  'Vends 20 Tesla avec stop à 210',
                  'Achète 2 Bitcoin au marché avec objectif à 95000',
                  'Vends 100 Nvidia à la limite de 145',
                  'Achète 10 Or GLD au marché',
                ].map((phrase, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleTestPhrase(phrase)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center gap-1.5"
                  >
                    <Play className="w-2.5 h-2.5 text-sky-400" />
                    "{phrase}"
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Audit Log */}
            {auditLog.length > 0 && (
              <div className="rounded-2xl bg-slate-800/40 border border-slate-700/60 p-4 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Journal des Commandes Vocales Récentes
                </span>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {auditLog.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between text-xs bg-slate-900/60 p-2 rounded-lg border border-slate-800"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`font-mono font-bold text-[10px] px-1.5 py-0.5 rounded ${
                            log.status === 'EXECUTED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-sky-500/20 text-sky-300'
                          }`}
                        >
                          {log.status}
                        </span>
                        <span className="text-slate-300 truncate font-medium">"{log.rawText}"</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">
                        {log.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default VoiceTradingDeskModal;
