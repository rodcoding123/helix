/**
 * HELIX WAVEFORM COMPONENT
 * Real-time audio visualization using Web Audio API
 */

import { LitElement, html, css } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";

export type WaveformType = "input" | "output";
export type WaveformStyle = "bars" | "wave" | "circle";

/**
 * Audio waveform visualization component
 *
 * Usage:
 * ```html
 * <helix-waveform
 *   type="input"
 *   style="bars"
 *   .audioLevel=${0.5}
 * ></helix-waveform>
 * ```
 */
@customElement("helix-waveform")
export class HelixWaveform extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    .waveform-container {
      width: 100%;
      height: 100%;
      min-height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--waveform-bg, transparent);
      border-radius: 8px;
      overflow: hidden;
    }

    /* Bars visualization */
    .bars {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      height: 100%;
      padding: 4px;
    }

    .bar {
      width: 4px;
      background: var(--waveform-color, #8b5cf6);
      border-radius: 2px;
      transition: height 0.05s ease-out;
      min-height: 4px;
    }

    .bars.input .bar {
      background: var(--waveform-input-color, #10b981);
    }

    .bars.output .bar {
      background: var(--waveform-output-color, #8b5cf6);
    }

    /* Canvas for wave visualization */
    canvas {
      width: 100%;
      height: 100%;
    }

    /* Circle visualization */
    .circle-container {
      position: relative;
      width: 80px;
      height: 80px;
    }

    .circle {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: var(--waveform-color, #8b5cf6);
      opacity: 0.3;
      transition:
        transform 0.1s ease-out,
        opacity 0.1s ease-out;
    }

    .circle.input {
      background: var(--waveform-input-color, #10b981);
    }

    .circle.output {
      background: var(--waveform-output-color, #8b5cf6);
    }

    .circle-inner {
      position: absolute;
      inset: 20%;
      border-radius: 50%;
      background: var(--waveform-color, #8b5cf6);
      opacity: 0.8;
    }

    .circle-inner.input {
      background: var(--waveform-input-color, #10b981);
    }

    .circle-inner.output {
      background: var(--waveform-output-color, #8b5cf6);
    }

    /* Inactive state */
    .waveform-container.inactive {
      opacity: 0.3;
    }
  `;

  /** Type of audio (input = microphone, output = speaker) */
  @property({ type: String }) type: WaveformType = "input";

  /** Visualization style */
  @property({ type: String, attribute: "waveform-style" }) waveformStyle: WaveformStyle = "bars";

  /** Current audio level (0-1) */
  @property({ type: Number }) audioLevel = 0;

  /** Number of bars for bars style */
  @property({ type: Number }) barCount = 12;

  /** Whether the visualization is active */
  @property({ type: Boolean }) active = false;

  /** Audio data array for wave style */
  @state() private audioData: number[] = [];

  /** Animation frame ID */
  private animationId: number | null = null;

  /** Smoothed bar heights */
  private barHeights: number[] = [];

  @query("canvas") private canvas!: HTMLCanvasElement;

  override connectedCallback() {
    super.connectedCallback();
    this.barHeights = new Array(this.barCount).fill(0);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  override updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has("audioLevel") || changedProperties.has("active")) {
      this.updateVisualization();
    }
  }

  override render() {
    const containerClass = `waveform-container ${this.active ? "" : "inactive"}`;

    switch (this.waveformStyle) {
      case "bars":
        return html`
          <div class=${containerClass}>
            <div class="bars ${this.type}">${this.renderBars()}</div>
          </div>
        `;
      case "wave":
        return html`
          <div class=${containerClass}>
            <canvas></canvas>
          </div>
        `;
      case "circle":
        return html`
          <div class=${containerClass}>
            <div class="circle-container">${this.renderCircle()}</div>
          </div>
        `;
    }
  }

  private renderBars() {
    const bars = [];
    for (let i = 0; i < this.barCount; i++) {
      const height = this.barHeights[i] ?? 0;
      const heightPercent = Math.max(10, height * 100);
      bars.push(html`<div class="bar" style="height: ${heightPercent}%"></div>`);
    }
    return bars;
  }

  private renderCircle() {
    const scale = 1 + this.audioLevel * 0.5;
    const opacity = 0.3 + this.audioLevel * 0.4;

    return html`
      <div
        class="circle ${this.type}"
        style="transform: scale(${scale}); opacity: ${opacity}"
      ></div>
      <div class="circle-inner ${this.type}"></div>
    `;
  }

  private updateVisualization() {
    if (this.waveformStyle === "bars") {
      this.updateBars();
    } else if (this.waveformStyle === "wave") {
      this.updateCanvas();
    }
  }

  private updateBars() {
    const level = this.active ? this.audioLevel : 0;

    // Generate pseudo-random heights based on level
    for (let i = 0; i < this.barCount; i++) {
      const targetHeight = level * (0.3 + Math.random() * 0.7);
      // Smooth transition
      this.barHeights[i] = this.barHeights[i] * 0.7 + targetHeight * 0.3;
    }

    this.requestUpdate();
  }

  private updateCanvas() {
    if (!this.canvas) return;

    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (!this.active) return;

    // Draw waveform
    const color = this.type === "input" ? "#10b981" : "#8b5cf6";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = width / 100;
    let x = 0;

    for (let i = 0; i < 100; i++) {
      const v = Math.sin(i * 0.1 + Date.now() * 0.005) * this.audioLevel;
      const y = height / 2 + v * height * 0.4;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();
  }

  /**
   * Set audio data directly (for Web Audio API integration)
   */
  setAudioData(data: Float32Array | number[]) {
    this.audioData = Array.from(data);
    this.updateVisualization();
  }

  /**
   * Start animation loop for continuous visualization
   */
  startAnimation() {
    const animate = () => {
      this.updateVisualization();
      this.animationId = requestAnimationFrame(animate);
    };
    animate();
  }

  /**
   * Stop animation loop
   */
  stopAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "helix-waveform": HelixWaveform;
  }
}
