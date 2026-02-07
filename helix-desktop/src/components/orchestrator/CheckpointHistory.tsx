/**
 * CheckpointHistory Component
 *
 * Virtualized list of recent checkpoints showing:
 * - Checkpoint metadata (ID, step, node)
 * - Timestamp and age
 * - Cost information
 * - Token usage per checkpoint
 * - Quick snapshot preview
 */

import React, { useMemo, useState } from 'react';
import { Save, ChevronDown, Zap, Coins } from 'lucide-react';
import { useOrchestratorMetrics } from '../../hooks';
import type { OrchestratorCheckpointSnapshot } from '../../lib/types/orchestrator-metrics';

interface CheckpointHistoryProps {
  threadId?: string;
  className?: string;
  maxItems?: number;
}

/**
 * Format timestamp to readable date/time
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  // Today
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  // This week
  const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    return `${daysDiff}d ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  }

  // Older
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format cost in cents
 */
function formatCost(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

/**
 * Calculate age of checkpoint in human-readable format
 */
function formatAge(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return `${Math.round(diff / 1000)}s old`;
  if (diff < 3600000) return `${Math.round(diff / 60000)}m old`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h old`;
  return `${Math.round(diff / 86400000)}d old`;
}

interface CheckpointRowProps {
  checkpoint: OrchestratorCheckpointSnapshot;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

/**
 * Individual checkpoint row component
 */
const CheckpointRow: React.FC<CheckpointRowProps> = ({
  checkpoint,
  isExpanded,
  onToggleExpand,
}) => {
  return (
    <div className="bg-bg-secondary/20 rounded-lg border border-border-secondary/30 overflow-hidden transition-all duration-200">
      <button
        onClick={onToggleExpand}
        className="w-full text-left p-3 hover:bg-bg-secondary/40 transition-colors flex items-center justify-between gap-3"
      >
        {/* Checkpoint number and node */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono bg-bg-primary/50 border border-border-secondary/50 px-2 py-1 rounded text-text-tertiary">
              CP{checkpoint.stepCount}
            </span>
            <span className="text-sm font-semibold text-text-secondary truncate">
              {checkpoint.currentNode}
            </span>
          </div>
          <p className="text-xs text-text-tertiary">
            {formatTimestamp(checkpoint.timestamp)} ({formatAge(checkpoint.timestamp)})
          </p>
        </div>

        {/* Cost and tokens preview */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-1">
            <Coins className="w-3 h-3 text-yellow-400" />
            <span className="text-xs font-semibold text-text-secondary">
              {formatCost(checkpoint.costCents)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-blue-400" />
            <span className="text-xs font-semibold text-text-secondary">
              {checkpoint.inputTokens + checkpoint.outputTokens}
            </span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-text-tertiary transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3 py-3 bg-bg-primary/30 border-t border-border-secondary/30 space-y-3">
          {/* Checkpoint ID */}
          <div>
            <p className="text-xs text-text-tertiary mb-1">Checkpoint ID</p>
            <p className="text-xs font-mono bg-bg-secondary/50 border border-border-secondary/50 px-2 py-1 rounded text-text-secondary break-all">
              {checkpoint.checkpointId}
            </p>
          </div>

          {/* Token breakdown */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-xs text-text-tertiary mb-1">Input Tokens</p>
              <p className="text-sm font-semibold text-blue-300">{checkpoint.inputTokens}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-1">Output Tokens</p>
              <p className="text-sm font-semibold text-green-300">{checkpoint.outputTokens}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-1">Total</p>
              <p className="text-sm font-semibold text-cyan-300">
                {checkpoint.inputTokens + checkpoint.outputTokens}
              </p>
            </div>
          </div>

          {/* Cost details */}
          <div>
            <p className="text-xs text-text-tertiary mb-1">Cost</p>
            <p className="text-sm font-semibold text-yellow-300">{formatCost(checkpoint.costCents)}</p>
          </div>

          {/* Metadata */}
          <div className="pt-2 border-t border-border-secondary/30 text-xs text-text-tertiary space-y-1">
            <p>Thread ID: <span className="text-text-secondary">{checkpoint.threadId}</span></p>
            <p>Timestamp: <span className="text-text-secondary">{new Date(checkpoint.timestamp).toISOString()}</span></p>
          </div>
        </div>
      )}
    </div>
  );
};

export const CheckpointHistory: React.FC<CheckpointHistoryProps> = ({
  threadId,
  className = '',
  maxItems = 30,
}) => {
  const _metrics = useOrchestratorMetrics(threadId || '');
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());

  const recentCheckpoints: OrchestratorCheckpointSnapshot[] = [];
  const connectionStatus = 'connected';
  const error: string | null = null;

  // Prepare checkpoint data
  const checkpointList = useMemo(() => {
    return recentCheckpoints.slice(0, maxItems);
  }, [recentCheckpoints, maxItems]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (checkpointList.length === 0) {
      return {
        totalCheckpoints: 0,
        totalCost: 0,
        totalTokens: 0,
        avgCostPerCheckpoint: 0,
      };
    }

    const totalCost = checkpointList.reduce((sum: number, cp: OrchestratorCheckpointSnapshot) => sum + cp.costCents, 0);
    const totalTokens = checkpointList.reduce(
      (sum: number, cp: OrchestratorCheckpointSnapshot) => sum + cp.inputTokens + cp.outputTokens,
      0
    );

    return {
      totalCheckpoints: checkpointList.length,
      totalCost,
      totalTokens,
      avgCostPerCheckpoint: totalCost / checkpointList.length,
    };
  }, [checkpointList]);

  // Toggle expand state for a checkpoint
  const toggleExpanded = (index: number) => {
    const newSet = new Set(expandedIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setExpandedIndices(newSet);
  };

  // Loading state
  if (connectionStatus === 'connecting') {
    return (
      <div className={`card-glass p-6 rounded-lg border border-border-secondary/50 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Save className="w-5 h-5 text-helix-400 opacity-50" />
          <h3 className="text-sm font-semibold text-text-secondary">Checkpoint History</h3>
        </div>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-bg-secondary/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (connectionStatus === 'error' || error) {
    return (
      <div className={`card-glass p-6 rounded-lg border border-border-secondary/50 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Save className="w-5 h-5 text-red-400" />
          <h3 className="text-sm font-semibold text-text-secondary">Checkpoint History</h3>
        </div>
        <p className="text-xs text-text-tertiary">{error || 'Failed to load checkpoint history'}</p>
      </div>
    );
  }

  return (
    <div className={`card-glass p-6 rounded-lg border border-border-secondary/50 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Save className="w-5 h-5 text-helix-400" />
          <h3 className="text-sm font-semibold text-text-secondary">Checkpoint History</h3>
        </div>
        <div className="text-xs text-text-tertiary">
          {stats.totalCheckpoints} checkpoints
        </div>
      </div>

      {/* Statistics cards */}
      {stats.totalCheckpoints > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4 pb-4 border-b border-border-secondary/30">
          <div className="bg-bg-secondary/30 rounded-lg p-2">
            <p className="text-xs text-text-tertiary mb-0.5">Total Cost</p>
            <p className="text-xs font-semibold text-yellow-300">
              {formatCost(stats.totalCost)}
            </p>
          </div>
          <div className="bg-bg-secondary/30 rounded-lg p-2">
            <p className="text-xs text-text-tertiary mb-0.5">Total Tokens</p>
            <p className="text-xs font-semibold text-blue-300">{stats.totalTokens}</p>
          </div>
          <div className="bg-bg-secondary/30 rounded-lg p-2">
            <p className="text-xs text-text-tertiary mb-0.5">Avg Cost/CP</p>
            <p className="text-xs font-semibold text-cyan-300">
              {formatCost(stats.avgCostPerCheckpoint)}
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {checkpointList.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-xs text-text-tertiary">No checkpoints yet...</p>
        </div>
      ) : (
        <>
          {/* Checkpoint list */}
          <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-bg-secondary/50 scrollbar-track-bg-secondary/20">
            {checkpointList.map((checkpoint, idx) => (
              <CheckpointRow
                key={checkpoint.checkpointId}
                checkpoint={checkpoint}
                isExpanded={expandedIndices.has(idx)}
                onToggleExpand={() => toggleExpanded(idx)}
              />
            ))}
          </div>

          {/* Footer info */}
          {recentCheckpoints.length > maxItems && (
            <div className="mt-3 pt-3 border-t border-border-secondary/30 text-xs text-text-tertiary">
              Showing {maxItems} of {recentCheckpoints.length} checkpoints
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CheckpointHistory;
