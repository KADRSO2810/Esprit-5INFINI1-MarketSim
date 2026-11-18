// Type definitions for Web Speech API in TypeScript
export interface IWindowSpeech extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as IWindowSpeech;
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
}

export function createSpeechRecognizer(
  onTranscript: (transcript: string, isFinal: boolean) => void,
  onError: (error: string) => void,
  onStatusChange: (listening: boolean) => void,
  lang: string = 'fr-FR'
) {
  if (!isSpeechRecognitionSupported()) {
    onError('La reconnaissance vocale n\'est pas supportée par ce navigateur (utilisez Chrome, Edge ou Safari).');
    return null;
  }

  const win = window as unknown as IWindowSpeech;
  const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
  const recognition = new SpeechRecognitionClass();

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = lang; // 'fr-FR' ou 'en-US'
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    onStatusChange(true);
  };

  recognition.onend = () => {
    onStatusChange(false);
  };

  recognition.onerror = (event: any) => {
    if (event.error === 'no-speech') return;
    console.warn('SpeechRecognition error:', event.error);
    onError(`Microphone: ${event.error}`);
  };

  recognition.onresult = (event: any) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const trans = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += trans;
      } else {
        interimTranscript += trans;
      }
    }

    if (finalTranscript.trim().length > 0) {
      onTranscript(finalTranscript.trim(), true);
    } else if (interimTranscript.trim().length > 0) {
      onTranscript(interimTranscript.trim(), false);
    }
  };

  return recognition;
}

/**
 * Synthèse Vocale Text-to-Speech (TTS) style Floor Trader Wall Street
 */
export function speakWallStreetVoice(text: string, lang: string = 'fr-FR') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  try {
    window.speechSynthesis.cancel(); // Stop any pending voice

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.05; // Slightly fast pace like a trader
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    // Priorité à une voix française ou anglaise naturelle
    const preferredVoice = voices.find(
      (v) => (v.lang.startsWith('fr') || v.lang.startsWith('en')) && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Premium'))
    ) || voices.find((v) => v.lang.startsWith(lang.slice(0, 2)));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Impossible de prononcer le retour vocal:', err);
  }
}
