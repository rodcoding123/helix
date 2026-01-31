/**
 * HELIX VOICE BUTTON COMPONENT
 * Floating button for voice interaction with Helix
 */

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

/**
 * Voice state for the button
 */
export type VoiceButtonState = "idle" | "listening" | "processing" | "speaking";

/**
 * Voice mode setting
 */
export type VoiceButtonMode = "wake-word" | "push-to-talk" | "always-on" | "off";

/**
 * Voice button click event detail
 */
export interface VoiceButtonClickEvent {
  action: "toggle" | "start" | "stop";
  currentState: VoiceButtonState;
}

/**
 * Floating voice button component
 *
 * Usage:
 * ```html
 * <helix-voice-button
 *   state="idle"
 *   mode="push-to-talk"
 *   @voice-click="${handleClick}"
 *   @voice-settings="${openSettings}"
 * ></helix-voice-button>
 * ```
 */
@customElement("helix-voice-button")
export class HelixVoiceButton extends LitElement {
  static override styles = css`
    :host {
      display: block;
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 1000;
    }

    .voice-button {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--voice-button-bg, #1a1a2e);
      color: var(--voice-button-color, #fff);
      box-shadow:
        0 4px 12px rgba(0, 0, 0, 0.3),
        0 0 0 0 rgba(139, 92, 246, 0);
      transition:
        transform 0.15s ease,
        box-shadow 0.3s ease,
        background 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    .voice-button:hover {
      transform: scale(1.05);
    }

    .voice-button:active {
      transform: scale(0.95);
    }

    .voice-button:focus {
      outline: none;
      box-shadow:
        0 4px 12px rgba(0, 0, 0, 0.3),
        0 0 0 3px rgba(139, 92, 246, 0.5);
    }

    /* State: Idle */
    .voice-button.idle {
      background: var(--voice-idle-bg, #1a1a2e);
    }

    .voice-button.idle .icon {
      opacity: 0.8;
    }

    /* State: Listening */
    .voice-button.listening {
      background: var(--voice-listening-bg, #10b981);
      animation: pulse-listening 1.5s ease-in-out infinite;
    }

    @keyframes pulse-listening {
      0%,
      100% {
        box-shadow:
          0 4px 12px rgba(0, 0, 0, 0.3),
          0 0 0 0 rgba(16, 185, 129, 0.4);
      }
      50% {
        box-shadow:
          0 4px 12px rgba(0, 0, 0, 0.3),
          0 0 0 12px rgba(16, 185, 129, 0);
      }
    }

    /* State: Processing */
    .voice-button.processing {
      background: var(--voice-processing-bg, #f59e0b);
    }

    .voice-button.processing .icon {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    /* State: Speaking */
    .voice-button.speaking {
      background: var(--voice-speaking-bg, #8b5cf6);
      animation: pulse-speaking 0.8s ease-in-out infinite;
    }

    @keyframes pulse-speaking {
      0%,
      100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.08);
      }
    }

    /* Disabled state */
    .voice-button.disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background: var(--voice-disabled-bg, #374151);
    }

    .voice-button.disabled:hover {
      transform: none;
    }

    /* Icon */
    .icon {
      width: 24px;
      height: 24px;
      transition: opacity 0.2s ease;
    }

    .icon svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }

    /* Mode indicator */
    .mode-indicator {
      position: absolute;
      bottom: -2px;
      right: -2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--bg-primary, #0f0f1a);
      border: 2px solid currentColor;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
    }

    .mode-indicator.wake-word {
      color: #10b981;
    }

    .mode-indicator.push-to-talk {
      color: #3b82f6;
    }

    .mode-indicator.always-on {
      color: #f59e0b;
    }

    /* Settings button */
    .settings-button {
      position: absolute;
      top: -8px;
      right: -8px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: none;
      background: var(--bg-secondary, #1f1f2e);
      color: var(--text-muted, #9ca3af);
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      transition: opacity 0.2s ease;
    }

    .voice-button-container:hover .settings-button {
      display: flex;
    }

    .settings-button:hover {
      color: var(--text-primary, #fff);
    }

    /* Container for positioning */
    .voice-button-container {
      position: relative;
    }

    /* Status text */
    .status-text {
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-bottom: 8px;
      white-space: nowrap;
      font-size: 12px;
      color: var(--text-muted, #9ca3af);
      background: var(--bg-secondary, #1f1f2e);
      padding: 4px 8px;
      border-radius: 4px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
    }

    .voice-button-container:hover .status-text,
    .voice-button.listening + .status-text,
    .voice-button.processing + .status-text,
    .voice-button.speaking + .status-text {
      opacity: 1;
    }
  `;

  /** Current voice state */
  @property({ type: String }) state: VoiceButtonState = "idle";

  /** Voice mode */
  @property({ type: String }) mode: VoiceButtonMode = "push-to-talk";

  /** Whether voice is enabled */
  @property({ type: Boolean }) enabled = true;

  /** Audio level (0-1) for visualization */
  @property({ type: Number }) audioLevel = 0;

  /** Whether the button is being held (for push-to-talk) */
  @state() private isHolding = false;

  /** Long press timer for settings */
  private longPressTimer: number | null = null;

  override render() {
    const buttonClasses = {
      "voice-button": true,
      [this.state]: true,
      disabled: !this.enabled || this.mode === "off",
    };

    const modeClasses = {
      "mode-indicator": true,
      [this.mode]: true,
    };

    return html`
      <div class="voice-button-container">
        <button
          class=${classMap(buttonClasses)}
          @click=${this.handleClick}
          @mousedown=${this.handleMouseDown}
          @mouseup=${this.handleMouseUp}
          @mouseleave=${this.handleMouseUp}
          @touchstart=${this.handleTouchStart}
          @touchend=${this.handleTouchEnd}
          ?disabled=${!this.enabled || this.mode === "off"}
          aria-label=${this.getAriaLabel()}
        >
          <span class="icon">${this.renderIcon()}</span>
          ${this.mode !== "off"
            ? html`<span class=${classMap(modeClasses)}>${this.getModeIcon()}</span>`
            : ""}
        </button>
        <span class="status-text">${this.getStatusText()}</span>
        <button class="settings-button" @click=${this.handleSettingsClick} aria-label="Voice settings">
          ⚙
        </button>
      </div>
    `;
  }

  private renderIcon() {
    switch (this.state) {
      case "listening":
        return html`
          <svg viewBox="0 0 24 24">
            <path
              d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
            />
            <path
              d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
            />
          </svg>
        `;
      case "processing":
        return html`
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="32" stroke-dashoffset="0" />
          </svg>
        `;
      case "speaking":
        return html`
          <svg viewBox="0 0 24 24">
            <path
              d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
            />
          </svg>
        `;
      default:
        return html`
          <svg viewBox="0 0 24 24">
            <path
              d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
              opacity="0.7"
            />
            <path
              d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
              opacity="0.7"
            />
          </svg>
        `;
    }
  }

  private getModeIcon(): string {
    switch (this.mode) {
      case "wake-word":
        return "W";
      case "push-to-talk":
        return "P";
      case "always-on":
        return "A";
      default:
        return "";
    }
  }

  private getStatusText(): string {
    switch (this.state) {
      case "listening":
        return "Listening...";
      case "processing":
        return "Processing...";
      case "speaking":
        return "Speaking...";
      default:
        if (this.mode === "wake-word") return 'Say "Hey Helix"';
        if (this.mode === "push-to-talk") return "Hold to talk";
        if (this.mode === "always-on") return "Voice active";
        return "Voice off";
    }
  }

  private getAriaLabel(): string {
    const modeLabel = {
      "wake-word": "Wake word mode",
      "push-to-talk": "Push to talk",
      "always-on": "Always on",
      off: "Voice disabled",
    }[this.mode];

    const stateLabel = {
      idle: "Ready",
      listening: "Listening",
      processing: "Processing",
      speaking: "Speaking",
    }[this.state];

    return `Voice button: ${modeLabel}, ${stateLabel}`;
  }

  private handleClick() {
    if (!this.enabled || this.mode === "off") return;

    // Don't trigger on push-to-talk (handled by mouse/touch events)
    if (this.mode === "push-to-talk") return;

    const action = this.state === "listening" ? "stop" : "toggle";
    this.dispatchEvent(
      new CustomEvent<VoiceButtonClickEvent>("voice-click", {
        detail: { action, currentState: this.state },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleMouseDown(e: MouseEvent) {
    if (this.mode !== "push-to-talk" || !this.enabled) return;

    e.preventDefault();
    this.isHolding = true;

    // Start listening
    this.dispatchEvent(
      new CustomEvent<VoiceButtonClickEvent>("voice-click", {
        detail: { action: "start", currentState: this.state },
        bubbles: true,
        composed: true,
      })
    );

    // Setup long press for settings
    this.longPressTimer = window.setTimeout(() => {
      this.handleSettingsClick();
    }, 1000);
  }

  private handleMouseUp() {
    if (this.mode !== "push-to-talk" || !this.isHolding) return;

    this.isHolding = false;

    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    // Stop listening
    this.dispatchEvent(
      new CustomEvent<VoiceButtonClickEvent>("voice-click", {
        detail: { action: "stop", currentState: this.state },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleTouchStart(e: TouchEvent) {
    if (this.mode !== "push-to-talk" || !this.enabled) return;

    e.preventDefault();
    this.isHolding = true;

    this.dispatchEvent(
      new CustomEvent<VoiceButtonClickEvent>("voice-click", {
        detail: { action: "start", currentState: this.state },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleTouchEnd() {
    if (this.mode !== "push-to-talk" || !this.isHolding) return;

    this.isHolding = false;

    this.dispatchEvent(
      new CustomEvent<VoiceButtonClickEvent>("voice-click", {
        detail: { action: "stop", currentState: this.state },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleSettingsClick() {
    this.dispatchEvent(
      new CustomEvent("voice-settings", {
        bubbles: true,
        composed: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "helix-voice-button": HelixVoiceButton;
  }
}
