/**
 * Orchestrator Monitoring Dashboard
 *
 * Real-time monitoring dashboard integrating:
 * - Cost burn rate tracking
 * - Agent activity timeline
 * - State graph visualization
 * - Checkpoint history
 *
 * Phase 2.3.4: Complete monitoring dashboard with error boundaries and animations.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { AlertCircle, BarChart3, Activity, Save, Maximize2, Minimize2 } from 'lucide-react';
import { useOrchestratorMetrics } from '../../hooks';
import { CostBurnRate } from './CostBurnRate';
import { AgentActivityTimeline } from './AgentActivityTimeline';
import { GraphVisualization } from './GraphVisualization';
import { CheckpointHistory } from './CheckpointHistory';

interface OrchestratorMonitoringDashboardProps {
  threadId?: string;
  className?: string;
}

/**
 * Error Boundary Component
 *
 * Catches errors in child components and displays graceful error UI
 */
class MetricsErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('[metrics-error-boundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="card-glass p-6 rounded-lg border border-red-500/20 bg-red-500/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-red-300 mb-1">Component Error</h3>
                <p className="text-xs text-red-200 opacity-75">
                  {this.state.error?.message || 'An error occurred while rendering this component'}
                </p>
              </div>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

/**
 * View mode selector
 */
type ViewMode = 'overview' | 'detailed' | 'fullscreen';

/**
 * Individual card wrapper with animations and error handling
 */
const MetricsCard: React.FC<{
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  expandable?: boolean;
  onExpand?: () => void;
  isExpanded?: boolean;
}> = ({ children, expandable = false, onExpand, isExpanded = false }) => {
  return (
    <div className="relative">
      {/* Card container with smooth entrance animation */}
      <div
        className="animate-in fade-in slide-in-from-bottom-4 duration-500"
        style={{
          animationFillMode: 'both',
        }}
      >
        {/* Header with expand button */}
        {expandable && (
          <div className="absolute top-0 right-0 z-10 p-2">
            <button
              onClick={onExpand}
              className="p-2 hover:bg-bg-secondary/50 rounded-lg transition-colors"
              title={isExpanded ? 'Minimize' : 'Expand'}
            >
              {isExpanded ? (
                <Minimize2 className="w-4 h-4 text-text-tertiary" />
              ) : (
                <Maximize2 className="w-4 h-4 text-text-tertiary" />
              )}
            </button>
          </div>
        )}

        {/* Error boundary wrapper */}
        <MetricsErrorBoundary>
          {children}
        </MetricsErrorBoundary>
      </div>
    </div>
  );
};

export const OrchestratorMonitoringDashboard: React.FC<
  OrchestratorMonitoringDashboardProps
> = ({ threadId, className = '' }) => {
  const metrics = useOrchestratorMetrics({ threadId });
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const { connectionStatus } = metrics;

  // Determine if metrics are available
  const hasData = useMemo(() => {
    return (
      connectionStatus === 'connected' &&
      metrics.currentMetrics !== undefined &&
      metrics.recentStateChanges.length > 0
    );
  }, [connectionStatus, metrics]);

  // Handle card expansion
  const toggleCardExpanded = useCallback((cardId: string) => {
    setExpandedCard(prev => (prev === cardId ? null : cardId));
  }, []);

  // Render based on view mode
  if (viewMode === 'fullscreen') {
    return (
      <div className="fixed inset-0 bg-bg-primary/95 backdrop-blur-sm z-50 p-4 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-text-primary">Orchestration Monitoring</h1>
            <button
              onClick={() => setViewMode('overview')}
              className="px-3 py-2 rounded-lg bg-helix-500/20 border border-helix-500/40 hover:bg-helix-500/30 transition-colors text-sm text-helix-400"
            >
              Exit Fullscreen
            </button>
          </div>

          {/* Fullscreen grid layout */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <MetricsCard title="Cost Burn Rate" icon={<BarChart3 className="w-5 h-5" />}>
              <CostBurnRate threadId={threadId} />
            </MetricsCard>
            <MetricsCard title="Activity Timeline" icon={<Activity className="w-5 h-5" />}>
              <AgentActivityTimeline threadId={threadId} maxItems={20} />
            </MetricsCard>
          </div>

          <div className="grid grid-cols-1 gap-6 mb-6">
            <MetricsCard title="State Graph" icon={null}>
              <GraphVisualization threadId={threadId} className="h-96" />
            </MetricsCard>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <MetricsCard title="Checkpoint History" icon={<Save className="w-5 h-5" />}>
              <CheckpointHistory threadId={threadId} maxItems={50} />
            </MetricsCard>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Dashboard header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Real-time Monitoring</h2>
          <p className="text-xs text-text-tertiary mt-1">
            {hasData
              ? `Thread: ${threadId || 'auto'} • Status: ${connectionStatus}`
              : 'Waiting for orchestration data...'}
          </p>
        </div>

        {/* View mode controls */}
        <div className="flex items-center gap-2">
          {['overview', 'detailed'].map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode as ViewMode)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-helix-500/30 border border-helix-500/40 text-helix-300'
                  : 'bg-bg-secondary/30 border border-border-secondary/30 text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {mode === 'overview' ? 'Overview' : 'Detailed'}
            </button>
          ))}
          <button
            onClick={() => setViewMode('fullscreen')}
            className="p-2 rounded-lg bg-bg-secondary/30 border border-border-secondary/30 text-text-tertiary hover:text-text-secondary transition-colors"
            title="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* No data state */}
      {!hasData && (
        <div className="card-glass p-8 rounded-lg border border-border-secondary/50 text-center">
          <Activity className="w-8 h-8 text-text-tertiary mx-auto mb-3 opacity-50" />
          <p className="text-sm text-text-secondary">
            {connectionStatus === 'connecting'
              ? 'Connecting to metrics...'
              : connectionStatus === 'error'
                ? 'Connection lost. Please check your gateway connection.'
                : 'No orchestration data available. Submit a job to get started.'}
          </p>
        </div>
      )}

      {/* Overview layout */}
      {viewMode === 'overview' && hasData && (
        <div className="space-y-6">
          {/* Top row: Cost and Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MetricsCard
              title="Cost Burn Rate"
              icon={<BarChart3 className="w-5 h-5" />}
              expandable
              onExpand={() => toggleCardExpanded('cost')}
              isExpanded={expandedCard === 'cost'}
            >
              <CostBurnRate threadId={threadId} />
            </MetricsCard>

            <MetricsCard
              title="Activity Timeline"
              icon={<Activity className="w-5 h-5" />}
              expandable
              onExpand={() => toggleCardExpanded('timeline')}
              isExpanded={expandedCard === 'timeline'}
            >
              <AgentActivityTimeline threadId={threadId} maxItems={10} />
            </MetricsCard>
          </div>

          {/* Bottom row: Graph and Checkpoints */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MetricsCard
              title="State Graph"
              icon={null}
              expandable
              onExpand={() => toggleCardExpanded('graph')}
              isExpanded={expandedCard === 'graph'}
            >
              <GraphVisualization threadId={threadId} />
            </MetricsCard>

            <MetricsCard
              title="Recent Checkpoints"
              icon={<Save className="w-5 h-5" />}
              expandable
              onExpand={() => toggleCardExpanded('checkpoints')}
              isExpanded={expandedCard === 'checkpoints'}
            >
              <CheckpointHistory threadId={threadId} maxItems={15} />
            </MetricsCard>
          </div>
        </div>
      )}

      {/* Detailed layout */}
      {viewMode === 'detailed' && hasData && (
        <div className="space-y-6">
          {/* Full width sections */}
          <MetricsCard title="Cost Analysis" icon={<BarChart3 className="w-5 h-5" />}>
            <CostBurnRate threadId={threadId} />
          </MetricsCard>

          <MetricsCard title="Activity History" icon={<Activity className="w-5 h-5" />}>
            <AgentActivityTimeline threadId={threadId} maxItems={30} />
          </MetricsCard>

          <MetricsCard title="Execution Flow" icon={null}>
            <GraphVisualization threadId={threadId} className="min-h-96" />
          </MetricsCard>

          <MetricsCard title="Complete Checkpoint Log" icon={<Save className="w-5 h-5" />}>
            <CheckpointHistory threadId={threadId} maxItems={100} />
          </MetricsCard>
        </div>
      )}

      {/* Styles for animation utilities if needed */}
      <style>{`
        @keyframes slideInFromBottom {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-in {
          animation-name: slideInFromBottom;
        }

        .fade-in {
          animation-name: fadeIn;
        }

        .slide-in-from-bottom-4 {
          animation-duration: 500ms;
          animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* Smooth scrollbar styling */
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }

        .scrollbar-thin::-webkit-scrollbar-track {
          background: var(--color-bg-secondary-20);
        }

        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: var(--color-bg-secondary-50);
          border-radius: 3px;
        }

        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: var(--color-bg-secondary-70);
        }
      `}</style>
    </div>
  );
};

export default OrchestratorMonitoringDashboard;
