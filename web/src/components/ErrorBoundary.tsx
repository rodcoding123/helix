/**
 * Phase 10 Week 5: Sentry Error Boundary Component
 * Catches React component errors and reports to Sentry
 */

import React, { ReactNode } from 'react';
import { ErrorBoundary as SentryErrorBoundary } from '@sentry/react';
import * as Sentry from '@sentry/react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: { error: Error; resetError: () => void }) => ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * Custom Error Boundary component with Sentry integration
 * Catches errors in child components and logs them
 */
export function ErrorBoundary({ children, fallback, onError }: ErrorBoundaryProps) {
  const defaultFallback = ({ error, resetError }: { error: Error; resetError: () => void }) => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#f5f5f5',
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        maxWidth: '600px',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          marginBottom: '16px',
          color: '#e53e3e',
        }}>
          Oops! Something went wrong
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#666',
          marginBottom: '16px',
          lineHeight: 1.5,
        }}>
          We're sorry for the inconvenience. Our team has been notified and is working to fix the issue.
        </p>
        <details style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: '#f9f9f9',
          borderRadius: '4px',
          textAlign: 'left',
          cursor: 'pointer',
        }}>
          <summary style={{
            cursor: 'pointer',
            fontWeight: 'bold',
            color: '#444',
            marginBottom: '8px',
          }}>
            Error details (for debugging)
          </summary>
          <pre style={{
            fontSize: '12px',
            color: '#e53e3e',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: '8px 0 0 0',
          }}>
            {error.toString()}
          </pre>
        </details>
        <button
          onClick={resetError}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = '#2563eb';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = '#3b82f6';
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );

  return (
    <SentryErrorBoundary
      fallback={fallback || defaultFallback}
      onError={(error, errorInfo) => {
        // Log to Discord for critical errors
        console.error('[ErrorBoundary] React error:', error);
        console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

        // Capture in Sentry with full context
        Sentry.captureException(error, {
          contexts: {
            react: {
              componentStack: errorInfo.componentStack,
            },
          },
          level: 'fatal',
        });

        // Call custom error handler if provided
        if (onError) {
          try {
            onError(error, errorInfo);
          } catch (handlerError) {
            console.error('[ErrorBoundary] Error handler failed:', handlerError);
          }
        }
      }}
    >
      {children}
    </SentryErrorBoundary>
  );
}

/**
 * Wrapper component that can be used to wrap specific sections
 * Prevents errors from crashing the entire app
 */
export function SafeComponent({
  children,
  fallback = <div>Failed to load component</div>,
  name = 'Component',
}: {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}): JSX.Element {
  return (
    <ErrorBoundary
      fallback={() => fallback}
      onError={(error) => {
        console.error(`[SafeComponent] ${name} failed:`, error);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
