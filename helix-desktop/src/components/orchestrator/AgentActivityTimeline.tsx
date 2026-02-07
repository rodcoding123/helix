/**
 * Agent Activity Timeline
 *
 * Real-time visualization of agent execution and state transitions.
 * Shows chronological activity log with timing information.
 *
 * Features:
 * - Live agent activity updates
 * - State transition tracking
 * - Execution duration calculation
 * - Activity filtering and search
 */

import { useMemo } from 'react';
import { useOrchestratorMetrics } from '../../hooks/useOrchestratorMetrics';
import './AgentActivityTimeline.css';

interface AgentActivityTimelineProps {
  threadId: string;
  maxItems?: number;
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 1000) return 'now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

function formatDuration(ms?: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function AgentActivityTimeline({ threadId }: AgentActivityTimelineProps) {
  const { metrics, isLoading, error, stateTransitions } = useOrchestratorMetrics(threadId);

  const allEvents = useMemo(() => {
    if (!metrics) return [];

    const events: Array<{
      type: 'agent' | 'state';
      timestamp: number;
      agent?: string;
      task?: string;
      from?: string;
      to?: string;
      duration?: number;
    }> = [];

    // Add state transitions
    stateTransitions.forEach((transition) => {
      events.push({
        type: 'state',
        timestamp: transition.timestamp,
        from: transition.from,
        to: transition.to,
      });
    });

    // Add agent activities
    metrics.agentActivityLog.forEach((activity) => {
      events.push({
        type: 'agent',
        timestamp: activity.startedAt,
        agent: activity.agent,
        task: activity.task,
        duration: activity.duration,
      });
    });

    // Sort by timestamp (newest first)
    return events.sort((a, b) => b.timestamp - a.timestamp);
  }, [metrics, stateTransitions]);

  if (isLoading) {
    return <div className="aat-loading">Loading activity...</div>;
  }

  if (error) {
    return <div className="aat-error">Error: {error}</div>;
  }

  if (!metrics || allEvents.length === 0) {
    return <div className="aat-empty">No activity yet</div>;
  }

  return (
    <div className="agent-activity-timeline">
      <div className="aat-header">
        <h3>👥 Agent Activity</h3>
        <span className="aat-count">{allEvents.length} events</span>
      </div>

      <div className="aat-list">
        {allEvents.map((event, index) => (
          <div
            key={index}
            className={`aat-event aat-event--${event.type}`}
          >
            <div className="aat-event__marker" />

            <div className="aat-event__content">
              {event.type === 'agent' && (
                <div className="aat-agent">
                  <div className="aat-agent__header">
                    <span className="aat-agent__name">🤖 {event.agent}</span>
                    <span className="aat-agent__task">{event.task}</span>
                  </div>
                  <div className="aat-agent__meta">
                    <span className="aat-agent__time">
                      {formatTimeAgo(event.timestamp)}
                    </span>
                    {event.duration && (
                      <span className="aat-agent__duration">
                        ⏱️ {formatDuration(event.duration)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {event.type === 'state' && (
                <div className="aat-transition">
                  <div className="aat-transition__flow">
                    <span className="aat-transition__from">{event.from}</span>
                    <span className="aat-transition__arrow">→</span>
                    <span className="aat-transition__to">{event.to}</span>
                  </div>
                  <span className="aat-transition__time">
                    {formatTimeAgo(event.timestamp)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Current Status */}
      <div className="aat-current">
        <div className="aat-current__label">Current Node</div>
        <div className="aat-current__value">{metrics.currentNode}</div>
      </div>
    </div>
  );
}
