/**
 * HELIX VOICE ENGINE - VOICE ACTIVITY DETECTION (VAD)
 * Detects when speech starts and ends in audio stream
 */

import { EventEmitter } from "events";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { AudioChunk, VADConfig } from "./types.js";

const log = createSubsystemLogger("helix:voice:vad");

/**
 * Voice Activity Detection states
 */
type VADState = "silence" | "speech" | "maybe-speech" | "maybe-silence";

/**
 * Energy-based Voice Activity Detector
 * Simple but effective for most use cases
 */
export class VoiceActivityDetector extends EventEmitter {
  private config: VADConfig;
  private state: VADState = "silence";
  private speechBuffer: AudioChunk[] = [];
  private speechStartTime: number = 0;
  private silenceStartTime: number = 0;
  private lastEnergyLevel: number = 0;
  private energyHistory: number[] = [];
  private adaptiveThreshold: number;

  // Timing constants
  private readonly SPEECH_CONFIRM_MS = 100; // Time to confirm speech started
  private readonly SILENCE_CONFIRM_MS: number; // Time to confirm speech ended
  private readonly MIN_SPEECH_MS: number; // Minimum speech duration to process

  constructor(config: Partial<VADConfig> = {}) {
    super();

    this.config = {
      silenceThreshold: config.silenceThreshold ?? 1000,
      minSpeechDuration: config.minSpeechDuration ?? 300,
      energyThreshold: config.energyThreshold ?? 0.01,
      backend: config.backend ?? "energy",
    };

    this.SILENCE_CONFIRM_MS = this.config.silenceThreshold;
    this.MIN_SPEECH_MS = this.config.minSpeechDuration;
    this.adaptiveThreshold = this.config.energyThreshold;

    log.info("VAD initialized", { config: this.config });
  }

  /**
   * Process audio chunk and detect voice activity
   */
  processChunk(chunk: AudioChunk): void {
    const energy = this.calculateEnergy(chunk);
    this.lastEnergyLevel = energy;

    // Update energy history for adaptive threshold
    this.energyHistory.push(energy);
    if (this.energyHistory.length > 50) {
      this.energyHistory.shift();
    }

    // Emit audio level for visualization
    this.emit("level", { level: energy, timestamp: chunk.timestamp });

    const isSpeech = energy > this.adaptiveThreshold;
    const now = Date.now();

    switch (this.state) {
      case "silence":
        if (isSpeech) {
          this.state = "maybe-speech";
          this.speechStartTime = now;
          this.speechBuffer = [chunk];
          log.debug("Possible speech start detected");
        }
        break;

      case "maybe-speech":
        this.speechBuffer.push(chunk);
        if (isSpeech) {
          if (now - this.speechStartTime >= this.SPEECH_CONFIRM_MS) {
            // Confirmed speech
            this.state = "speech";
            log.info("Speech confirmed");
            this.emit("speech:start", {
              timestamp: this.speechStartTime,
              bufferedChunks: this.speechBuffer.length,
            });
          }
        } else {
          // False positive, go back to silence
          this.state = "silence";
          this.speechBuffer = [];
          log.debug("False positive speech detection");
        }
        break;

      case "speech":
        this.speechBuffer.push(chunk);
        if (!isSpeech) {
          this.state = "maybe-silence";
          this.silenceStartTime = now;
          log.debug("Possible speech end detected");
        }
        break;

      case "maybe-silence":
        this.speechBuffer.push(chunk);
        if (isSpeech) {
          // Still speaking, false alarm
          this.state = "speech";
          log.debug("False alarm, still speaking");
        } else if (now - this.silenceStartTime >= this.SILENCE_CONFIRM_MS) {
          // Confirmed silence - speech ended
          const speechDuration = now - this.speechStartTime;

          if (speechDuration >= this.MIN_SPEECH_MS) {
            log.info(`Speech ended, duration: ${speechDuration}ms`);
            this.emit("speech:end", {
              duration: speechDuration,
              chunks: this.speechBuffer,
              startTime: this.speechStartTime,
            });
          } else {
            log.debug(`Speech too short (${speechDuration}ms), ignoring`);
          }

          this.state = "silence";
          this.speechBuffer = [];
        }
        break;
    }

    // Update adaptive threshold based on ambient noise
    this.updateAdaptiveThreshold();
  }

  /**
   * Calculate RMS energy of audio chunk
   */
  private calculateEnergy(chunk: AudioChunk): number {
    let sum = 0;
    let samples: number[];

    if (Buffer.isBuffer(chunk.data)) {
      // Convert 16-bit PCM buffer to samples
      samples = [];
      for (let i = 0; i < chunk.data.length - 1; i += 2) {
        const sample = chunk.data.readInt16LE(i) / 32768; // Normalize to -1..1
        samples.push(sample);
      }
    } else {
      // Already Float32Array
      samples = Array.from(chunk.data);
    }

    for (const sample of samples) {
      sum += sample * sample;
    }

    const rms = Math.sqrt(sum / samples.length);
    return rms;
  }

  /**
   * Update adaptive threshold based on ambient noise
   */
  private updateAdaptiveThreshold(): void {
    if (this.energyHistory.length < 10) return;
    if (this.state !== "silence") return;

    // Calculate noise floor from recent silence
    const sortedEnergy = [...this.energyHistory].sort((a, b) => a - b);
    const noiseFloor = sortedEnergy[Math.floor(sortedEnergy.length * 0.2)]; // 20th percentile

    // Set threshold above noise floor
    const newThreshold = Math.max(this.config.energyThreshold, noiseFloor * 2);

    if (Math.abs(newThreshold - this.adaptiveThreshold) > 0.001) {
      this.adaptiveThreshold = newThreshold;
      log.debug(`Adaptive threshold updated: ${newThreshold.toFixed(4)}`);
    }
  }

  /**
   * Reset VAD state
   */
  reset(): void {
    this.state = "silence";
    this.speechBuffer = [];
    this.speechStartTime = 0;
    this.silenceStartTime = 0;
    this.energyHistory = [];
    this.adaptiveThreshold = this.config.energyThreshold;
    log.info("VAD reset");
  }

  /**
   * Get current state
   */
  getState(): { state: VADState; isSpeaking: boolean; energy: number } {
    return {
      state: this.state,
      isSpeaking: this.state === "speech" || this.state === "maybe-speech",
      energy: this.lastEnergyLevel,
    };
  }

  /**
   * Get buffered speech chunks (while speech is ongoing)
   */
  getSpeechBuffer(): AudioChunk[] {
    return [...this.speechBuffer];
  }

  /**
   * Force end of speech (for timeout scenarios)
   */
  forceEndSpeech(): void {
    if (this.state === "speech" || this.state === "maybe-speech") {
      const speechDuration = Date.now() - this.speechStartTime;

      if (speechDuration >= this.MIN_SPEECH_MS) {
        log.info(`Force ending speech, duration: ${speechDuration}ms`);
        this.emit("speech:end", {
          duration: speechDuration,
          chunks: this.speechBuffer,
          startTime: this.speechStartTime,
          forced: true,
        });
      }

      this.state = "silence";
      this.speechBuffer = [];
    }
  }
}

/**
 * Create a combined audio buffer from chunks
 */
export function combineAudioChunks(chunks: AudioChunk[]): Buffer {
  if (chunks.length === 0) {
    return Buffer.alloc(0);
  }

  const totalLength = chunks.reduce((sum, chunk) => {
    if (Buffer.isBuffer(chunk.data)) {
      return sum + chunk.data.length;
    }
    return sum + chunk.data.length * 2; // Float32 to 16-bit
  }, 0);

  const result = Buffer.alloc(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    if (Buffer.isBuffer(chunk.data)) {
      chunk.data.copy(result, offset);
      offset += chunk.data.length;
    } else {
      // Convert Float32Array to 16-bit PCM
      for (let i = 0; i < chunk.data.length; i++) {
        const sample = Math.max(-1, Math.min(1, chunk.data[i]));
        const intSample = Math.round(sample * 32767);
        result.writeInt16LE(intSample, offset);
        offset += 2;
      }
    }
  }

  return result;
}

/**
 * Convert audio buffer to WAV format
 */
export function toWavBuffer(pcmBuffer: Buffer, sampleRate: number, channels: number = 1): Buffer {
  const bytesPerSample = 2; // 16-bit
  const dataSize = pcmBuffer.length;
  const headerSize = 44;
  const fileSize = dataSize + headerSize;

  const wav = Buffer.alloc(fileSize);

  // RIFF header
  wav.write("RIFF", 0);
  wav.writeUInt32LE(fileSize - 8, 4);
  wav.write("WAVE", 8);

  // fmt chunk
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16); // Chunk size
  wav.writeUInt16LE(1, 20); // Audio format (PCM)
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * channels * bytesPerSample, 28); // Byte rate
  wav.writeUInt16LE(channels * bytesPerSample, 32); // Block align
  wav.writeUInt16LE(bytesPerSample * 8, 34); // Bits per sample

  // data chunk
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(wav, headerSize);

  return wav;
}
