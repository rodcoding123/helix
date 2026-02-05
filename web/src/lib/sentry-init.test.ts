/**
 * Phase 10 Week 5: Sentry Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initSentry,
  setSentryUser,
  captureException,
  captureMessage,
  addBreadcrumb,
  startTransaction,
} from './sentry-init';

// Mock Sentry
vi.mock('@sentry/react', () => {
  const initMock = vi.fn().mockImplementation(() => undefined);
  return {
    init: initMock,
    setUser: vi.fn(),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    startTransaction: vi.fn(),
  };
});

vi.mock('@sentry/tracing', () => ({
  BrowserTracing: class MockBrowserTracing {
    constructor() {}
  },
}));

vi.mock('@sentry/replay', () => ({
  Replay: class MockReplay {
    constructor() {}
  },
}));

import * as Sentry from '@sentry/react';

describe('Sentry Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    delete (process.env as any).NODE_ENV;
  });

  describe('initSentry', () => {
    it('should skip initialization in development', () => {
      process.env.NODE_ENV = 'development';

      initSentry();

      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('should initialize in production with DSN', () => {
      process.env.NODE_ENV = 'production';

      initSentry({
        dsn: 'https://example@sentry.io/123456',
        environment: 'production',
      });

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://example@sentry.io/123456',
          environment: 'production',
        })
      );
    });

    it('should use environment variable DSN', () => {
      process.env.NODE_ENV = 'production';
      process.env.VITE_SENTRY_DSN = 'https://env-dsn@sentry.io/123456';

      initSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://env-dsn@sentry.io/123456',
        })
      );
    });

    it('should skip initialization without DSN', () => {
      process.env.NODE_ENV = 'production';
      delete (process.env as any).VITE_SENTRY_DSN;

      initSentry();

      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('should set performance monitoring sample rate', () => {
      process.env.NODE_ENV = 'production';

      initSentry({
        dsn: 'https://example@sentry.io/123456',
        tracesSampleRate: 0.5,
      });

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          tracesSampleRate: 0.5,
        })
      );
    });

    it('should set session replay sample rates', () => {
      process.env.NODE_ENV = 'production';

      initSentry({
        dsn: 'https://example@sentry.io/123456',
        replaysSessionSampleRate: 0.2,
        replaysOnErrorSampleRate: 0.8,
      });

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          replaysSessionSampleRate: 0.2,
          replaysOnErrorSampleRate: 0.8,
        })
      );
    });

    it('should include integrations', () => {
      process.env.NODE_ENV = 'production';

      initSentry({
        dsn: 'https://example@sentry.io/123456',
      });

      const call = (Sentry.init as any).mock.calls[0]?.[0];
      expect(call.integrations).toBeDefined();
      expect(Array.isArray(call.integrations)).toBe(true);
    });

    it('should include beforeSend hook for sanitization', () => {
      process.env.NODE_ENV = 'production';

      initSentry({
        dsn: 'https://example@sentry.io/123456',
      });

      const call = (Sentry.init as any).mock.calls[0]?.[0];
      expect(call.beforeSend).toBeDefined();
      expect(typeof call.beforeSend).toBe('function');
    });

    it('should include beforeBreadcrumb hook', () => {
      process.env.NODE_ENV = 'production';

      initSentry({
        dsn: 'https://example@sentry.io/123456',
      });

      const call = (Sentry.init as any).mock.calls[0]?.[0];
      expect(call.beforeBreadcrumb).toBeDefined();
      expect(typeof call.beforeBreadcrumb).toBe('function');
    });

    it('should handle initialization errors gracefully', () => {
      process.env.NODE_ENV = 'production';
      (Sentry.init as any).mockImplementation(() => {
        throw new Error('Sentry initialization failed');
      });

      expect(() => {
        initSentry({
          dsn: 'https://example@sentry.io/123456',
        });
      }).not.toThrow();
    });
  });

  describe('setSentryUser', () => {
    it('should set user context', () => {
      setSentryUser({
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
      });

      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: 'user-123',
        email: 'user@example.com',
        username: 'Test User',
      });
    });

    it('should clear user context when null', () => {
      setSentryUser(null);

      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });

    it('should handle partial user data', () => {
      setSentryUser({
        id: 'user-456',
      });

      expect(Sentry.setUser).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-456',
        })
      );
    });
  });

  describe('captureException', () => {
    it('should capture exception without context', () => {
      const error = new Error('Test error');

      captureException(error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it('should capture exception with context', () => {
      const error = new Error('Test error');
      const context = { operation: 'test' };

      captureException(error, context);

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          contexts: {
            custom: context,
          },
        })
      );
    });
  });

  describe('captureMessage', () => {
    it('should capture info message by default', () => {
      captureMessage('Test message');

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Test message',
        'info'
      );
    });

    it('should capture message with custom level', () => {
      captureMessage('Warning message', 'warning');

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Warning message',
        'warning'
      );
    });

    it('should capture message with context', () => {
      const context = { userId: 'user-123' };

      captureMessage('User action', 'info', context);

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'User action',
        expect.objectContaining({
          contexts: {
            custom: context,
          },
        })
      );
    });
  });

  describe('addBreadcrumb', () => {
    it('should add breadcrumb with default category', () => {
      addBreadcrumb('User clicked button');

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'User clicked button',
        expect.any(Object)
      );
    });

    it('should add breadcrumb with custom category', () => {
      addBreadcrumb('Page loaded', 'navigation');

      expect(Sentry.captureMessage).toHaveBeenCalled();
    });

    it('should add breadcrumb with data', () => {
      const data = { buttonId: 'save-btn' };

      addBreadcrumb('Button clicked', 'user-action', 'info', data);

      expect(Sentry.captureMessage).toHaveBeenCalled();
    });
  });

  describe('startTransaction', () => {
    it('should start transaction with name and op', () => {
      startTransaction('API Request', 'http');

      expect(Sentry.startTransaction).toHaveBeenCalledWith({
        name: 'API Request',
        op: 'http',
        sampled: true,
      });
    });

    it('should start transaction with default op', () => {
      startTransaction('My Operation');

      expect(Sentry.startTransaction).toHaveBeenCalledWith({
        name: 'My Operation',
        op: 'custom',
        sampled: true,
      });
    });
  });

  describe('beforeSend Hook', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should sanitize authorization header', () => {
      initSentry({
        dsn: 'https://example@sentry.io/123456',
      });

      const call = (Sentry.init as any).mock.calls[0]?.[0];
      const event = {
        request: {
          headers: {
            Authorization: 'Bearer token123',
            'X-API-Key': 'secret',
          },
        },
      };

      const result = call.beforeSend?.(event, {});

      expect(result?.request?.headers?.Authorization).toBeUndefined();
      expect(result?.request?.headers?.['X-API-Key']).toBeUndefined();
    });

    it('should filter third-party network errors', () => {
      initSentry({
        dsn: 'https://example@sentry.io/123456',
      });

      const call = (Sentry.init as any).mock.calls[0]?.[0];
      const event = {
        message: 'Failed to fetch',
        request: {
          url: 'https://external-api.com/endpoint',
        },
      };

      const result = call.beforeSend?.(event, {
        originalException: new Error('Failed to fetch'),
      });

      expect(result).toBeNull();
    });
  });

  describe('beforeBreadcrumb Hook', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should filter health check breadcrumbs', () => {
      initSentry({
        dsn: 'https://example@sentry.io/123456',
      });

      const call = (Sentry.init as any).mock.calls[0]?.[0];
      const breadcrumb = {
        category: 'http',
        data: {
          url: '/api/health',
        },
      };

      const result = call.beforeBreadcrumb?.(breadcrumb, {});

      expect(result).toBeNull();
    });

    it('should keep ui.click breadcrumbs', () => {
      initSentry({
        dsn: 'https://example@sentry.io/123456',
      });

      const call = (Sentry.init as any).mock.calls[0]?.[0];
      const breadcrumb = {
        category: 'ui.click',
        data: {
          target: 'button',
        },
      };

      const result = call.beforeBreadcrumb?.(breadcrumb, {});

      expect(result).toBe(breadcrumb);
    });
  });

  describe('Error Filtering', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should ignore browser extension errors', () => {
      initSentry({
        dsn: 'https://example@sentry.io/123456',
      });

      const call = (Sentry.init as any).mock.calls[0]?.[0];
      expect(call.ignoreErrors).toContain('chrome-extension://');
      expect(call.ignoreErrors).toContain('moz-extension://');
    });

    it('should ignore ResizeObserver errors', () => {
      initSentry({
        dsn: 'https://example@sentry.io/123456',
      });

      const call = (Sentry.init as any).mock.calls[0]?.[0];
      expect(call.ignoreErrors).toContain('ResizeObserver loop limit exceeded');
    });
  });
});
