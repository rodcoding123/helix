/**
 * Safe Console Wrapper - Global console override with automatic log sanitization
 *
 * Replaces global console methods to automatically sanitize output before logging.
 * Prevents accidental secret leakage through console.error(), console.log(), etc.
 *
 * Usage: Import this module early in application startup (before any logging)
 *   import './lib/safe-console.js';
 *
 * All console output will be automatically sanitized. Original console preserved as
 * console.raw for debugging when needed.
 */

import { globalSanitizer } from './log-sanitizer.js';

// Extend Console interface to include raw property
declare global {
  interface Console {
    raw?: typeof console;
  }
}

// Preserve original console methods
const originalConsole = { ...console };

// Save original methods that we'll override
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info ?? originalLog;
const originalDebug = console.debug ?? originalLog;

/**
 * Override console.log with sanitization
 */
console.log = (...args: unknown[]): void => {
  const sanitized = args.map((arg) => globalSanitizer.sanitize(arg));
  originalLog.apply(console, sanitized);
};

/**
 * Override console.error with sanitization
 * Critical: This prevents error object leakage containing secrets
 */
console.error = (...args: unknown[]): void => {
  const sanitized = args.map((arg) => {
    if (arg instanceof Error) {
      return globalSanitizer.sanitizeError(arg);
    }
    return globalSanitizer.sanitize(arg);
  });
  originalError.apply(console, sanitized);
};

/**
 * Override console.warn with sanitization
 */
console.warn = (...args: unknown[]): void => {
  const sanitized = args.map((arg) => globalSanitizer.sanitize(arg));
  originalWarn.apply(console, sanitized);
};

/**
 * Override console.info with sanitization
 */
(console.info as any) = (...args: unknown[]): void => {
  const sanitized = args.map((arg) => globalSanitizer.sanitize(arg));
  originalInfo.apply(console, sanitized);
};

/**
 * Override console.debug with sanitization
 */
(console.debug as any) = (...args: unknown[]): void => {
  const sanitized = args.map((arg) => globalSanitizer.sanitize(arg));
  originalDebug.apply(console, sanitized);
};

/**
 * Preserve original console for debugging
 * Access with console.raw.log(), console.raw.error(), etc. when needed
 */
(console.raw as any) = originalConsole;

/**
 * Mark that console has been safety-wrapped (for testing/verification)
 */
(console as any).__safeWrapped = true;

export {};
