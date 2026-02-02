/**
 * HELIX VOICE ENGINE - WAKE WORD DETECTION
 * Detects "Hey Helix" or custom wake phrases
 */

import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";
import * as fs from "fs/promises";
import * as path from "path";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { AudioChunk, WakeWordConfig } from "./types.js";

const log = createSubsystemLogger("helix:voice:wakeword");

/**
 * Wake Word Detector using Vosk (offline) or keyword spotting
 * Continuously listens for wake phrases with low CPU usage
 */
export class WakeWordDetector extends EventEmitter {
  private config: WakeWordConfig;
  private isListening = false;
  private voskProcess: ChildProcess | null = null;
  private audioBuffer: Buffer[] = [];
  private lastDetectionTime = 0;
  private readonly COOLDOWN_MS = 2000; // Prevent rapid re-triggers

  constructor(config: Partial<WakeWordConfig> = {}) {
    super();

    this.config = {
      enabled: config.enabled ?? true,
      phrases: config.phrases ?? ["helix", "hey helix"],
      sensitivity: config.sensitivity ?? 0.5,
      backend: config.backend ?? "vosk",
      customModelPath: config.customModelPath,
    };

    log.info("Wake word detector initialized", {
      phrases: this.config.phrases,
      backend: this.config.backend,
    });
  }

  /**
   * Start listening for wake word
   */
  async start(): Promise<void> {
    if (this.isListening) {
      log.warn("Wake word detector already running");
      return;
    }

    if (!this.config.enabled) {
      log.info("Wake word detection disabled");
      return;
    }

    try {
      if (this.config.backend === "vosk") {
        await this.startVoskDetector();
      } else {
        // Fallback to simple keyword detection
        await this.startSimpleDetector();
      }

      this.isListening = true;
      this.emit("start");
      log.info("Wake word detection started");
    } catch (err) {
      log.error("Failed to start wake word detection:", { error: String(err) });
      throw err;
    }
  }

  /**
   * Start Vosk-based detector (requires vosk-api Python package)
   */
  private async startVoskDetector(): Promise<void> {
    // Check if vosk is available
    const voskAvailable = await this.checkVoskAvailable();
    if (!voskAvailable) {
      log.warn("Vosk not available, falling back to simple detection");
      return this.startSimpleDetector();
    }

    // Create Python script for continuous recognition
    const pythonScript = `
import sys
import json
import vosk
import sounddevice as sd

# Initialize Vosk
vosk.SetLogLevel(-1)
model = vosk.Model(lang="en-us")
rec = vosk.KaldiRecognizer(model, 16000)

# Wake phrases
WAKE_PHRASES = ${JSON.stringify(this.config.phrases.map((p) => p.toLowerCase()))}

def contains_wake_phrase(text):
    text_lower = text.lower()
    for phrase in WAKE_PHRASES:
        if phrase in text_lower:
            return phrase
    return None

def audio_callback(indata, frames, time, status):
    if status:
        print(json.dumps({"error": str(status)}), file=sys.stderr)
        return

    data = bytes(indata)
    if rec.AcceptWaveform(data):
        result = json.loads(rec.Result())
        text = result.get("text", "")
        phrase = contains_wake_phrase(text)
        if phrase:
            print(json.dumps({"detected": phrase, "text": text}))
            sys.stdout.flush()

# Start audio stream
with sd.RawInputStream(
    samplerate=16000,
    blocksize=4000,
    dtype='int16',
    channels=1,
    callback=audio_callback
):
    print(json.dumps({"status": "listening"}))
    sys.stdout.flush()
    while True:
        sd.sleep(100)
`;

    // Write temporary script
    const tempDir = process.env.TMPDIR || process.env.TEMP || "/tmp";
    const scriptPath = path.join(tempDir, "helix_wake_word.py");
    await fs.writeFile(scriptPath, pythonScript, "utf-8");

    this.voskProcess = spawn("python3", [scriptPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.voskProcess.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().trim().split("\n");
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.detected) {
            this.handleWakeWordDetection(msg.detected, 0.9);
          } else if (msg.status) {
            log.debug(`Vosk status: ${msg.status}`);
          }
        } catch {
          // Ignore non-JSON output
        }
      }
    });

    this.voskProcess.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) {
        log.debug(`Vosk stderr: ${msg}`);
      }
    });

    this.voskProcess.on("error", (err) => {
      log.error("Vosk process error:", { error: String(err), name: err.name });
      this.emit("error", err);
    });

    this.voskProcess.on("close", (code) => {
      log.info(`Vosk process exited with code ${code}`);
      this.isListening = false;
    });
  }

  /**
   * Simple keyword detection fallback (process audio chunks manually)
   */
  private async startSimpleDetector(): Promise<void> {
    // This is a placeholder for simple keyword spotting
    // In production, you'd use a lightweight keyword spotter
    log.info("Using simple wake word detection (placeholder)");
    this.isListening = true;
  }

  /**
   * Process audio chunk for wake word detection (simple mode)
   */
  processChunk(chunk: AudioChunk): void {
    if (!this.isListening || this.config.backend !== "simple") {
      return;
    }

    // Buffer audio for batch processing
    if (Buffer.isBuffer(chunk.data)) {
      this.audioBuffer.push(chunk.data);
    }

    // Process every 2 seconds of audio
    const bufferDuration = (this.audioBuffer.reduce((sum, b) => sum + b.length, 0) / 2) / 16000;
    if (bufferDuration >= 2) {
      // In production, you'd send this to a lightweight keyword spotter
      // For now, this is a placeholder
      this.audioBuffer = [];
    }
  }

  /**
   * Handle wake word detection
   */
  private handleWakeWordDetection(phrase: string, confidence: number): void {
    const now = Date.now();

    // Apply cooldown to prevent rapid re-triggers
    if (now - this.lastDetectionTime < this.COOLDOWN_MS) {
      log.debug(`Wake word detected but in cooldown (${this.COOLDOWN_MS}ms)`);
      return;
    }

    // Check sensitivity threshold
    if (confidence < this.config.sensitivity) {
      log.debug(`Wake word confidence (${confidence}) below threshold (${this.config.sensitivity})`);
      return;
    }

    this.lastDetectionTime = now;
    log.info(`Wake word detected: "${phrase}" (confidence: ${confidence.toFixed(2)})`);

    this.emit("detected", {
      phrase,
      confidence,
      timestamp: now,
    });
  }

  /**
   * Stop listening
   */
  stop(): void {
    if (this.voskProcess) {
      this.voskProcess.kill("SIGTERM");
      this.voskProcess = null;
    }

    this.isListening = false;
    this.audioBuffer = [];
    this.emit("stop");
    log.info("Wake word detection stopped");
  }

  /**
   * Check if currently listening
   */
  get listening(): boolean {
    return this.isListening;
  }

  /**
   * Check if Vosk is available
   */
  private async checkVoskAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("python3", ["-c", "import vosk; print('ok')"], {
        stdio: ["ignore", "pipe", "ignore"],
      });

      let output = "";
      proc.stdout?.on("data", (data) => {
        output += data.toString();
      });

      proc.on("close", (code) => {
        resolve(code === 0 && output.includes("ok"));
      });

      proc.on("error", () => {
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Update wake phrases
   */
  updatePhrases(phrases: string[]): void {
    this.config.phrases = phrases;
    log.info(`Wake phrases updated: ${phrases.join(", ")}`);

    // Restart if using Vosk to pick up new phrases
    if (this.isListening && this.config.backend === "vosk") {
      this.stop();
      this.start().catch((err) => log.error("Failed to restart wake word detection:", err));
    }
  }

  /**
   * Update sensitivity
   */
  setSensitivity(sensitivity: number): void {
    this.config.sensitivity = Math.max(0, Math.min(1, sensitivity));
    log.info(`Wake word sensitivity set to ${this.config.sensitivity}`);
  }
}

/**
 * Play confirmation sound when wake word is detected
 */
export async function playConfirmationSound(): Promise<void> {
  const platform = process.platform;

  try {
    if (platform === "darwin") {
      // macOS: Use system sound
      spawn("afplay", ["/System/Library/Sounds/Pop.aiff"]);
    } else if (platform === "linux") {
      // Linux: Use paplay or aplay
      const proc = spawn("paplay", ["/usr/share/sounds/freedesktop/stereo/message.oga"]);
      proc.on("error", () => {
        // Fallback to aplay
        spawn("aplay", ["-q", "/usr/share/sounds/alsa/Front_Center.wav"]);
      });
    } else if (platform === "win32") {
      // Windows: Use PowerShell
      spawn("powershell", [
        "-c",
        "[console]::beep(800, 200)",
      ]);
    }
  } catch (err) {
    log.debug("Could not play confirmation sound:", { error: String(err) });
  }
}
