/**
 * AgentActivityTimeline Component
 *
 * Visual timeline of agent state transitions showing:
 * - Node execution order and timing
 * - State change frequency
 * - Execution time per node
 * - Current active node highlight
 */

import React, { useMemo, useState } from 'react';
import { ChevronDown, Activity, ArrowRight } from 'lucide-react';
import { useOrchestratorMetrics } from '../../hooks';
import type { OrchestratorStateChangeEvent } from '../../lib/types/orchestrator-metrics';

interface AgentActivityTimelineProps {
  threadId?: string;
  className?: string;
  maxItems?: number;
}

/**
 * Format timestamp to relative time string
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) return 'now';
  if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  return `${Math.round(diff / 3600000)}h ago`;
}

/**
 * Format duration in milliseconds
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Get a consistent color for a node name
 */
function getNodeColor(nodeName: string): string {
  const colors = [
    'bg-blue-500/20 border-blue-500/40 text-blue-300',
    'bg-purple-500/20 border-purple-500/40 text-purple-300',
    'bg-pink-500/20 border-pink-500/40 text-pink-300',
    'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
    'bg-green-500/20 border-green-500/40 text-green-300',
    'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
    'bg-indigo-500/20 border-indigo-500/40 text-indigo-300',
  ];

  // Use hash of node name to pick consistent color
  let hash = 0;
  for (let i = 0; i < nodeName.length; i++) {
    hash = ((hash << 5) - hash) + nodeName.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Group consecutive state changes from the same node
 */
function groupStateChanges(
  changes: OrchestratorStateChangeEvent[]
): Array<{ from: string; to: string; count: number; latestTime: number; duration: number }> {
  if (changes.length === 0) return [];

  const grouped: Array<{ from: string; to: string; count: number; latestTime: number; duration: number }> = [];
  let current: { from: string; to: string; count: number; latestTime: number; duration: number } | null = null;

  for (const change of changes) {
    if (!current || current.from !== change.from || current.to !== change.to) {
      if (current) {
        grouped.push(current);
      }
      current = {
        from: change.from,
        to: change.to,
        count: 1,
        latestTime: change.timestamp,
        duration: change.executionTimeMs,
      };
    } else {
      current.count += 1;
      current.latestTime = change.timestamp;
      current.duration += change.executionTimeMs;
    }
  }

  if (current) {
    grouped.push(current);
  }

  return grouped.reverse(); // Most recent first
}

export const AgentActivityTimeline: React.FC<AgentActivityTimelineProps> = ({
  threadId,
  className = '',
  maxItems = 15,
}) => {
  const metrics = useOrchestratorMetrics({ threadId });
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const {
    recentStateChanges,
    currentMetrics,
    connectionStatus,
    error,
  } = metrics;

  // Group and prepare timeline data
  const timelineData = useMemo(() => {
    if (recentStateChanges.length === 0) {
      return [];
    }

    return groupStateChanges(recentStateChanges).slice(0, maxItems);
  }, [recentStateChanges, maxItems]);

  // Compute frequency heatmap
  const frequencyStats = useMemo(() => {
    const stats = new Map<string, { count: number; totalDuration: number }>();

    for (const change of recentStateChanges) {
      const key = `${change.from} → ${change.to}`;
      const existing = stats.get(key) || { count: 0, totalDuration: 0 };
      stats.set(key, {
        count: existing.count + 1,
        totalDuration: existing.totalDuration + change.executionTimeMs,
      });
    }

    return stats;
  }, [recentStateChanges]);

  // Loading state
  if (connectionStatus === 'connecting') {
    return (
      <div className={`card-glass p-6 rounded-lg border border-border-secondary/50 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-helix-400 opacity-50" />
          <h3 className="text-sm font-semibold text-text-secondary">Agent Activity Timeline</h3>
        </div>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-bg-secondary/50 rounded-lg animate-pulse" />
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
          <Activity className="w-5 h-5 text-red-400" />
          <h3 className="text-sm font-semibold text-text-secondary">Agent Activity Timeline</h3>
        </div>
        <p className="text-xs text-text-tertiary">{error || 'Failed to load timeline'}</p>
      </div>
    );
  }

  return (
    <div className={`card-glass p-6 rounded-lg border border-border-secondary/50 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-helix-400" />
          <h3 className="text-sm font-semibold text-text-secondary">Agent Activity Timeline</h3>
        </div>
        {currentMetrics && (
          <div className="text-xs text-text-tertiary">
            {recentStateChanges.length} transitions
          </div>
        )}
      </div>

      {/* Empty state */}
      {timelineData.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-xs text-text-tertiary">Waiting for orchestration to start...</p>
        </div>
      ) : (
        <>
          {/* Current node indicator */}
          {currentMetrics && (
            <div className="mb-4 p-3 rounded-lg bg-bg-secondary/50 border border-helix-500/30 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-helix-500 animate-pulse" />
              <span className="text-xs text-text-secondary">
                Currently executing:{' '}
                <span className="text-helix-400 font-semibold">{currentMetrics.currentNode}</span>
              </span>
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {timelineData.map((item, index) => {
              const isExpanded = expandedIndex === index;
              const fromColor = getNodeColor(item.from);
              const toColor = getNodeColor(item.to);
              const frequency = frequencyStats.get(`${item.from} → ${item.to}`);
              const avgDuration = frequency
                ? frequency.totalDuration / frequency.count
                : item.duration;

              return (
                <div
                  key={index}
                  className="bg-bg-secondary/30 rounded-lg border border-border-secondary/30 overflow-hidden transition-all duration-200"
                >
                  <button
                    onClick={() =>
                      setExpandedIndex(isExpanded ? null : index)
                    }
                    className="w-full text-left p-3 hover:bg-bg-secondary/50 transition-colors flex items-center justify-between gap-2"
                  >
                    {/* Timeline item content */}
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      {/* From node */}
                      <div className={`px-2 py-1 rounded text-xs font-semibold border ${fromColor} truncate`}>
                        {item.from}
                      </div>

                      {/* Arrow */}
                      <ArrowRight className="w-4 h-4 text-text-tertiary flex-shrink-0" />

                      {/* To node */}
                      <div className={`px-2 py-1 rounded text-xs font-semibold border ${toColor} truncate`}>
                        {item.to}
                      </div>

                      {/* Count badge */}
                      {item.count > 1 && (
                        <div className="px-2 py-1 rounded bg-bg-primary/50 border border-border-secondary/50 text-xs text-text-tertiary ml-auto flex-shrink-0">
                          ×{item.count}
                        </div>
                      )}
                    </div>

                    {/* Duration and expand */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-text-tertiary whitespace-nowrap">
                        {formatRelativeTime(item.latestTime)}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-text-tertiary transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-3 py-2 bg-bg-primary/30 border-t border-border-secondary/30 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-text-tertiary mb-1">Execution Time</p>
                          <p className="text-text-secondary font-semibold">
                            {formatDuration(item.duration)}
                          </p>
                        </div>
                        <div>
                          <p className="text-text-tertiary mb-1">Average</p>
                          <p className="text-text-secondary font-semibold">
                            {formatDuration(avgDuration)}
                          </p>
                        </div>
                        {frequency && (
                          <>
                            <div>
                              <p className="text-text-tertiary mb-1">Frequency</p>
                              <p className="text-text-secondary font-semibold">
                                {frequency.count} times
                              </p>
                            </div>
                            <div>
                              <p className="text-text-tertiary mb-1">Total Time</p>
                              <p className="text-text-secondary font-semibold">
                                {formatDuration(frequency.totalDuration)}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer stats */}
          {currentMetrics && (
            <div className="mt-4 pt-4 border-t border-border-secondary/30 grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-xs text-text-tertiary mb-1">Total Steps</p>
                <p className="text-sm font-semibold text-text-secondary">
                  {currentMetrics.stepCount}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-text-tertiary mb-1">Avg Step Time</p>
                <p className="text-sm font-semibold text-text-secondary">
                  {formatDuration(currentMetrics.avgStepDurationMs)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-text-tertiary mb-1">Distinct Nodes</p>
                <p className="text-sm font-semibold text-text-secondary">
                  {new Set(recentStateChanges.flatMap(c => [c.from, c.to])).size}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AgentActivityTimeline;
