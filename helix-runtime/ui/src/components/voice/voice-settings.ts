/**
 * HELIX VOICE SETTINGS COMPONENT
 * Configuration panel for voice preferences
 */

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

export type VoiceMode = "wake-word" | "push-to-talk" | "always-on" | "off";
export type STTProvider = "whisper-local" | "whisper-api" | "deepgram";
export type TTSProvider = "elevenlabs" | "openai" | "edge" | "system";

export interface VoiceSettingsData {
  mode: VoiceMode;
  wakeWordEnabled: boolean;
  wakeWordSensitivity: number;
  sttProvider: STTProvider;
  ttsProvider: TTSProvider;
  ttsVoiceId: string;
  autoStopSeconds: number;
  interruptible: boolean;
  playConfirmationSound: boolean;
}

/**
 * Voice settings panel component
 *
 * Usage:
 * ```html
 * <helix-voice-settings
 *   .settings=${currentSettings}
 *   @settings-change=${handleChange}
 * ></helix-voice-settings>
 * ```
 */
@customElement("helix-voice-settings")
export class HelixVoiceSettings extends LitElement {
  static override styles = css`
    :host {
      display: block;
      padding: 16px;
      background: var(--bg-primary, #0f0f1a);
      border-radius: 12px;
      color: var(--text-primary, #fff);
    }

    h2 {
      margin: 0 0 16px;
      font-size: 18px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    h2 svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }

    .section {
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-color, #2d2d3d);
    }

    .section:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-muted, #9ca3af);
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .field {
      margin-bottom: 12px;
    }

    .field:last-child {
      margin-bottom: 0;
    }

    label {
      display: block;
      font-size: 14px;
      margin-bottom: 6px;
      color: var(--text-primary, #fff);
    }

    .field-description {
      font-size: 12px;
      color: var(--text-muted, #9ca3af);
      margin-top: 4px;
    }

    select,
    input[type="text"],
    input[type="number"] {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border-color, #2d2d3d);
      border-radius: 8px;
      background: var(--bg-secondary, #1f1f2e);
      color: var(--text-primary, #fff);
      font-size: 14px;
      transition: border-color 0.2s ease;
    }

    select:focus,
    input:focus {
      outline: none;
      border-color: var(--accent-color, #8b5cf6);
    }

    input[type="range"] {
      width: 100%;
      height: 4px;
      border-radius: 2px;
      background: var(--bg-secondary, #1f1f2e);
      appearance: none;
    }

    input[type="range"]::-webkit-slider-thumb {
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--accent-color, #8b5cf6);
      cursor: pointer;
    }

    .range-value {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--text-muted, #9ca3af);
      margin-top: 4px;
    }

    .checkbox-field {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .checkbox-field input[type="checkbox"] {
      width: 18px;
      height: 18px;
      border-radius: 4px;
      cursor: pointer;
    }

    .checkbox-field label {
      margin-bottom: 0;
      cursor: pointer;
    }

    .mode-selector {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }

    .mode-option {
      padding: 12px;
      border: 2px solid var(--border-color, #2d2d3d);
      border-radius: 8px;
      cursor: pointer;
      transition:
        border-color 0.2s ease,
        background 0.2s ease;
      text-align: center;
    }

    .mode-option:hover {
      background: var(--bg-secondary, #1f1f2e);
    }

    .mode-option.selected {
      border-color: var(--accent-color, #8b5cf6);
      background: rgba(139, 92, 246, 0.1);
    }

    .mode-option-icon {
      font-size: 24px;
      margin-bottom: 6px;
    }

    .mode-option-label {
      font-size: 13px;
      font-weight: 500;
    }

    .mode-option-desc {
      font-size: 11px;
      color: var(--text-muted, #9ca3af);
      margin-top: 2px;
    }

    .api-key-field {
      position: relative;
    }

    .api-key-field input {
      padding-right: 80px;
    }

    .api-key-status {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .api-key-status.valid {
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
    }

    .api-key-status.invalid {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }

    .test-button {
      margin-top: 12px;
      padding: 10px 16px;
      border: none;
      border-radius: 8px;
      background: var(--accent-color, #8b5cf6);
      color: white;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s ease;
    }

    .test-button:hover {
      opacity: 0.9;
    }

    .test-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;

  /** Current settings */
  @property({ type: Object }) settings: VoiceSettingsData = {
    mode: "wake-word",
    wakeWordEnabled: true,
    wakeWordSensitivity: 0.5,
    sttProvider: "whisper-local",
    ttsProvider: "elevenlabs",
    ttsVoiceId: "",
    autoStopSeconds: 30,
    interruptible: true,
    playConfirmationSound: true,
  };

  /** Whether API keys are configured */
  @state() private elevenLabsConfigured = false;
  @state() private openAIConfigured = false;

  override connectedCallback() {
    super.connectedCallback();
    // Check for API keys in environment (these would be passed from backend)
    this.elevenLabsConfigured = Boolean((window as any).__ELEVENLABS_API_KEY);
    this.openAIConfigured = Boolean((window as any).__OPENAI_API_KEY);
  }

  override render() {
    return html`
      <h2>
        <svg viewBox="0 0 24 24">
          <path
            d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
          />
          <path
            d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
          />
        </svg>
        Voice Settings
      </h2>

      <div class="section">
        <div class="section-title">Voice Mode</div>
        <div class="mode-selector">
          ${this.renderModeOption("wake-word", "👋", "Wake Word", '"Hey Helix"')}
          ${this.renderModeOption("push-to-talk", "👆", "Push to Talk", "Hold button")}
          ${this.renderModeOption("always-on", "🎙️", "Always On", "Continuous")}
          ${this.renderModeOption("off", "🔇", "Off", "Disabled")}
        </div>
      </div>

      ${this.settings.mode === "wake-word"
        ? html`
            <div class="section">
              <div class="section-title">Wake Word</div>
              <div class="field">
                <label>Sensitivity</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  .value=${String(this.settings.wakeWordSensitivity)}
                  @input=${this.handleSensitivityChange}
                />
                <div class="range-value">
                  <span>Less sensitive</span>
                  <span>${(this.settings.wakeWordSensitivity * 100).toFixed(0)}%</span>
                  <span>More sensitive</span>
                </div>
              </div>
            </div>
          `
        : ""}

      <div class="section">
        <div class="section-title">Speech Recognition</div>
        <div class="field">
          <label>Provider</label>
          <select @change=${this.handleSTTChange}>
            <option value="whisper-local" ?selected=${this.settings.sttProvider === "whisper-local"}>
              Whisper (Local) - Free, private
            </option>
            <option value="whisper-api" ?selected=${this.settings.sttProvider === "whisper-api"}>
              Whisper API (OpenAI) - Fast, accurate
            </option>
            <option value="deepgram" ?selected=${this.settings.sttProvider === "deepgram"}>
              Deepgram - Real-time streaming
            </option>
          </select>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Text to Speech</div>
        <div class="field">
          <label>Provider</label>
          <select @change=${this.handleTTSChange}>
            <option value="elevenlabs" ?selected=${this.settings.ttsProvider === "elevenlabs"}>
              ElevenLabs - Highest quality
            </option>
            <option value="openai" ?selected=${this.settings.ttsProvider === "openai"}>
              OpenAI TTS
            </option>
            <option value="edge" ?selected=${this.settings.ttsProvider === "edge"}>
              Edge TTS - Free
            </option>
            <option value="system" ?selected=${this.settings.ttsProvider === "system"}>
              System - Built-in
            </option>
          </select>
          <div class="field-description">
            ${this.settings.ttsProvider === "elevenlabs" && !this.elevenLabsConfigured
              ? "⚠️ ELEVENLABS_API_KEY not configured"
              : ""}
          </div>
        </div>

        ${this.settings.ttsProvider === "elevenlabs"
          ? html`
              <div class="field">
                <label>Voice ID</label>
                <input
                  type="text"
                  placeholder="e.g., 21m00Tcm4TlvDq8ikWAM"
                  .value=${this.settings.ttsVoiceId}
                  @input=${this.handleVoiceIdChange}
                />
                <div class="field-description">
                  Find voice IDs at <a href="https://elevenlabs.io" target="_blank">ElevenLabs</a>
                </div>
              </div>
            `
          : ""}

        <button class="test-button" @click=${this.testTTS}>
          🔊 Test Voice
        </button>
      </div>

      <div class="section">
        <div class="section-title">Conversation</div>

        <div class="field">
          <label>Auto-stop after silence (seconds)</label>
          <input
            type="number"
            min="5"
            max="120"
            .value=${String(this.settings.autoStopSeconds)}
            @input=${this.handleAutoStopChange}
          />
        </div>

        <div class="field checkbox-field">
          <input
            type="checkbox"
            id="interruptible"
            ?checked=${this.settings.interruptible}
            @change=${this.handleInterruptibleChange}
          />
          <label for="interruptible">Allow interrupting while speaking</label>
        </div>

        <div class="field checkbox-field">
          <input
            type="checkbox"
            id="confirmationSound"
            ?checked=${this.settings.playConfirmationSound}
            @change=${this.handleConfirmationSoundChange}
          />
          <label for="confirmationSound">Play confirmation sound</label>
        </div>
      </div>
    `;
  }

  private renderModeOption(
    mode: VoiceMode,
    icon: string,
    label: string,
    description: string
  ) {
    const isSelected = this.settings.mode === mode;
    return html`
      <div
        class="mode-option ${isSelected ? "selected" : ""}"
        @click=${() => this.handleModeChange(mode)}
      >
        <div class="mode-option-icon">${icon}</div>
        <div class="mode-option-label">${label}</div>
        <div class="mode-option-desc">${description}</div>
      </div>
    `;
  }

  private handleModeChange(mode: VoiceMode) {
    this.updateSetting("mode", mode);
  }

  private handleSensitivityChange(e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    this.updateSetting("wakeWordSensitivity", value);
  }

  private handleSTTChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as STTProvider;
    this.updateSetting("sttProvider", value);
  }

  private handleTTSChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as TTSProvider;
    this.updateSetting("ttsProvider", value);
  }

  private handleVoiceIdChange(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    this.updateSetting("ttsVoiceId", value);
  }

  private handleAutoStopChange(e: Event) {
    const value = parseInt((e.target as HTMLInputElement).value, 10);
    this.updateSetting("autoStopSeconds", value);
  }

  private handleInterruptibleChange(e: Event) {
    const value = (e.target as HTMLInputElement).checked;
    this.updateSetting("interruptible", value);
  }

  private handleConfirmationSoundChange(e: Event) {
    const value = (e.target as HTMLInputElement).checked;
    this.updateSetting("playConfirmationSound", value);
  }

  private updateSetting<K extends keyof VoiceSettingsData>(
    key: K,
    value: VoiceSettingsData[K]
  ) {
    this.settings = { ...this.settings, [key]: value };
    this.dispatchEvent(
      new CustomEvent("settings-change", {
        detail: { key, value, settings: this.settings },
        bubbles: true,
        composed: true,
      })
    );
  }

  private testTTS() {
    this.dispatchEvent(
      new CustomEvent("test-tts", {
        detail: { provider: this.settings.ttsProvider, voiceId: this.settings.ttsVoiceId },
        bubbles: true,
        composed: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "helix-voice-settings": HelixVoiceSettings;
  }
}
