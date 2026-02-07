/**
 * Message Filter Builder
 *
 * Visual interface for creating and testing regex/keyword filters
 * with real-time validation and DoS protection feedback.
 */

import { useState, useCallback } from 'react';
import { getGatewayClient } from '../../lib/gateway-client';
import type { MessageFilter } from '../../lib/types/message-filter';

interface FilterBuilderProps {
  onSave: (filter: Partial<MessageFilter>) => void;
  onCancel: () => void;
  initialFilter?: MessageFilter;
}

export function FilterBuilder({ onSave, onCancel, initialFilter }: FilterBuilderProps) {
  const [name, setName] = useState(initialFilter?.name ?? '');
  const [type, setType] = useState<MessageFilter['type']>(initialFilter?.type ?? 'keyword');
  const [pattern, setPattern] = useState(initialFilter?.pattern ?? '');
  const [action, setAction] = useState<'block' | 'allow' | 'route'>(initialFilter?.action ?? 'block');
  const [priority, setPriority] = useState(initialFilter?.priority ?? 0);
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<{ blocked?: boolean; reason?: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testFilter = useCallback(async () => {
    if (!testMessage.trim()) {
      setError('Enter a test message');
      return;
    }

    setTesting(true);
    setError(null);

    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        setError('Gateway not connected');
        return;
      }

      const result = (await client.request('filters.test', {
        message: testMessage,
        pattern,
        type,
        action,
      })) as any;

      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  }, [testMessage, pattern, type, action]);

  const handleSave = () => {
    if (!name.trim() || !pattern.trim()) {
      setError('Name and pattern required');
      return;
    }

    onSave({
      id: initialFilter?.id,
      name,
      type,
      pattern,
      action,
      priority,
      enabled: true,
      createdAt: initialFilter?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    });
  };

  return (
    <div className="filter-builder">
      <div className="filter-section">
        <label>Filter Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Block spam keywords"
        />
      </div>

      <div className="filter-row">
        <div className="filter-section">
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="keyword">Keyword (fast)</option>
            <option value="regex">Regex (powerful)</option>
          </select>
        </div>

        <div className="filter-section">
          <label>Action</label>
          <select value={action} onChange={(e) => setAction(e.target.value as any)}>
            <option value="block">🚫 Block</option>
            <option value="allow">✅ Allow</option>
            <option value="route">➡️ Route to Agent</option>
          </select>
        </div>

        <div className="filter-section">
          <label>Priority</label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            min="0"
            max="100"
          />
        </div>
      </div>

      <div className="filter-section">
        <label>Pattern</label>
        {type === 'keyword' ? (
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="Separate keywords with | (pipe)"
          />
        ) : (
          <textarea
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="Enter regex pattern (e.g., /casino|prize|winner/i)"
            rows={4}
          />
        )}
        <div className="pattern-hint">
          {type === 'keyword'
            ? 'Example: casino|prize|winner'
            : 'Regex with DoS protection (100ms timeout)'}
        </div>
      </div>

      <div className="filter-section">
        <label>Test Pattern</label>
        <textarea
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          placeholder="Enter a test message to validate the filter"
          rows={2}
        />
        <button onClick={testFilter} disabled={testing} className="btn-secondary btn-sm">
          {testing ? '🔄 Testing...' : '▶️ Test Filter'}
        </button>
      </div>

      {testResult && (
        <div className={`filter-test-result ${testResult.blocked ? 'blocked' : 'allowed'}`}>
          <div className="result-badge">
            {testResult.blocked ? '🚫 BLOCKED' : '✅ ALLOWED'}
          </div>
          {testResult.reason && <div className="result-reason">{testResult.reason}</div>}
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      <div className="filter-actions">
        <button onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button onClick={handleSave} className="btn-primary">
          {initialFilter ? 'Update Filter' : 'Create Filter'}
        </button>
      </div>
    </div>
  );
}
