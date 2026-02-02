/**
 * HELIX VOICE ENGINE
 * Real-time voice conversation system for Helix
 *
 * State Machine:
 *   IDLE → LISTENING → PROCESSING → THINKING → SPEAKING → IDLE
 *
 * Usage:
 * ```typescript
 * import { VoiceEngine } from './helix/voice/index.js';
 *
 * const voice = new VoiceEngine(config);
 * await voice.initialize();
 *
 * voice.on('transcript', async (transcript) => {
 *   const response = await processWithClaude(transcript.text);
 *   await voice.speak(response);
 * });
 *
 * await voice.start();
 * ```
 */

import { EventEmitter } from "events";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import {
  type VoiceConfig,
  type VoiceState,
  type VoiceMode,
  type VoiceStats,
  type VoiceTranscript,
  type AudioChunk,
  type VoiceEngineEvents,
  DEFAULT_VOICE_CONFIG,
} from "./types.js";
import { AudioRecorder, AudioPlayer, isAudioAvailable } from "./audio-devices.js";
import { VoiceActivityDetector, combineAudioChunks, toWavBuffer } from "./voice-activity.js";
import { WakeWordDetector, playConfirmationSound } from "./wake-word.js";
import { SpeechToText } from "./speech-to-text.js";
import { TextToSpeech } from "./text-to-speech.js";

const log = createSubsystemLogger("helix:voice");

// Re-export types and utilities
export * from "./types.js";
export { AudioRecorder, AudioPlayer, listAudioDevices, isAudioAvailable } from "./audio-devices.js";
export { VoiceActivityDetector, combineAudioChunks, toWavBuffer } from "./voice-activity.js";
export { WakeWordDetector, playConfirmationSound } from "./wake-word.js";
export { SpeechToText } from "./speech-to-text.js";
export { TextToSpeech, listElevenLabsVoices } from "./text-to-speech.js";

/**
 * Main Voice Engine class
 * Orchestrates all voice components with a state machine
 */
export class VoiceEngine extends EventEmitter {
  private config: VoiceConfig;
  private state: VoiceState = "idle";
  private mode: VoiceMode;

  // Components
  private recorder: AudioRecorder | null = null;
  private player: AudioPlayer | null = null;
  private vad: VoiceActivityDetector | null = null;
  private wakeWord: WakeWordDetector | null = null;
  private stt: SpeechToText | null = null;
  private tts: TextToSpeech | null = null;

  // State tracking
  private startTime: number = 0;
  private stats: VoiceStats;
  private autoStopTimer: NodeJS.Timeout | null = null;
  private speechBuffer: AudioChunk[] = [];

  // Callbacks for external processing
  private onTranscriptCallback: ((transcript: VoiceTranscript) => Promise<string>) | null = null;

  constructor(config: Partial<VoiceConfig> = {}) {
    super();

    // Merge with defaults
    this.config = {
      enabled: config.enabled ?? true,
      wakeWord: { ...DEFAULT_VOICE_CONFIG.wakeWord, ...config.wakeWord },
      stt: { ...DEFAULT_VOICE_CONFIG.stt, ...config.stt },
      tts: { ...DEFAULT_VOICE_CONFIG.tts, ...config.tts },
      vad: { ...DEFAULT_VOICE_CONFIG.vad, ...config.vad },
      conversation: { ...DEFAULT_VOICE_CONFIG.conversation, ...config.conversation },
      audio: config.audio,
    };

    this.mode = this.config.conversation.mode;

    this.stats = {
      state: "idle",
      mode: this.mode,
      uptime: 0,
      transcriptCount: 0,
      totalSpeechDuration: 0,
      totalTTSDuration: 0,
      wakeWordDetections: 0,
      errors: 0,
      lastActivity: null,
    };

    log.info("Voice engine created", {
      mode: this.mode,
      sttProvider: this.config.stt.provider,
      ttsProvider: this.config.tts.provider,
    });
  }

  /**
   * Initialize voice engine components
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      log.info("Voice engine disabled");
      return;
    }

    // Check audio availability
    const audioAvailable = await isAudioAvailable();
    if (!audioAvailable) {
      log.warn("Audio tools not available. Voice features will be limited.");
    }

    // Initialize STT
    this.stt = new SpeechToText(this.config.stt);
    await this.stt.initialize();

    // Initialize TTS
    this.tts = new TextToSpeech(this.config.tts);

    // Initialize VAD
    this.vad = new VoiceActivityDetector(this.config.vad);
    this.setupVADListeners();

    // Initialize wake word detector
    if (this.config.wakeWord.enabled && this.mode === "wake-word") {
      this.wakeWord = new WakeWordDetector(this.config.wakeWord);
      this.setupWakeWordListeners();
    }

    // Initialize audio devices
    this.recorder = new AudioRecorder({
      sampleRate: 16000,
      deviceId: this.config.audio?.inputDevice,
    });
    this.setupRecorderListeners();

    this.player = new AudioPlayer({
      sampleRate: 24000,
      deviceId: this.config.audio?.outputDevice,
    });

    this.startTime = Date.now();
    log.info("Voice engine initialized");
  }

  /**
   * Start the voice engine
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      log.warn("Voice engine is disabled");
      return;
    }

    if (this.state !== "idle") {
      log.warn(`Cannot start: already in state ${this.state}`);
      return;
    }

    log.info(`Starting voice engine in ${this.mode} mode`);

    switch (this.mode) {
      case "wake-word":
        // Start wake word detection (always listening for trigger)
        await this.wakeWord?.start();
        break;

      case "always-on":
        // Start recording immediately
        await this.startListening();
        break;

      case "push-to-talk":
        // Wait for startListening() to be called manually
        log.info("Push-to-talk mode: call startListening() to begin");
        break;

      case "off":
        log.info("Voice mode is off");
        break;
    }

    // Greeting on startup
    if (this.config.conversation.greetOnStartup && this.config.conversation.greetingMessage) {
      await this.speak(this.config.conversation.greetingMessage);
    }

    this.emit("start");
  }

  /**
   * Stop the voice engine
   */
  async stop(): Promise<void> {
    log.info("Stopping voice engine");

    // Stop all components
    this.recorder?.stop();
    this.wakeWord?.stop();
    this.tts?.stop();
    this.player?.stop();

    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = null;
    }

    this.transitionTo("idle");
    this.emit("stop");
  }

  /**
   * Start listening for speech
   */
  async startListening(): Promise<void> {
    if (this.state === "listening") {
      return;
    }

    if (this.state === "speaking") {
      // Interrupt TTS
      this.tts?.stop();
      this.player?.stop();
    }

    log.info("Starting to listen");
    this.transitionTo("listening");

    // Play confirmation sound
    if (this.config.conversation.playConfirmationSound) {
      playConfirmationSound();
    }

    // Start recording
    await this.recorder?.start();

    // Start auto-stop timer
    this.resetAutoStopTimer();

    this.emit("listening:start");
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    if (this.state !== "listening") {
      return;
    }

    log.info("Stopping listening");
    this.recorder?.stop();

    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = null;
    }

    // Process any buffered speech
    if (this.speechBuffer.length > 0) {
      this.processSpeech(this.speechBuffer);
      this.speechBuffer = [];
    } else {
      this.transitionTo("idle");
    }

    this.emit("listening:stop");
  }

  /**
   * Speak text (TTS)
   */
  async speak(text: string): Promise<void> {
    if (!text.trim()) {
      return;
    }

    if (!this.tts) {
      log.warn("TTS not initialized");
      return;
    }

    log.info(`Speaking: "${text.substring(0, 50)}..."`);
    this.transitionTo("speaking");
    this.emit("speaking:start", { text });

    const startTime = Date.now();

    try {
      // Stream TTS for real-time playback
      for await (const chunk of this.tts.stream(text)) {
        if (this.state !== "speaking") {
          // Interrupted
          break;
        }
        await this.player?.streamChunk(chunk);
      }

      this.player?.endStream();

      const duration = Date.now() - startTime;
      this.stats.totalTTSDuration += duration;
      this.stats.lastActivity = new Date();

      log.info(`Speaking complete (${duration}ms)`);
    } catch (err) {
      log.error("TTS error:", { error: String(err) });
      this.stats.errors++;
      this.emit("error", { code: "TTS_ERROR", message: String(err) });
    }

    // Return to appropriate state
    if (this.mode === "always-on") {
      await this.startListening();
    } else {
      this.transitionTo("idle");
    }

    this.emit("speaking:end", { duration: Date.now() - startTime });
  }

  /**
   * Set callback for processing transcripts
   * Return the response text to be spoken
   */
  onTranscript(callback: (transcript: VoiceTranscript) => Promise<string>): void {
    this.onTranscriptCallback = callback;
  }

  /**
   * Set voice mode
   */
  setMode(mode: VoiceMode): void {
    if (this.mode === mode) return;

    log.info(`Changing voice mode: ${this.mode} → ${mode}`);
    const oldMode = this.mode;
    this.mode = mode;
    this.stats.mode = mode;

    // Adjust running state
    if (oldMode === "wake-word" && mode !== "wake-word") {
      this.wakeWord?.stop();
    } else if (mode === "wake-word" && this.config.wakeWord.enabled) {
      this.wakeWord?.start();
    }

    if (mode === "always-on" && this.state === "idle") {
      this.startListening();
    } else if (mode === "off") {
      this.stop();
    }

    this.emit("mode:change", { from: oldMode, to: mode });
  }

  /**
   * Get current state
   */
  getState(): VoiceState {
    return this.state;
  }

  /**
   * Get voice statistics
   */
  getStats(): VoiceStats {
    return {
      ...this.stats,
      state: this.state,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Check if voice engine is available
   */
  async isAvailable(): Promise<boolean> {
    const audioOk = await isAudioAvailable();
    const ttsOk = await this.tts?.isAvailable();
    return audioOk && Boolean(ttsOk);
  }

  // ==================== Private Methods ====================

  /**
   * Transition to new state
   */
  private transitionTo(newState: VoiceState): void {
    if (this.state === newState) return;

    const oldState = this.state;
    this.state = newState;
    this.stats.state = newState;

    log.debug(`State: ${oldState} → ${newState}`);
    this.emit("state:change", { from: oldState, to: newState });
  }

  /**
   * Setup recorder event listeners
   */
  private setupRecorderListeners(): void {
    if (!this.recorder) return;

    this.recorder.on("data", (chunk: AudioChunk) => {
      // Feed to VAD
      this.vad?.processChunk(chunk);

      // Feed to wake word detector (if in wake-word mode and idle)
      if (this.mode === "wake-word" && this.state === "idle") {
        this.wakeWord?.processChunk(chunk);
      }
    });

    this.recorder.on("error", (err) => {
      log.error("Recorder error:", err);
      this.stats.errors++;
      this.emit("error", { code: "RECORDER_ERROR", message: String(err) });
    });
  }

  /**
   * Setup VAD event listeners
   */
  private setupVADListeners(): void {
    if (!this.vad) return;

    this.vad.on("speech:start", () => {
      if (this.state === "listening") {
        log.debug("Speech started");
        this.speechBuffer = [];
        this.resetAutoStopTimer();
        this.emit("speech:start", { timestamp: Date.now() });
      }
    });

    this.vad.on("speech:end", (event: { chunks: AudioChunk[]; duration: number }) => {
      if (this.state === "listening") {
        log.debug(`Speech ended (${event.duration}ms)`);
        this.speechBuffer = event.chunks;
        this.processSpeech(event.chunks);
        this.emit("speech:end", { duration: event.duration });
      }
    });

    this.vad.on("level", (event: { level: number }) => {
      this.emit("audio:level", event);
    });
  }

  /**
   * Setup wake word event listeners
   */
  private setupWakeWordListeners(): void {
    if (!this.wakeWord) return;

    this.wakeWord.on("detected", (event: { phrase: string; confidence: number }) => {
      log.info(`Wake word detected: "${event.phrase}"`);
      this.stats.wakeWordDetections++;
      this.emit("wake-word:detected", event);

      // Start listening
      this.startListening();
    });
  }

  /**
   * Process captured speech through STT and callback
   */
  private async processSpeech(chunks: AudioChunk[]): Promise<void> {
    if (chunks.length === 0) {
      this.transitionTo(this.mode === "always-on" ? "listening" : "idle");
      return;
    }

    this.transitionTo("processing");
    log.info(`Processing speech (${chunks.length} chunks)`);

    try {
      // Transcribe with STT
      const transcript = await this.stt!.transcribe(chunks);

      if (!transcript.text.trim()) {
        log.debug("Empty transcript, returning to listening");
        if (this.mode === "always-on") {
          await this.startListening();
        } else {
          this.transitionTo("idle");
        }
        return;
      }

      this.stats.transcriptCount++;
      this.stats.totalSpeechDuration += transcript.duration;
      this.stats.lastActivity = new Date();

      log.info(`Transcript: "${transcript.text}"`);
      this.emit("transcript:final", transcript);

      // Process with callback if set
      if (this.onTranscriptCallback) {
        this.transitionTo("thinking");
        this.emit("thinking:start");

        const response = await this.onTranscriptCallback(transcript);

        this.emit("thinking:end");

        if (response) {
          await this.speak(response);
        }
      }
    } catch (err) {
      log.error("Speech processing error:", { error: String(err) });
      this.stats.errors++;
      this.emit("error", { code: "PROCESSING_ERROR", message: String(err) });
      this.transitionTo(this.mode === "always-on" ? "listening" : "idle");
    }
  }

  /**
   * Reset auto-stop timer
   */
  private resetAutoStopTimer(): void {
    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer);
    }

    if (this.config.conversation.autoStopAfterSeconds > 0) {
      this.autoStopTimer = setTimeout(() => {
        log.info("Auto-stop timeout reached");
        this.stopListening();
      }, this.config.conversation.autoStopAfterSeconds * 1000);
    }
  }
}

/**
 * Create and initialize a voice engine
 */
export async function createVoiceEngine(config?: Partial<VoiceConfig>): Promise<VoiceEngine> {
  const engine = new VoiceEngine(config);
  await engine.initialize();
  return engine;
}

