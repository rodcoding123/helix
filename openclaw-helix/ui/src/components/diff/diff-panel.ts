/**
 * HELIX DIFF PANEL COMPONENT
 * Visual diff view for file changes with unified/split modes
 *
 * Features:
 * - Unified and split view modes
 * - Syntax highlighting
 * - Line-by-line navigation
 * - Inline commenting support
 * - Copy/revert functionality
 */

import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { classMap } from "lit/directives/class-map.js";
import type { FileDiff, DiffLine, DiffViewMode, DiffStats } from "./diff-types.js";
import { parseDiff, generateDiff, calculateStats } from "./diff-types.js";

/**
 * Diff panel component
 *
 * Usage:
 * ```html
 * <helix-diff-panel
 *   .filePath=${"src/index.ts"}
 *   .oldContent=${oldCode}
 *   .newContent=${newCode}
 *   view-mode="split"
 * ></helix-diff-panel>
 * ```
 */
@customElement("helix-diff-panel")
export class HelixDiffPanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--diff-bg, #1e1e1e);
      color: var(--diff-fg, #d4d4d4);
      font-family: var(--mono, "JetBrains Mono", "Fira Code", monospace);
      border-radius: 8px;
      overflow: hidden;
    }

    /* Header */
    .diff-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: var(--diff-header-bg, #252526);
      border-bottom: 1px solid var(--diff-border, #3c3c3c);
      flex-shrink: 0;
    }

    .diff-file-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .diff-file-path {
      font-size: 13px;
      font-weight: 500;
      color: var(--diff-fg, #d4d4d4);
    }

    .diff-file-status {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .diff-file-status--added {
      background: rgba(78, 201, 176, 0.2);
      color: #4ec9b0;
    }

    .diff-file-status--modified {
      background: rgba(220, 220, 170, 0.2);
      color: #dcdcaa;
    }

    .diff-file-status--deleted {
      background: rgba(244, 71, 71, 0.2);
      color: #f44747;
    }

    .diff-file-status--renamed {
      background: rgba(156, 220, 254, 0.2);
      color: #9cdcfe;
    }

    .diff-stats {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;
    }

    .diff-stat {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .diff-stat--additions {
      color: #4ec9b0;
    }

    .diff-stat--deletions {
      color: #f44747;
    }

    .diff-actions {
      display: flex;
      gap: 8px;
    }

    .diff-action {
      padding: 6px 12px;
      background: transparent;
      border: 1px solid var(--diff-border, #3c3c3c);
      border-radius: 4px;
      color: var(--diff-fg, #d4d4d4);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .diff-action:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: var(--diff-focus, #007acc);
    }

    .diff-action--active {
      background: var(--diff-focus, #007acc);
      border-color: var(--diff-focus, #007acc);
      color: white;
    }

    /* Body */
    .diff-body {
      flex: 1;
      overflow: auto;
    }

    .diff-body::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }

    .diff-body::-webkit-scrollbar-track {
      background: transparent;
    }

    .diff-body::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 5px;
    }

    .diff-body::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    /* Unified view */
    .diff-unified {
      min-width: fit-content;
    }

    .diff-line {
      display: flex;
      min-height: 20px;
      font-size: 13px;
      line-height: 20px;
    }

    .diff-line:hover {
      background: rgba(255, 255, 255, 0.02);
    }

    .diff-line--header {
      background: var(--diff-header-bg, #252526);
      color: var(--diff-info, #9cdcfe);
      padding: 4px 0;
      font-weight: 500;
    }

    .diff-line--added {
      background: rgba(78, 201, 176, 0.1);
    }

    .diff-line--added .diff-line-content {
      background: rgba(78, 201, 176, 0.15);
    }

    .diff-line--removed {
      background: rgba(244, 71, 71, 0.1);
    }

    .diff-line--removed .diff-line-content {
      background: rgba(244, 71, 71, 0.15);
    }

    .diff-line-gutter {
      display: flex;
      flex-shrink: 0;
      background: var(--diff-gutter-bg, #1e1e1e);
      border-right: 1px solid var(--diff-border, #3c3c3c);
    }

    .diff-line-number {
      width: 50px;
      padding: 0 8px;
      text-align: right;
      color: var(--diff-line-number, #858585);
      user-select: none;
      font-size: 12px;
    }

    .diff-line-number--old {
      border-right: 1px solid var(--diff-border, #3c3c3c);
    }

    .diff-line-indicator {
      width: 20px;
      text-align: center;
      font-weight: bold;
      user-select: none;
    }

    .diff-line--added .diff-line-indicator {
      color: #4ec9b0;
    }

    .diff-line--removed .diff-line-indicator {
      color: #f44747;
    }

    .diff-line-content {
      flex: 1;
      padding: 0 12px;
      white-space: pre;
      overflow-x: visible;
    }

    /* Split view */
    .diff-split {
      display: flex;
      min-width: fit-content;
    }

    .diff-split-pane {
      flex: 1;
      min-width: 0;
    }

    .diff-split-pane:first-child {
      border-right: 1px solid var(--diff-border, #3c3c3c);
    }

    .diff-split-pane-header {
      padding: 6px 12px;
      background: var(--diff-header-bg, #252526);
      border-bottom: 1px solid var(--diff-border, #3c3c3c);
      font-size: 12px;
      font-weight: 500;
      color: var(--diff-muted, #858585);
      text-align: center;
    }

    .diff-split-line {
      display: flex;
      min-height: 20px;
      font-size: 13px;
      line-height: 20px;
    }

    .diff-split-line--added {
      background: rgba(78, 201, 176, 0.1);
    }

    .diff-split-line--removed {
      background: rgba(244, 71, 71, 0.1);
    }

    .diff-split-line--empty {
      background: rgba(128, 128, 128, 0.05);
    }

    .diff-split-line-number {
      width: 50px;
      padding: 0 8px;
      text-align: right;
      color: var(--diff-line-number, #858585);
      user-select: none;
      font-size: 12px;
      background: var(--diff-gutter-bg, #1e1e1e);
      border-right: 1px solid var(--diff-border, #3c3c3c);
    }

    .diff-split-line-content {
      flex: 1;
      padding: 0 12px;
      white-space: pre;
      overflow-x: visible;
    }

    .diff-split-line--added .diff-split-line-content {
      background: rgba(78, 201, 176, 0.15);
    }

    .diff-split-line--removed .diff-split-line-content {
      background: rgba(244, 71, 71, 0.15);
    }

    /* Empty state */
    .diff-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--diff-muted, #858585);
      gap: 8px;
      padding: 40px;
    }

    .diff-empty-icon {
      font-size: 32px;
      opacity: 0.5;
    }

    /* Word diff highlighting */
    .diff-word-added {
      background: rgba(78, 201, 176, 0.3);
      padding: 0 2px;
      border-radius: 2px;
    }

    .diff-word-removed {
      background: rgba(244, 71, 71, 0.3);
      padding: 0 2px;
      border-radius: 2px;
    }

    /* Binary file notice */
    .diff-binary {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
      color: var(--diff-muted, #858585);
      font-style: italic;
    }
  `;

  /** File path */
  @property({ type: String, attribute: "file-path" }) filePath = "";

  /** Old content for comparison */
  @property({ type: String, attribute: "old-content" }) oldContent = "";

  /** New content for comparison */
  @property({ type: String, attribute: "new-content" }) newContent = "";

  /** File status */
  @property({ type: String }) status: FileDiff["status"] = "modified";

  /** View mode: unified or split */
  @property({ type: String, attribute: "view-mode" }) viewMode: DiffViewMode = "unified";

  /** Show line numbers */
  @property({ type: Boolean, attribute: "show-line-numbers" }) showLineNumbers = true;

  /** Is binary file */
  @property({ type: Boolean }) binary = false;

  /** Computed diff lines */
  @state() private diffLines: DiffLine[] = [];

  /** Split view paired lines */
  @state() private splitLines: { left: DiffLine | null; right: DiffLine | null }[] = [];

  override willUpdate(changedProperties: PropertyValues) {
    if (changedProperties.has("oldContent") || changedProperties.has("newContent")) {
      this.computeDiff();
    }
  }

  private computeDiff() {
    if (this.binary) {
      this.diffLines = [];
      this.splitLines = [];
      return;
    }

    this.diffLines = generateDiff(this.oldContent, this.newContent);
    this.splitLines = this.pairLinesForSplit(this.diffLines);
  }

  private pairLinesForSplit(
    lines: DiffLine[]
  ): { left: DiffLine | null; right: DiffLine | null }[] {
    const paired: { left: DiffLine | null; right: DiffLine | null }[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.type === "unchanged") {
        paired.push({ left: line, right: line });
        i++;
      } else if (line.type === "removed") {
        // Collect consecutive removed lines
        const removed: DiffLine[] = [];
        while (i < lines.length && lines[i].type === "removed") {
          removed.push(lines[i]);
          i++;
        }

        // Collect consecutive added lines
        const added: DiffLine[] = [];
        while (i < lines.length && lines[i].type === "added") {
          added.push(lines[i]);
          i++;
        }

        // Pair them up
        const maxLen = Math.max(removed.length, added.length);
        for (let j = 0; j < maxLen; j++) {
          paired.push({
            left: removed[j] || null,
            right: added[j] || null,
          });
        }
      } else if (line.type === "added") {
        // Added without corresponding removed
        paired.push({ left: null, right: line });
        i++;
      } else {
        i++;
      }
    }

    return paired;
  }

  override render() {
    const stats = this.calculateLocalStats();

    return html`
      <div class="diff-header">
        <div class="diff-file-info">
          <span class="diff-file-path">${this.filePath || "Untitled"}</span>
          <span class="diff-file-status diff-file-status--${this.status}">
            ${this.status}
          </span>
          <div class="diff-stats">
            <span class="diff-stat diff-stat--additions">+${stats.additions}</span>
            <span class="diff-stat diff-stat--deletions">-${stats.deletions}</span>
          </div>
        </div>
        <div class="diff-actions">
          <button
            class="diff-action ${this.viewMode === "unified" ? "diff-action--active" : ""}"
            @click=${() => this.setViewMode("unified")}
          >
            Unified
          </button>
          <button
            class="diff-action ${this.viewMode === "split" ? "diff-action--active" : ""}"
            @click=${() => this.setViewMode("split")}
          >
            Split
          </button>
          <button class="diff-action" @click=${this.handleCopy}>Copy New</button>
        </div>
      </div>

      <div class="diff-body">
        ${this.binary
          ? html`<div class="diff-binary">Binary file - cannot display diff</div>`
          : this.diffLines.length === 0
            ? html`
                <div class="diff-empty">
                  <span class="diff-empty-icon">=</span>
                  <span>No changes</span>
                </div>
              `
            : this.viewMode === "unified"
              ? this.renderUnified()
              : this.renderSplit()}
      </div>
    `;
  }

  private renderUnified() {
    return html`
      <div class="diff-unified">
        ${repeat(
          this.diffLines,
          (_, i) => i,
          (line) => this.renderUnifiedLine(line)
        )}
      </div>
    `;
  }

  private renderUnifiedLine(line: DiffLine) {
    const classes = {
      "diff-line": true,
      "diff-line--header": line.type === "header",
      "diff-line--added": line.type === "added",
      "diff-line--removed": line.type === "removed",
      "diff-line--unchanged": line.type === "unchanged",
    };

    const indicator =
      line.type === "added" ? "+" : line.type === "removed" ? "-" : line.type === "header" ? "@@" : " ";

    return html`
      <div class=${classMap(classes)}>
        ${this.showLineNumbers
          ? html`
              <div class="diff-line-gutter">
                <span class="diff-line-number diff-line-number--old">
                  ${line.oldLineNumber ?? ""}
                </span>
                <span class="diff-line-number">${line.newLineNumber ?? ""}</span>
              </div>
            `
          : nothing}
        <span class="diff-line-indicator">${indicator}</span>
        <span class="diff-line-content">${this.escapeHtml(line.content)}</span>
      </div>
    `;
  }

  private renderSplit() {
    return html`
      <div class="diff-split">
        <div class="diff-split-pane">
          <div class="diff-split-pane-header">Original</div>
          ${repeat(
            this.splitLines,
            (_, i) => i,
            (pair) => this.renderSplitLine(pair.left, "left")
          )}
        </div>
        <div class="diff-split-pane">
          <div class="diff-split-pane-header">Modified</div>
          ${repeat(
            this.splitLines,
            (_, i) => i,
            (pair) => this.renderSplitLine(pair.right, "right")
          )}
        </div>
      </div>
    `;
  }

  private renderSplitLine(line: DiffLine | null, side: "left" | "right") {
    if (!line) {
      return html`
        <div class="diff-split-line diff-split-line--empty">
          ${this.showLineNumbers
            ? html`<span class="diff-split-line-number"></span>`
            : nothing}
          <span class="diff-split-line-content"></span>
        </div>
      `;
    }

    const isAdded = line.type === "added" || (line.type === "unchanged" && side === "right" && line.type === "added");
    const isRemoved = line.type === "removed";

    const classes = {
      "diff-split-line": true,
      "diff-split-line--added": isAdded && side === "right",
      "diff-split-line--removed": isRemoved && side === "left",
    };

    const lineNum = side === "left" ? line.oldLineNumber : line.newLineNumber;

    return html`
      <div class=${classMap(classes)}>
        ${this.showLineNumbers
          ? html`<span class="diff-split-line-number">${lineNum ?? ""}</span>`
          : nothing}
        <span class="diff-split-line-content">${this.escapeHtml(line.content)}</span>
      </div>
    `;
  }

  private calculateLocalStats(): { additions: number; deletions: number } {
    return this.diffLines.reduce(
      (acc, line) => ({
        additions: acc.additions + (line.type === "added" ? 1 : 0),
        deletions: acc.deletions + (line.type === "removed" ? 1 : 0),
      }),
      { additions: 0, deletions: 0 }
    );
  }

  private setViewMode(mode: DiffViewMode) {
    this.viewMode = mode;
    this.dispatchEvent(
      new CustomEvent("view-mode-change", {
        detail: { mode },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(this.newContent);
      this.dispatchEvent(
        new CustomEvent("copy", {
          detail: { content: this.newContent },
          bubbles: true,
          composed: true,
        })
      );
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Set diff from unified diff text
   */
  setFromDiffText(diffText: string): void {
    const files = parseDiff(diffText);
    if (files.length > 0) {
      const file = files[0];
      this.filePath = file.filePath;
      this.status = file.status;
      this.binary = file.binary ?? false;

      // Flatten chunks into lines
      this.diffLines = file.chunks.flatMap((chunk) => chunk.lines);
      this.splitLines = this.pairLinesForSplit(this.diffLines);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "helix-diff-panel": HelixDiffPanel;
  }
}
