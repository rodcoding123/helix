/**
 * Phase 10 Week 5: Sentry Error Tracking Integration
 * Comprehensive error tracking, performance monitoring, and session replay
 */

import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import { Replay } from '@sentry/replay';

export interface SentryConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
  replaysSessionSampleRate?: number;
  replaysOnErrorSampleRate?: number;
  debug?: boolean;
}

/**
 * Initialize Sentry for production error tracking
 * Only initializes in production to avoid log spam in development
 */
export function initSentry(config: SentryConfig = {}): void {
  // Skip initialization in development
  if (process.env.NODE_ENV !== 'production') {
    if (config.debug) {
      console.log('[Sentry] Skipping initialization in non-production environment');
    }
    return;
  }

  // Require DSN for production
  const dsn = config.dsn || process.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.warn('[Sentry] No DSN configured, skipping initialization');
    return;
  }

  const environment = config.environment || process.env.VITE_ENV || 'production';
  const release = config.release || process.env.VITE_COMMIT_SHA || undefined;

  try {
    Sentry.init({
      dsn,
      environment,
      release,

      // Performance Monitoring
      integrations: [
        new BrowserTracing({
          // Set sampling rate for performance monitoring
          tracingOrigins: ['localhost', process.env.VITE_API_URL || '', /^\//],
          // Capture HTTP requests
          tracePropagationTargets: ['localhost', process.env.VITE_API_URL || '', /^\//],
          // Monitor long-running operations
          shouldCreateSpanForRequest: (url: string) => {
            // Skip monitoring for health checks
            if (url.includes('/health') || url.includes('/ping')) {
              return false;
            }
            return true;
          },
        }) as any,
        new Replay({
          // Capture 10% of all sessions for replay
          maskAllText: false, // Capture actual text for debugging
          blockAllMedia: false, // Capture actual media
        }) as any,
      ],

      // Performance Monitoring
      tracesSampleRate: config.tracesSampleRate || 0.1, // 10% of transactions
      profilesSampleRate: 0.1, // Profile 10% of transactions for performance analysis

      // Session Replay
      replaysSessionSampleRate: config.replaysSessionSampleRate || 0.1, // 10% of sessions
      replaysOnErrorSampleRate: config.replaysOnErrorSampleRate || 1.0, // 100% of errors

      // Error Filtering
      beforeSend(event, hint) {
        // Don't send development errors
        if (process.env.NODE_ENV !== 'production') {
          return null;
        }

        // Sanitize sensitive data
        if (event.request?.headers) {
          // Remove Authorization header
          delete event.request.headers.Authorization;
          // Remove Cookie header
          delete event.request.headers.Cookie;
          // Remove API keys from headers
          for (const key of Object.keys(event.request.headers)) {
            if (key.toLowerCase().includes('api') && key.toLowerCase().includes('key')) {
              delete event.request.headers[key];
            }
          }
        }

        // Sanitize environment variables
        if (event.contexts?.os?.env) {
          const env = event.contexts.os.env as Record<string, string>;
          const sensitiveKeys = [
            'STRIPE_KEY',
            'API_KEY',
            'SECRET',
            'TOKEN',
            'PASSWORD',
            'CREDENTIAL',
          ];
          for (const key of Object.keys(env)) {
            if (sensitiveKeys.some(s => key.includes(s))) {
              delete env[key];
            }
          }
        }

        // Filter specific error types
        const errorMessage = hint.originalException?.toString() || event.message || '';

        // Ignore network errors from third-party services
        if (errorMessage.includes('Failed to fetch')) {
          const apiUrl = process.env.VITE_API_URL;
          const requestUrl = event.request?.url || '';
          // Only keep if it's from our own API
          if (!apiUrl || !requestUrl.includes(apiUrl)) {
            return null;
          }
        }

        // Ignore browser extension errors
        if (errorMessage.includes('chrome-extension://') || errorMessage.includes('moz-extension://')) {
          return null;
        }

        // Ignore abuse report errors
        if (errorMessage.includes('content_blocker')) {
          return null;
        }

        return event;
      },

      // Ignore certain errors
      ignoreErrors: [
        // Browser extensions
        'chrome-extension://',
        'moz-extension://',
        // Network errors we can't control
        'NetworkError',
        'Network request failed',
        // AbortController
        'AbortError',
        // ResizeObserver infinite loop
        'ResizeObserver loop limit exceeded',
        // Random plugins
        'top.GLOBALS',
        // See http://blog.errorception.com/2012/03/tale-of-unfindable-js-error.html
        'originalCreateNotification',
        'canvas.contentDocument',
        'MyApp_RemoveAllHighlights',
      ],

      // Breadcrumb filtering
      beforeBreadcrumb(breadcrumb, _hint) {
        // Reduce noise from HTTP requests
        if (breadcrumb.category === 'http') {
          // Skip logging health checks
          if (breadcrumb.data?.url?.includes('/health') || breadcrumb.data?.url?.includes('/ping')) {
            return null;
          }
          // Limit detail for non-error responses
          if (breadcrumb.data?.status_code && breadcrumb.data.status_code < 400) {
            // Keep for tracking, just reduce frequency
            return breadcrumb;
          }
        }

        // Log UI interactions
        if (breadcrumb.category === 'ui.click') {
          return breadcrumb;
        }

        // Log user actions
        if (breadcrumb.category === 'user-action') {
          return breadcrumb;
        }

        return breadcrumb;
      },

      // Debug mode
      debug: config.debug || process.env.VITE_SENTRY_DEBUG === 'true',
    });

    // Set initial user context if available
    const user = (window as any).__INITIAL_USER__;
    if (user?.id) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.name,
      });
    }

    console.log(`[Sentry] Initialized for ${environment}`);
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error);
  }
}

/**
 * Set user context for Sentry
 * Call this after user authentication
 */
export function setSentryUser(user: { id: string; email?: string; name?: string } | null): void {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Capture exception with context
 */
export function captureException(
  error: Error,
  context?: Record<string, any>
): void {
  if (context) {
    Sentry.captureException(error, {
      contexts: {
        custom: context,
      },
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Capture message with level
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: Record<string, any>
): void {
  if (context) {
    Sentry.captureMessage(message, {
      level,
      contexts: {
        custom: context,
      },
    });
  } else {
    Sentry.captureMessage(message, level);
  }
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(
  message: string,
  category: string = 'user-action',
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  data?: Record<string, any>
): void {
  Sentry.captureMessage(message, {
    level,
    contexts: {
      breadcrumb: {
        category,
        ...data,
      },
    },
  });
}

/**
 * Start manual transaction for custom monitoring
 */
export function startTransaction(name: string, op: string = 'custom') {
  return (Sentry as any).startTransaction?.({
    name,
    op,
    sampled: true,
  });
}

/**
 * Export Sentry for direct access if needed
 */
export { Sentry };
