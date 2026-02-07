/**
 * Filter Builder Component
 *
 * Visual message filter creator with regex testing and complexity analysis.
 * - Regex pattern testing with live preview
 * - Catastrophic backtracking detection
 * - DoS protection warnings
 * - Filter action selection (block, allow, route, flag, mute)
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle, Play } from 'lucide-react';
import { getGatewayClient } from '../../lib/gateway-client';
import type { MessageFilter } from '../../lib/types/orchestrator-metrics';

interface FilterBuilderProps {
  channelId?: string;
  className?: string;
  onFilterCreated?: (filter: MessageFilter) => void;
}

type FilterType = 'regex' | 'keyword' | 'sender' | 'time';
type FilterAction = 'block' | 'allow' | 'route' | 'flag' | 'mute';

interface ComplexityWarning {
  level: 'safe' | 'warning' | 'danger';
  message: string;
}

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  channelId,
  className = '',
  onFilterCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<FilterType>('keyword');
  const [pattern, setPattern] = useState('');
  const [action, setAction] = useState<FilterAction>('block');
  const [routeAgent, setRouteAgent] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchMode, setMatchMode] = useState<'any' | 'all'>('any');

  // Testing
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<{
    matched: boolean;
    executionTimeMs: number;
  } | null>(null);

  const [filters, setFilters] = useState<MessageFilter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analyze regex complexity
  const complexity = useMemo((): ComplexityWarning => {
    if (type !== 'regex') {
      return { level: 'safe', message: 'Non-regex filters are always safe' };
    }

    // Check for catastrophic backtracking patterns
    if (/(\.\*\+|\.\+\+|\*\+|\+\+|\{\d+,\}\+)/.test(pattern)) {
      return {
        level: 'danger',
        message: 'Catastrophic backtracking detected: nested quantifiers',
      };
    }

    // Check for negative lookahead (expensive)
    if (/\(\?!/.test(pattern)) {
      return {
        level: 'warning',
        message: 'Negative lookahead can be slow on large messages',
      };
    }

    // Check for alternation with quantifiers
    if (/\|.*[\*\+]/.test(pattern) || /[\*\+].*\|/.test(pattern)) {
      return {
        level: 'warning',
        message: 'Alternation with quantifiers may impact performance',
      };
    }

    // Basic patterns are safe
    return { level: 'safe', message: 'Regex pattern looks safe' };
  }, [type, pattern]);

  // Test regex/keyword pattern
  const testFilter = useCallback(async () => {
    if (!testMessage || !pattern) {
      setTestResult(null);
      return;
    }

    setLoading(true);
    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        setError('Gateway not connected');
        return;
      }

      const result = await client.request('filters.test', {
        pattern,
        type,
        testMessage,
      });

      setTestResult({
        matched: result.matched,
        executionTimeMs: result.executionTimeMs,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setLoading(false);
    }
  }, [pattern, type, testMessage]);

  // Create and save filter
  const createFilter = useCallback(async () => {
    if (!name || !pattern) {
      setError('Name and pattern required');
      return;
    }

    if (complexity.level === 'danger') {
      setError('Cannot create filter with catastrophic backtracking');
      return;
    }

    const filter: MessageFilter = {
      id: `filter-${Date.now()}`,
      name,
      description,
      enabled: true,
      type,
      pattern,
      action,
      routeToAgent: action === 'route' ? routeAgent : undefined,
      caseSensitive,
      matchMode: type === 'keyword' ? matchMode : undefined,
      priority: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setLoading(true);
    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        setError('Gateway not connected');
        return;
      }

      await client.request('filters.create', filter);
      setFilters([...filters, filter]);

      // Reset form
      setName('');
      setDescription('');
      setPattern('');
      setAction('block');
      setTestResult(null);
      setError(null);

      onFilterCreated?.(filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create filter');
    } finally {
      setLoading(false);
    }
  }, [name, pattern, description, type, action, routeAgent, caseSensitive, matchMode, complexity, filters, onFilterCreated]);

  // Delete filter
  const deleteFilter = useCallback(
    async (filterId: string) => {
      setLoading(true);
      try {
        const client = getGatewayClient();
        if (!client?.connected) {
          setError('Gateway not connected');
          return;
        }

        await client.request('filters.delete', { id: filterId });
        setFilters(filters.filter(f => f.id !== filterId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete filter');
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Play className="w-5 h-5 text-helix-400" />
        <h3 className="text-sm font-semibold text-text-secondary">Message Filters</h3>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Filter builder form */}
      <div className="space-y-3 p-3 rounded-lg bg-bg-secondary/20 border border-border-secondary/30">
        {/* Basic info */}
        <div>
          <label className="text-xs font-semibold text-text-secondary block mb-1">
            Filter Name
          </label>
          <input
            type="text"
            placeholder="e.g., Block spam keywords"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-2 py-1 bg-bg-secondary/50 border border-border-secondary/50 rounded text-xs text-text-secondary placeholder-text-tertiary focus:outline-none focus:border-helix-500/50"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-text-secondary block mb-1">
            Description
          </label>
          <input
            type="text"
            placeholder="Optional description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-2 py-1 bg-bg-secondary/50 border border-border-secondary/50 rounded text-xs text-text-secondary placeholder-text-tertiary focus:outline-none focus:border-helix-500/50"
          />
        </div>

        {/* Type selector */}
        <div>
          <label className="text-xs font-semibold text-text-secondary block mb-2">
            Filter Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['regex', 'keyword', 'sender', 'time'] as FilterType[]).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`p-2 rounded text-xs font-medium transition-colors ${
                  type === t
                    ? 'bg-helix-500/30 border border-helix-500/40 text-helix-300'
                    : 'bg-bg-secondary/30 border border-border-secondary/30 text-text-tertiary'
                }`}
              >
                {t === 'regex' && 'Regex'}
                {t === 'keyword' && 'Keyword'}
                {t === 'sender' && 'Sender'}
                {t === 'time' && 'Time'}
              </button>
            ))}
          </div>
        </div>

        {/* Pattern input */}
        <div>
          <label className="text-xs font-semibold text-text-secondary block mb-1">
            {type === 'regex' && 'Regex Pattern'}
            {type === 'keyword' && 'Keywords (comma-separated)'}
            {type === 'sender' && 'Sender ID'}
            {type === 'time' && 'Time Range'}
          </label>
          <input
            type="text"
            placeholder={
              type === 'regex'
                ? '^spam|casino|prize$'
                : type === 'keyword'
                  ? 'spam, casino, prize'
                  : 'Enter pattern'
            }
            value={pattern}
            onChange={e => setPattern(e.target.value)}
            className="w-full px-2 py-1 bg-bg-secondary/50 border border-border-secondary/50 rounded text-xs font-mono text-text-secondary placeholder-text-tertiary focus:outline-none focus:border-helix-500/50"
          />
        </div>

        {/* Options */}
        {type === 'regex' && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={e => setCaseSensitive(e.target.checked)}
              className="cursor-pointer"
            />
            <span className="text-xs text-text-secondary">Case sensitive</span>
          </label>
        )}

        {type === 'keyword' && (
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-2">
              Match Mode
            </label>
            <div className="flex gap-2">
              {(['any', 'all'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setMatchMode(mode)}
                  className={`flex-1 p-2 rounded text-xs font-medium transition-colors ${
                    matchMode === mode
                      ? 'bg-helix-500/30 border border-helix-500/40 text-helix-300'
                      : 'bg-bg-secondary/30 border border-border-secondary/30 text-text-tertiary'
                  }`}
                >
                  {mode === 'any' ? 'Any keyword' : 'All keywords'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Complexity warning */}
        {type === 'regex' && pattern && (
          <div
            className={`p-2 rounded-lg flex items-start gap-2 ${
              complexity.level === 'danger'
                ? 'bg-red-500/10 border border-red-500/20'
                : complexity.level === 'warning'
                  ? 'bg-yellow-500/10 border border-yellow-500/20'
                  : 'bg-emerald-500/10 border border-emerald-500/20'
            }`}
          >
            {complexity.level === 'danger' ? (
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            ) : complexity.level === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            )}
            <p
              className={`text-xs ${
                complexity.level === 'danger'
                  ? 'text-red-300'
                  : complexity.level === 'warning'
                    ? 'text-yellow-300'
                    : 'text-emerald-300'
              }`}
            >
              {complexity.message}
            </p>
          </div>
        )}

        {/* Action selector */}
        <div>
          <label className="text-xs font-semibold text-text-secondary block mb-2">
            Action
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['block', 'allow', 'route', 'flag', 'mute'] as FilterAction[]).map(act => (
              <button
                key={act}
                onClick={() => setAction(act)}
                className={`p-2 rounded text-xs font-medium transition-colors ${
                  action === act
                    ? 'bg-helix-500/30 border border-helix-500/40 text-helix-300'
                    : 'bg-bg-secondary/30 border border-border-secondary/30 text-text-tertiary'
                }`}
              >
                {act === 'block' && 'Block'}
                {act === 'allow' && 'Allow'}
                {act === 'route' && 'Route'}
                {act === 'flag' && 'Flag'}
                {act === 'mute' && 'Mute'}
              </button>
            ))}
          </div>
        </div>

        {action === 'route' && (
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Route to Agent
            </label>
            <input
              type="text"
              placeholder="Agent ID"
              value={routeAgent}
              onChange={e => setRouteAgent(e.target.value)}
              className="w-full px-2 py-1 bg-bg-secondary/50 border border-border-secondary/50 rounded text-xs text-text-secondary focus:outline-none focus:border-helix-500/50"
            />
          </div>
        )}
      </div>

      {/* Test section */}
      <div className="space-y-2 p-3 rounded-lg bg-bg-secondary/20 border border-border-secondary/30">
        <label className="text-xs font-semibold text-text-secondary block">
          Test Filter
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter test message"
            value={testMessage}
            onChange={e => setTestMessage(e.target.value)}
            className="flex-1 px-2 py-1 bg-bg-secondary/50 border border-border-secondary/50 rounded text-xs text-text-secondary placeholder-text-tertiary focus:outline-none focus:border-helix-500/50"
          />
          <button
            onClick={testFilter}
            disabled={!pattern || !testMessage || loading}
            className="px-3 py-1 rounded bg-helix-500/30 border border-helix-500/40 hover:bg-helix-500/40 disabled:opacity-50 transition-colors text-xs font-medium text-helix-300"
          >
            Test
          </button>
        </div>

        {testResult && (
          <div
            className={`p-2 rounded text-xs ${
              testResult.matched
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                : 'bg-blue-500/10 border border-blue-500/20 text-blue-300'
            }`}
          >
            {testResult.matched ? '✓ Matched' : '✗ No match'} ({testResult.executionTimeMs.toFixed(2)}ms)
          </div>
        )}
      </div>

      {/* Create button */}
      <button
        onClick={createFilter}
        disabled={!name || !pattern || loading || complexity.level === 'danger'}
        className="w-full p-2 rounded bg-helix-500/30 border border-helix-500/40 hover:bg-helix-500/40 disabled:opacity-50 transition-colors text-xs font-medium text-helix-300"
      >
        {loading ? 'Creating...' : 'Create Filter'}
      </button>

      {/* Filters list */}
      {filters.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-secondary">Created Filters</p>
          {filters.map(filter => (
            <div
              key={filter.id}
              className="p-2 rounded bg-bg-secondary/30 border border-border-secondary/30 flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-semibold text-text-secondary">{filter.name}</p>
                <p className="text-xs text-text-tertiary">{filter.pattern}</p>
              </div>
              <button
                onClick={() => deleteFilter(filter.id)}
                className="p-1 hover:bg-red-500/20 rounded transition-colors"
              >
                <Trash2 className="w-3 h-3 text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FilterBuilder;
