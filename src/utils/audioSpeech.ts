// Web Speech API and Web Audio API helpers for natural Voice Calling experience

export class VoiceAudioManager {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private audioCtx: AudioContext | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private activeVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => {
          this.loadVoices();
        };
      }
    }
  }

  private loadVoices(): void {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
    this.activeVoice = this.findBestIndianVoice();
  }

  // Find the most natural Indian accent voice available in the browser/OS
  private findBestIndianVoice(preferredLang?: 'English' | 'Hindi' | 'Auto', sampleText = ''): SpeechSynthesisVoice | null {
    if (!this.voices || this.voices.length === 0) {
      if (this.synth) {
        this.voices = this.synth.getVoices();
      }
    }
    if (!this.voices || this.voices.length === 0) return null;

    const isHindi =
      preferredLang === 'Hindi' ||
      /[\u0900-\u097F]/.test(sampleText) ||
      sampleText.toLowerCase().includes('namaste') ||
      sampleText.toLowerCase().includes('shukriya');

    // 1. If Hindi mode or Hindi text detected, pick top natural Hindi engine
    if (isHindi) {
      const hindiVoice =
        this.voices.find((v) => (v.lang === 'hi-IN' || v.lang === 'hi_IN') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Neural'))) ||
        this.voices.find((v) => v.lang === 'hi-IN' || v.lang === 'hi_IN') ||
        this.voices.find((v) => v.lang.startsWith('hi')) ||
        this.voices.find((v) => v.name.toLowerCase().includes('hindi'));
      if (hindiVoice) return hindiVoice;
    }

    // 2. High-priority search for Indian English Voice (Arjun - White Collar HR)
    // E.g. Microsoft Prabhat Online (Natural), Madhav, Ravi, Google English (India)
    const naturalIndianMale = this.voices.find((v) => {
      const name = v.name.toLowerCase();
      const lang = v.lang.toLowerCase();
      const isIndian = lang.includes('en-in') || lang.includes('en_in') || name.includes('india');
      const isMale = name.includes('prabhat') || name.includes('madhav') || name.includes('ravi') || 
                     name.includes('rishi') || name.includes('male') || name.includes('arjun');
      return isIndian && isMale;
    });
    if (naturalIndianMale) return naturalIndianMale;

    const naturalIndian = this.voices.find((v) => {
      const name = v.name.toLowerCase();
      const lang = v.lang.toLowerCase();
      const isIndian = lang.includes('en-in') || lang.includes('en_in') || name.includes('india');
      const isNaturalOrNeural = name.includes('natural') || name.includes('neural') || name.includes('online') || name.includes('google');
      return isIndian && isNaturalOrNeural;
    });
    if (naturalIndian) return naturalIndian;

    // 3. Any Indian English Voice (Arjun - White Collar HR)
    const indianVoice = this.voices.find((v) => {
      const name = v.name.toLowerCase();
      const lang = v.lang.toLowerCase();
      const isIndian = lang.includes('en-in') || lang.includes('en_in') || name.includes('india');
      return isIndian;
    });
    if (indianVoice) return indianVoice;

    // 4. Any Google / Microsoft Natural English Voice (Alexa / Assistant tier)
    const googleAssistantVoice = this.voices.find((v) => {
      const name = v.name.toLowerCase();
      return (name.includes('google') && v.lang.startsWith('en')) || 
             (name.includes('natural') && (name.includes('jenny') || name.includes('aria') || name.includes('sonia')));
    });
    if (googleAssistantVoice) return googleAssistantVoice;

    // 5. Any Indian English Voice (en-IN, en_IN, India)
    const indianAny = this.voices.find((v) => {
      const name = v.name.toLowerCase();
      const lang = v.lang.toLowerCase();
      return lang === 'en-in' || lang === 'en_in' || lang.startsWith('en-in') || name.includes('india');
    });
    if (indianAny) return indianAny;

    // 6. Natural sounding female English voice (Siri/Alexa/Google Assistant grade fallback)
    const naturalFemale = this.voices.find((v) => {
      const name = v.name.toLowerCase();
      return (name.includes('natural') || name.includes('neural') || name.includes('samantha') || name.includes('zira') || name.includes('karen')) && v.lang.startsWith('en');
    });
    if (naturalFemale) return naturalFemale;

    // 6. Default English voice
    return this.voices.find((v) => v.lang.startsWith('en')) || this.voices[0] || null;
  }

  // Get current active voice information for UI display
  getActiveVoiceInfo(): { name: string; isIndianAccent: boolean; lang: string } {
    const voice = this.activeVoice || this.findBestIndianVoice();
    if (!voice) {
      return { name: 'Indian English Engine (Synthesized)', isIndianAccent: true, lang: 'en-IN' };
    }
    const name = voice.name.toLowerCase();
    const lang = voice.lang.toLowerCase();
    const isIndian = lang.includes('in') || name.includes('india') || name.includes('heera') || name.includes('neerja') || name.includes('hindi') || name.includes('veena');
    return {
      name: voice.name,
      isIndianAccent: isIndian,
      lang: voice.lang,
    };
  }

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Play realistic phone ring tone
  playRingTone(): () => void {
    try {
      const ctx = this.getAudioContext();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(440, ctx.currentTime);
      osc2.frequency.setValueAtTime(480, ctx.currentTime);

      gainNode.gain.setValueAtTime(0.08, ctx.currentTime);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start();
      osc2.start();

      return () => {
        try {
          osc1.stop();
          osc2.stop();
          osc1.disconnect();
          osc2.disconnect();
        } catch {}
      };
    } catch {
      return () => {};
    }
  }

  // Play call connected beep
  playConnectChime() {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch {}
  }

  // Play subtle Google Assistant / Alexa style listening earcon
  playListeningStartChime() {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.19);
    } catch {}
  }

  // Play call disconnect beep
  playDisconnectTone() {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.1, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {}
  }

  // Speak text using browser speech synthesis
  speak(
    text: string,
    options: {
      language?: 'English' | 'Hindi' | 'Auto';
      rate?: number;
      pitch?: number;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (e: any) => void;
    } = {}
  ): void {
    if (!this.synth) {
      options.onEnd?.();
      return;
    }

    // Ensure synthesis is unpaused (fixes browser speech throttle)
    if (this.synth.paused) {
      this.synth.resume();
    }

    this.stopSpeaking();

    // Clean text of markdown/asterisks
    const cleanedText = text.replace(/[*_#`]/g, '').trim();
    if (!cleanedText) {
      options.onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    // Google Assistant / Alexa natural cadence: crisp, friendly, conversational, warm
    utterance.rate = options.rate ?? 1.02;
    utterance.pitch = options.pitch ?? 1.02;

    const selectedVoice = this.findBestIndianVoice(options.language, cleanedText);

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = options.language === 'Hindi' ? 'hi-IN' : 'en-IN';
    }

    utterance.onstart = () => {
      options.onStart?.();
    };

    utterance.onend = () => {
      this.currentUtterance = null;
      options.onEnd?.();
    };

    utterance.onerror = (err) => {
      console.warn('SpeechSynthesis error:', err);
      this.currentUtterance = null;
      options.onEnd?.();
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  // Speak a sentence chunk by appending to speech queue for real-time streaming
  speakQueue(
    text: string,
    options: {
      language?: 'English' | 'Hindi' | 'Auto';
      rate?: number;
      pitch?: number;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (e: any) => void;
    } = {}
  ): void {
    if (!this.synth) {
      options.onEnd?.();
      return;
    }

    // Ensure synthesis is active and unpaused
    if (this.synth.paused) {
      this.synth.resume();
    }

    const cleanedText = text.replace(/[*_#`]/g, '').trim();
    if (!cleanedText) {
      options.onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.rate = options.rate ?? 1.02;
    utterance.pitch = options.pitch ?? 1.02;

    const selectedVoice = this.findBestIndianVoice(options.language, cleanedText);

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = options.language === 'Hindi' ? 'hi-IN' : 'en-IN';
    }

    utterance.onstart = () => {
      options.onStart?.();
    };

    utterance.onend = () => {
      options.onEnd?.();
    };

    utterance.onerror = (err) => {
      console.warn('SpeechSynthesis queue item error:', err);
      options.onEnd?.();
    };

    this.synth.speak(utterance);
  }

  stopSpeaking() {
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
  }

  isSpeaking(): boolean {
    return !!(this.synth && this.synth.speaking);
  }
}

export const voiceAudio = new VoiceAudioManager();
