/**
 * HELIX VOICE ENGINE - AUDIO DEVICE MANAGEMENT
 * Handles microphone input and speaker output
 */

import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { AudioChunk, AudioDevice } from "./types.js";

const log = createSubsystemLogger("helix:voice:audio");

/**
 * Audio recorder using system tools (sox/arecord)
 */
export class AudioRecorder extends EventEmitter {
  private process: ChildProcess | null = null;
  private isRecording = false;
  private sampleRate: number;
  private channels: number;
  private deviceId?: string;

  constructor(options: { sampleRate?: number; channels?: number; deviceId?: string } = {}) {
    super();
    this.sampleRate = options.sampleRate ?? 16000; // 16kHz for STT
    this.channels = options.channels ?? 1; // Mono
    this.deviceId = options.deviceId;
  }

  /**
   * Start recording audio from microphone
   */
  async start(): Promise<void> {
    if (this.isRecording) {
      log.warn("Already recording");
      return;
    }

    const platform = process.platform;
    let command: string;
    let args: string[];

    if (platform === "darwin") {
      // macOS: Use sox with coreaudio
      command = "sox";
      args = [
        "-d", // Default input device
        "-t",
        "raw", // Raw PCM output
        "-b",
        "16", // 16-bit
        "-e",
        "signed-integer",
        "-c",
        String(this.channels),
        "-r",
        String(this.sampleRate),
        "-", // Output to stdout
      ];
    } else if (platform === "linux") {
      // Linux: Use arecord
      command = "arecord";
      args = [
        "-f",
        "S16_LE", // 16-bit signed little-endian
        "-c",
        String(this.channels),
        "-r",
        String(this.sampleRate),
        "-t",
        "raw",
        "-q", // Quiet mode
        "-", // Output to stdout
      ];
      if (this.deviceId) {
        args.unshift("-D", this.deviceId);
      }
    } else if (platform === "win32") {
      // Windows: Use sox with waveaudio
      command = "sox";
      args = [
        "-t",
        "waveaudio",
        "default",
        "-t",
        "raw",
        "-b",
        "16",
        "-e",
        "signed-integer",
        "-c",
        String(this.channels),
        "-r",
        String(this.sampleRate),
        "-",
      ];
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    log.info(`Starting audio recording: ${command} ${args.join(" ")}`);

    this.process = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.process.stdout?.on("data", (data: Buffer) => {
      const chunk: AudioChunk = {
        data,
        sampleRate: this.sampleRate,
        channels: this.channels,
        timestamp: Date.now(),
      };
      this.emit("data", chunk);
    });

    this.process.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) {
        log.debug(`Audio recorder stderr: ${msg}`);
      }
    });

    this.process.on("error", (err) => {
      log.error("Audio recorder error:", { error: String(err), name: err.name });
      this.emit("error", err);
    });

    this.process.on("close", (code) => {
      log.info(`Audio recorder closed with code ${code}`);
      this.isRecording = false;
      this.emit("close", code);
    });

    this.isRecording = true;
    this.emit("start");
    log.info("Audio recording started");
  }

  /**
   * Stop recording
   */
  stop(): void {
    if (!this.isRecording || !this.process) {
      return;
    }

    log.info("Stopping audio recording");
    this.process.kill("SIGTERM");
    this.process = null;
    this.isRecording = false;
    this.emit("stop");
  }

  /**
   * Check if currently recording
   */
  get recording(): boolean {
    return this.isRecording;
  }
}

/**
 * Audio player using system tools (sox/aplay)
 */
export class AudioPlayer extends EventEmitter {
  private process: ChildProcess | null = null;
  private isPlaying = false;
  private sampleRate: number;
  private channels: number;
  private deviceId?: string;
  private audioQueue: Buffer[] = [];

  constructor(options: { sampleRate?: number; channels?: number; deviceId?: string } = {}) {
    super();
    this.sampleRate = options.sampleRate ?? 24000; // 24kHz for TTS
    this.channels = options.channels ?? 1;
    this.deviceId = options.deviceId;
  }

  /**
   * Play audio buffer
   */
  async play(audio: Buffer): Promise<void> {
    const platform = process.platform;
    let command: string;
    let args: string[];

    if (platform === "darwin") {
      // macOS: Use sox to play
      command = "sox";
      args = [
        "-t",
        "raw",
        "-b",
        "16",
        "-e",
        "signed-integer",
        "-c",
        String(this.channels),
        "-r",
        String(this.sampleRate),
        "-",
        "-d", // Output to default device
      ];
    } else if (platform === "linux") {
      // Linux: Use aplay
      command = "aplay";
      args = [
        "-f",
        "S16_LE",
        "-c",
        String(this.channels),
        "-r",
        String(this.sampleRate),
        "-t",
        "raw",
        "-q",
      ];
      if (this.deviceId) {
        args.unshift("-D", this.deviceId);
      }
    } else if (platform === "win32") {
      // Windows: Use sox with waveaudio
      command = "sox";
      args = [
        "-t",
        "raw",
        "-b",
        "16",
        "-e",
        "signed-integer",
        "-c",
        String(this.channels),
        "-r",
        String(this.sampleRate),
        "-",
        "-t",
        "waveaudio",
        "default",
      ];
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    return new Promise((resolve, reject) => {
      log.debug(`Playing audio: ${audio.length} bytes`);

      this.process = spawn(command, args, {
        stdio: ["pipe", "ignore", "pipe"],
      });

      this.process.stderr?.on("data", (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) {
          log.debug(`Audio player stderr: ${msg}`);
        }
      });

      this.process.on("error", (err) => {
        log.error("Audio player error:", { error: String(err), name: err.name });
        this.isPlaying = false;
        this.emit("error", err);
        reject(err);
      });

      this.process.on("close", (code) => {
        log.debug(`Audio player closed with code ${code}`);
        this.isPlaying = false;
        this.emit("end");
        resolve();
      });

      this.isPlaying = true;
      this.emit("start");

      // Write audio data to stdin
      this.process.stdin?.write(audio);
      this.process.stdin?.end();
    });
  }

  /**
   * Stream audio chunk for real-time playback
   */
  async streamChunk(chunk: AudioChunk): Promise<void> {
    if (!this.isPlaying || !this.process?.stdin?.writable) {
      // Start new playback stream
      await this.startStream();
    }

    if (this.process?.stdin?.writable) {
      this.process.stdin.write(chunk.data);
    }
  }

  /**
   * Start streaming playback
   */
  private async startStream(): Promise<void> {
    const platform = process.platform;
    let command: string;
    let args: string[];

    if (platform === "darwin") {
      command = "sox";
      args = [
        "-t",
        "raw",
        "-b",
        "16",
        "-e",
        "signed-integer",
        "-c",
        String(this.channels),
        "-r",
        String(this.sampleRate),
        "-",
        "-d",
      ];
    } else if (platform === "linux") {
      command = "aplay";
      args = ["-f", "S16_LE", "-c", String(this.channels), "-r", String(this.sampleRate), "-t", "raw", "-q"];
    } else if (platform === "win32") {
      command = "sox";
      args = [
        "-t",
        "raw",
        "-b",
        "16",
        "-e",
        "signed-integer",
        "-c",
        String(this.channels),
        "-r",
        String(this.sampleRate),
        "-",
        "-t",
        "waveaudio",
        "default",
      ];
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    this.process = spawn(command, args, {
      stdio: ["pipe", "ignore", "pipe"],
    });

    this.process.on("error", (err) => {
      log.error("Audio stream error:", { error: String(err), name: err.name });
      this.isPlaying = false;
      this.emit("error", err);
    });

    this.process.on("close", () => {
      this.isPlaying = false;
      this.emit("end");
    });

    this.isPlaying = true;
    this.emit("start");
  }

  /**
   * End streaming playback
   */
  endStream(): void {
    if (this.process?.stdin?.writable) {
      this.process.stdin.end();
    }
  }

  /**
   * Stop playback immediately
   */
  stop(): void {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
      this.isPlaying = false;
      this.emit("stop");
    }
  }

  /**
   * Check if currently playing
   */
  get playing(): boolean {
    return this.isPlaying;
  }
}

/**
 * List available audio devices
 * Note: This is platform-dependent and may require additional tools
 */
export async function listAudioDevices(): Promise<AudioDevice[]> {
  const devices: AudioDevice[] = [];
  const platform = process.platform;

  try {
    if (platform === "darwin") {
      // macOS: Use system_profiler or sox
      // For simplicity, return default device
      devices.push({
        id: "default",
        name: "Default Input",
        kind: "audioinput",
        isDefault: true,
      });
      devices.push({
        id: "default",
        name: "Default Output",
        kind: "audiooutput",
        isDefault: true,
      });
    } else if (platform === "linux") {
      // Linux: Parse arecord -l output
      const { execSync } = await import("child_process");
      try {
        const output = execSync("arecord -l 2>/dev/null").toString();
        const lines = output.split("\n");
        for (const line of lines) {
          const match = line.match(/card (\d+):.*\[(.+?)\]/);
          if (match) {
            devices.push({
              id: `hw:${match[1]}`,
              name: match[2],
              kind: "audioinput",
              isDefault: devices.filter((d) => d.kind === "audioinput").length === 0,
            });
          }
        }
      } catch {
        // Fallback to default
        devices.push({
          id: "default",
          name: "Default Input",
          kind: "audioinput",
          isDefault: true,
        });
      }
    } else if (platform === "win32") {
      // Windows: Return default device
      devices.push({
        id: "default",
        name: "Default Input",
        kind: "audioinput",
        isDefault: true,
      });
      devices.push({
        id: "default",
        name: "Default Output",
        kind: "audiooutput",
        isDefault: true,
      });
    }
  } catch (err) {
    log.warn("Failed to list audio devices:", { error: String(err) });
    // Return default fallback
    devices.push({
      id: "default",
      name: "Default Device",
      kind: "audioinput",
      isDefault: true,
    });
  }

  return devices;
}

/**
 * Get default audio input device
 */
export async function getDefaultInputDevice(): Promise<AudioDevice | null> {
  const devices = await listAudioDevices();
  return devices.find((d) => d.kind === "audioinput" && d.isDefault) ?? devices.find((d) => d.kind === "audioinput") ?? null;
}

/**
 * Get default audio output device
 */
export async function getDefaultOutputDevice(): Promise<AudioDevice | null> {
  const devices = await listAudioDevices();
  return devices.find((d) => d.kind === "audiooutput" && d.isDefault) ?? devices.find((d) => d.kind === "audiooutput") ?? null;
}

/**
 * Check if audio recording is available
 */
export async function isAudioAvailable(): Promise<boolean> {
  const platform = process.platform;

  try {
    const { execSync } = await import("child_process");

    if (platform === "darwin" || platform === "win32") {
      // Check for sox
      execSync("sox --version", { stdio: "ignore" });
      return true;
    } else if (platform === "linux") {
      // Check for arecord
      execSync("arecord --version", { stdio: "ignore" });
      return true;
    }
  } catch {
    log.warn("Audio tools not available. Install sox (macOS/Windows) or alsa-utils (Linux)");
    return false;
  }

  return false;
}
