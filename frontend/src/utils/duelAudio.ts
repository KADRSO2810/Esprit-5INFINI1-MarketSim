// Procedural sound effects for 1v1 Blind Market Duels

let globalAudioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!globalAudioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      globalAudioCtx = new AudioCtx();
    }
  }
  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(() => {});
  }
  return globalAudioCtx;
};

export type DuelSfxType = 'order_buy' | 'order_sell' | 'order_close' | 'tick' | 'victory' | 'defeat' | 'countdown';

export const playDuelSfx = (type: DuelSfxType, enabled: boolean = true) => {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case 'order_buy': {
        // Double bip aigu montant
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }

      case 'order_sell': {
        // Bip descendant grave
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.12);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }

      case 'order_close': {
        // Clôture neutre
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.09);
        break;
      }

      case 'tick': {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc.start(now);
        osc.stop(now + 0.04);
        break;
      }

      case 'countdown': {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      }

      case 'victory': {
        // Fanfare triomphante majeure
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
          const noteOsc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          noteOsc.type = 'triangle';
          noteOsc.frequency.setValueAtTime(freq, now + i * 0.12);
          noteGain.gain.setValueAtTime(0.2, now + i * 0.12);
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);
          noteOsc.connect(noteGain);
          noteGain.connect(ctx.destination);
          noteOsc.start(now + i * 0.12);
          noteOsc.stop(now + i * 0.12 + 0.38);
        });
        break;
      }

      case 'defeat': {
        // Son mineur descendant
        const notes = [440, 415.3, 392, 349.23];
        notes.forEach((freq, i) => {
          const noteOsc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          noteOsc.type = 'sawtooth';
          noteOsc.frequency.setValueAtTime(freq, now + i * 0.14);
          noteGain.gain.setValueAtTime(0.12, now + i * 0.14);
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.3);
          noteOsc.connect(noteGain);
          noteGain.connect(ctx.destination);
          noteOsc.start(now + i * 0.14);
          noteOsc.stop(now + i * 0.14 + 0.32);
        });
        break;
      }
    }
  } catch (err) {
    console.debug('[AUDIO] Erreur SFX duel:', err);
  }
};
