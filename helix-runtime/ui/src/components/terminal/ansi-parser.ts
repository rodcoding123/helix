/**
 * HELIX ANSI PARSER
 * Parses ANSI escape codes and converts them to styled HTML
 *
 * Supports:
 * - 16 standard colors (8 normal + 8 bright)
 * - 256 extended colors
 * - 24-bit true colors
 * - Bold, italic, underline, strikethrough
 * - Dim and blink
 */

export interface AnsiStyle {
  foreground: string | null;
  background: string | null;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  blink: boolean;
  inverse: boolean;
  strikethrough: boolean;
}

export interface AnsiSpan {
  text: string;
  style: AnsiStyle;
}

// Standard 16 ANSI colors
const COLORS_16: Record<number, string> = {
  // Normal colors (30-37, 40-47)
  30: "#1e1e1e", // Black
  31: "#e74c3c", // Red
  32: "#2ecc71", // Green
  33: "#f39c12", // Yellow
  34: "#3498db", // Blue
  35: "#9b59b6", // Magenta
  36: "#1abc9c", // Cyan
  37: "#ecf0f1", // White
  // Bright colors (90-97, 100-107)
  90: "#636e72", // Bright Black (Gray)
  91: "#ff6b6b", // Bright Red
  92: "#4cd137", // Bright Green
  93: "#fbc531", // Bright Yellow
  94: "#74b9ff", // Bright Blue
  95: "#a29bfe", // Bright Magenta
  96: "#81ecec", // Bright Cyan
  97: "#ffffff", // Bright White
};

// 256 color palette
function get256Color(code: number): string {
  if (code < 16) {
    // Standard colors
    const colorMap: Record<number, string> = {
      0: "#1e1e1e",
      1: "#e74c3c",
      2: "#2ecc71",
      3: "#f39c12",
      4: "#3498db",
      5: "#9b59b6",
      6: "#1abc9c",
      7: "#ecf0f1",
      8: "#636e72",
      9: "#ff6b6b",
      10: "#4cd137",
      11: "#fbc531",
      12: "#74b9ff",
      13: "#a29bfe",
      14: "#81ecec",
      15: "#ffffff",
    };
    return colorMap[code] || "#ffffff";
  } else if (code < 232) {
    // 216 color cube (6x6x6)
    const c = code - 16;
    const r = Math.floor(c / 36);
    const g = Math.floor((c % 36) / 6);
    const b = c % 6;
    const toHex = (v: number) =>
      Math.round(v === 0 ? 0 : v * 40 + 55)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } else {
    // Grayscale (232-255)
    const gray = (code - 232) * 10 + 8;
    const hex = gray.toString(16).padStart(2, "0");
    return `#${hex}${hex}${hex}`;
  }
}

/**
 * Create default ANSI style
 */
export function createDefaultStyle(): AnsiStyle {
  return {
    foreground: null,
    background: null,
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    blink: false,
    inverse: false,
    strikethrough: false,
  };
}

/**
 * Apply SGR (Select Graphic Rendition) codes to style
 */
function applySGR(style: AnsiStyle, codes: number[]): AnsiStyle {
  const newStyle = { ...style };
  let i = 0;

  while (i < codes.length) {
    const code = codes[i];

    switch (code) {
      case 0: // Reset
        Object.assign(newStyle, createDefaultStyle());
        break;
      case 1: // Bold
        newStyle.bold = true;
        break;
      case 2: // Dim
        newStyle.dim = true;
        break;
      case 3: // Italic
        newStyle.italic = true;
        break;
      case 4: // Underline
        newStyle.underline = true;
        break;
      case 5: // Blink
      case 6: // Rapid blink (treated same as blink)
        newStyle.blink = true;
        break;
      case 7: // Inverse
        newStyle.inverse = true;
        break;
      case 8: // Hidden (not rendered, but tracked)
        break;
      case 9: // Strikethrough
        newStyle.strikethrough = true;
        break;
      case 21: // Double underline (not widely supported, treat as underline)
        newStyle.underline = true;
        break;
      case 22: // Normal intensity (not bold, not dim)
        newStyle.bold = false;
        newStyle.dim = false;
        break;
      case 23: // Not italic
        newStyle.italic = false;
        break;
      case 24: // Not underline
        newStyle.underline = false;
        break;
      case 25: // Not blink
        newStyle.blink = false;
        break;
      case 27: // Not inverse
        newStyle.inverse = false;
        break;
      case 29: // Not strikethrough
        newStyle.strikethrough = false;
        break;
      case 30:
      case 31:
      case 32:
      case 33:
      case 34:
      case 35:
      case 36:
      case 37: // Standard foreground colors
        newStyle.foreground = COLORS_16[code];
        break;
      case 38: // Extended foreground color
        if (codes[i + 1] === 5) {
          // 256 color
          newStyle.foreground = get256Color(codes[i + 2] || 0);
          i += 2;
        } else if (codes[i + 1] === 2) {
          // 24-bit RGB
          const r = (codes[i + 2] || 0).toString(16).padStart(2, "0");
          const g = (codes[i + 3] || 0).toString(16).padStart(2, "0");
          const b = (codes[i + 4] || 0).toString(16).padStart(2, "0");
          newStyle.foreground = `#${r}${g}${b}`;
          i += 4;
        }
        break;
      case 39: // Default foreground
        newStyle.foreground = null;
        break;
      case 40:
      case 41:
      case 42:
      case 43:
      case 44:
      case 45:
      case 46:
      case 47: // Standard background colors
        newStyle.background = COLORS_16[code - 10];
        break;
      case 48: // Extended background color
        if (codes[i + 1] === 5) {
          // 256 color
          newStyle.background = get256Color(codes[i + 2] || 0);
          i += 2;
        } else if (codes[i + 1] === 2) {
          // 24-bit RGB
          const r = (codes[i + 2] || 0).toString(16).padStart(2, "0");
          const g = (codes[i + 3] || 0).toString(16).padStart(2, "0");
          const b = (codes[i + 4] || 0).toString(16).padStart(2, "0");
          newStyle.background = `#${r}${g}${b}`;
          i += 4;
        }
        break;
      case 49: // Default background
        newStyle.background = null;
        break;
      case 90:
      case 91:
      case 92:
      case 93:
      case 94:
      case 95:
      case 96:
      case 97: // Bright foreground colors
        newStyle.foreground = COLORS_16[code];
        break;
      case 100:
      case 101:
      case 102:
      case 103:
      case 104:
      case 105:
      case 106:
      case 107: // Bright background colors
        newStyle.background = COLORS_16[code - 10];
        break;
    }

    i++;
  }

  return newStyle;
}

/**
 * Parse ANSI escape sequences from text
 * Returns array of styled spans
 */
export function parseAnsi(text: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  let currentStyle = createDefaultStyle();

  // ANSI escape sequence pattern
  // Matches: ESC[...m (SGR) and other escape sequences
  const ansiPattern = /\x1b\[([0-9;]*)m|\x1b\[[0-9;]*[A-Za-z]|\x1b[=>][0-9]*[A-Za-z]?/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ansiPattern.exec(text)) !== null) {
    // Add text before this escape sequence
    if (match.index > lastIndex) {
      const textBefore = text.substring(lastIndex, match.index);
      if (textBefore) {
        spans.push({ text: textBefore, style: { ...currentStyle } });
      }
    }

    // Parse the escape sequence
    const fullMatch = match[0];
    const params = match[1];

    // Only process SGR (Select Graphic Rendition) sequences
    if (fullMatch.endsWith("m") && params !== undefined) {
      const codes = params
        .split(";")
        .filter((s) => s !== "")
        .map((s) => parseInt(s, 10) || 0);
      if (codes.length === 0) {
        codes.push(0); // Empty params means reset
      }
      currentStyle = applySGR(currentStyle, codes);
    }
    // Other escape sequences (cursor movement, etc.) are stripped

    lastIndex = match.index + fullMatch.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const remaining = text.substring(lastIndex);
    if (remaining) {
      spans.push({ text: remaining, style: { ...currentStyle } });
    }
  }

  return spans;
}

/**
 * Convert ANSI style to CSS style string
 */
export function styleToCSS(style: AnsiStyle): string {
  const css: string[] = [];

  let fg = style.foreground;
  let bg = style.background;

  // Handle inverse
  if (style.inverse) {
    [fg, bg] = [bg || "var(--terminal-bg, #1e1e1e)", fg || "var(--terminal-fg, #d4d4d4)"];
  }

  if (fg) css.push(`color: ${fg}`);
  if (bg) css.push(`background-color: ${bg}`);

  if (style.bold) css.push("font-weight: bold");
  if (style.dim) css.push("opacity: 0.7");
  if (style.italic) css.push("font-style: italic");
  if (style.underline) css.push("text-decoration: underline");
  if (style.strikethrough) {
    if (style.underline) {
      css.push("text-decoration: underline line-through");
    } else {
      css.push("text-decoration: line-through");
    }
  }
  if (style.blink) css.push("animation: ansi-blink 1s step-end infinite");

  return css.join("; ");
}

/**
 * Convert ANSI text to HTML string
 */
export function ansiToHtml(text: string): string {
  const spans = parseAnsi(text);
  return spans
    .map((span) => {
      const escapedText = escapeHtml(span.text);
      const css = styleToCSS(span.style);
      if (css) {
        return `<span style="${css}">${escapedText}</span>`;
      }
      return escapedText;
    })
    .join("");
}

/**
 * Strip all ANSI escape sequences from text
 */
export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[A-Za-z]|\x1b[=>][0-9]*[A-Za-z]?/g, "");
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Check if text contains ANSI escape sequences
 */
export function hasAnsi(text: string): boolean {
  return /\x1b\[/.test(text);
}

/**
 * CSS for ANSI blink animation (add to document once)
 */
export const ANSI_BLINK_CSS = `
@keyframes ansi-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
`;
