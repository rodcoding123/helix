/**
 * HELIX VOICE ENGINE TYPE DEFINITIONS
 * Types for the real-time voice conversation system
 */

/**
 * Voice engine state machine states
 */
export type VoiceState = "idle" | "listening" | "processing" | "thinking" | "speaking";

/**
 * Voice conversation modes
 */
export type VoiceMode = "wake-word" | "push-to-talk" | "always-on" | "off";

/**
 * Speech-to-Text provider options
 */
export type STTProvider = "whisper-local" | "whisper-api" | "deepgram" | "assembly";

/**
 * Text-to-Speech provider options
 */
export type TTSProvider = "elevenlabs" | "openai" | "edge" | "system";

/**
 * Whisper model sizes (local inference)
 */
export type WhisperModelSize = "tiny" | "base" | "small" | "medium" | "large";

/**
 * Compute device for local inference
 */
export type ComputeDevice = "cpu" | "cuda" | "mps" | "auto";

/**
 * OpenAI TTS voice options
 */
export type OpenAITTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

/**
 * Speech-to-Text configuration
 */
export interface STTConfig {
  provider: STTProvider;

  /** Whisper Local configuration */
  whisperLocal?: {
    modelSize: WhisperModelSize;
    device: ComputeDevice;
    language?: string; // e.g., 'en', 'es', 'auto'
  };

  /** Whisper API configuration (OpenAI) */
  whisperApi?: {
    apiKey?: string; // Falls back to OPENAI_API_KEY env var
    language?: string;
  };

  /** Deepgram configuration */
  deepgram?: {
    apiKey: string;
    model: "nova-2" | "enhanced";
    language?: string;
  };

  /** AssemblyAI configuration */
  assembly?: {
    apiKey: string;
    model?: string;
  };
}

/**
 * Text-to-Speech configuration
 */
export interface TTSConfig {
  provider: TTSProvider;

  /** ElevenLabs configuration (highest quality) */
  elevenlabs?: {
    apiKey?: string; // Falls back to ELEVENLABS_API_KEY env var
    voiceId: string;
    modelId?: string; // Default: 'eleven_v3'
    stability?: number; // 0-1, default: 0.5
    similarityBoost?: number; // 0-1, default: 0.75
    style?: number; // 0-1, default: 0
    speakerBoost?: boolean;
  };

  /** OpenAI TTS configuration */
  openai?: {
    apiKey?: string; // Falls back to OPENAI_API_KEY env var
    voice: OpenAITTSVoice;
    model?: "tts-1" | "tts-1-hd"; // Default: 'tts-1'
    speed?: number; // 0.25-4.0, default: 1.0
  };

  /** Edge TTS configuration (free, Microsoft Azure) */
  edge?: {
    voice: string; // e.g., 'en-US-JennyNeural'
    rate?: string; // e.g., '+10%', '-20%'
    pitch?: string; // e.g., '+5Hz', '-10Hz'
  };

  /** System TTS configuration (OS native) */
  system?: {
    voice?: string; // System voice name
    rate?: number; // Speaking rate multiplier
  };
}

/**
 * Wake word detection configuration
 */
export interface WakeWordConfig {
  enabled: boolean;
  phrases: string[]; // e.g., ['helix', 'hey helix']
  sensitivity: number; // 0-1, lower = more sensitive but more false positives
  backend?: "porcupine" | "vosk" | "custom" | "simple";
  customModelPath?: string;
}

/**
 * Voice Activity Detection (VAD) configuration
 */
export interface VADConfig {
  /** Silence duration (ms) to trigger speech end */
  silenceThreshold: number; // Default: 1000ms

  /** Minimum speech duration (ms) to process */
  minSpeechDuration: number; // Default: 300ms

  /** Energy threshold for voice detection */
  energyThreshold: number; // Default: 0.01

  /** Backend for VAD */
  backend?: "webrtc" | "silero" | "energy";
}

/**
 * Voice conversation settings
 */
export interface ConversationConfig {
  /** Voice mode */
  mode: VoiceMode;

  /** Auto-stop listening after N seconds of no speech */
  autoStopAfterSeconds: number; // Default: 30

  /** Allow user to interrupt while Helix is speaking */
  interruptible: boolean; // Default: true

  /** Confirmation sound when wake word detected */
  playConfirmationSound: boolean; // Default: true

  /** Play typing sound while processing */
  playTypingSound: boolean; // Default: false

  /** Greeting on startup */
  greetOnStartup: boolean; // Default: false
  greetingMessage?: string;
}

/**
 * Complete voice engine configuration
 */
export interface VoiceConfig {
  /** Enable voice engine */
  enabled: boolean;

  /** Wake word detection */
  wakeWord: WakeWordConfig;

  /** Speech-to-Text */
  stt: STTConfig;

  /** Text-to-Speech */
  tts: TTSConfig;

  /** Voice Activity Detection */
  vad: VADConfig;

  /** Conversation settings */
  conversation: ConversationConfig;

  /** Audio device preferences */
  audio?: {
    inputDevice?: string; // Specific mic device ID
    outputDevice?: string; // Specific speaker device ID
    sampleRate?: number; // Default: 16000 for STT, 24000 for TTS
  };
}

/**
 * Default voice configuration
 */
export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  enabled: true,

  wakeWord: {
    enabled: true,
    phrases: ["helix", "hey helix"],
    sensitivity: 0.5,
    backend: "vosk",
  },

  stt: {
    provider: "whisper-local",
    whisperLocal: {
      modelSize: "base",
      device: "auto",
      language: "en",
    },
  },

  tts: {
    provider: "elevenlabs",
    elevenlabs: {
      voiceId: "21m00Tcm4TlvDq8ikWAM", // Default: Rachel
      modelId: "eleven_v3",
      stability: 0.5,
      similarityBoost: 0.75,
    },
  },

  vad: {
    silenceThreshold: 1000,
    minSpeechDuration: 300,
    energyThreshold: 0.01,
    backend: "energy",
  },

  conversation: {
    mode: "wake-word",
    autoStopAfterSeconds: 30,
    interruptible: true,
    playConfirmationSound: true,
    playTypingSound: false,
    greetOnStartup: false,
  },
};

/**
 * Voice transcript from STT
 */
export interface VoiceTranscript {
  text: string;
  confidence?: number;
  language?: string;
  duration: number; // ms
  timestamp: Date;
  isFinal: boolean;
}

/**
 * Audio chunk for streaming
 */
export interface AudioChunk {
  data: Buffer | Float32Array;
  sampleRate: number;
  channels: number;
  timestamp: number;
}

/**
 * Voice engine events
 */
export interface VoiceEngineEvents {
  "state:change": { from: VoiceState; to: VoiceState };
  "wake-word:detected": { phrase: string; confidence: number };
  "speech:start": { timestamp: number };
  "speech:end": { duration: number };
  "transcript:partial": { text: string };
  "transcript:final": VoiceTranscript;
  "tts:start": { text: string };
  "tts:chunk": { audio: AudioChunk };
  "tts:end": { duration: number };
  "audio:level": { level: number; timestamp: number };
  error: { code: string; message: string; details?: unknown };
}

/**
 * Voice engine statistics
 */
export interface VoiceStats {
  state: VoiceState;
  mode: VoiceMode;
  uptime: number; // ms since engine started
  transcriptCount: number;
  totalSpeechDuration: number; // ms
  totalTTSDuration: number; // ms
  wakeWordDetections: number;
  errors: number;
  lastActivity: Date | null;
}

/**
 * Audio device information
 */
export interface AudioDevice {
  id: string;
  name: string;
  kind: "audioinput" | "audiooutput";
  isDefault: boolean;
  sampleRate?: number;
  channels?: number;
}