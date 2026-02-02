/**
 * HELIX VOICE ENGINE - SPEECH TO TEXT
 * Converts speech audio to text using Whisper or cloud APIs
 */

import { spawn, type ChildProcess } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { STTConfig, VoiceTranscript, AudioChunk } from "./types.js";
import { toWavBuffer, combineAudioChunks } from "./voice-activity.js";

const log = createSubsystemLogger("helix:voice:stt");

/**
 * Speech-to-Text engine supporting multiple providers
 */
export class SpeechToText {
  private config: STTConfig;
  private modelLoaded = false;
  private tempDir: string;

  constructor(config: Partial<STTConfig> = {}) {
    this.config = {
      provider: config.provider ?? "whisper-local",
      whisperLocal: config.whisperLocal ?? {
        modelSize: "base",
        device: "auto",
        language: "en",
      },
      whisperApi: config.whisperApi,
      deepgram: config.deepgram,
      assembly: config.assembly,
    };

    this.tempDir = process.env.TMPDIR || process.env.TEMP || "/tmp";
    log.info("STT initialized", { provider: this.config.provider });
  }

  /**
   * Initialize the STT engine (load model if local)
   */
  async initialize(): Promise<void> {
    if (this.config.provider === "whisper-local") {
      // Check if Whisper is available
      const available = await this.checkWhisperAvailable();
      if (!available) {
        log.warn("Whisper not installed. Run: pip install openai-whisper");
        throw new Error("Whisper not installed. Run: pip install openai-whisper");
      }

      // Pre-load the model
      await this.loadWhisperModel();
      this.modelLoaded = true;
    }

    log.info("STT engine initialized");
  }

  /**
   * Transcribe audio chunks to text
   */
  async transcribe(chunks: AudioChunk[]): Promise<VoiceTranscript> {
    const startTime = Date.now();

    // Combine chunks into single buffer
    const pcmBuffer = combineAudioChunks(chunks);
    const wavBuffer = toWavBuffer(pcmBuffer, chunks[0]?.sampleRate ?? 16000);

    let transcript: VoiceTranscript;

    switch (this.config.provider) {
      case "whisper-local":
        transcript = await this.transcribeWithWhisperLocal(wavBuffer);
        break;
      case "whisper-api":
        transcript = await this.transcribeWithWhisperAPI(wavBuffer);
        break;
      case "deepgram":
        transcript = await this.transcribeWithDeepgram(wavBuffer);
        break;
      case "assembly":
        transcript = await this.transcribeWithAssembly(wavBuffer);
        break;
      default:
        throw new Error(`Unknown STT provider: ${this.config.provider}`);
    }

    const duration = Date.now() - startTime;
    log.info(`Transcription complete in ${duration}ms: "${transcript.text}"`);

    return {
      ...transcript,
      duration,
      timestamp: new Date(),
      isFinal: true,
    };
  }

  /**
   * Transcribe using local Whisper model
   */
  private async transcribeWithWhisperLocal(wavBuffer: Buffer): Promise<VoiceTranscript> {
    const tempFile = path.join(this.tempDir, `helix_stt_${Date.now()}.wav`);

    try {
      // Write WAV to temp file
      await fs.writeFile(tempFile, wavBuffer);

      const modelSize = this.config.whisperLocal?.modelSize ?? "base";
      const language = this.config.whisperLocal?.language ?? "en";
      const device = this.config.whisperLocal?.device ?? "auto";

      // Determine device flag
      let deviceFlag: string | null = null;
      if (device === "cuda") {
        deviceFlag = "--device cuda";
      } else if (device === "mps") {
        deviceFlag = "--device mps";
      } else if (device === "cpu") {
        deviceFlag = "--device cpu";
      }

      // Run Whisper
      const args = [
        tempFile,
        "--model",
        modelSize,
        "--language",
        language,
        "--output_format",
        "json",
        "--output_dir",
        this.tempDir,
        "--verbose",
        "False",
      ];

      if (deviceFlag) {
        args.push(...deviceFlag.split(" "));
      }

      return new Promise((resolve, reject) => {
        const proc = spawn("whisper", args, {
          stdio: ["ignore", "pipe", "pipe"],
        });

        let stderr = "";
        proc.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        proc.on("close", async (code) => {
          if (code !== 0) {
            log.error(`Whisper failed with code ${code}: ${stderr}`);
            reject(new Error(`Whisper transcription failed: ${stderr}`));
            return;
          }

          try {
            // Read JSON output
            const jsonFile = tempFile.replace(".wav", ".json");
            const jsonContent = await fs.readFile(jsonFile, "utf-8");
            const result = JSON.parse(jsonContent);

            // Clean up temp files
            await fs.unlink(tempFile).catch(() => {});
            await fs.unlink(jsonFile).catch(() => {});

            resolve({
              text: result.text?.trim() ?? "",
              confidence: 0.9, // Whisper doesn't provide confidence
              language: result.language ?? language,
              duration: 0,
              timestamp: new Date(),
              isFinal: true,
            });
          } catch (err) {
            reject(err);
          }
        });

        proc.on("error", (err) => {
          reject(err);
        });
      });
    } finally {
      // Ensure cleanup
      await fs.unlink(tempFile).catch(() => {});
    }
  }

  /**
   * Transcribe using OpenAI Whisper API
   */
  private async transcribeWithWhisperAPI(wavBuffer: Buffer): Promise<VoiceTranscript> {
    const apiKey = this.config.whisperApi?.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key not configured for Whisper API");
    }

    // Create FormData using the native Node.js FormData
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(wavBuffer)], { type: "audio/wav" });
    formData.append("file", blob, "audio.wav");
    formData.append("model", "whisper-1");

    if (this.config.whisperApi?.language) {
      formData.append("language", this.config.whisperApi.language);
    }

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Whisper API error: ${error}`);
    }

    const result = (await response.json()) as { text?: string };

    return {
      text: result.text?.trim() ?? "",
      language: this.config.whisperApi?.language,
      duration: 0,
      timestamp: new Date(),
      isFinal: true,
    };
  }

  /**
   * Transcribe using Deepgram API
   */
  private async transcribeWithDeepgram(wavBuffer: Buffer): Promise<VoiceTranscript> {
    const apiKey = this.config.deepgram?.apiKey;
    if (!apiKey) {
      throw new Error("Deepgram API key not configured");
    }

    const model = this.config.deepgram?.model ?? "nova-2";
    const language = this.config.deepgram?.language ?? "en";

    const response = await fetch(
      `https://api.deepgram.com/v1/listen?model=${model}&language=${language}`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "audio/wav",
        },
        body: new Uint8Array(wavBuffer),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Deepgram API error: ${error}`);
    }

    const result = (await response.json()) as {
      results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string; confidence?: number }> }> };
    };
    const transcript = result.results?.channels?.[0]?.alternatives?.[0];

    return {
      text: transcript?.transcript?.trim() ?? "",
      confidence: transcript?.confidence,
      language,
      duration: 0,
      timestamp: new Date(),
      isFinal: true,
    };
  }

  /**
   * Transcribe using AssemblyAI API
   */
  private async transcribeWithAssembly(wavBuffer: Buffer): Promise<VoiceTranscript> {
    const apiKey = this.config.assembly?.apiKey;
    if (!apiKey) {
      throw new Error("AssemblyAI API key not configured");
    }

    // Upload audio
    const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: {
        authorization: apiKey,
      },
      body: new Uint8Array(wavBuffer),
    });

    if (!uploadResponse.ok) {
      throw new Error("AssemblyAI upload failed");
    }

    const uploadResult = (await uploadResponse.json()) as { upload_url: string };

    // Start transcription
    const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ audio_url: uploadResult.upload_url }),
    });

    const transcriptStart = (await transcriptResponse.json()) as { id: string };

    // Poll for result
    let result: { status?: string; text?: string; confidence?: number; error?: string } | undefined;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 1000));

      const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptStart.id}`, {
        headers: { authorization: apiKey },
      });

      result = (await pollResponse.json()) as typeof result;

      if (result?.status === "completed") {
        break;
      } else if (result?.status === "error") {
        throw new Error(`AssemblyAI error: ${result.error}`);
      }
    }

    return {
      text: result?.text?.trim() ?? "",
      confidence: result?.confidence,
      duration: 0,
      timestamp: new Date(),
      isFinal: true,
    };
  }

  /**
   * Check if local Whisper is available
   */
  private async checkWhisperAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("whisper", ["--help"], {
        stdio: ["ignore", "ignore", "ignore"],
      });

      proc.on("close", (code) => {
        resolve(code === 0);
      });

      proc.on("error", () => {
        resolve(false);
      });

      setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Pre-load Whisper model
   */
  private async loadWhisperModel(): Promise<void> {
    const modelSize = this.config.whisperLocal?.modelSize ?? "base";
    log.info(`Loading Whisper model: ${modelSize}`);

    return new Promise((resolve, reject) => {
      // Trigger model download by running a quick transcription
      const proc = spawn("python3", [
        "-c",
        `import whisper; whisper.load_model("${modelSize}"); print("loaded")`,
      ], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let output = "";
      proc.stdout?.on("data", (data) => {
        output += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0 && output.includes("loaded")) {
          log.info(`Whisper model ${modelSize} loaded successfully`);
          resolve();
        } else {
          reject(new Error(`Failed to load Whisper model: ${modelSize}`));
        }
      });

      proc.on("error", (err) => {
        reject(err);
      });

      // Timeout after 2 minutes (model download can be slow)
      setTimeout(() => {
        proc.kill();
        reject(new Error("Whisper model loading timed out"));
      }, 120000);
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): STTConfig {
    return { ...this.config };
  }

  /**
   * Check if model is loaded
   */
  isReady(): boolean {
    return this.config.provider !== "whisper-local" || this.modelLoaded;
  }
}
