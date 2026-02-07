/**
 * Webhook Tester Panel - Test webhook endpoints without live deployment
 *
 * Features:
 * - URL validation
 * - Custom payload editor
 * - Test execution with response inspection
 * - Performance timing
 */

import { useState, useCallback } from 'react';
import { useGateway } from '../../../hooks/useGateway';
import './webhook-tester-panel.css';

export interface WebhookTesterPanelProps {
  channel: string;
}

interface TestResult {
  success: boolean;
  statusCode?: number;
  responseTime: number;
  responseSize: number;
  responsePreview: string;
  error?: string;
}

const DEFAULT_PAYLOADS: Record<string, Record<string, unknown>> = {
  whatsapp: {
    type: 'message',
    from: '+1234567890',
    body: 'Test message from Helix',
    timestamp: Math.floor(Date.now() / 1000),
  },
  telegram: {
    message: {
      message_id: 123,
      chat: { id: 456, type: 'private' },
      text: 'Test message from Helix',
      date: Math.floor(Date.now() / 1000),
    },
  },
  discord: {
    type: 1,
    data: {
      name: 'test',
      options: [],
    },
  },
};

export function WebhookTesterPanel({ channel }: WebhookTesterPanelProps) {
  const { getClient } = useGateway();

  // State
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('POST');
  const [payload, setPayload] = useState(JSON.stringify(DEFAULT_PAYLOADS[channel] || {}, null, 2));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Validate URL
  const validateUrl = useCallback(async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    const client = getClient();
    if (!client?.connected) {
      setError('Gateway not connected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const validation = (await client.request('channels.webhook.validate_url', {
        url,
      })) as {
        valid?: boolean;
        validation?: { valid: boolean; error?: string };
      };

      const isValid = validation.valid ?? validation.validation?.valid ?? false;
      if (!isValid) {
        setError(validation.validation?.error ?? 'Invalid webhook URL');
      } else {
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate URL');
    } finally {
      setLoading(false);
    }
  }, [url, getClient]);

  // Test webhook
  const testWebhook = useCallback(async () => {
    if (!url.trim()) {
      setError('Please enter a webhook URL');
      return;
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      setError('Invalid JSON payload');
      return;
    }

    const client = getClient();
    if (!client?.connected) {
      setError('Gateway not connected');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const testResult = (await client.request('channels.webhook.test', {
        url,
        method,
        payload: parsedPayload,
        channel,
      })) as {
        ok?: boolean;
        result?: {
          success: boolean;
          statusCode?: number;
          responseTime: number;
          responseSize: number;
          responsePreview?: string;
          error?: string;
        };
      };

      if (testResult.result) {
        setResult({
          success: testResult.result.success,
          statusCode: testResult.result.statusCode,
          responseTime: testResult.result.responseTime,
          responseSize: testResult.result.responseSize,
          responsePreview: testResult.result.responsePreview ?? '',
          error: testResult.result.error,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setLoading(false);
    }
  }, [url, method, payload, channel, getClient]);

  return (
    <div className="wtp-container">
      {/* URL Input */}
      <div className="wtp-section">
        <h3>Webhook URL</h3>
        <div className="wtp-url-input-group">
          <input
            type="url"
            className="wtp-url-input"
            placeholder="https://example.com/webhook"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
          />
          <button
            className="wtp-validate-btn"
            onClick={validateUrl}
            disabled={loading || !url}
          >
            {loading ? 'Validating...' : 'Validate'}
          </button>
        </div>
      </div>

      {/* Method & Payload */}
      <div className="wtp-section">
        <h3>Request Configuration</h3>

        <div className="wtp-method-group">
          <label>Method</label>
          <select
            className="wtp-method-select"
            value={method}
            onChange={(e) => setMethod(e.target.value as 'GET' | 'POST' | 'PUT' | 'DELETE')}
            disabled={loading}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>

        <label className="wtp-payload-label">Payload (JSON)</label>
        <textarea
          className="wtp-payload-textarea"
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          disabled={loading}
          rows={8}
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="wtp-error">
          <span>⚠️ {error}</span>
          <button
            className="wtp-error-close"
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Test Results */}
      {result && (
        <div className={`wtp-result ${result.success ? 'success' : 'failure'}`}>
          <div className="wtp-result-header">
            <span className="wtp-result-status">
              {result.success ? '✅ Success' : '❌ Failed'}
            </span>
            {result.statusCode && (
              <span className="wtp-result-code">{result.statusCode}</span>
            )}
          </div>

          <div className="wtp-result-metrics">
            <div className="wtp-metric">
              <span className="wtp-metric-label">Response Time</span>
              <span className="wtp-metric-value">{result.responseTime}ms</span>
            </div>
            <div className="wtp-metric">
              <span className="wtp-metric-label">Response Size</span>
              <span className="wtp-metric-value">{result.responseSize} bytes</span>
            </div>
          </div>

          {result.responsePreview && (
            <div className="wtp-result-preview">
              <div className="wtp-preview-label">Response Preview</div>
              <pre className="wtp-preview-content">{result.responsePreview}</pre>
            </div>
          )}

          {result.error && (
            <div className="wtp-result-error">
              <div className="wtp-error-label">Error</div>
              <div className="wtp-error-message">{result.error}</div>
            </div>
          )}
        </div>
      )}

      {/* Test Button */}
      <div className="wtp-actions">
        <button
          className="wtp-test-btn"
          onClick={testWebhook}
          disabled={loading || !url}
        >
          {loading ? 'Testing...' : 'Test Webhook'}
        </button>
      </div>

      {/* Info */}
      <div className="wtp-info">
        <p>
          💡 Test your webhook endpoint without deploying to production. The test includes
          timeout protection (5s) and response size limits (10KB).
        </p>
      </div>
    </div>
  );
}
