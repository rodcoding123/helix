/**
 * HELIX VOICE INDICATOR COMPONENT
 * Visual feedback for voice state in the status bar
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

export type VoiceIndicatorState = "idle" | "listening" | "processing" | "speaking" | "off";

/**
 * Voice state indicator for status bar
 *
 * Usage:
 * ```html
 * <helix-voice-indicator state="listening"></helix-voice-indicator>
 * ```
 */
@customElement("helix-voice-indicator")
export class HelixVoiceIndicator extends LitElement {
  static override styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      background: var(--bg-secondary, #1f1f2e);
      color: var(--text-muted, #9ca3af);
      transition:
        background 0.2s ease,
        color 0.2s ease;
    }

    /* State: Idle */
    .indicator.idle {
      background: var(--bg-secondary, #1f1f2e);
      color: var(--text-muted, #9ca3af);
    }

    /* State: Listening */
    .indicator.listening {
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
    }

    /* State: Processing */
    .indicator.processing {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
    }

    /* State: Speaking */
    .indicator.speaking {
      background: rgba(139, 92, 246, 0.15);
      color: #8b5cf6;
    }

    /* State: Off */
    .indicator.off {
      background: rgba(107, 114, 128, 0.1);
      color: #6b7280;
    }

    /* Icon */
    .icon {
      width: 14px;
      height: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .icon svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }

    /* Animated dots for listening */
    .dots {
      display: inline-flex;
      gap: 3px;
    }

    .dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: currentColor;
      animation: dot-pulse 1.2s ease-in-out infinite;
    }

    .dot:nth-child(2) {
      animation-delay: 0.2s;
    }

    .dot:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes dot-pulse {
      0%,
      60%,
      100% {
        transform: scale(0.6);
        opacity: 0.5;
      }
      30% {
        transform: scale(1);
        opacity: 1;
      }
    }

    /* Waveform animation for speaking */
    .waveform {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      height: 14px;
    }

    .bar {
      width: 2px;
      background: currentColor;
      border-radius: 1px;
      animation: wave 0.8s ease-in-out infinite;
    }

    .bar:nth-child(1) {
      height: 6px;
      animation-delay: 0s;
    }
    .bar:nth-child(2) {
      height: 10px;
      animation-delay: 0.1s;
    }
    .bar:nth-child(3) {
      height: 14px;
      animation-delay: 0.2s;
    }
    .bar:nth-child(4) {
      height: 10px;
      animation-delay: 0.3s;
    }
    .bar:nth-child(5) {
      height: 6px;
      animation-delay: 0.4s;
    }

    @keyframes wave {
      0%,
      100% {
        transform: scaleY(0.5);
      }
      50% {
        transform: scaleY(1);
      }
    }

    /* Spinner for processing */
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    /* Text label */
    .label {
      white-space: nowrap;
    }

    /* Compact mode */
    :host([compact]) .indicator {
      padding: 2px 6px;
    }

    :host([compact]) .label {
      display: none;
    }
  `;

  /** Current voice state */
  @property({ type: String }) state: VoiceIndicatorState = "idle";

  /** Whether to show the label */
  @property({ type: Boolean }) showLabel = true;

  override render() {
    const classes = {
      indicator: true,
      [this.state]: true,
    };

    return html`
      <div class=${classMap(classes)}>
        ${this.renderStateIcon()}
        ${this.showLabel ? html`<span class="label">${this.getLabel()}</span>` : ""}
      </div>
    `;
  }

  private renderStateIcon() {
    switch (this.state) {
      case "listening":
        return html`
          <span class="dots">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </span>
        `;
      case "processing":
        return html`<span class="spinner"></span>`;
      case "speaking":
        return html`
          <span class="waveform">
            <span class="bar"></span>
            <span class="bar"></span>
            <span class="bar"></span>
            <span class="bar"></span>
            <span class="bar"></span>
          </span>
        `;
      case "off":
        return html`
          <span class="icon">
            <svg viewBox="0 0 24 24">
              <path
                d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"
              />
            </svg>
          </span>
        `;
      default:
        return html`
          <span class="icon">
            <svg viewBox="0 0 24 24">
              <path
                d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
              />
              <path
                d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
              />
            </svg>
          </span>
        `;
    }
  }

  private getLabel(): string {
    switch (this.state) {
      case "listening":
        return "Listening";
      case "processing":
        return "Processing";
      case "speaking":
        return "Speaking";
      case "off":
        return "Voice off";
      default:
        return "Voice ready";
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "helix-voice-indicator": HelixVoiceIndicator;
  }
}
