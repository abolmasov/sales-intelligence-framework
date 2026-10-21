/**
 * Sound notification utility for playing audio alerts when analyses complete
 * Uses Web Audio API for reliable playback with fallback to HTML5 Audio
 */

type SoundType = 'success' | 'error' | 'info';

// Audio context for Web Audio API (singleton)
let audioContext: AudioContext | null = null;

// Get or create audio context
const getAudioContext = (): AudioContext | null => {
  if (audioContext) return audioContext;

  try {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    return audioContext;
  } catch (e) {
    console.warn('Web Audio API not supported:', e);
    return null;
  }
};

// Generate a pleasant notification tone using Web Audio API
const playToneWithWebAudio = (type: SoundType): boolean => {
  const ctx = getAudioContext();
  if (!ctx) return false;

  try {
    // Resume audio context if suspended (required by browsers)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Configure sound based on type
    switch (type) {
      case 'success':
        // Pleasant rising two-tone chime (C5 -> E5)
        oscillator.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.4);
        break;

      case 'error':
        // Descending tone (G4 -> E4)
        oscillator.frequency.setValueAtTime(392, ctx.currentTime); // G4
        oscillator.frequency.setValueAtTime(329.63, ctx.currentTime + 0.2); // E4
        oscillator.type = 'triangle';
        gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.35);
        break;

      case 'info':
      default:
        // Single soft tone (A4)
        oscillator.frequency.setValueAtTime(440, ctx.currentTime); // A4
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.25);
        break;
    }

    return true;
  } catch (e) {
    console.warn('Failed to play Web Audio tone:', e);
    return false;
  }
};

// Play a complete melody for workflow completion (more celebratory)
const playCompletionMelody = (): boolean => {
  const ctx = getAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Three-note success melody: C5 -> E5 -> G5
    const notes = [
      { freq: 523.25, start: 0, duration: 0.15 },      // C5
      { freq: 659.25, start: 0.12, duration: 0.15 },   // E5
      { freq: 783.99, start: 0.24, duration: 0.3 },    // G5 (longer)
    ];

    notes.forEach(note => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(note.freq, ctx.currentTime + note.start);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0, ctx.currentTime + note.start);
      gainNode.gain.linearRampToValueAtTime(0.25, ctx.currentTime + note.start + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + note.start + note.duration);

      oscillator.start(ctx.currentTime + note.start);
      oscillator.stop(ctx.currentTime + note.start + note.duration);
    });

    return true;
  } catch (e) {
    console.warn('Failed to play completion melody:', e);
    return false;
  }
};

// Storage key for sound preferences
const SOUND_ENABLED_KEY = 'salesIntelSoundNotifications';

/**
 * Check if sound notifications are enabled
 */
export const isSoundEnabled = (): boolean => {
  const stored = localStorage.getItem(SOUND_ENABLED_KEY);
  // Default to enabled
  return stored === null ? true : stored === 'true';
};

/**
 * Enable or disable sound notifications
 */
export const setSoundEnabled = (enabled: boolean): void => {
  localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
};

/**
 * Toggle sound notifications
 */
export const toggleSound = (): boolean => {
  const newValue = !isSoundEnabled();
  setSoundEnabled(newValue);
  return newValue;
};

/**
 * Play a notification sound
 * @param type - Type of sound to play: 'success', 'error', or 'info'
 */
export const playNotificationSound = (type: SoundType = 'success'): void => {
  if (!isSoundEnabled()) return;

  playToneWithWebAudio(type);
};

/**
 * Play a celebratory melody for workflow completion
 * Used when entire analysis pipeline completes successfully
 */
export const playWorkflowCompleteSound = (): void => {
  if (!isSoundEnabled()) return;

  playCompletionMelody();
};

/**
 * Play sound for pre-call analysis completion
 */
export const playPreCallCompleteSound = (): void => {
  playNotificationSound('success');
};

/**
 * Play sound for transcript analysis completion
 */
export const playTranscriptCompleteSound = (): void => {
  playNotificationSound('success');
};

/**
 * Play sound for proposal generation completion
 */
export const playProposalCompleteSound = (): void => {
  playNotificationSound('success');
};

/**
 * Play sound for PPT generation completion
 */
export const playPptCompleteSound = (): void => {
  playNotificationSound('success');
};

/**
 * Play sound for analysis error
 */
export const playErrorSound = (): void => {
  playNotificationSound('error');
};

/**
 * Initialize audio context on first user interaction
 * Call this on a user click/touch event to enable audio
 */
export const initializeAudio = (): void => {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {
      // Ignore resume errors
    });
  }
};

export default {
  playNotificationSound,
  playWorkflowCompleteSound,
  playPreCallCompleteSound,
  playTranscriptCompleteSound,
  playProposalCompleteSound,
  playPptCompleteSound,
  playErrorSound,
  isSoundEnabled,
  setSoundEnabled,
  toggleSound,
  initializeAudio,
};
