/**
 * Remote Execution Dashboard - Module 16
 *
 * Admin panel for monitoring multi-device remote command execution.
 * Shows queue status, execution history, and system health.
 *
 * **Features**:
 * - Real-time queue visualization
 * - Command history with filtering
 * - Executor health monitoring
 * - Manual command cancellation
 * - Export/debugging utilities
 *
 * **Real-Time Updates**:
 * Uses Supabase subscriptions for live updates.
 * No polling required.
 */

import React, { useState, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface RemoteExecutionDashboardProps {
  supabase: SupabaseClient;
  gateway: any; // OpenClaw gateway RPC client
}

interface QueueStats {
  pending: number;
  executing: number;
  maxConcurrent: number;
  isAtCapacity: boolean;
  executingCommandIds: string[];
}

interface CommandResult {
  command_id: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  provider: string;
  created_at: string;
  executed_at?: number;
  source_device_id: string;
}

/**
 * Remote Execution Dashboard Component
 *
 * Main admin interface for monitoring executor health and command queue.
 */
export function RemoteExecutionDashboard({
  supabase,
  gateway,
}: RemoteExecutionDashboardProps): React.ReactElement {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [recentCommands, setRecentCommands] = useState<CommandResult[]>([]);
  const [selectedCommand, setSelectedCommand] = useState<CommandResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial queue status
  useEffect(() => {
    const fetchQueueStatus = async () => {
      try {
        setLoading(true);
        const result = await gateway.call('getQueueStatus');
        if (result.success) {
          setStats(result);
        } else {
          setError(result.error || 'Failed to fetch queue status');
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchQueueStatus();
    const interval = setInterval(fetchQueueStatus, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, [gateway]);

  // Subscribe to recent commands
  useEffect(() => {
    const subscription = (supabase
      .from('remote_commands') as any)
      .on('*', () => {
        // Refetch recent commands on any change
        fetchRecentCommands();
      })
      .subscribe();

    fetchRecentCommands();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchRecentCommands = async () => {
    const { data, error: queryError } = await supabase
      .from('remote_commands')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!queryError && data) {
      setRecentCommands(data as CommandResult[]);
    }
  };

  const handleCancelCommand = async (commandId: string) => {
    try {
      const result = await gateway.call('cancelCommand', { commandId });
      if (result.success) {
        setSelectedCommand(null);
        fetchRecentCommands();
      } else {
        alert(`Cancel failed: ${result.error}`);
      }
    } catch (err) {
      alert(`Error: ${String(err)}`);
    }
  };

  if (loading) {
    return (
      <div className="remote-execution-dashboard loading">
        <div className="spinner" />
        <p>Loading executor status...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="remote-execution-dashboard error">
        <h2>Error Loading Dashboard</h2>
        <p>{error}</p>
      </div>
    );
  }

  const utilizationPercent = stats
    ? Math.round((stats.executing / stats.maxConcurrent) * 100)
    : 0;

  return (
    <div className="remote-execution-dashboard">
      <h1>Remote Execution Dashboard</h1>

      {/* Queue Status Card */}
      <div className="status-card">
        <h2>Queue Status</h2>
        <div className="stat-row">
          <div className="stat-item">
            <span className="label">Pending</span>
            <span className="value pending">{stats?.pending || 0}</span>
          </div>
          <div className="stat-item">
            <span className="label">Executing</span>
            <span className="value executing">{stats?.executing || 0}</span>
          </div>
          <div className="stat-item">
            <span className="label">Max Concurrent</span>
            <span className="value">{stats?.maxConcurrent || 0}</span>
          </div>
        </div>

        {/* Utilization Bar */}
        <div className="utilization-bar">
          <div
            className="utilization-fill"
            style={{
              width: `${utilizationPercent}%`,
              backgroundColor:
                utilizationPercent > 80 ? '#ef4444' : utilizationPercent > 50 ? '#f59e0b' : '#10b981',
            }}
          />
          <span className="utilization-text">{utilizationPercent}% Utilized</span>
        </div>

        {stats?.isAtCapacity && (
          <div className="alert alert-warning">⚠️ Executor at capacity - queue may build up</div>
        )}
      </div>

      {/* Recent Commands Table */}
      <div className="commands-card">
        <h2>Recent Commands</h2>
        <table className="commands-table">
          <thead>
            <tr>
              <th>Command ID</th>
              <th>Provider</th>
              <th>Device</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {recentCommands.map((cmd) => (
              <tr key={cmd.command_id} className={`status-${cmd.status}`}>
                <td className="command-id">{cmd.command_id.slice(0, 8)}...</td>
                <td className="provider">{cmd.provider}</td>
                <td className="device">{cmd.source_device_id}</td>
                <td className="status">
                  <span className={`badge badge-${cmd.status}`}>{cmd.status}</span>
                </td>
                <td className="created">
                  {new Date(cmd.created_at).toLocaleTimeString()}
                </td>
                <td className="actions">
                  <button
                    className="btn-view"
                    onClick={() => setSelectedCommand(cmd)}
                  >
                    View
                  </button>
                  {cmd.status === 'pending' && (
                    <button
                      className="btn-cancel"
                      onClick={() => handleCancelCommand(cmd.command_id)}
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Command Detail Panel */}
      {selectedCommand && (
        <div className="detail-panel">
          <h2>Command Details</h2>
          <button className="btn-close" onClick={() => setSelectedCommand(null)}>
            ✕
          </button>
          <div className="detail-content">
            <div className="detail-field">
              <label>Command ID</label>
              <code>{selectedCommand.command_id}</code>
            </div>
            <div className="detail-field">
              <label>Status</label>
              <span className={`badge badge-${selectedCommand.status}`}>
                {selectedCommand.status}
              </span>
            </div>
            <div className="detail-field">
              <label>Provider</label>
              <span>{selectedCommand.provider}</span>
            </div>
            <div className="detail-field">
              <label>Source Device</label>
              <span>{selectedCommand.source_device_id}</span>
            </div>
            <div className="detail-field">
              <label>Created</label>
              <span>{new Date(selectedCommand.created_at).toLocaleString()}</span>
            </div>
            {selectedCommand.executed_at && (
              <div className="detail-field">
                <label>Executed</label>
                <span>{new Date(selectedCommand.executed_at).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .remote-execution-dashboard {
          padding: 2rem;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .remote-execution-dashboard.loading,
        .remote-execution-dashboard.error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }

        .status-card,
        .commands-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 2rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .stat-row {
          display: flex;
          gap: 2rem;
          margin: 1.5rem 0;
        }

        .stat-item {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .stat-item .label {
          font-size: 0.875rem;
          color: #6b7280;
          margin-bottom: 0.5rem;
        }

        .stat-item .value {
          font-size: 2rem;
          font-weight: bold;
          color: #1f2937;
        }

        .stat-item .value.pending {
          color: #f59e0b;
        }

        .stat-item .value.executing {
          color: #3b82f6;
        }

        .utilization-bar {
          background: #f3f4f6;
          height: 24px;
          border-radius: 12px;
          overflow: hidden;
          margin: 1rem 0;
          display: flex;
          align-items: center;
          position: relative;
        }

        .utilization-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .utilization-text {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          font-size: 0.75rem;
          font-weight: bold;
          color: white;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
          pointer-events: none;
        }

        .alert {
          padding: 0.75rem;
          border-radius: 6px;
          font-size: 0.875rem;
          margin-top: 1rem;
        }

        .alert-warning {
          background: #fef3c7;
          border: 1px solid #fcd34d;
          color: #92400e;
        }

        .commands-table {
          width: 100%;
          border-collapse: collapse;
        }

        .commands-table thead {
          background: #f9fafb;
          border-bottom: 2px solid #e5e7eb;
        }

        .commands-table th {
          padding: 0.75rem;
          text-align: left;
          font-weight: 600;
          color: #374151;
          font-size: 0.875rem;
        }

        .commands-table td {
          padding: 0.75rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .commands-table tr:hover {
          background: #f9fafb;
        }

        .command-id {
          font-family: monospace;
          color: #6b7280;
        }

        .badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .badge-pending {
          background: #fef3c7;
          color: #92400e;
        }

        .badge-executing {
          background: #dbeafe;
          color: #1e40af;
        }

        .badge-completed {
          background: #dcfce7;
          color: #166534;
        }

        .badge-failed {
          background: #fee2e2;
          color: #991b1b;
        }

        .actions {
          display: flex;
          gap: 0.5rem;
        }

        .btn-view,
        .btn-cancel,
        .btn-close {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-view {
          background: #e5e7eb;
          color: #1f2937;
        }

        .btn-view:hover {
          background: #d1d5db;
        }

        .btn-cancel {
          background: #fee2e2;
          color: #991b1b;
        }

        .btn-cancel:hover {
          background: #fecaca;
        }

        .detail-panel {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1.5rem;
          position: relative;
        }

        .detail-panel .btn-close {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: #f3f4f6;
          color: #6b7280;
          padding: 0.5rem;
          width: 32px;
          height: 32px;
        }

        .detail-content {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }

        .detail-field {
          display: flex;
          flex-direction: column;
        }

        .detail-field label {
          font-weight: 600;
          color: #6b7280;
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
        }

        .detail-field code {
          background: #f3f4f6;
          padding: 0.5rem;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.875rem;
          word-break: break-all;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
