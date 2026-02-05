import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, circuitBreakers } from './circuit-breaker.js';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker<string>;

  beforeEach(() => {
    breaker = new CircuitBreaker('TestService', {
      failureThreshold: 3,
      resetTimeoutMs: 100, // Short timeout for tests
      successThreshold: 2,
    });
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('initializes in CLOSED state', () => {
      const metrics = breaker.getMetrics();
      expect(metrics.state).toBe('closed');
    });

    it('has zero failures and successes initially', () => {
      const metrics = breaker.getMetrics();
      expect(metrics.failures).toBe(0);
      expect(metrics.successes).toBe(0);
    });

    it('accepts custom configuration', () => {
      const custom = new CircuitBreaker('Custom', {
        failureThreshold: 5,
        resetTimeoutMs: 30000,
        successThreshold: 3,
      });

      // Test by causing 4 failures - should still be closed (threshold is 5)
      for (let i = 0; i < 4; i++) {
        custom.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      const metrics = custom.getMetrics();
      expect(metrics.state).toBe('closed');
    });

    it('has a name for logging', () => {
      const breaker1 = new CircuitBreaker('MyService');
      expect(breaker1['name']).toBe('MyService');
    });
  });

  describe('Normal Operation (Closed State)', () => {
    it('executes successful operations', async () => {
      const result = await breaker.execute(() => Promise.resolve('success'));
      expect(result).toBe('success');
    });

    it('returns operation results correctly', async () => {
      const result = await breaker.execute(() => Promise.resolve('success'));
      expect(result).toBe('success');
    });

    it('passes through operation errors', async () => {
      const error = new Error('Operation failed');
      await expect(breaker.execute(() => Promise.reject(error))).rejects.toBe(error);
    });

    it('resets failure count on success', async () => {
      // Cause 1 failure
      await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      expect(breaker.getMetrics().failures).toBe(1);

      // Success should reset count
      await breaker.execute(() => Promise.resolve('ok'));
      expect(breaker.getMetrics().failures).toBe(0);
    });

    it('stays closed with sporadic failures', async () => {
      for (let i = 0; i < 2; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      const metrics = breaker.getMetrics();
      expect(metrics.state).toBe('closed');
      expect(metrics.failures).toBe(2);
    });

    it('is healthy when closed', () => {
      expect(breaker.isHealthy()).toBe(true);
    });
  });

  describe('Opening Circuit (Failure Threshold)', () => {
    it('opens after reaching failure threshold', async () => {
      for (let i = 0; i < 3; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      expect(breaker.getMetrics().state).toBe('open');
    });

    it('fails fast when circuit is open', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      // Attempt should fail immediately without executing fn
      let executed = false;
      const fn = () => {
        executed = true;
        return Promise.resolve('ok');
      };

      await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker is OPEN');
      expect(executed).toBe(false);
    });

    it('tracks last failure time', async () => {
      const before = Date.now();
      await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      const after = Date.now();

      const metrics = breaker.getMetrics();
      expect(metrics.lastFailureTime).toBeGreaterThanOrEqual(before);
      expect(metrics.lastFailureTime).toBeLessThanOrEqual(after);
    });

    it('is not healthy when open', async () => {
      for (let i = 0; i < 3; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      expect(breaker.isHealthy()).toBe(false);
    });
  });

  describe('Half-Open State (Recovery Testing)', () => {
    it('transitions to HALF_OPEN after reset timeout', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }
      expect(breaker.getMetrics().state).toBe('open');

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next attempt should transition to half-open
      await breaker.execute(() => Promise.resolve('ok')).catch(() => {});
      expect(breaker.getMetrics().state).toBe('half-open');
    });

    it('requires success threshold to close', async () => {
      // Setup: open and wait
      for (let i = 0; i < 3; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }
      await new Promise(resolve => setTimeout(resolve, 150));

      // First success in half-open (need 2 total)
      await breaker.execute(() => Promise.resolve('ok')).catch(() => {});
      expect(breaker.getMetrics().state).toBe('half-open');

      // Second success should close
      await breaker.execute(() => Promise.resolve('ok')).catch(() => {});
      expect(breaker.getMetrics().state).toBe('closed');
    });

    it('reopens on failure during half-open', async () => {
      // Setup: open and wait
      for (let i = 0; i < 3; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }
      await new Promise(resolve => setTimeout(resolve, 150));

      // Enter half-open
      await breaker.execute(() => Promise.resolve('ok')).catch(() => {});
      expect(breaker.getMetrics().state).toBe('half-open');

      // Single failure should reopen
      await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      expect(breaker.getMetrics().state).toBe('open');
    });

    it('resets counters on state transition', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }
      const metricsOpen = breaker.getMetrics();
      expect(metricsOpen.failures).toBe(3);

      // Transition to half-open
      await new Promise(resolve => setTimeout(resolve, 150));
      await breaker.execute(() => Promise.resolve('ok')).catch(() => {});

      const metricsHalfOpen = breaker.getMetrics();
      expect(metricsHalfOpen.failures).toBe(0);
      expect(metricsHalfOpen.successes).toBe(1);
    });
  });

  describe('State Transitions', () => {
    it('transitions CLOSED → OPEN → HALF_OPEN → CLOSED', async () => {
      const states: string[] = [];

      // CLOSED → OPEN
      for (let i = 0; i < 3; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }
      states.push(breaker.getMetrics().state);
      expect(states[0]).toBe('open');

      // OPEN → HALF_OPEN
      await new Promise(resolve => setTimeout(resolve, 150));
      await breaker.execute(() => Promise.resolve('ok')).catch(() => {});
      states.push(breaker.getMetrics().state);
      expect(states[1]).toBe('half-open');

      // HALF_OPEN → CLOSED
      await breaker.execute(() => Promise.resolve('ok')).catch(() => {});
      states.push(breaker.getMetrics().state);
      expect(states[2]).toBe('closed');
    });

    it('tracks lastStateChange timestamp', async () => {
      const initial = breaker.getMetrics().lastStateChange;

      await new Promise(resolve => setTimeout(resolve, 10));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      const afterOpen = breaker.getMetrics().lastStateChange;
      expect(afterOpen).toBeGreaterThan(initial);
    });

    it('prevents redundant state transitions', async () => {
      // Open circuit
      for (let i = 0; i < 3; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      const timestamp1 = breaker.getMetrics().lastStateChange;
      await new Promise(resolve => setTimeout(resolve, 10));

      // Attempt another failure (should stay open, not retransition)
      await breaker
        .execute(() => Promise.reject(new Error('fail')))
        .catch(() => {})
        .catch(() => {});

      const timestamp2 = breaker.getMetrics().lastStateChange;
      expect(timestamp2).toBe(timestamp1); // No state change
    });
  });

  describe('Metrics', () => {
    it('returns complete metrics object', async () => {
      await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});

      const metrics = breaker.getMetrics();
      expect(metrics).toHaveProperty('state');
      expect(metrics).toHaveProperty('failures');
      expect(metrics).toHaveProperty('successes');
      expect(metrics).toHaveProperty('lastFailureTime');
      expect(metrics).toHaveProperty('lastStateChange');
    });

    it('tracks failure count', async () => {
      for (let i = 0; i < 2; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      expect(breaker.getMetrics().failures).toBe(2);
    });

    it('tracks success count', async () => {
      for (let i = 0; i < 3; i++) {
        await breaker.execute(() => Promise.resolve('ok'));
      }

      expect(breaker.getMetrics().successes).toBe(0); // Successes only count in half-open
    });

    it('counts successes only in half-open state', async () => {
      // Succeed in closed state
      await breaker.execute(() => Promise.resolve('ok'));
      expect(breaker.getMetrics().successes).toBe(0);

      // Open and transition to half-open
      for (let i = 0; i < 3; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }
      await new Promise(resolve => setTimeout(resolve, 150));

      // Succeed in half-open
      await breaker.execute(() => Promise.resolve('ok'));
      expect(breaker.getMetrics().successes).toBe(1);
    });
  });

  describe('Reset', () => {
    it('resets to initial state', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      expect(breaker.getMetrics().state).toBe('open');

      breaker.reset();

      const metrics = breaker.getMetrics();
      expect(metrics.state).toBe('closed');
      expect(metrics.failures).toBe(0);
      expect(metrics.successes).toBe(0);
    });

    it('clears failure and success counts', async () => {
      for (let i = 0; i < 2; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      breaker.reset();

      const metrics = breaker.getMetrics();
      expect(metrics.failures).toBe(0);
      expect(metrics.successes).toBe(0);
    });

    it('updates lastStateChange on reset', async () => {
      for (let i = 0; i < 3; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      const before = Date.now();
      breaker.reset();
      const after = Date.now();

      const metrics = breaker.getMetrics();
      expect(metrics.lastStateChange).toBeGreaterThanOrEqual(before);
      expect(metrics.lastStateChange).toBeLessThanOrEqual(after);
    });

    it('clears lastFailureTime on reset', async () => {
      await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      expect(breaker.getMetrics().lastFailureTime).toBeGreaterThan(0);

      breaker.reset();
      // After reset, lastFailureTime is 0, but getMetrics() returns it as undefined
      expect(breaker.getMetrics().lastFailureTime).toBeUndefined();
    });
  });

  describe('Generic Type Support', () => {
    it('handles generic type parameters', async () => {
      interface TestData {
        id: number;
        name: string;
      }

      const typedBreaker = new CircuitBreaker<TestData>('TypedService');
      const data: TestData = { id: 1, name: 'test' };

      const result = await typedBreaker.execute(() => Promise.resolve(data));
      expect(result.id).toBe(1);
      expect(result.name).toBe('test');
    });

    it('works with different return types', async () => {
      const stringBreaker = new CircuitBreaker<string>('String');
      const numberBreaker = new CircuitBreaker<number>('Number');
      const boolBreaker = new CircuitBreaker<boolean>('Bool');

      const str = await stringBreaker.execute(() => Promise.resolve('hello'));
      const num = await numberBreaker.execute(() => Promise.resolve(42));
      const bool = await boolBreaker.execute(() => Promise.resolve(true));

      expect(typeof str).toBe('string');
      expect(typeof num).toBe('number');
      expect(typeof bool).toBe('boolean');
    });

    it('works with array types', async () => {
      const arrayBreaker = new CircuitBreaker<string[]>('Array');
      const result = await arrayBreaker.execute(() => Promise.resolve(['a', 'b', 'c']));
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('includes retry delay in open state error message', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      let errorMessage = '';
      try {
        await breaker.execute(() => Promise.resolve('ok'));
      } catch (error) {
        errorMessage = (error as Error).message;
      }

      expect(errorMessage).toContain('Circuit breaker is OPEN');
      expect(errorMessage).toContain('will retry in');
      expect(errorMessage).toContain('ms');
    });

    it('shows decreasing retry delay over time', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      let delay1 = 0;
      try {
        await breaker.execute(() => Promise.resolve('ok'));
      } catch (error) {
        const match = (error as Error).message.match(/will retry in (\d+)ms/);
        delay1 = parseInt(match?.[1] ?? '0', 10);
      }

      await new Promise(resolve => setTimeout(resolve, 20));

      let delay2 = 0;
      try {
        await breaker.execute(() => Promise.resolve('ok'));
      } catch (error) {
        const match = (error as Error).message.match(/will retry in (\d+)ms/);
        delay2 = parseInt(match?.[1] ?? '0', 10);
      }

      expect(delay2).toBeLessThan(delay1);
    });
  });

  describe('Global Instances', () => {
    it('provides Discord webhook circuit breaker', () => {
      expect(circuitBreakers.discord).toBeDefined();
      expect(circuitBreakers.discord.getMetrics().state).toBe('closed');
    });

    it('provides 1Password CLI circuit breaker', () => {
      expect(circuitBreakers.onePassword).toBeDefined();
      expect(circuitBreakers.onePassword.getMetrics().state).toBe('closed');
    });

    it('provides Plugin loading circuit breaker', () => {
      expect(circuitBreakers.plugins).toBeDefined();
      expect(circuitBreakers.plugins.getMetrics().state).toBe('closed');
    });

    it('Discord uses 3 failure threshold', async () => {
      const discord = circuitBreakers.discord;

      // First 2 failures should not open
      for (let i = 0; i < 2; i++) {
        await discord.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }
      expect(discord.getMetrics().state).toBe('closed');

      // Third failure opens
      await discord.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      expect(discord.getMetrics().state).toBe('open');

      discord.reset(); // Clean up
    });

    it('1Password uses 2 failure threshold', async () => {
      const onePassword = circuitBreakers.onePassword;

      // First failure should not open
      await onePassword.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      expect(onePassword.getMetrics().state).toBe('closed');

      // Second failure opens (threshold is 2)
      await onePassword.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      expect(onePassword.getMetrics().state).toBe('open');

      onePassword.reset(); // Clean up
    });

    it('Plugins use 1 failure threshold (fail-fast)', async () => {
      const plugins = circuitBreakers.plugins;

      // Single failure opens (threshold is 1)
      await plugins.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      expect(plugins.getMetrics().state).toBe('open');

      plugins.reset(); // Clean up
    });

    it('1Password has faster recovery (30s vs 60s)', () => {
      expect(circuitBreakers.onePassword['resetTimeoutMs']).toBe(30000);
      expect(circuitBreakers.discord['resetTimeoutMs']).toBe(60000);
    });
  });

  describe('Concurrency', () => {
    it('handles concurrent requests safely', async () => {
      const requests = Array.from({ length: 10 }, (_, i) =>
        breaker.execute(() => Promise.resolve(`result-${i}`))
      );

      const results = await Promise.allSettled(requests);
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    });

    it('handles concurrent failures safely', async () => {
      const requests = Array.from({ length: 5 }, () =>
        breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {})
      );

      await Promise.all(requests);
      expect(breaker.getMetrics().failures).toBe(5);
    });
  });

  describe('Logging', () => {
    it('logs state transitions', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('OPEN'));
      consoleSpy.mockRestore();
    });

    it('logs recovery in half-open state', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      // Open circuit
      for (let i = 0; i < 3; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      // Wait and transition to half-open
      await new Promise(resolve => setTimeout(resolve, 150));
      await breaker.execute(() => Promise.resolve('ok')).catch(() => {});

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('HALF-OPEN'));
      consoleSpy.mockRestore();
    });

    it('logs circuit close on successful recovery', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      // Open and recover
      for (let i = 0; i < 3; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }
      await new Promise(resolve => setTimeout(resolve, 150));
      await breaker.execute(() => Promise.resolve('ok'));
      await breaker.execute(() => Promise.resolve('ok'));

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('CLOSED'));
      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('handles rapid state changes', async () => {
      // Rapid opens and closes
      for (let cycle = 0; cycle < 3; cycle++) {
        for (let i = 0; i < 3; i++) {
          await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
        }
        breaker.reset();
      }

      expect(breaker.getMetrics().state).toBe('closed');
    });

    it('handles very long reset timeout', async () => {
      const longBreaker = new CircuitBreaker('Long', { resetTimeoutMs: 1000000000 });

      await longBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      await longBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      await longBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});

      expect(longBreaker.getMetrics().state).toBe('open');
      // Should require actual reset, not timeout
    });

    it('handles zero success threshold', async () => {
      const zeroBreaker = new CircuitBreaker('Zero', {
        failureThreshold: 1,
        resetTimeoutMs: 50,
        successThreshold: 1,
      });

      await zeroBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      expect(zeroBreaker.getMetrics().state).toBe('open');

      await new Promise(resolve => setTimeout(resolve, 100));
      await zeroBreaker.execute(() => Promise.resolve('ok'));
      expect(zeroBreaker.getMetrics().state).toBe('closed');
    });

    it('survives many sequential operations', async () => {
      for (let i = 0; i < 100; i++) {
        await breaker.execute(() => Promise.resolve(`result-${i}`));
      }

      expect(breaker.getMetrics().state).toBe('closed');
      expect(breaker.getMetrics().failures).toBe(0);
    });
  });
});
