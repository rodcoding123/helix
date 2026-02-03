import { describe, it, expect } from 'vitest';

describe('Safe Console Wrapper', () => {
  describe('Module Import', () => {
    it('imports without error', async () => {
      // Safe-console should load without errors
      await expect(import('./safe-console.js')).resolves.toBeDefined();
    });

    it('marks console as safe-wrapped after import', async () => {
      await import('./safe-console.js');

      // Check that console has been marked
      expect((console as any).__safeWrapped).toBe(true);
    });

    it('preserves original console as console.raw', async () => {
      await import('./safe-console.js');

      // console.raw should have the original methods
      expect((console as any).raw).toBeDefined();
      expect(typeof (console as any).raw.log).toBe('function');
      expect(typeof (console as any).raw.error).toBe('function');
      expect(typeof (console as any).raw.warn).toBe('function');
      expect(typeof (console as any).raw.info).toBe('function');
      expect(typeof (console as any).raw.debug).toBe('function');
    });
  });

  describe('Console Methods Override', () => {
    it('console.log is a function', async () => {
      await import('./safe-console.js');
      expect(typeof console.log).toBe('function');
    });

    it('console.error is a function', async () => {
      await import('./safe-console.js');
      expect(typeof console.error).toBe('function');
    });

    it('console.warn is a function', async () => {
      await import('./safe-console.js');
      expect(typeof console.warn).toBe('function');
    });

    it('console.info is a function', async () => {
      await import('./safe-console.js');
      expect(typeof (console as any).info).toBe('function');
    });

    it('console.debug is a function', async () => {
      await import('./safe-console.js');
      expect(typeof (console as any).debug).toBe('function');
    });
  });

  describe('Original Console Preservation', () => {
    it('original methods are accessible via console.raw', async () => {
      await import('./safe-console.js');

      const raw = (console as any).raw;
      // These should all be callable
      expect(typeof raw.log).toBe('function');
      expect(typeof raw.error).toBe('function');
      expect(typeof raw.warn).toBe('function');
    });

    it('console methods are different from console.raw methods', async () => {
      await import('./safe-console.js');

      // The console methods should be different functions (wrapped)
      expect(console.log).not.toBe((console as any).raw.log);
      expect(console.error).not.toBe((console as any).raw.error);
      expect(console.warn).not.toBe((console as any).raw.warn);
    });
  });

  describe('Integration with LogSanitizer', () => {
    it('console methods accept multiple arguments like original', async () => {
      await import('./safe-console.js');

      // These should not throw
      expect(() => {
        console.log('test1', 'test2', { key: 'value' });
      }).not.toThrow();

      expect(() => {
        console.error('error1', new Error('test'), 'error3');
      }).not.toThrow();

      expect(() => {
        console.warn('warning1', 'warning2');
      }).not.toThrow();
    });

    it('console methods handle Error objects', async () => {
      await import('./safe-console.js');

      const error = new Error('Test error');
      expect(() => {
        console.error(error);
      }).not.toThrow();

      const typeError = new TypeError('Type error');
      expect(() => {
        console.error(typeError);
      }).not.toThrow();
    });

    it('console methods handle various input types', async () => {
      await import('./safe-console.js');

      expect(() => {
        console.log(null);
        console.log(undefined);
        console.log(12345);
        console.log({ obj: 'value' });
        console.log(['array', 'values']);
      }).not.toThrow();
    });
  });

  describe('Safe-Console Usage Pattern', () => {
    it('can import and use immediately after startup', async () => {
      // This mimics typical usage: import early in main.ts/index.ts
      await import('./safe-console.js');

      // All subsequent logs should be sanitized
      expect(() => {
        console.log('Application started');
        console.error('An error occurred');
        console.warn('A warning');
      }).not.toThrow();
    });

    it('console.raw provides backdoor to original console if needed', async () => {
      await import('./safe-console.js');

      // For extreme debugging, developers can use console.raw
      const raw = (console as any).raw;
      expect(typeof raw.log).toBe('function');

      // This would log without sanitization
      expect(() => {
        raw.log('This would not be sanitized');
      }).not.toThrow();
    });
  });
});
