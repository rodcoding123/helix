/**
 * ADVANCED INJECTION DETECTION
 *
 * Detects sophisticated indirect prompt injection attacks that use:
 * - Obfuscation (base64, hex, unicode)
 * - Zero-width characters
 * - Multi-layer encoding
 * - Delayed trigger patterns
 * - Cross-call injection
 */

import { sendAlert } from './logging-hooks.js';

/**
 * Injection detection context for tracking across multiple calls
 */
export interface InjectionContext {
  sessionId: string;
  callCount: number;
  lastToolCall?: string;
  suspiciousPatterns: string[];
  decodedContent: Map<string, string[]>;
  riskScore: number;
}

/**
 * Detect base64-encoded payloads
 */
export function detectBase64Encoding(content: string): {
  hasBase64: boolean;
  suspicious: boolean;
  patterns: string[];
} {
  const patterns: string[] = [];

  // Look for large base64 sequences (likely encoded)
  const base64Pattern = /[A-Za-z0-9+/]{50,}={0,2}/g;
  const matches = content.match(base64Pattern);

  if (matches && matches.length > 0) {
    for (const match of matches) {
      try {
        // Try to decode
        const decoded = Buffer.from(match, 'base64').toString('utf-8');

        // Check if decoded looks like code/instructions
        const codePatterns = /SYSTEM|ADMIN|OVERRIDE|IGNORE|EXECUTE/gi;
        if (codePatterns.test(decoded)) {
          patterns.push(`Suspicious base64: ${match.substring(0, 50)}...`);
        }
      } catch {
        // Invalid base64, skip
      }
    }
  }

  return {
    hasBase64: !!matches,
    suspicious: patterns.length > 0,
    patterns,
  };
}

/**
 * Detect hex-encoded payloads
 */
export function detectHexEncoding(content: string): {
  hasHex: boolean;
  suspicious: boolean;
  patterns: string[];
} {
  const patterns: string[] = [];

  // Look for hex sequences
  const hexPattern = /\\x[0-9a-fA-F]{2}/g;
  const matches = content.match(hexPattern);

  if (matches && matches.length > 10) {
    // Many hex sequences is suspicious
    patterns.push(`Found ${matches.length} hex-encoded characters`);

    // Try to decode
    try {
      let decoded = '';
      for (const match of matches) {
        const charCode = parseInt(match.substring(2), 16);
        decoded += String.fromCharCode(charCode);
      }

      if (/SYSTEM|ADMIN|OVERRIDE|EXECUTE/gi.test(decoded)) {
        patterns.push(`Suspicious decoded hex: ${decoded}`);
      }
    } catch {
      // Decoding error
    }
  }

  return {
    hasHex: !!matches,
    suspicious: patterns.length > 0,
    patterns,
  };
}

/**
 * Detect zero-width characters and invisible Unicode
 */
export function detectInvisibleCharacters(content: string): {
  hasInvisible: boolean;
  patterns: string[];
} {
  const patterns: string[] = [];

  // Common invisible Unicode characters
  const invisibleChars: { [key: string]: string } = {
    '\u200B': 'zero-width space',
    '\u200C': 'zero-width non-joiner',
    '\u200D': 'zero-width joiner',
    '\u2060': 'word joiner',
    '\uFEFF': 'zero-width no-break space',
    '\u061C': 'Arabic letter mark',
    '\u180E': 'Mongolian vowel separator',
  };

  for (const [char, name] of Object.entries(invisibleChars)) {
    if (content.includes(char)) {
      patterns.push(`Detected ${name} (U+${char.charCodeAt(0).toString(16).toUpperCase()})`);
    }
  }

  return {
    hasInvisible: patterns.length > 0,
    patterns,
  };
}

/**
 * Detect HTML/CSS encoding tricks
 */
export function detectHTMLEncoding(content: string): {
  hasSuspicious: boolean;
  patterns: string[];
} {
  const patterns: string[] = [];

  // HTML entity patterns that could hide code
  const entities = [
    /&#\d{2,};/g, // Numeric entities
    /&[a-z]+;/gi, // Named entities
    /&#x[0-9a-f]+;/gi, // Hex entities
  ];

  for (const entityPattern of entities) {
    const matches = content.match(entityPattern);
    if (matches && matches.length > 5) {
      patterns.push(`Detected ${matches.length} HTML entities`);
    }
  }

  // Check for CSS-based obfuscation
  if (/font-family|display:none|visibility:hidden/gi.test(content)) {
    patterns.push('HTML contains hidden content indicators');
  }

  return {
    hasSuspicious: patterns.length > 0,
    patterns,
  };
}

/**
 * Detect delayed trigger patterns (instructions to activate later)
 */
export function detectDelayedTriggers(content: string): {
  hasDelayedTriggers: boolean;
  patterns: string[];
} {
  const patterns: string[] = [];

  // Patterns that suggest delayed activation
  const triggerPatterns = [
    /when.*asked|if.*questioned|when.*prompted/gi,
    /next.*call|following.*request|later.*asked/gi,
    /ignore.*previous|override.*instructions/gi,
    /from.*now.*on|starting.*now|from.*this.*point/gi,
  ];

  for (const pattern of triggerPatterns) {
    if (pattern.test(content)) {
      const match = content.match(pattern)?.[0];
      if (match) {
        patterns.push(`Delayed trigger: "${match}"`);
      }
    }
  }

  return {
    hasDelayedTriggers: patterns.length > 0,
    patterns,
  };
}

/**
 * Detect suspicious command patterns
 */
export function detectSuspiciousCommands(content: string): {
  hasSuspicious: boolean;
  patterns: string[];
} {
  const patterns: string[] = [];

  // Dangerous operations disguised in text
  const dangerousPatterns = [
    /execute.*command|run.*code|eval|exec/gi,
    /write.*file|create.*file|delete.*file|rm\s+-rf/gi,
    /system.*command|shell.*command|bash|sh\s+/gi,
    /reverse.*shell|bind.*shell|backdoor/gi,
    /exfiltrate|steal.*data|leak.*secret/gi,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      const match = content.match(pattern)?.[0];
      if (match) {
        patterns.push(`Suspicious operation: "${match}"`);
      }
    }
  }

  return {
    hasSuspicious: patterns.length > 0,
    patterns,
  };
}

/**
 * Analyze content across multiple tool calls for injection
 *
 * Detects multi-call attacks where each call seems safe individually
 * but together form a malicious instruction
 */
export function analyzeMultiCallContext(
  context: InjectionContext,
  currentContent: string
): {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  totalRiskScore: number;
  patterns: string[];
} {
  const patterns: string[] = [];
  let riskScore = 0;

  // Check this content
  const base64Check = detectBase64Encoding(currentContent);
  if (base64Check.suspicious) {
    riskScore += 3;
    patterns.push(...base64Check.patterns);
  }

  const hexCheck = detectHexEncoding(currentContent);
  if (hexCheck.suspicious) {
    riskScore += 3;
    patterns.push(...hexCheck.patterns);
  }

  const invisibleCheck = detectInvisibleCharacters(currentContent);
  if (invisibleCheck.hasInvisible) {
    riskScore += 2;
    patterns.push(...invisibleCheck.patterns);
  }

  const htmlCheck = detectHTMLEncoding(currentContent);
  if (htmlCheck.hasSuspicious) {
    riskScore += 2;
    patterns.push(...htmlCheck.patterns);
  }

  const triggerCheck = detectDelayedTriggers(currentContent);
  if (triggerCheck.hasDelayedTriggers) {
    riskScore += 4;
    patterns.push(...triggerCheck.patterns);
  }

  const commandCheck = detectSuspiciousCommands(currentContent);
  if (commandCheck.hasSuspicious) {
    riskScore += 5;
    patterns.push(...commandCheck.patterns);
  }

  // Increase risk if we see patterns across multiple calls
  if (context.callCount > 1 && patterns.length > 0) {
    riskScore += 2; // Multi-call injection attempt
  }

  // Update context
  context.suspiciousPatterns.push(...patterns);
  context.riskScore = Math.max(context.riskScore, riskScore);

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (riskScore >= 10) riskLevel = 'critical';
  else if (riskScore >= 6) riskLevel = 'high';
  else if (riskScore >= 3) riskLevel = 'medium';

  return {
    riskLevel,
    totalRiskScore: context.riskScore,
    patterns,
  };
}

/**
 * Comprehensive injection detection
 */
export async function performComprehensiveInjectionDetection(
  content: string,
  context?: InjectionContext
): Promise<{
  safe: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  issues: string[];
}> {
  const issues: string[] = [];

  // Create context if not provided
  const ctx = context || {
    sessionId: `session-${Date.now()}`,
    callCount: 0,
    suspiciousPatterns: [],
    decodedContent: new Map(),
    riskScore: 0,
  };

  ctx.callCount++;

  // Run all detection methods
  const base64 = detectBase64Encoding(content);
  const hex = detectHexEncoding(content);
  const invisible = detectInvisibleCharacters(content);
  const html = detectHTMLEncoding(content);
  const triggers = detectDelayedTriggers(content);
  const commands = detectSuspiciousCommands(content);

  if (base64.suspicious) issues.push(...base64.patterns);
  if (hex.suspicious) issues.push(...hex.patterns);
  if (invisible.hasInvisible) issues.push(...invisible.patterns);
  if (html.hasSuspicious) issues.push(...html.patterns);
  if (triggers.hasDelayedTriggers) issues.push(...triggers.patterns);
  if (commands.hasSuspicious) issues.push(...commands.patterns);

  // Analyze in context
  const contextAnalysis = analyzeMultiCallContext(ctx, content);

  if (contextAnalysis.patterns.length > 0) {
    issues.push(...contextAnalysis.patterns);
  }

  // Alert if critical
  if (contextAnalysis.riskLevel === 'critical') {
    await sendAlert(
      '🚨 CRITICAL: Advanced Injection Detected',
      `Risk Level: Critical\nPatterns: ${issues.join('\n')}\nSession: ${ctx.sessionId}`,
      'critical'
    );
  }

  return {
    safe: contextAnalysis.riskLevel === 'low',
    riskLevel: contextAnalysis.riskLevel,
    issues,
  };
}

/**
 * Create injection detection context for a session
 */
export function createInjectionContext(sessionId: string): InjectionContext {
  return {
    sessionId,
    callCount: 0,
    suspiciousPatterns: [],
    decodedContent: new Map(),
    riskScore: 0,
  };
}
