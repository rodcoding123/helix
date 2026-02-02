/**
 * HELIX TERMINAL LINE COMPONENT
 * Renders a single line of terminal output with ANSI support
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { ansiToHtml, stripAnsi, ANSI_BLINK_CSS } from "./ansi-parser.js";

export type LineType = "stdout" | "stderr" | "stdin" | "prompt" | "info" | "success" | "error" | "warning";

export interface TerminalLineData {
  id: string;
  content: string;
  type: LineType;
  timestamp: number;
  isPartial?: boolean; // For streaming - line not yet complete
  exitCode?: number; // For command completion
}

/**
 * Individual terminal line component
 *
 * Usage:
 * ```html
 * <helix-terminal-line
 *   .line=${lineData}
 *   show-timestamp
 * ></helix-terminal-line>
 * ```
 */
@customElement("helix-terminal-line")
export class HelixTerminalLine extends LitElement {
  static override styles = css`
    ${unsafeCSS(ANSI_BLINK_CSS)}

    :host {
      display: block;
      font-family: var(--mono, "JetBrains Mono", "Fira Code", monospace);
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .line {
      display: flex;
      padding: 1px 12px;
      min-height: 20px;
    }

    .line:hover {
      background: rgba(255, 255, 255, 0.03);
    }

    .line--stdout {
      color: var(--terminal-fg, #d4d4d4);
    }

    .line--stderr {
      color: var(--terminal-error, #f44747);
      background: rgba(244, 71, 71, 0.05);
    }

    .line--stdin {
      color: var(--terminal-cyan, #4ec9b0);
    }

    .line--prompt {
      color: var(--terminal-prompt, #569cd6);
      font-weight: 500;
    }

    .line--info {
      color: var(--terminal-info, #9cdcfe);
    }

    .line--success {
      color: var(--terminal-success, #4ec9b0);
    }

    .line--error {
      color: var(--terminal-error, #f44747);
    }

    .line--warning {
      color: var(--terminal-warning, #dcdcaa);
    }

    .line--partial {
      opacity: 0.8;
    }

    .timestamp {
      flex-shrink: 0;
      color: var(--terminal-dim, #808080);
      font-size: 11px;
      margin-right: 12px;
      opacity: 0.6;
      min-width: 65px;
    }

    .content {
      flex: 1;
      overflow-wrap: break-word;
    }

    .exit-code {
      margin-left: 12px;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 500;
    }

    .exit-code--success {
      background: rgba(78, 201, 176, 0.15);
      color: var(--terminal-success, #4ec9b0);
    }

    .exit-code--failure {
      background: rgba(244, 71, 71, 0.15);
      color: var(--terminal-error, #f44747);
    }

    .cursor {
      display: inline-block;
      width: 8px;
      height: 15px;
      background: var(--terminal-cursor, #aeafad);
      animation: cursor-blink 1s step-end infinite;
      vertical-align: text-bottom;
      margin-left: 1px;
    }

    @keyframes cursor-blink {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0;
      }
    }

    /* Line number gutter (optional) */
    .line-number {
      flex-shrink: 0;
      color: var(--terminal-dim, #808080);
      font-size: 11px;
      margin-right: 12px;
      text-align: right;
      min-width: 32px;
      opacity: 0.4;
      user-select: none;
    }

    /* Selection highlight */
    ::selection {
      background: var(--terminal-selection, rgba(38, 79, 120, 0.6));
    }
  `;

  /** Line data to render */
  @property({ type: Object }) line: TerminalLineData = {
    id: "",
    content: "",
    type: "stdout",
    timestamp: Date.now(),
  };

  /** Show timestamp */
  @property({ type: Boolean, attribute: "show-timestamp" }) showTimestamp = false;

  /** Show line numbers */
  @property({ type: Boolean, attribute: "show-line-number" }) showLineNumber = false;

  /** Line number (if showing) */
  @property({ type: Number, attribute: "line-number" }) lineNumber = 0;

  /** Show blinking cursor at end (for streaming) */
  @property({ type: Boolean, attribute: "show-cursor" }) showCursor = false;

  override render() {
    const classes = [
      "line",
      `line--${this.line.type}`,
      this.line.isPartial ? "line--partial" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return html`
      <div class=${classes}>
        ${this.showLineNumber
          ? html`<span class="line-number">${this.lineNumber}</span>`
          : nothing}
        ${this.showTimestamp
          ? html`<span class="timestamp">${this.formatTimestamp()}</span>`
          : nothing}
        <span class="content">
          ${this.renderContent()}
          ${this.showCursor && this.line.isPartial
            ? html`<span class="cursor"></span>`
            : nothing}
        </span>
        ${this.line.exitCode !== undefined
          ? html`
              <span
                class="exit-code ${this.line.exitCode === 0
                  ? "exit-code--success"
                  : "exit-code--failure"}"
              >
                exit ${this.line.exitCode}
              </span>
            `
          : nothing}
      </div>
    `;
  }

  private renderContent() {
    // Parse ANSI codes and render as HTML
    const htmlContent = ansiToHtml(this.line.content);
    return unsafeHTML(htmlContent);
  }

  private formatTimestamp(): string {
    const date = new Date(this.line.timestamp);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  /**
   * Get plain text content (ANSI stripped)
   */
  getPlainText(): string {
    return stripAnsi(this.line.content);
  }
}

// Helper to create CSS from string (for ANSI_BLINK_CSS injection)
function unsafeCSS(cssText: string) {
  return css([cssText] as unknown as TemplateStringsArray);
}

declare global {
  interface HTMLElementTagNameMap {
    "helix-terminal-line": HelixTerminalLine;
  }
}
