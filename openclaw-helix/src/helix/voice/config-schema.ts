/**
 * HELIX VOICE CONFIGURATION SCHEMA
 * TypeBox schema for voice configuration validation
 */

import { Type, type Static } from "@sinclair/typebox";

/**
 * Wake word configuration schema
 */
export const WakeWordConfigSchema = Type.Object({
  enabled: Type.Boolean({ default: true }),
  phrases: Type.Array(Type.String(), { default: ["helix", "hey helix"] }),
  sensitivity: Type.Number({ minimum: 0, maximum: 1, default: 0.5 }),
  backend: Type.Optional(Type.Union([Type.Literal("vosk"), Type.Literal("porcupine")])),
  modelPath: Type.Optional(Type.String()),
});

/**
 * Speech-to-text configuration schema
 */
export const STTConfigSchema = Type.Object({
  provider: Type.Union([
    Type.Literal("whisper-local"),
    Type.Literal("whisper-api"),
    Type.Literal("deepgram"),
    Type.Literal("assembly"),
  ], { default: "whisper-local" }),
  whisperLocal: Type.Optional(Type.Object({
    modelSize: Type.Union([
      Type.Literal("tiny"),
      Type.Literal("base"),
      Type.Literal("small"),
      Type.Literal("medium"),
      Type.Literal("large"),
    ], { default: "base" }),
    device: Type.Union([
      Type.Literal("cpu"),
      Type.Literal("cuda"),
      Type.Literal("mps"),
      Type.Literal("auto"),
    ], { default: "auto" }),
    language: Type.Optional(Type.String()),
  })),
  whisperApi: Type.Optional(Type.Object({
    model: Type.Optional(Type.String({ default: "whisper-1" })),
  })),
  deepgram: Type.Optional(Type.Object({
    model: Type.Union([
      Type.Literal("nova-2"),
      Type.Literal("enhanced"),
    ], { default: "nova-2" }),
  })),
});

/**
 * Text-to-speech configuration schema
 */
export const TTSConfigSchema = Type.Object({
  provider: Type.Union([
    Type.Literal("elevenlabs"),
    Type.Literal("openai"),
    Type.Literal("edge"),
    Type.Literal("system"),
  ], { default: "elevenlabs" }),
  elevenlabs: Type.Optional(Type.Object({
    voiceId: Type.String(),
    modelId: Type.String({ default: "eleven_multilingual_v2" }),
    stability: Type.Optional(Type.Number({ minimum: 0, maximum: 1, default: 0.5 })),
    similarityBoost: Type.Optional(Type.Number({ minimum: 0, maximum: 1, default: 0.75 })),
    style: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
    useSpeakerBoost: Type.Optional(Type.Boolean({ default: true })),
  })),
  openai: Type.Optional(Type.Object({
    voice: Type.Union([
      Type.Literal("alloy"),
      Type.Literal("echo"),
      Type.Literal("fable"),
      Type.Literal("onyx"),
      Type.Literal("nova"),
      Type.Literal("shimmer"),
    ], { default: "nova" }),
    model: Type.Union([
      Type.Literal("tts-1"),
      Type.Literal("tts-1-hd"),
    ], { default: "tts-1" }),
    speed: Type.Optional(Type.Number({ minimum: 0.25, maximum: 4, default: 1 })),
  })),
  edge: Type.Optional(Type.Object({
    voice: Type.String({ default: "en-US-JennyNeural" }),
    rate: Type.Optional(Type.String()),
    pitch: Type.Optional(Type.String()),
  })),
  system: Type.Optional(Type.Object({
    voice: Type.Optional(Type.String()),
    rate: Type.Optional(Type.Number()),
  })),
});

/**
 * Voice activity detection configuration schema
 */
export const VADConfigSchema = Type.Object({
  energyThreshold: Type.Number({ minimum: 0, maximum: 1, default: 0.01 }),
  silenceThresholdMs: Type.Number({ minimum: 100, maximum: 5000, default: 1500 }),
  speechMinMs: Type.Number({ minimum: 100, maximum: 5000, default: 250 }),
  adaptiveThreshold: Type.Boolean({ default: true }),
});

/**
 * Conversation configuration schema
 */
export const ConversationConfigSchema = Type.Object({
  mode: Type.Union([
    Type.Literal("wake-word"),
    Type.Literal("push-to-talk"),
    Type.Literal("always-on"),
    Type.Literal("off"),
  ], { default: "wake-word" }),
  autoStopAfterSeconds: Type.Number({ minimum: 5, maximum: 300, default: 30 }),
  interruptible: Type.Boolean({ default: true }),
  playConfirmationSound: Type.Boolean({ default: true }),
  greetOnStartup: Type.Boolean({ default: false }),
  greetingMessage: Type.Optional(Type.String()),
});

/**
 * Audio device configuration schema
 */
export const AudioConfigSchema = Type.Optional(Type.Object({
  inputDevice: Type.Optional(Type.String()),
  outputDevice: Type.Optional(Type.String()),
  sampleRate: Type.Optional(Type.Number({ default: 16000 })),
}));

/**
 * Complete voice configuration schema
 */
export const VoiceConfigSchema = Type.Object({
  enabled: Type.Boolean({ default: true }),
  wakeWord: Type.Optional(WakeWordConfigSchema),
  stt: Type.Optional(STTConfigSchema),
  tts: Type.Optional(TTSConfigSchema),
  vad: Type.Optional(VADConfigSchema),
  conversation: Type.Optional(ConversationConfigSchema),
  audio: AudioConfigSchema,
});

/**
 * Session sync configuration schema
 */
export const SyncConfigSchema = Type.Object({
  enabled: Type.Boolean({ default: false }),
  endpoint: Type.Optional(Type.String()),
  instanceKey: Type.Optional(Type.String()),
  intervalSeconds: Type.Number({ minimum: 10, maximum: 300, default: 30 }),
  conflictResolution: Type.Union([
    Type.Literal("local-wins"),
    Type.Literal("remote-wins"),
    Type.Literal("manual"),
    Type.Literal("merge"),
  ], { default: "local-wins" }),
});

/**
 * Helix extension configuration schema (to add to openclaw.json)
 */
export const HelixConfigSchema = Type.Object({
  voice: Type.Optional(VoiceConfigSchema),
  sync: Type.Optional(SyncConfigSchema),
});

// Type exports
export type WakeWordConfig = Static<typeof WakeWordConfigSchema>;
export type STTConfig = Static<typeof STTConfigSchema>;
export type TTSConfig = Static<typeof TTSConfigSchema>;
export type VADConfig = Static<typeof VADConfigSchema>;
export type ConversationConfig = Static<typeof ConversationConfigSchema>;
export type AudioConfig = Static<typeof AudioConfigSchema>;
export type VoiceConfig = Static<typeof VoiceConfigSchema>;
export type SyncConfig = Static<typeof SyncConfigSchema>;
export type HelixConfig = Static<typeof HelixConfigSchema>;

/**
 * Default configuration values
 */
export const DEFAULT_HELIX_CONFIG: HelixConfig = {
  voice: {
    enabled: true,
    wakeWord: {
      enabled: true,
      phrases: ["helix", "hey helix"],
      sensitivity: 0.5,
    },
    stt: {
      provider: "whisper-local",
      whisperLocal: {
        modelSize: "base",
        device: "auto",
      },
    },
    tts: {
      provider: "elevenlabs",
      elevenlabs: {
        voiceId: "",
        modelId: "eleven_multilingual_v2",
        stability: 0.5,
        similarityBoost: 0.75,
      },
    },
    vad: {
      energyThreshold: 0.01,
      silenceThresholdMs: 1500,
      speechMinMs: 250,
      adaptiveThreshold: true,
    },
    conversation: {
      mode: "wake-word",
      autoStopAfterSeconds: 30,
      interruptible: true,
      playConfirmationSound: true,
      greetOnStartup: false,
    },
  },
  sync: {
    enabled: false,
    intervalSeconds: 30,
    conflictResolution: "local-wins",
  },
};
