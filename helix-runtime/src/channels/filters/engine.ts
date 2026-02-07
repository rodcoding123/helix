/**
 * Filter Engine
 *
 * Evaluates message filters with DoS protection:
 * - 100ms timeout per filter
 * - Regex complexity analyzer
 * - Circuit breaker for failed filters
 */

import type {
  MessageFilter,
  CompiledFilter,
  RegexComplexity,
  FilterEvaluationContext,
  FilterEvaluationResult,
  FilterBatchResult,
  FilterAction,
  FiltersConfig,
} from './types.js';

export class FilterEngine {
  private filters: CompiledFilter[] = [];
  private circuitBreakers: Map<string, { failures: number; lastFailure: number }> =
    new Map();
  private readonly TIMEOUT_MS = 100;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_RESET_MS = 60000; // 1 minute

  constructor(filters: MessageFilter[] = []) {
    this.loadFilters(filters);
  }

  /**
   * Load and compile filters
   */
  loadFilters(filters: MessageFilter[]): void {
    this.filters = filters
      .sort((a, b) => a.priority - b.priority)
      .map(filter => this.compileFilter(filter));
  }

  /**
   * Compile a single filter
   */
  private compileFilter(filter: MessageFilter): CompiledFilter {
    const compiled: CompiledFilter = {
      filter,
      compiled: false,
    };

    try {
      if (filter.type === 'regex') {
        const regex = new RegExp(
          filter.pattern,
          filter.caseSensitive ? '' : 'i'
        );

        // Analyze complexity
        const complexity = this.analyzeRegexComplexity(filter.pattern);

        if (complexity.isCatastrophic) {
          throw new Error(
            `Regex is catastrophic (backtracking): ${filter.pattern}`
          );
        }

        compiled.regex = regex;
        compiled.complexity = complexity;
        compiled.compiled = true;
      } else if (filter.type === 'keyword') {
        compiled.keywords = filter.pattern
          .split(',')
          .map(k => k.trim())
          .filter(k => k.length > 0);
        compiled.compiled = true;
      } else {
        // 'sender' or 'time' filters don't need compilation
        compiled.compiled = true;
      }
    } catch (error) {
      compiled.compileError = error instanceof Error ? error.message : String(error);
      compiled.compiled = false;
    }

    return compiled;
  }

  /**
   * Evaluate filters against a message
   */
  async evaluateBatch(context: FilterEvaluationContext): Promise<FilterBatchResult> {
    const startTime = performance.now();
    const results: FilterEvaluationResult[] = [];
    let finalAction: FilterAction = 'allow';
    let blockedBy: MessageFilter | undefined;
    let routedTo: string | undefined;

    for (const compiled of this.filters) {
      const filter = compiled.filter;

      // Check circuit breaker
      if (this.isCircuitBreakerOpen(filter.id)) {
        continue;
      }

      try {
        const result = await this.evaluateFilter(compiled, context);
        results.push(result);

        // Track final action (allow is overridden by deny/route/etc)
        if (result.matched) {
          if (filter.action === 'block') {
            finalAction = 'block';
            blockedBy = filter;
            break; // Stop processing on first block
          } else if (filter.action === 'route' && result.routeTo) {
            routedTo = result.routeTo;
            finalAction = 'route';
          }
        }
      } catch (error) {
        this.recordFilterFailure(filter.id);
        console.error(`Filter error (${filter.id}):`, error);
      }
    }

    const executionTimeMs = performance.now() - startTime;

    return {
      message: context.message,
      filters: results,
      finalAction,
      matched: results.some(r => r.matched),
      blockedBy,
      routedTo,
      executionTimeMs,
    };
  }

  /**
   * Evaluate a single filter with timeout
   */
  private evaluateFilter(
    compiled: CompiledFilter,
    context: FilterEvaluationContext
  ): Promise<FilterEvaluationResult> {
    return Promise.race([
      this.doEvaluateFilter(compiled, context),
      this.timeout(this.TIMEOUT_MS),
    ]);
  }

  /**
   * Actual filter evaluation logic
   */
  private async doEvaluateFilter(
    compiled: CompiledFilter,
    context: FilterEvaluationContext
  ): Promise<FilterEvaluationResult> {
    const startTime = performance.now();
    const filter = compiled.filter;

    if (!compiled.compiled) {
      return {
        matched: false,
        filter,
        action: 'allow',
        reason: 'Filter failed to compile',
        confidence: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }

    let matched = false;
    let matchedPattern = '';

    try {
      if (filter.type === 'regex' && compiled.regex) {
        matched = compiled.regex.test(context.message);
        matchedPattern = filter.pattern;
      } else if (filter.type === 'keyword' && compiled.keywords) {
        if (filter.matchMode === 'all') {
          matched = compiled.keywords.every(k =>
            context.message.toLowerCase().includes(k.toLowerCase())
          );
        } else {
          matched = compiled.keywords.some(k =>
            context.message.toLowerCase().includes(k.toLowerCase())
          );
        }
        matchedPattern = compiled.keywords.join(',');
      } else if (filter.type === 'sender') {
        matched = context.sender === filter.pattern ||
          context.sender.includes(filter.pattern);
        matchedPattern = filter.pattern;
      }
    } catch (error) {
      console.error(`Filter evaluation error: ${filter.id}`, error);
      return {
        matched: false,
        filter,
        action: 'allow',
        reason: 'Filter evaluation error',
        confidence: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }

    const executionTimeMs = performance.now() - startTime;

    return {
      matched,
      filter,
      action: filter.action,
      reason: matched ? `Matched filter: ${filter.name}` : `No match: ${filter.name}`,
      matchedPattern: matched ? matchedPattern : undefined,
      confidence: matched ? 1.0 : 0,
      executionTimeMs,
      routeTo: matched && filter.action === 'route' ? filter.routeToAgent : undefined,
    };
  }

  /**
   * Analyze regex for catastrophic backtracking
   */
  private analyzeRegexComplexity(pattern: string): RegexComplexity {
    const hasBacktracking = /(\.\*|\.\+|\{\d+,\})\+/.test(pattern);
    const hasNegativeLookahead = /\(\?!/.test(pattern);
    const hasAlternation = /\|/.test(pattern);

    // Heuristic: nested quantifiers or alternation with quantifiers are dangerous
    const isCatastrophic = /(\.\*\+|\.\+\+|\*\+|\+\+|\{\d+,\}\+)/.test(pattern);

    return {
      hasBacktracking,
      hasNegativeLookahead,
      hasAlternation,
      isCatastrophic,
      estimatedWorstCaseMs: isCatastrophic ? 500 : 10,
      safeForProduction: !isCatastrophic && !hasNegativeLookahead,
    };
  }

  /**
   * Timeout helper
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`Filter evaluation timeout after ${ms}ms`)),
        ms
      );
    });
  }

  /**
   * Circuit breaker: check if filter is open
   */
  private isCircuitBreakerOpen(filterId: string): boolean {
    const breaker = this.circuitBreakers.get(filterId);
    if (!breaker) return false;

    // Reset after timeout
    if (Date.now() - breaker.lastFailure > this.CIRCUIT_BREAKER_RESET_MS) {
      this.circuitBreakers.delete(filterId);
      return false;
    }

    return breaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD;
  }

  /**
   * Record filter failure for circuit breaker
   */
  private recordFilterFailure(filterId: string): void {
    const breaker = this.circuitBreakers.get(filterId) || {
      failures: 0,
      lastFailure: Date.now(),
    };

    breaker.failures += 1;
    breaker.lastFailure = Date.now();

    this.circuitBreakers.set(filterId, breaker);
  }

  /**
   * Get filter stats
   */
  getFilters(): MessageFilter[] {
    return this.filters.map(c => c.filter);
  }

  /**
   * Recompile all filters
   */
  recompile(): void {
    const filters = this.filters.map(c => c.filter);
    this.loadFilters(filters);
  }
}

/**
 * Create filter engine from config
 */
export function createFilterEngine(config: FiltersConfig): FilterEngine {
  const engine = new FilterEngine(config.filters);
  return engine;
}
