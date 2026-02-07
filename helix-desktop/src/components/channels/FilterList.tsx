/**
 * Message Filter List
 *
 * Displays, enables/disables, edits, and deletes message filters.
 */

import { useState, useEffect, useCallback } from 'react';
import { getGatewayClient } from '../../lib/gateway-client';
import { FilterBuilder } from './FilterBuilder';
import type { MessageFilter } from '../../lib/types/message-filter';

export function FilterList() {
  const [filters, setFilters] = useState<MessageFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);

  const loadFilters = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        setError('Gateway not connected');
        return;
      }

      const result = (await client.request('filters.list', {})) as any;
      setFilters(result.filters ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load filters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  const toggleFilter = useCallback(
    async (id: string, enabled: boolean) => {
      const client = getGatewayClient();
      if (!client?.connected) return;

      try {
        await client.request('filters.update', {
          id,
          updates: { enabled: !enabled },
        });

        setFilters((prev) =>
          prev.map((f) => (f.id === id ? { ...f, enabled: !enabled } : f))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to toggle filter');
      }
    },
    []
  );

  const deleteFilter = useCallback(async (id: string) => {
    if (!confirm('Delete this filter?')) return;

    const client = getGatewayClient();
    if (!client?.connected) return;

    try {
      await client.request('filters.delete', { id });
      setFilters((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete filter');
    }
  }, []);

  const handleSaveFilter = useCallback(
    async (filter: Partial<MessageFilter>) => {
      const client = getGatewayClient();
      if (!client?.connected) return;

      try {
        if (filter.id && editingId) {
          await client.request('filters.update', { id: filter.id, updates: filter });
          setFilters((prev) =>
            prev.map((f) => (f.id === filter.id ? { ...f, ...filter } : f))
          );
        } else {
          await client.request('filters.create', filter);
          setFilters((prev) => [...prev, filter as MessageFilter]);
        }

        setShowBuilder(false);
        setEditingId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save filter');
      }
    },
    [editingId]
  );

  if (loading) return <div className="loading">Loading filters...</div>;

  return (
    <div className="filter-list">
      <div className="filter-header">
        <h3>Message Filters</h3>
        <button
          onClick={() => {
            setEditingId(null);
            setShowBuilder(!showBuilder);
          }}
          className="btn-primary btn-sm"
        >
          + Add Filter
        </button>
      </div>

      {showBuilder && (
        <div className="filter-builder-section">
          <FilterBuilder
            onSave={handleSaveFilter}
            onCancel={() => {
              setShowBuilder(false);
              setEditingId(null);
            }}
            initialFilter={
              editingId ? filters.find((f) => f.id === editingId) : undefined
            }
          />
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      <div className="filters-grid">
        {filters.length === 0 ? (
          <div className="empty-state">No filters created yet</div>
        ) : (
          filters.map((filter) => (
            <div key={filter.id} className="filter-card">
              <div className="filter-card-header">
                <div className="filter-title">
                  <input
                    type="checkbox"
                    checked={filter.enabled}
                    onChange={() => toggleFilter(filter.id, filter.enabled)}
                  />
                  <span>{filter.name}</span>
                </div>
                <div className="filter-badge">{filter.type}</div>
              </div>

              <div className="filter-pattern">
                <code>{filter.pattern.slice(0, 60)}...</code>
              </div>

              <div className="filter-meta">
                <span className={`action-badge action-${filter.action}`}>
                  {filter.action.toUpperCase()}
                </span>
                <span className="priority">Priority: {filter.priority}</span>
              </div>

              <div className="filter-actions">
                <button
                  onClick={() => {
                    setEditingId(filter.id);
                    setShowBuilder(true);
                  }}
                  className="btn-icon"
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  onClick={() => deleteFilter(filter.id)}
                  className="btn-icon delete"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
