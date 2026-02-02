/**
 * HELIX VOICE ENGINE - TEXT TO SPEECH
 * Converts text to speech using ElevenLabs or other providers
 */

import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { TTSConfig, AudioChunk } from "./types.js";

const log = createSubsystemLogger("helix:voice:tts");

/**
 * Text-to-Speech engine with streaming support
 */
export class TextToSpeech extends EventEmitter {
  private config: TTSConfig;
  private isStreaming = false;
  private abortController: AbortController | null = null;

  constructor(config: Partial<TTSConfig> = {}) {
    super();

    this.config = {
      provider: config.provider ?? "elevenlabs",
      elevenlabs: config.elevenlabs ?? {
        voiceId: "21m00Tcm4TlvDq8ikWAM", // Default: Rachel
        modelId: "eleven_v3",
        stability: 0.5,
        similarityBoost: 0.75,
      },
      openai: config.openai,
      edge: config.edge,
      system: config.system,
    };

    log.info("TTS initialized", { provider: this.config.provider });
  }

  /**
   * Synthesize text to audio with streaming
   * Emits 'chunk' events with audio data as it's generated
   */
  async synthesize(text: string): Promise<Buffer> {
    if (!text.trim()) {
      return Buffer.alloc(0);
    }

    this.abortController = new AbortController();

    try {
      switch (this.config.provider) {
        case "elevenlabs":
          return await this.synthesizeWithElevenLabs(text);
        case "openai":
          return await this.synthesizeWithOpenAI(text);
        case "edge":
          return await this.synthesizeWithEdge(text);
        case "system":
          return await this.synthesizeWithSystem(text);
        default:
          throw new Error(`Unknown TTS provider: ${this.config.provider}`);
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Stream text to speech (for real-time playback)
   */
  async *stream(text: string): AsyncGenerator<AudioChunk> {
    if (!text.trim()) {
      return;
    }

    this.isStreaming = true;
    this.abortController = new AbortController();

    try {
      switch (this.config.provider) {
        case "elevenlabs":
          yield* this.streamElevenLabs(text);
          break;
        case "openai":
          // OpenAI TTS doesn't support streaming, fall back to full synthesis
          const buffer = await this.synthesizeWithOpenAI(text);
          yield {
            data: buffer,
            sampleRate: 24000,
            channels: 1,
            timestamp: Date.now(),
          };
          break;
        default:
          // Other providers: synthesize then yield
          const audio = await this.synthesize(text);
          yield {
            data: audio,
            sampleRate: 24000,
            channels: 1,
            timestamp: Date.now(),
          };
      }
    } finally {
      this.isStreaming = false;
      this.abortController = null;
    }
  }

  /**
   * ElevenLabs streaming TTS
   */
  private async *streamElevenLabs(text: string): AsyncGenerator<AudioChunk> {
    const apiKey = this.config.elevenlabs?.apiKey ?? process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY env var.");
    }

    const voiceId = this.config.elevenlabs?.voiceId ?? "21m00Tcm4TlvDq8ikWAM";
    const modelId = this.config.elevenlabs?.modelId ?? "eleven_v3";

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;

    log.debug(`ElevenLabs TTS: "${text.substring(0, 50)}..."`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: this.config.elevenlabs?.stability ?? 0.5,
          similarity_boost: this.config.elevenlabs?.similarityBoost ?? 0.75,
          style: this.config.elevenlabs?.style ?? 0,
          use_speaker_boost: this.config.elevenlabs?.speakerBoost ?? true,
        },
      }),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} ${error}`);
    }

    if (!response.body) {
      throw new Error("No response body from ElevenLabs");
    }

    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Emit chunk for real-time playback
      yield {
        data: Buffer.from(value),
        sampleRate: 44100, // ElevenLabs streams MP3 at 44.1kHz
        channels: 1,
        timestamp: Date.now(),
      };

      this.emit("chunk", { data: Buffer.from(value), timestamp: Date.now() });
    }
  }

  /**
   * Synthesize full audio with ElevenLabs (non-streaming)
   */
  private async synthesizeWithElevenLabs(text: string): Promise<Buffer> {
    const chunks: Buffer[] = [];

    for await (const chunk of this.streamElevenLabs(text)) {
      if (Buffer.isBuffer(chunk.data)) {
        chunks.push(chunk.data);
      } else {
        chunks.push(Buffer.from(chunk.data));
      }
    }

    return Buffer.concat(chunks);
  }

  /**
   * OpenAI TTS
   */
  private async synthesizeWithOpenAI(text: string): Promise<Buffer> {
    const apiKey = this.config.openai?.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const voice = this.config.openai?.voice ?? "nova";
    const model = this.config.openai?.model ?? "tts-1";
    const speed = this.config.openai?.speed ?? 1.0;

    log.debug(`OpenAI TTS: "${text.substring(0, 50)}..." (voice: ${voice})`);

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice,
        input: text,
        speed,
        response_format: "pcm", // Raw PCM for easy playback
      }),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI TTS error: ${response.status} ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Edge TTS (free Microsoft Azure voices)
   */
  private async synthesizeWithEdge(text: string): Promise<Buffer> {
    const voice = this.config.edge?.voice ?? "en-US-JennyNeural";
    const rate = this.config.edge?.rate ?? "+0%";
    const pitch = this.config.edge?.pitch ?? "+0Hz";

    log.debug(`Edge TTS: "${text.substring(0, 50)}..." (voice: ${voice})`);

    return new Promise((resolve, reject) => {
      // Use edge-tts Python package
      const proc = spawn("edge-tts", [
        "--voice",
        voice,
        "--rate",
        rate,
        "--pitch",
        pitch,
        "--text",
        text,
        "--write-media",
        "-",
      ], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      const chunks: Buffer[] = [];

      proc.stdout?.on("data", (data: Buffer) => {
        chunks.push(data);
        this.emit("chunk", { data, timestamp: Date.now() });
      });

      proc.stderr?.on("data", (data: Buffer) => {
        log.debug(`Edge TTS stderr: ${data.toString()}`);
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`Edge TTS failed with code ${code}`));
        }
      });

      proc.on("error", (err) => {
        reject(new Error(`Edge TTS not available. Install with: pip install edge-tts`));
      });

      // Handle abort
      this.abortController?.signal.addEventListener("abort", () => {
        proc.kill("SIGTERM");
      });
    });
  }

  /**
   * System TTS (macOS say, Windows SAPI)
   */
  private async synthesizeWithSystem(text: string): Promise<Buffer> {
    const platform = process.platform;
    const voice = this.config.system?.voice;
    const rate = this.config.system?.rate ?? 1.0;

    log.debug(`System TTS: "${text.substring(0, 50)}..."`);

    return new Promise((resolve, reject) => {
      let command: string;
      let args: string[];

      if (platform === "darwin") {
        // macOS: Use 'say' command
        command = "say";
        args = ["--data-format=LEI16@16000", "-o", "-", text];
        if (voice) {
          args.unshift("-v", voice);
        }
        if (rate !== 1.0) {
          args.unshift("-r", String(Math.round(175 * rate))); // 175 WPM is default
        }
      } else if (platform === "win32") {
        // Windows: Use PowerShell with SAPI
        command = "powershell";
        const psScript = `
          Add-Type -AssemblyName System.Speech
          $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
          ${voice ? `$synth.SelectVoice("${voice}")` : ""}
          $synth.Rate = ${Math.round((rate - 1) * 10)}
          $stream = New-Object System.IO.MemoryStream
          $synth.SetOutputToWaveStream($stream)
          $synth.Speak("${text.replace(/"/g, '`"')}")
          $stream.Position = 0
          $bytes = $stream.ToArray()
          [System.Console]::OpenStandardOutput().Write($bytes, 0, $bytes.Length)
        `;
        args = ["-Command", psScript];
      } else if (platform === "linux") {
        // Linux: Use espeak
        command = "espeak";
        args = ["--stdout", text];
        if (voice) {
          args.unshift("-v", voice);
        }
        if (rate !== 1.0) {
          args.unshift("-s", String(Math.round(175 * rate)));
        }
      } else {
        reject(new Error(`System TTS not supported on ${platform}`));
        return;
      }

      const proc = spawn(command, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      const chunks: Buffer[] = [];

      proc.stdout?.on("data", (data: Buffer) => {
        chunks.push(data);
        this.emit("chunk", { data, timestamp: Date.now() });
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`System TTS failed with code ${code}`));
        }
      });

      proc.on("error", (err) => {
        reject(err);
      });

      // Handle abort
      this.abortController?.signal.addEventListener("abort", () => {
        proc.kill("SIGTERM");
      });
    });
  }

  /**
   * Stop current synthesis
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      log.info("TTS synthesis stopped");
    }
    this.isStreaming = false;
    this.emit("stop");
  }

  /**
   * Check if currently streaming
   */
  get streaming(): boolean {
    return this.isStreaming;
  }

  /**
   * Get current configuration
   */
  getConfig(): TTSConfig {
    return { ...this.config };
  }

  /**
   * Update voice ID (ElevenLabs)
   */
  setVoice(voiceId: string): void {
    if (this.config.elevenlabs) {
      this.config.elevenlabs.voiceId = voiceId;
      log.info(`TTS voice updated: ${voiceId}`);
    }
  }

  /**
   * Check if provider is available
   */
  async isAvailable(): Promise<boolean> {
    switch (this.config.provider) {
      case "elevenlabs": {
        const apiKey = this.config.elevenlabs?.apiKey ?? process.env.ELEVENLABS_API_KEY;
        return Boolean(apiKey);
      }
      case "openai": {
        const apiKey = this.config.openai?.apiKey ?? process.env.OPENAI_API_KEY;
        return Boolean(apiKey);
      }
      case "edge": {
        return new Promise((resolve) => {
          const proc = spawn("edge-tts", ["--help"], {
            stdio: ["ignore", "ignore", "ignore"],
          });
          proc.on("close", (code) => resolve(code === 0));
          proc.on("error", () => resolve(false));
          setTimeout(() => {
            proc.kill();
            resolve(false);
          }, 5000);
        });
      }
      case "system": {
        return true; // System TTS is always available
      }
      default:
        return false;
    }
  }
}

/**
 * List available ElevenLabs voices
 */
export async function listElevenLabsVoices(): Promise<
  Array<{ voice_id: string; name: string; category: string }>
> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY not set");
  }

  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list voices: ${response.status}`);
  }

  const data = await response.json();
  return data.voices.map((v: { voice_id: string; name: string; category: string }) => ({
    voice_id: v.voice_id,
    name: v.name,
    category: v.category,
  }));
}
