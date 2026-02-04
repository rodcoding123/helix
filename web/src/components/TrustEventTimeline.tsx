/**
 * Trust Event Timeline Component
 *
 * Displays historical trust events (increases, decreases, stage progressions, violations)
 * Shows relationship evolution over time with detailed annotations
 *
 * Connects to the hash chain trust logging system for immutable records
 */

import React, { useMemo } from 'react';

interface TrustEvent {
  id: string;
  timestamp: string; // ISO format
  operation: 'trust_increase' | 'trust_decrease' | 'violation' | 'stage_progression' | 'stage_regression' | 'emotional_impact' | 'reciprocity_detected';
  trustBefore: number;
  trustAfter: number;
  trigger: string;
  salience: 'critical' | 'high' | 'medium' | 'low';
  attachmentStageBefore?: string;
  attachmentStageAfter?: string;
  conversationId?: string;
}

interface TrustEventTimelineProps {
  events: TrustEvent[];
  maxEvents?: number;
  showDelta?: boolean;
  interactive?: boolean;
}

const OPERATION_EMOJI: Record<TrustEvent['operation'], string> = {
  trust_increase: '📈',
  trust_decrease: '📉',
  violation: '⚠️',
  stage_progression: '✅',
  stage_regression: '❌',
  emotional_impact: '💫',
  reciprocity_detected: '🔄',
};

const OPERATION_COLOR: Record<TrustEvent['operation'], string> = {
  trust_increase: 'bg-green-100 border-green-500 text-green-900',
  trust_decrease: 'bg-orange-100 border-orange-500 text-orange-900',
  violation: 'bg-red-100 border-red-500 text-red-900',
  stage_progression: 'bg-blue-100 border-blue-500 text-blue-900',
  stage_regression: 'bg-red-100 border-red-500 text-red-900',
  emotional_impact: 'bg-purple-100 border-purple-500 text-purple-900',
  reciprocity_detected: 'bg-cyan-100 border-cyan-500 text-cyan-900',
};

const SALIENCE_ICON: Record<TrustEvent['salience'], string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '⚪',
};

/**
 * Format date for display
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format time relative to now
 */
function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/**
 * Single event card
 */
function EventCard({ event, showDelta }: { event: TrustEvent; showDelta?: boolean }): JSX.Element {
  const delta = event.trustAfter - event.trustBefore;
  const deltaSign = delta > 0 ? '+' : '';
  const deltaPercent = `${deltaSign}${(delta * 100).toFixed(1)}%`;

  return (
    <div
      className={`rounded-lg border-l-4 p-4 mb-4 ${OPERATION_COLOR[event.operation]}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{OPERATION_EMOJI[event.operation]}</span>
          <div>
            <h4 className="font-semibold">
              {event.operation.replace(/_/g, ' ').toUpperCase()}
            </h4>
            <p className="text-xs opacity-75">{formatTimeAgo(event.timestamp)}</p>
          </div>
        </div>
        <span className="text-sm font-semibold">{SALIENCE_ICON[event.salience]}</span>
      </div>

      {/* Trust delta */}
      {showDelta && (
        <div className="mb-3 p-2 bg-white bg-opacity-50 rounded text-sm font-mono">
          {(event.trustBefore * 100).toFixed(1)}% → {(event.trustAfter * 100).toFixed(1)}%{' '}
          <span className={delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-600'}>
            ({deltaPercent})
          </span>
        </div>
      )}

      {/* Trigger description */}
      <p className="text-sm mb-2">{event.trigger}</p>

      {/* Stage progression */}
      {event.attachmentStageBefore && event.attachmentStageAfter && (
        <div className="text-xs opacity-75 mb-2">
          Stage: {event.attachmentStageBefore.replace(/_/g, ' ')} →{' '}
          {event.attachmentStageAfter.replace(/_/g, ' ')}
        </div>
      )}

      {/* Timestamp */}
      <div className="text-xs opacity-50 font-mono">{formatDate(event.timestamp)}</div>
    </div>
  );
}

/**
 * Timeline view with connecting lines
 */
function TimelineView({ events, showDelta }: { events: TrustEvent[]; showDelta?: boolean }): JSX.Element {
  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-purple-400" />

      {/* Events */}
      <div className="pl-6">
        {events.map((event, index) => (
          <div key={event.id || index} className="mb-4 relative">
            {/* Dot connector */}
            <div className="absolute -left-[29px] top-[16px] w-[13px] h-[13px] rounded-full bg-white border-2 border-blue-500" />

            {/* Event card */}
            <EventCard event={event} showDelta={showDelta} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Summary statistics
 */
function TimelineSummary({ events }: { events: TrustEvent[] }): JSX.Element {
  const stats = useMemo(() => {
    let increases = 0;
    let decreases = 0;
    let violations = 0;
    let stageProg = 0;
    let stageReg = 0;
    let totalDelta = 0;

    for (const event of events) {
      switch (event.operation) {
        case 'trust_increase':
          increases++;
          totalDelta += event.trustAfter - event.trustBefore;
          break;
        case 'trust_decrease':
          decreases++;
          totalDelta += event.trustAfter - event.trustBefore;
          break;
        case 'violation':
          violations++;
          totalDelta += event.trustAfter - event.trustBefore;
          break;
        case 'stage_progression':
          stageProg++;
          break;
        case 'stage_regression':
          stageReg++;
          break;
      }
    }

    return {
      increases,
      decreases,
      violations,
      stageProg,
      stageReg,
      totalDelta,
      totalEvents: events.length,
    };
  }, [events]);

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-green-600">{stats.increases}</div>
        <div className="text-xs text-gray-600">Increases</div>
      </div>
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-orange-600">{stats.decreases}</div>
        <div className="text-xs text-gray-600">Decreases</div>
      </div>
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-red-600">{stats.violations}</div>
        <div className="text-xs text-gray-600">Violations</div>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center col-span-3">
        <div className="text-2xl font-bold text-blue-600">
          {stats.stageProg}/{stats.stageReg}
        </div>
        <div className="text-xs text-gray-600">Stage Progressions / Regressions</div>
      </div>
    </div>
  );
}

/**
 * Main Trust Event Timeline Component
 */
export function TrustEventTimeline({
  events,
  maxEvents = 20,
  showDelta = true,
  interactive = false,
}: TrustEventTimelineProps): JSX.Element {
  // Sort by timestamp descending (newest first)
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, maxEvents),
    [events, maxEvents]
  );

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl">
      {/* Header */}
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Trust Event Timeline</h2>

      {/* Summary */}
      <TimelineSummary events={events} />

      {/* Events */}
      {sortedEvents.length > 0 ? (
        <TimelineView events={sortedEvents} showDelta={showDelta} />
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg">No trust events recorded yet</p>
          <p className="text-sm">Start interacting to build relationship history</p>
        </div>
      )}

      {/* Footer */}
      {events.length > maxEvents && (
        <div className="text-center text-sm text-gray-600 mt-6 pt-6 border-t border-gray-200">
          Showing {maxEvents} of {events.length} events
        </div>
      )}
    </div>
  );
}

export default TrustEventTimeline;
