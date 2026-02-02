/**
 * HELIX LIVE TERMINAL COMPONENT
 * Real-time character-by-character terminal output streaming
 *
 * Features:
 * - Character streaming with configurable speed
 * - ANSI color code support
 * - Auto-scroll with smart pause on user scroll
 * - Line virtualization for large outputs
 * - Command prompt display
 * - Copy/selection support
 */

import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import type { TerminalLineData, LineType } from "./terminal-line.js";
import "./terminal-line.js";

export interface TerminalCommand {
  id: string;
  command: string;
  cwd?: string;
  startTime: number;
  endTime?: number;
  exitCode?: number;
  lines: TerminalLineData[];
}

export interface StreamingChunk {
  commandId: string;
  content: string;
  type: "stdout" | "stderr";
  timestamp: number;
}

/**
 * Live terminal component with streaming support
 *
 * Usage:
 * ```html
 * <helix-live-terminal
 *   .commands=${commands}
 *   auto-scroll
 *   show-timestamps
 * ></helix-live-terminal>
 * ```
 *
 * Stream data:
 * ```typescript
 * terminal.streamChunk({ commandId: '1', content: 'Hello', type: 'stdout' });
 * ```
 */
@customElement("helix-live-terminal")
export class HelixLiveTerminal extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--terminal-bg, #1e1e1e);
      color: var(--terminal-fg, #d4d4d4);
      font-family: var(--mono, "JetBrains Mono", "Fira Code", monospace);
      border-radius: 8px;
      overflow: hidden;
    }

    .terminal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: var(--terminal-header-bg, #252526);
      border-bottom: 1px solid var(--terminal-border, #3c3c3c);
      flex-shrink: 0;
    }

    .terminal-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 500;
      color: var(--terminal-title, #cccccc);
    }

    .terminal-title-icon {
      width: 14px;
      height: 14px;
      opacity: 0.7;
    }

    .terminal-actions {
      display: flex;
      gap: 4px;
    }

    .terminal-action {
      padding: 4px 8px;
      background: transparent;
      border: none;
      border-radius: 4px;
      color: var(--terminal-fg, #d4d4d4);
      font-size: 11px;
      cursor: pointer;
      opacity: 0.7;
      transition: all 0.15s ease;
    }

    .terminal-action:hover {
      background: rgba(255, 255, 255, 0.1);
      opacity: 1;
    }

    .terminal-body {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      scroll-behavior: smooth;
    }

    .terminal-body::-webkit-scrollbar {
      width: 10px;
    }

    .terminal-body::-webkit-scrollbar-track {
      background: transparent;
    }

    .terminal-body::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 5px;
      border: 2px solid transparent;
      background-clip: padding-box;
    }

    .terminal-body::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.25);
      background-clip: padding-box;
    }

    .terminal-content {
      padding: 8px 0;
      min-height: 100%;
    }

    .command-block {
      margin-bottom: 16px;
    }

    .command-block:last-child {
      margin-bottom: 0;
    }

    .command-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      background: rgba(255, 255, 255, 0.03);
      border-left: 3px solid var(--terminal-prompt, #569cd6);
      font-size: 12px;
    }

    .command-prompt {
      color: var(--terminal-prompt, #569cd6);
      font-weight: 500;
    }

    .command-text {
      color: var(--terminal-fg, #d4d4d4);
      flex: 1;
    }

    .command-cwd {
      color: var(--terminal-dim, #808080);
      font-size: 11px;
      opacity: 0.7;
    }

    .command-status {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
    }

    .command-status--running {
      color: var(--terminal-info, #9cdcfe);
    }

    .command-status--success {
      color: var(--terminal-success, #4ec9b0);
    }

    .command-status--error {
      color: var(--terminal-error, #f44747);
    }

    .spinner {
      width: 12px;
      height: 12px;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .command-output {
      /* Lines container */
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--terminal-dim, #808080);
      font-size: 13px;
      gap: 8px;
      padding: 40px;
      text-align: center;
    }

    .empty-state-icon {
      font-size: 32px;
      opacity: 0.5;
    }

    .scroll-indicator {
      position: absolute;
      bottom: 16px;
      right: 20px;
      padding: 6px 12px;
      background: var(--terminal-header-bg, #252526);
      border: 1px solid var(--terminal-border, #3c3c3c);
      border-radius: 16px;
      font-size: 11px;
      color: var(--terminal-fg, #d4d4d4);
      cursor: pointer;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.2s ease;
      z-index: 10;
    }

    .scroll-indicator--visible {
      opacity: 1;
      transform: translateY(0);
    }

    .scroll-indicator:hover {
      background: var(--terminal-border, #3c3c3c);
    }

    /* Terminal focused state */
    :host(:focus-within) {
      outline: 1px solid var(--terminal-focus, #007acc);
      outline-offset: -1px;
    }
  `;

  /** Commands with their output */
  @property({ type: Array }) commands: TerminalCommand[] = [];

  /** Auto-scroll to bottom on new content */
  @property({ type: Boolean, attribute: "auto-scroll" }) autoScroll = true;

  /** Show timestamps on lines */
  @property({ type: Boolean, attribute: "show-timestamps" }) showTimestamps = false;

  /** Show line numbers */
  @property({ type: Boolean, attribute: "show-line-numbers" }) showLineNumbers = false;

  /** Terminal title */
  @property({ type: String }) title = "Terminal";

  /** Maximum lines to keep (0 = unlimited) */
  @property({ type: Number, attribute: "max-lines" }) maxLines = 10000;

  /** Whether user has scrolled away from bottom */
  @state() private userScrolled = false;

  /** Current streaming line content */
  @state() private streamingContent: Map<string, string> = new Map();

  @query(".terminal-body") private terminalBody!: HTMLElement;

  private scrollObserver: IntersectionObserver | null = null;
  private lineIdCounter = 0;

  override connectedCallback() {
    super.connectedCallback();
    // Set up scroll detection
    this.addEventListener("wheel", this.handleWheel, { passive: true });
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("wheel", this.handleWheel);
    this.scrollObserver?.disconnect();
  }

  override updated(changedProperties: PropertyValues) {
    if (changedProperties.has("commands") && this.autoScroll && !this.userScrolled) {
      this.scrollToBottom();
    }
  }

  override render() {
    return html`
      <div class="terminal-header">
        <div class="terminal-title">
          <svg class="terminal-title-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 19V7H4v12h16m0-16a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h16m-7 14v-2h5v2h-5m-9.5-2L7 11l-3.5 3.5L5 16l5-5-5-5-1.5 1.5L7 11z" />
          </svg>
          ${this.title}
        </div>
        <div class="terminal-actions">
          <button class="terminal-action" @click=${this.handleClear} title="Clear">
            Clear
          </button>
          <button class="terminal-action" @click=${this.handleCopyAll} title="Copy all">
            Copy
          </button>
        </div>
      </div>

      <div class="terminal-body" @scroll=${this.handleScroll}>
        <div class="terminal-content">
          ${this.commands.length === 0
            ? html`
                <div class="empty-state">
                  <span class="empty-state-icon">></span>
                  <span>Waiting for commands...</span>
                </div>
              `
            : repeat(
                this.commands,
                (cmd) => cmd.id,
                (cmd) => this.renderCommand(cmd)
              )}
        </div>
      </div>

      <div
        class="scroll-indicator ${this.userScrolled ? "scroll-indicator--visible" : ""}"
        @click=${this.scrollToBottom}
      >
        Scroll to bottom
      </div>
    `;
  }

  private renderCommand(command: TerminalCommand) {
    const isRunning = command.endTime === undefined;
    const isSuccess = command.exitCode === 0;
    const statusClass = isRunning
      ? "command-status--running"
      : isSuccess
        ? "command-status--success"
        : "command-status--error";

    return html`
      <div class="command-block">
        <div class="command-header">
          <span class="command-prompt">$</span>
          <span class="command-text">${command.command}</span>
          ${command.cwd ? html`<span class="command-cwd">${command.cwd}</span>` : nothing}
          <span class="command-status ${statusClass}">
            ${isRunning
              ? html`<span class="spinner"></span> Running...`
              : command.exitCode === 0
                ? "Done"
                : `Exit ${command.exitCode}`}
          </span>
        </div>
        <div class="command-output">
          ${repeat(
            command.lines,
            (line) => line.id,
            (line, index) => html`
              <helix-terminal-line
                .line=${line}
                ?show-timestamp=${this.showTimestamps}
                ?show-line-number=${this.showLineNumbers}
                line-number=${index + 1}
                ?show-cursor=${line.isPartial && index === command.lines.length - 1}
              ></helix-terminal-line>
            `
          )}
        </div>
      </div>
    `;
  }

  /**
   * Stream a chunk of output character-by-character
   */
  streamChunk(chunk: StreamingChunk): void {
    const cmd = this.commands.find((c) => c.id === chunk.commandId);
    if (!cmd) return;

    // Get or create streaming buffer for this command
    const key = `${chunk.commandId}-${chunk.type}`;
    let buffer = this.streamingContent.get(key) || "";
    buffer += chunk.content;

    // Split on newlines
    const lines = buffer.split("\n");

    // All complete lines
    const completeLines = lines.slice(0, -1);
    const partialLine = lines[lines.length - 1];

    // Add complete lines
    for (const lineContent of completeLines) {
      this.addLine(cmd, lineContent, chunk.type, false);
    }

    // Update or create partial line
    if (partialLine) {
      const lastLine = cmd.lines[cmd.lines.length - 1];
      if (lastLine?.isPartial && lastLine.type === chunk.type) {
        // Update existing partial line
        lastLine.content = partialLine;
        lastLine.timestamp = chunk.timestamp;
      } else {
        // Create new partial line
        this.addLine(cmd, partialLine, chunk.type, true);
      }
      this.streamingContent.set(key, partialLine);
    } else {
      this.streamingContent.delete(key);
    }

    this.requestUpdate();

    // Auto-scroll if enabled
    if (this.autoScroll && !this.userScrolled) {
      this.scrollToBottom();
    }
  }

  /**
   * Add a complete line to a command
   */
  addLine(
    command: TerminalCommand,
    content: string,
    type: LineType = "stdout",
    isPartial: boolean = false
  ): TerminalLineData {
    // Check if last line is partial and needs to be completed
    const lastLine = command.lines[command.lines.length - 1];
    if (lastLine?.isPartial && lastLine.type === type && !isPartial) {
      lastLine.content = content;
      lastLine.isPartial = false;
      lastLine.timestamp = Date.now();
      return lastLine;
    }

    const line: TerminalLineData = {
      id: `line-${++this.lineIdCounter}`,
      content,
      type,
      timestamp: Date.now(),
      isPartial,
    };

    command.lines.push(line);

    // Enforce max lines
    if (this.maxLines > 0 && command.lines.length > this.maxLines) {
      command.lines.splice(0, command.lines.length - this.maxLines);
    }

    return line;
  }

  /**
   * Start a new command
   */
  startCommand(command: string, cwd?: string): TerminalCommand {
    const cmd: TerminalCommand = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      command,
      cwd,
      startTime: Date.now(),
      lines: [],
    };

    this.commands = [...this.commands, cmd];
    this.requestUpdate();

    // Scroll to show new command
    if (this.autoScroll && !this.userScrolled) {
      requestAnimationFrame(() => this.scrollToBottom());
    }

    return cmd;
  }

  /**
   * Complete a command
   */
  completeCommand(commandId: string, exitCode: number): void {
    const cmd = this.commands.find((c) => c.id === commandId);
    if (cmd) {
      cmd.endTime = Date.now();
      cmd.exitCode = exitCode;

      // Finalize any partial lines
      const lastLine = cmd.lines[cmd.lines.length - 1];
      if (lastLine?.isPartial) {
        lastLine.isPartial = false;
      }

      // Clear streaming buffer
      this.streamingContent.delete(`${commandId}-stdout`);
      this.streamingContent.delete(`${commandId}-stderr`);

      this.requestUpdate();

      // Dispatch event
      this.dispatchEvent(
        new CustomEvent("command-complete", {
          detail: { command: cmd },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  /**
   * Clear all output
   */
  clear(): void {
    this.commands = [];
    this.streamingContent.clear();
    this.userScrolled = false;
    this.requestUpdate();
  }

  /**
   * Scroll to bottom of terminal
   */
  scrollToBottom(): void {
    if (this.terminalBody) {
      this.terminalBody.scrollTop = this.terminalBody.scrollHeight;
      this.userScrolled = false;
    }
  }

  /**
   * Get all output as plain text
   */
  getPlainText(): string {
    return this.commands
      .map((cmd) => {
        const header = `$ ${cmd.command}`;
        const output = cmd.lines.map((line) => line.content).join("\n");
        const footer = cmd.exitCode !== undefined ? `[Exit ${cmd.exitCode}]` : "";
        return [header, output, footer].filter(Boolean).join("\n");
      })
      .join("\n\n");
  }

  private handleScroll = () => {
    if (!this.terminalBody) return;

    const { scrollTop, scrollHeight, clientHeight } = this.terminalBody;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    this.userScrolled = !isAtBottom;
  };

  private handleWheel = () => {
    // Mark as user scrolled when they use the wheel
    if (this.terminalBody) {
      const { scrollTop, scrollHeight, clientHeight } = this.terminalBody;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

      if (!isAtBottom) {
        this.userScrolled = true;
      }
    }
  };

  private handleClear = () => {
    this.clear();
    this.dispatchEvent(new CustomEvent("clear", { bubbles: true, composed: true }));
  };

  private handleCopyAll = async () => {
    const text = this.getPlainText();
    try {
      await navigator.clipboard.writeText(text);
      this.dispatchEvent(
        new CustomEvent("copy", {
          detail: { text },
          bubbles: true,
          composed: true,
        })
      );
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "helix-live-terminal": HelixLiveTerminal;
  }
}
