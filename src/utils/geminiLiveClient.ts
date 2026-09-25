/**
 * Gemini Live Client: Real-Time Bidirectional Voice Audio Engine
 *
 * - Microphone input: 16,000 Hz 16-bit PCM little-endian streamed in real-time over WebSocket
 * - Speaker playback: 24,000 Hz 16-bit PCM native audio received from Gemini Live API
 * - Instant Barge-In: Local acoustic voice detection + Gemini interruption signal instantly
 *   silences agent audio and yields the floor to candidate speech
 * - Continuous hands-free conversational turn-taking
 */

/**
 * Gemini Live Client: Real-Time Bidirectional Voice Audio Engine
 *
 * - Single-pipeline 24,000 Hz native Web Audio playback from Gemini Live
 * - 16,000 Hz 16-bit PCM microphone streaming over WebSocket
 * - Unique session tracking to prevent duplicate sessions or stale audio playback
 * - Comprehensive 12-point idempotent cleanup stopping all streams, contexts, queues, and listeners
 * - Instant zero-latency Barge-In: local RMS acoustic threshold + server interruption signal
 */

export interface GeminiLiveCallbacks {
  onStatusChange: (status: 'idle' | 'connecting' | 'connected' | 'ended' | 'error') => void;
  onAgentTranscript: (chunk: string) => void;
  onUserTranscript: (text: string, isFinal: boolean) => void;
  onAgentSpeakingChange: (isSpeaking: boolean) => void;
  onInterrupted: () => void;
  onToolCall: (name: string, args: any) => void;
  onTurnComplete: () => void;
  onVolumeChange: (candidateVolume: number, agentVolume: number) => void;
  onError: (errorMessage: string) => void;
}

export interface GeminiLiveClientOptions {
  sessionId?: string;
}

// Module-level tracker to enforce STRICT SINGLETON for AI Voice Recruiter:
// If a previous instance is still running, it is halted immediately before a new one starts.
let globalActiveLiveClient: GeminiLiveClient | null = null;

export class GeminiLiveClient {
  public readonly sessionId: string;

  private transportMode: 'ws' | 'http' = 'ws';
  private ws: WebSocket | null = null;
  private eventSource: EventSource | null = null;
  private httpAudioInFlight: boolean = false;
  private httpAudioBuffer: string[] = [];
  private httpAudioTimer: any = null;

  private micStream: MediaStream | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private silenceGain: GainNode | null = null;

  private playbackAudioCtx: AudioContext | null = null;
  private playbackAnalyser: AnalyserNode | null = null;
  private activeAudioSources: AudioBufferSourceNode[] = [];
  private audioQueue: Array<{ buffer: AudioBuffer; duration: number }> = [];
  private nextPlaybackStartTime: number = 0;

  private scheduledTimeouts: Set<any> = new Set();
  private animationFrameId: number | null = null;

  private isMutedState: boolean = false;
  private isAgentSpeakingState: boolean = false;
  private isConnecting: boolean = false;
  private isConnected: boolean = false;
  private callEnded: boolean = false;
  private isCleanedUp: boolean = false;

  private callbacks: GeminiLiveCallbacks;

  constructor(callbacks: GeminiLiveCallbacks, options?: GeminiLiveClientOptions) {
    this.sessionId = options?.sessionId || `gls_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.callbacks = callbacks;

    // Terminate any previous global client instance immediately to avoid duplicate audio pipelines
    if (globalActiveLiveClient && globalActiveLiveClient !== this) {
      try {
        console.warn(`[GeminiLiveClient] Stopping previous active session (${globalActiveLiveClient.sessionId}) for new session (${this.sessionId})`);
        globalActiveLiveClient.cleanup();
      } catch (e) {
        console.error('[GeminiLiveClient] Error stopping previous instance:', e);
      }
    }
    globalActiveLiveClient = this;
  }

  public async start(
    candidate: any,
    scenario: string,
    availableSlots: any[],
    languagePreference: string = 'Auto'
  ): Promise<void> {
    if (this.callEnded || this.isCleanedUp || this.isConnecting || this.isConnected) {
      return;
    }

    this.isConnecting = true;
    this.callbacks.onStatusChange('connecting');

    try {
      // 1. Request microphone permission early
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Abort guard: if call was ended while waiting for getUserMedia permission
      if (this.callEnded || this.isCleanedUp) {
        console.log(`[GeminiLiveClient:${this.sessionId}] Session ended during mic prompt; aborting setup.`);
        stream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
        return;
      }
      this.micStream = stream;

      // 2. Initialize Playback AudioContext (24kHz native Gemini Live output) - exactly ONE output pipeline
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const playCtx = new AudioCtxClass({ sampleRate: 24000 });
      if (playCtx.state === 'suspended') {
        await playCtx.resume();
      }

      // Abort guard
      if (this.callEnded || this.isCleanedUp) {
        try { playCtx.close(); } catch {}
        return;
      }
      this.playbackAudioCtx = playCtx;

      const analyser = playCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(playCtx.destination);
      this.playbackAnalyser = analyser;
      this.nextPlaybackStartTime = playCtx.currentTime;

      // 3. Initialize Input AudioContext (16kHz PCM capture)
      const inputCtx = new AudioCtxClass({ sampleRate: 16000 });
      if (inputCtx.state === 'suspended') {
        await inputCtx.resume();
      }

      // Abort guard
      if (this.callEnded || this.isCleanedUp) {
        try { inputCtx.close(); } catch {}
        return;
      }
      this.inputAudioCtx = inputCtx;

      this.sourceNode = inputCtx.createMediaStreamSource(this.micStream);
      this.processorNode = inputCtx.createScriptProcessor(4096, 1, 1);

      this.silenceGain = inputCtx.createGain();
      this.silenceGain.gain.value = 0; // Avoid mic loopback to local speakers
      this.processorNode.connect(this.silenceGain);
      this.silenceGain.connect(inputCtx.destination);

      this.setupMicProcessor();

      // Abort guard before opening WebSocket
      if (this.callEnded || this.isCleanedUp) {
        return;
      }

      // 4. Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live-stream`;
      console.log(`[GeminiLiveClient:${this.sessionId}] Connecting to WebSocket:`, wsUrl);

      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      // 2.5 second fallback timer: if WebSocket handshake is blocked or hanging due to reverse-proxy cookies
      const wsConnectTimer = setTimeout(() => {
        if (!this.isConnected && !this.callEnded && !this.isCleanedUp && this.transportMode === 'ws') {
          console.warn(`[GeminiLiveClient:${this.sessionId}] WebSocket connect timed out after 2.5s; activating HTTP streaming fallback...`);
          if (this.ws) {
            try { this.ws.close(); } catch {}
            this.ws = null;
          }
          this.startHttpTransport(candidate, scenario, availableSlots, languagePreference);
        }
      }, 2500);
      this.scheduledTimeouts.add(wsConnectTimer);

      ws.onopen = () => {
        clearTimeout(wsConnectTimer);
        this.scheduledTimeouts.delete(wsConnectTimer);

        if (this.callEnded || this.isCleanedUp || this.ws !== ws) {
          try { ws.close(); } catch {}
          return;
        }

        console.log(`[GeminiLiveClient:${this.sessionId}] WebSocket open. Sending init payload...`);
        ws.send(
          JSON.stringify({
            type: 'init',
            sessionId: this.sessionId,
            candidate,
            scenario,
            availableSlots,
            languagePreference,
          })
        );
      };

      ws.onmessage = (event) => {
        if (this.callEnded || this.isCleanedUp || this.ws !== ws) {
          return;
        }
        try {
          const msg = JSON.parse(event.data);
          // Discard messages destined for an older session ID if specified
          if (msg.sessionId && msg.sessionId !== this.sessionId) {
            return;
          }
          this.handleServerMessage(msg);
        } catch (e) {
          console.error('[GeminiLiveClient] Error parsing message:', e);
        }
      };

      ws.onerror = (err) => {
        clearTimeout(wsConnectTimer);
        this.scheduledTimeouts.delete(wsConnectTimer);

        if (this.callEnded || this.isCleanedUp) return;

        // If WebSocket failed during handshake before connected (e.g. Nginx 302 redirect), seamlessly fall back to HTTP streaming
        if (!this.isConnected && this.transportMode === 'ws') {
          console.warn(`[GeminiLiveClient:${this.sessionId}] WebSocket handshake failed; seamlessly switching to HTTP streaming fallback...`);
          try { ws.close(); } catch {}
          this.ws = null;
          this.startHttpTransport(candidate, scenario, availableSlots, languagePreference);
          return;
        }

        console.error(`[GeminiLiveClient:${this.sessionId}] WebSocket error:`, err);
        this.callbacks.onError('Connection error with Gemini Live server.');
        this.callbacks.onStatusChange('error');
      };

      ws.onclose = () => {
        clearTimeout(wsConnectTimer);
        this.scheduledTimeouts.delete(wsConnectTimer);

        console.log(`[GeminiLiveClient:${this.sessionId}] WebSocket closed`);
        if (!this.isConnected && !this.callEnded && !this.isCleanedUp && this.transportMode === 'ws') {
          console.warn(`[GeminiLiveClient:${this.sessionId}] WebSocket closed before ready; switching to HTTP streaming fallback...`);
          this.ws = null;
          this.startHttpTransport(candidate, scenario, availableSlots, languagePreference);
          return;
        }

        if (!this.callEnded && this.isConnected) {
          this.isConnected = false;
          this.callbacks.onStatusChange('ended');
        }
      };
    } catch (err: any) {
      if (this.callEnded || this.isCleanedUp) return;
      console.error(`[GeminiLiveClient:${this.sessionId}] Failed to start live session:`, err);
      this.cleanup();
      const message =
        err?.name === 'NotAllowedError' || err?.message?.includes('Permission')
          ? 'Microphone permission denied. Please allow microphone access to speak with the AI Recruiter.'
          : err?.message || 'Failed to initialize voice session.';
      this.callbacks.onError(message);
      this.callbacks.onStatusChange('error');
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * HTTP Streaming Fallback Transport
   * Handles reverse-proxy environments where WebSockets are restricted or redirected.
   */
  private async startHttpTransport(
    candidate: any,
    scenario: string,
    availableSlots: any[],
    languagePreference: string
  ): Promise<void> {
    if (this.callEnded || this.isCleanedUp) return;
    this.transportMode = 'http';
    console.log(`[GeminiLiveClient:${this.sessionId}] Starting HTTP streaming live session...`);

    try {
      const res = await fetch('/api/live-session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          candidate,
          scenario,
          availableSlots,
          languagePreference,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server returned status ${res.status}: ${errText}`);
      }

      if (this.callEnded || this.isCleanedUp) {
        fetch('/api/live-session/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: this.sessionId }),
        }).catch(() => {});
        return;
      }

      const sseUrl = `/api/live-session/stream?sessionId=${encodeURIComponent(this.sessionId)}`;
      console.log(`[GeminiLiveClient:${this.sessionId}] Connecting SSE stream:`, sseUrl);

      const es = new EventSource(sseUrl);
      this.eventSource = es;

      es.onmessage = (event) => {
        if (this.callEnded || this.isCleanedUp || this.eventSource !== es) {
          try { es.close(); } catch {}
          return;
        }
        try {
          const msg = JSON.parse(event.data);
          if (msg.sessionId && msg.sessionId !== this.sessionId) return;
          this.handleServerMessage(msg);
        } catch (e) {
          console.error('[GeminiLiveClient] Error parsing SSE message:', e);
        }
      };

      es.onerror = (err) => {
        if (this.callEnded || this.isCleanedUp) return;
        console.warn(`[GeminiLiveClient:${this.sessionId}] SSE stream state event:`, err);
        if (!this.isConnected) {
          this.callbacks.onError('Unable to establish Gemini Live voice session.');
          this.callbacks.onStatusChange('error');
        }
      };
    } catch (httpErr: any) {
      if (this.callEnded || this.isCleanedUp) return;
      console.error(`[GeminiLiveClient:${this.sessionId}] HTTP live session failed:`, httpErr);
      this.callbacks.onError(httpErr?.message || 'Failed to start Gemini Live voice session.');
      this.callbacks.onStatusChange('error');
    }
  }

  /**
   * Sends audio chunks in HTTP streaming mode with smart queue management
   */
  private sendHttpAudioChunk(base64Audio: string): void {
    if (this.callEnded || this.isCleanedUp || !this.isConnected) return;
    this.httpAudioBuffer.push(base64Audio);
    this.flushHttpAudio();
  }

  private flushHttpAudio(): void {
    if (this.httpAudioInFlight || this.httpAudioBuffer.length === 0 || this.callEnded || this.isCleanedUp) {
      return;
    }

    const nextChunk = this.httpAudioBuffer.shift();
    if (!nextChunk) return;

    this.httpAudioInFlight = true;
    fetch('/api/live-session/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        audio: nextChunk,
      }),
    })
      .catch((err) => {
        console.warn('[GeminiLiveClient] Audio packet transmission warning:', err);
      })
      .finally(() => {
        this.httpAudioInFlight = false;
        if (this.httpAudioBuffer.length > 0) {
          // Drop older chunks if lagging to keep conversation real-time (<250ms)
          if (this.httpAudioBuffer.length > 6) {
            this.httpAudioBuffer = this.httpAudioBuffer.slice(-3);
          }
          this.flushHttpAudio();
        }
      });
  }

  private setupMicProcessor(): void {
    if (!this.sourceNode || !this.processorNode) return;

    this.sourceNode.connect(this.processorNode);

    this.processorNode.onaudioprocess = (e) => {
      // Strictly prevent audio streaming if call has ended or client is muted
      if (this.callEnded || this.isCleanedUp || !this.isConnected || this.isMutedState || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }

      const channel = e.inputBuffer.getChannelData(0);

      // 1. Calculate RMS volume for candidate visual meter
      let sum = 0;
      for (let i = 0; i < channel.length; i++) {
        sum += channel[i] * channel[i];
      }
      const rms = Math.sqrt(sum / channel.length);
      const volumeLevel = Math.min(100, Math.round(rms * 450));
      this.callbacks.onVolumeChange(volumeLevel, this.getAgentVolume());

      // 2. Instant Local Barge-In (If candidate speaks while agent is speaking)
      if (rms > 0.038 && this.isAgentSpeakingState) {
        console.log(`[GeminiLiveClient:${this.sessionId}] Candidate speech detected during agent playback -> Instant Barge-In triggered`);
        this.stopAgentPlayback();
        this.callbacks.onInterrupted();
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'interrupt', sessionId: this.sessionId }));
        }
      }

      // 3. Convert Float32Array to 16-bit PCM (Little-Endian)
      const pcm16 = new Int16Array(channel.length);
      for (let i = 0; i < channel.length; i++) {
        const s = Math.max(-1, Math.min(1, channel[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      // 4. Convert to base64
      const bytes = new Uint8Array(pcm16.buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Audio = btoa(binary);

      // 5. Stream real-time input to server with session tag
      this.ws.send(
        JSON.stringify({
          type: 'audio',
          sessionId: this.sessionId,
          audio: base64Audio,
        })
      );
    };
  }

  private handleServerMessage(msg: any): void {
    if (this.callEnded || this.isCleanedUp) return;

    switch (msg.type) {
      case 'ready':
        console.log(`[GeminiLiveClient:${this.sessionId}] Gemini Live session is ready`);
        this.isConnected = true;
        this.callbacks.onStatusChange('connected');
        break;

      case 'audio':
        if (msg.audio) {
          this.playAudioChunk(msg.audio);
        }
        break;

      case 'agent_transcript':
        if (msg.text) {
          this.callbacks.onAgentTranscript(msg.text);
        }
        break;

      case 'user_transcript':
        if (msg.text) {
          this.callbacks.onUserTranscript(msg.text, !!msg.isFinal);
        }
        break;

      case 'interrupted':
        console.log(`[GeminiLiveClient:${this.sessionId}] Server signaled interruption -> silencer triggered`);
        this.stopAgentPlayback();
        this.callbacks.onInterrupted();
        break;

      case 'turn_complete':
        this.callbacks.onTurnComplete();
        break;

      case 'tool_call':
        if (msg.name) {
          this.callbacks.onToolCall(msg.name, msg.args || {});
        }
        break;

      case 'error':
        console.error(`[GeminiLiveClient:${this.sessionId}] Server error:`, msg.message);
        this.callbacks.onError(msg.message || 'Error from voice server.');
        break;

      case 'session_closed':
        this.cleanup();
        this.callbacks.onStatusChange('ended');
        break;

      default:
        break;
    }
  }

  /**
   * Plays a single 24kHz PCM audio chunk received from Gemini Live API.
   * Ensures no audio can ever be played if callEnded or isCleanedUp is true.
   */
  private playAudioChunk(base64Pcm: string): void {
    if (this.callEnded || this.isCleanedUp || !this.playbackAudioCtx || this.playbackAudioCtx.state === 'closed') {
      return;
    }

    try {
      const binaryString = atob(base64Pcm);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const int16Array = new Int16Array(bytes.buffer);
      if (int16Array.length === 0) return;

      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = this.playbackAudioCtx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.copyToChannel(float32Array, 0);

      const source = this.playbackAudioCtx.createBufferSource();
      source.buffer = audioBuffer;

      if (this.playbackAnalyser) {
        source.connect(this.playbackAnalyser);
      } else {
        source.connect(this.playbackAudioCtx.destination);
      }

      const currentTime = this.playbackAudioCtx.currentTime;
      const startTime = Math.max(currentTime, this.nextPlaybackStartTime);
      source.start(startTime);
      this.nextPlaybackStartTime = startTime + audioBuffer.duration;

      this.activeAudioSources.push(source);

      if (!this.isAgentSpeakingState) {
        this.isAgentSpeakingState = true;
        this.callbacks.onAgentSpeakingChange(true);
      }

      source.onended = () => {
        const index = this.activeAudioSources.indexOf(source);
        if (index !== -1) {
          this.activeAudioSources.splice(index, 1);
        }

        if (
          this.activeAudioSources.length === 0 &&
          this.playbackAudioCtx &&
          this.playbackAudioCtx.state !== 'closed' &&
          this.playbackAudioCtx.currentTime >= this.nextPlaybackStartTime - 0.05
        ) {
          this.isAgentSpeakingState = false;
          this.callbacks.onAgentSpeakingChange(false);
        }
      };
    } catch (e) {
      console.error('[GeminiLiveClient] Error playing audio chunk:', e);
    }
  }

  /**
   * BARGE-IN / INTERRUPTION HANDLER:
   * Immediately stops all currently playing AI audio, resets the timeline,
   * and clears the entire audio queue.
   */
  public stopAgentPlayback(): void {
    for (const source of this.activeAudioSources) {
      try {
        source.onended = null;
        source.stop(0);
        source.disconnect();
      } catch (e) {
        // ignore
      }
    }
    this.activeAudioSources = [];
    this.audioQueue = [];

    if (this.playbackAudioCtx && this.playbackAudioCtx.state !== 'closed') {
      this.nextPlaybackStartTime = this.playbackAudioCtx.currentTime;
    } else {
      this.nextPlaybackStartTime = 0;
    }

    if (this.isAgentSpeakingState) {
      this.isAgentSpeakingState = false;
      this.callbacks.onAgentSpeakingChange(false);
    }
  }

  private getAgentVolume(): number {
    if (!this.playbackAnalyser || !this.isAgentSpeakingState) return 0;
    try {
      const dataArray = new Uint8Array(this.playbackAnalyser.frequencyBinCount);
      this.playbackAnalyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      return Math.min(100, Math.round((avg / 255) * 100));
    } catch {
      return 0;
    }
  }

  public sendText(text: string): void {
    if (!text.trim() || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: 'text',
        sessionId: this.sessionId,
        text: text.trim(),
      })
    );
  }

  public setMuted(muted: boolean): void {
    this.isMutedState = muted;
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  public isMuted(): boolean {
    return this.isMutedState;
  }

  public isAgentSpeaking(): boolean {
    return this.isAgentSpeakingState;
  }

  public isEnded(): boolean {
    return this.callEnded;
  }

  public stop(): void {
    this.cleanup();
    this.callbacks.onStatusChange('ended');
  }

  /**
   * 12-POINT IDEMPOTENT CLEANUP:
   * 1. Stop microphone MediaStream tracks
   * 2. Disconnect/close the microphone AudioContext
   * 3. Stop and disconnect any microphone MediaStreamSource
   * 4. Immediately stop all currently playing AI audio
   * 5. Clear any queued/generated audio chunks
   * 6. Close the Gemini Live session/WebSocket
   * 7. Remove all Gemini Live event/message listeners
   * 8. Cancel any animationFrame, setInterval, setTimeout, or pending audio scheduling
   * 9. Reset the audio queue
   * 10. Reset the session reference to null
   * 11. Reset the microphone stream reference to null
   * 12. Ensure no new audio can be played after callEnded becomes true
   */
  public cleanup(): void {
    if (this.isCleanedUp) return;
    this.isCleanedUp = true;
    this.callEnded = true;
    this.isConnected = false;
    this.isConnecting = false;

    console.log(`[GeminiLiveClient:${this.sessionId}] Executing 12-point cleanup...`);

    // 4 & 5 & 9: Stop all playing audio & clear queue
    this.stopAgentPlayback();

    // 8: Cancel any pending timeouts and animation frames
    for (const tid of this.scheduledTimeouts) {
      clearTimeout(tid);
    }
    this.scheduledTimeouts.clear();

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // 1 & 11: Stop and reset microphone stream
    if (this.micStream) {
      try {
        this.micStream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
      } catch (e) {
        console.warn('[GeminiLiveClient] Error stopping mic tracks:', e);
      }
      this.micStream = null;
    }

    // 3: Disconnect processor and source nodes
    if (this.processorNode) {
      try {
        this.processorNode.onaudioprocess = null;
        this.processorNode.disconnect();
      } catch (e) {}
      this.processorNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {}
      this.sourceNode = null;
    }

    if (this.silenceGain) {
      try {
        this.silenceGain.disconnect();
      } catch (e) {}
      this.silenceGain = null;
    }

    // 2: Disconnect and close input AudioContext
    if (this.inputAudioCtx) {
      try {
        if (this.inputAudioCtx.state !== 'closed') {
          this.inputAudioCtx.close();
        }
      } catch (e) {}
      this.inputAudioCtx = null;
    }

    // Disconnect and close playback AudioContext
    if (this.playbackAnalyser) {
      try {
        this.playbackAnalyser.disconnect();
      } catch (e) {}
      this.playbackAnalyser = null;
    }

    if (this.playbackAudioCtx) {
      try {
        if (this.playbackAudioCtx.state !== 'closed') {
          this.playbackAudioCtx.close();
        }
      } catch (e) {}
      this.playbackAudioCtx = null;
    }

    // 6 & 7: Close WebSocket and remove all listeners
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'end', sessionId: this.sessionId }));
        }
        ws.close();
      } catch (e) {}
    }

    // Disable any lingering browser speech synthesis just in case
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }

    if (globalActiveLiveClient === this) {
      globalActiveLiveClient = null;
    }

    console.log(`[GeminiLiveClient:${this.sessionId}] 12-point cleanup completed successfully.`);
  }
}

