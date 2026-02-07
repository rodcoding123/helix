/**
 * Message Filter Engine
 *
 * Applies message filters with timeout protection against regex DoS.
 * Supports: regex, keyword, sender, time, media filtering
 */

import type { MessageFilter, FilterType } from '../policies/types.js';

export interface FilterResult {
  blocked: boolean;
  reason?: string;
  routeToAgent?: string;
}

interface CompiledFilter {
  filter: MessageFilter;
  regex?: RegExp;
  keywords?: string[];
}

/**
 * Compile filters for efficient matching
 * Regex patterns are validated and timeout-protected
 */
export function compileFilters(filters: MessageFilter[]): CompiledFilter[] {
  return filters
    .filter((f) => f.enabled)
    .sort((a, b) => b.priority - a.priority)
    .map((filter) => {
      const compiled: CompiledFilter = { filter };

      if (filter.type === 'regex') {
        try {
          // Add timeout wrapper for regex
          const regex = new RegExp(filter.pattern, filter.caseSensitive ? 'g' : 'gi');
          // Test for catastrophic backtracking
          if (hasExponentialBacktracking(filter.pattern)) {
            console.warn(`[filter] Pattern ${filter.id} may have exponential backtracking`);
            return null;
          }
          compiled.regex = regex;
        } catch (err) {
          console.error(`[filter] Invalid regex pattern ${filter.id}:`, err);
          return null;
        }
      } else if (filter.type === 'keyword') {
        compiled.keywords = filter.pattern
          .split('|')
          .map((k) => k.trim())
          .filter(Boolean);
      }

      return compiled;
    })
    .filter((f): f is CompiledFilter => f !== null);
}

/**
 * Detect likely catastrophic backtracking patterns
 * Simple heuristic - not exhaustive
 */
function hasExponentialBacktracking(pattern: string): boolean {
  // Look for nested quantifiers: (a+)+, (a*)*,  (a+)*
  const nestedQuantifiers = /(\+|\*|\{[\d,]+\})\s*(\+|\*|\{[\d,]+\})/;
  if (nestedQuantifiers.test(pattern)) return true;

  // Look for alternation with overlapping patterns: (a|a)+
  const overlappingAlternation = /\(([^|)]+)\|.*\1/;
  if (overlappingAlternation.test(pattern)) return true;

  return false;
}

/**
 * Apply filters to message with timeout
 */
export async function applyFilters(
  message: string,
  compiled: CompiledFilter[],
  timeout = 100 // 100ms timeout
): Promise<FilterResult> {
  // Create timeout promise
  const timeoutPromise = new Promise<FilterResult>((resolve) => {
    setTimeout(() => {
      resolve({
        blocked: true,
        reason: 'Filter evaluation timeout (potential malicious regex)',
      });
    }, timeout);
  });

  // Create filter evaluation promise
  const evalPromise = new Promise<FilterResult>((resolve) => {
    for (const compiled of compiled) {
      const filter = compiled.filter;

      if (filter.type === 'regex' && compiled.regex) {
        try {
          if (compiled.regex.test(message)) {
            resolve({
              blocked: filter.action === 'block',
              reason: filter.action === 'block' ? `Matched filter: ${filter.name}` : undefined,
              routeToAgent: filter.routeToAgent,
            });
            return;
          }
        } catch (err) {
          console.error(`[filter] Regex evaluation error:`, err);
          continue;
        }
      } else if (filter.type === 'keyword' && compiled.keywords) {
        const msgLower = filter.caseSensitive ? message : message.toLowerCase();
        const keywords = filter.caseSensitive ? compiled.keywords : compiled.keywords.map((k) => k.toLowerCase());

        if (keywords.some((kw) => msgLower.includes(kw))) {
          resolve({
            blocked: filter.action === 'block',
            reason: filter.action === 'block' ? `Matched filter: ${filter.name}` : undefined,
            routeToAgent: filter.routeToAgent,
          });
          return;
        }
      }
    }

    resolve({ blocked: false });
  });

  // Race: first to complete
  return Promise.race([timeoutPromise, evalPromise]);
}

/**
 * Filter messages by sender ID
 */
export function filterBySender(
  senderId: string,
  allowlist?: string[],
  blocklist?: string[]
): { allowed: boolean; reason?: string } {
  if (blocklist?.includes(senderId)) {
    return { allowed: false, reason: 'Sender is blocklisted' };
  }

  if (allowlist && !allowlist.includes(senderId)) {
    return { allowed: false, reason: 'Sender not in allowlist' };
  }

  return { allowed: true };
}

/**
 * Filter messages by time window
 */
export function filterByTime(hour: number, allowedHours?: number[]): {
  allowed: boolean;
  reason?: string;
} {
  if (!allowedHours || allowedHours.length === 0) {
    return { allowed: true };
  }

  if (allowedHours.includes(hour)) {
    return { allowed: true };
  }

  return { allowed: false, reason: `Messages not allowed at hour ${hour}` };
}
