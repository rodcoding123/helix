/**
 * Log Sanitizer - Central log redaction system
 *
 * Detects and redacts sensitive data from log output including:
 * - API keys (Stripe, DeepSeek, Gemini, etc.)
 * - Discord webhook URLs
 * - JWT tokens
 * - Bearer tokens
 * - Supabase credentials
 * - And 20+ other secret patterns
 *
 * Each redaction produces consistent hash-based fingerprint for audit logging
 */

import { createHash } from 'node:crypto';

export class LogSanitizer {
  private patterns: Array<{
    pattern: RegExp;
    name: string;
  }> = [
    // Stripe keys
    { pattern: /sk_live_[a-zA-Z0-9]{8,}/g, name: 'stripe_sk_live' },
    { pattern: /sk_test_[a-zA-Z0-9]{8,}/g, name: 'stripe_sk_test' },
    { pattern: /pk_live_[a-zA-Z0-9]{8,}/g, name: 'stripe_pk_live' },
    { pattern: /pk_test_[a-zA-Z0-9]{8,}/g, name: 'stripe_pk_test' },
    { pattern: /rk_live_[a-zA-Z0-9]{8,}/g, name: 'stripe_rk_live' },
    { pattern: /rk_test_[a-zA-Z0-9]{8,}/g, name: 'stripe_rk_test' },

    // Discord webhooks
    {
      pattern: /https:\/\/discord\.com\/api\/webhooks\/\d+\/[a-zA-Z0-9_-]+/g,
      name: 'discord_webhook',
    },

    // JWT tokens (eyJ... format)
    { pattern: /eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, name: 'jwt_token' },

    // Bearer tokens
    { pattern: /Bearer\s+[a-zA-Z0-9_\-\.]{8,}/gi, name: 'bearer_token' },
    { pattern: /Authorization:\s*Bearer\s+[a-zA-Z0-9_\-\.]{8,}/gi, name: 'bearer_auth_header' },

    // API keys (generic)
    { pattern: /api[_-]?key[=:\s]+[a-zA-Z0-9_\-\.]{8,}/gi, name: 'generic_api_key' },
    { pattern: /apikey[=:\s]+[a-zA-Z0-9_\-\.]{8,}/gi, name: 'generic_apikey' },

    // Supabase
    { pattern: /supabase[_-]?key[=:\s]+[a-zA-Z0-9_\-\.]{8,}/gi, name: 'supabase_key' },
    {
      pattern: /supabase[_-]?url[=:\s]+https:\/\/[a-zA-Z0-9\-\.]+\.supabase\.co/gi,
      name: 'supabase_url',
    },

    // DeepSeek API key
    { pattern: /sk-[a-zA-Z0-9]{8,}/g, name: 'deepseek_api_key' },

    // Gemini API key
    { pattern: /AIzaSy[a-zA-Z0-9_\-]{33}/g, name: 'gemini_api_key' },

    // OpenAI/Generic sk- keys
    { pattern: /sk-[a-zA-Z0-9]{48,}/g, name: 'openai_api_key' },

    // AWS credentials
    { pattern: /AKIA[0-9A-Z]{16}/g, name: 'aws_access_key' },
    { pattern: /aws_secret_access_key[=:\s]+[a-zA-Z0-9/+=]{40}/gi, name: 'aws_secret_key' },

    // GitHub tokens
    { pattern: /gh[pousr]_[a-zA-Z0-9_]{36,}/g, name: 'github_token' },
    { pattern: /github[_-]?token[=:\s]+[a-zA-Z0-9_]{36,}/gi, name: 'github_token_var' },

    // Generic secrets in URLs
    {
      pattern: /[?&](?:api_?key|secret|token|password|auth)[=]([a-zA-Z0-9_\-\.]{8,})/gi,
      name: 'secret_in_url',
    },

    // Password-like patterns
    { pattern: /password[=:\s]+[^\s]{8,}/gi, name: 'password_assignment' },
    { pattern: /passwd[=:\s]+[^\s]{8,}/gi, name: 'passwd_assignment' },
    { pattern: /pwd[=:\s]+[^\s]{8,}/gi, name: 'pwd_assignment' },

    // Generic secrets
    { pattern: /secret[=:\s]+[^\s]{8,}/gi, name: 'generic_secret' },
    { pattern: /token[=:\s]+[a-zA-Z0-9_\-\.]{8,}/gi, name: 'token_assignment' },

    // SSH keys
    {
      pattern: /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g,
      name: 'ssh_private_key',
    },

    // Hex strings that look like secrets (32+ chars)
    { pattern: /[a-f0-9]{32,}/g, name: 'hex_secret' },
  ];

  /**
   * Sanitize a log message or value
   * @param input - Any value to sanitize
   * @returns Sanitized string with secrets redacted
   */
  sanitize(input: unknown): string {
    const text = this.convertToString(input);
    return this.redactPatterns(text);
  }

  /**
   * Sanitize an Error object
   * @param error - Error to sanitize
   * @returns Sanitized error message and stack trace
   */
  sanitizeError(error: unknown): string {
    if (!(error instanceof Error)) {
      return this.sanitize(error);
    }

    const parts: string[] = [];

    if (error.name) {
      parts.push(`${error.name}:`);
    }

    if (error.message) {
      parts.push(this.redactPatterns(error.message));
    }

    if (error.stack) {
      parts.push(this.redactPatterns(error.stack));
    }

    return parts.join(' ');
  }

  /**
   * Convert input to string representation
   * Handles objects, arrays, errors, primitives, etc.
   */
  private convertToString(input: unknown): string {
    if (input === null) {
      return 'null';
    }

    if (input === undefined) {
      return 'undefined';
    }

    if (typeof input === 'string') {
      return input;
    }

    if (typeof input === 'object') {
      if (input instanceof Error) {
        return this.sanitizeError(input);
      }

      if (Array.isArray(input)) {
        return JSON.stringify(input.map(item => this.sanitize(item)));
      }

      try {
        return JSON.stringify(input);
      } catch {
        return String(input);
      }
    }

    return String(input);
  }

  /**
   * Apply all redaction patterns
   * Replaces matches with [REDACTED:<hash>] for consistent tracking
   */
  private redactPatterns(text: string): string {
    let result = text;

    for (const { pattern, name } of this.patterns) {
      // Create fresh regex to avoid global state issues
      const regex = new RegExp(pattern.source, pattern.flags);
      result = result.replace(regex, match => {
        // Create consistent hash of the secret (not the value itself)
        const hash = this.createSecretHash(match, name);
        return `[REDACTED:${hash}]`;
      });
    }

    return result;
  }

  /**
   * Create a hash for the redacted secret
   * Useful for tracking same secrets across logs
   */
  private createSecretHash(secret: string, category: string): string {
    // Hash the category and length (not the value) for consistency
    const hashInput = `${category}:${secret.length}`;
    const hash = createHash('sha256').update(hashInput).digest('hex').slice(0, 8);
    return `${category.toUpperCase()}_${hash}`;
  }

  /**
   * Check if a string contains any detectable secrets
   * @param text - String to check
   * @returns true if secrets detected
   */
  hasSecrets(text: string): boolean {
    for (const { pattern } of this.patterns) {
      // Create fresh regex to avoid global state issues
      const regex = new RegExp(pattern.source, pattern.flags);
      if (regex.test(text)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Count detected secrets in a string
   * @param text - String to analyze
   * @returns Number of potential secret patterns found
   */
  countSecrets(text: string): number {
    let count = 0;

    for (const { pattern } of this.patterns) {
      // Create fresh regex to avoid global state issues
      const regex = new RegExp(pattern.source, pattern.flags);
      const matches = text.match(regex);
      if (matches) {
        count += matches.length;
      }
    }

    return count;
  }

  /**
   * Get all detected secrets with their categories (for auditing)
   * @param text - String to analyze
   * @returns Array of detected secrets with category info
   */
  detectSecrets(text: string): Array<{ category: string; match: string; index: number }> {
    const detected: Array<{ category: string; match: string; index: number }> = [];

    for (const { pattern, name } of this.patterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        detected.push({
          category: name,
          match: match[0],
          index: match.index,
        });
      }
    }

    return detected.sort((a, b) => a.index - b.index);
  }
}

/**
 * Global instance of log sanitizer
 */
export const globalSanitizer = new LogSanitizer();
