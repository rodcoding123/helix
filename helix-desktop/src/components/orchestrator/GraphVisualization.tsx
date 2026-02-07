/**
 * GraphVisualization Component
 *
 * Mermaid-based visualization of the state graph showing:
 * - All nodes in the orchestration flow
 * - Edges connecting nodes
 * - Active node highlighting with pulse animation
 * - Recent state transitions as edge highlights
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { AlertTriangle, Network } from 'lucide-react';
import { useOrchestratorMetrics } from '../../hooks';
import type { OrchestratorStateChangeEvent } from '../../lib/types/orchestrator-metrics';

interface GraphVisualizationProps {
  threadId?: string;
  className?: string;
}

/**
 * Build Mermaid diagram from state transitions
 *
 * Extracts all unique nodes and edges from the state change history
 * and generates a Mermaid diagram syntax.
 */
function buildMermaidDiagram(
  stateChanges: OrchestratorStateChangeEvent[],
  currentNode: string | undefined,
  recentTransitions: Set<string>
): string {
  // Collect all unique nodes
  const nodes = new Set<string>();
  const edges = new Map<string, { count: number; weight: number }>();

  for (const change of stateChanges) {
    nodes.add(change.from);
    nodes.add(change.to);

    const edgeKey = `${change.from}|${change.to}`;
    const existing = edges.get(edgeKey) || { count: 0, weight: 0 };
    edges.set(edgeKey, {
      count: existing.count + 1,
      weight: existing.weight + change.executionTimeMs,
    });
  }

  // Handle END node specially
  if (nodes.has('END')) {
    // END is a terminal node
  }

  // Build Mermaid graph
  let diagram = 'graph TD\n';

  // Add nodes with styling
  for (const node of nodes) {
    if (node === 'END') {
      diagram += `  ${node}((${node}))\n`;
      diagram += `  style ${node} fill:#10b981,stroke:#059669,stroke-width:2px,color:#fff\n`;
    } else if (node === currentNode) {
      diagram += `  ${node}["<b>${node}</b><br/><span style=\"font-size:0.7em\">🔄 Active</span>"]\n`;
      diagram += `  style ${node} fill:#3b82f6,stroke:#2563eb,stroke-width:3px,color:#fff\n`;
    } else {
      diagram += `  ${node}["${node}"]\n`;
      diagram += `  style ${node} fill:#4f46e5,stroke:#4338ca,stroke-width:2px,color:#fff\n`;
    }
  }

  // Add edges
  for (const [edgeKey, edgeData] of edges.entries()) {
    const [from, to] = edgeKey.split('|');
    const isRecent = recentTransitions.has(edgeKey);

    if (isRecent) {
      diagram += `  ${from} -->|${edgeData.count}| ${to}\n`;
      diagram += `  linkStyle${edges.size - 1} stroke:#f59e0b,stroke-width:3px\n`;
    } else {
      diagram += `  ${from} -->|${edgeData.count}| ${to}\n`;
    }
  }

  // Add Mermaid config
  diagram += '\n%%{init: {\n';
  diagram += '  "flowchart": {"htmlLabels": true},\n';
  diagram += '  "theme": "dark"\n';
  diagram += '}}%%\n';

  return diagram;
}

/**
 * Load and render Mermaid diagram
 */
async function renderMermaidDiagram(
  containerId: string,
  diagramDefinition: string
): Promise<void> {
  try {
    // Dynamically import mermaid
    const mermaidModule = await import('mermaid');
    const mermaid = mermaidModule.default || mermaidModule;

    // Initialize mermaid if not already done
    if (!window.__mermaidInitialized) {
      (mermaid as any).initialize?.({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
        flowchart: {
          htmlLabels: true,
          useMaxWidth: true,
          padding: 20,
        },
      });
      (window as any).__mermaidInitialized = true;
    }

    // Clear previous content
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    // Set diagram content
    container.textContent = diagramDefinition;

    // Render diagram
    if ((mermaid as any).contentLoaderAsync) {
      await (mermaid as any).contentLoaderAsync();
    }
    if ((mermaid as any).run) {
      await (mermaid as any).run();
    }
  } catch (err) {
    console.debug('[graph-viz] Failed to render Mermaid diagram:', err);
  }
}

export const GraphVisualization: React.FC<GraphVisualizationProps> = ({
  threadId,
  className = '',
}) => {
  const metrics = useOrchestratorMetrics({ threadId });
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    recentStateChanges,
    currentMetrics,
    connectionStatus,
    error,
  } = metrics;

  // Build diagram definition
  const diagramDefinition = useMemo(() => {
    const recentTransitions = new Set<string>();

    // Track recent transitions (last 5)
    for (const change of recentStateChanges.slice(0, 5)) {
      recentTransitions.add(`${change.from}|${change.to}`);
    }

    return buildMermaidDiagram(
      recentStateChanges,
      currentMetrics?.currentNode,
      recentTransitions
    );
  }, [recentStateChanges, currentMetrics?.currentNode]);

  // Render diagram when definition changes
  useEffect(() => {
    if (!containerRef.current || connectionStatus !== 'connected') {
      return;
    }

    const containerId = 'mermaid-diagram';
    renderMermaidDiagram(containerId, diagramDefinition);
  }, [diagramDefinition, connectionStatus]);

  // Loading state
  if (connectionStatus === 'connecting') {
    return (
      <div className={`card-glass p-6 rounded-lg border border-border-secondary/50 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Network className="w-5 h-5 text-helix-400 opacity-50" />
          <h3 className="text-sm font-semibold text-text-secondary">Graph Visualization</h3>
        </div>
        <div className="h-64 bg-bg-secondary/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  // Error state
  if (connectionStatus === 'error' || error) {
    return (
      <div className={`card-glass p-6 rounded-lg border border-border-secondary/50 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h3 className="text-sm font-semibold text-text-secondary">Graph Visualization</h3>
        </div>
        <p className="text-xs text-text-tertiary">{error || 'Failed to load graph'}</p>
      </div>
    );
  }

  return (
    <div className={`card-glass p-6 rounded-lg border border-border-secondary/50 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-helix-400" />
          <h3 className="text-sm font-semibold text-text-secondary">State Graph</h3>
        </div>
      </div>

      {/* Empty state */}
      {recentStateChanges.length === 0 ? (
        <div className="h-64 flex items-center justify-center bg-bg-secondary/20 rounded-lg border border-border-secondary/30">
          <p className="text-xs text-text-tertiary">Waiting for state transitions...</p>
        </div>
      ) : (
        <>
          {/* Mermaid diagram container */}
          <div
            ref={containerRef}
            id="mermaid-diagram"
            className="flex justify-center overflow-x-auto bg-bg-secondary/20 rounded-lg border border-border-secondary/30 p-4 min-h-64"
          />

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-border-secondary/30 space-y-2">
            <p className="text-xs font-semibold text-text-secondary mb-3">Legend</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span className="text-text-tertiary">Current Node</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-indigo-500" />
                <span className="text-text-tertiary">Other Nodes</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-600" />
                <span className="text-text-tertiary">END Node</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-amber-500" />
                <span className="text-text-tertiary">Recent Edge</span>
              </div>
            </div>
          </div>

          {/* Stats footer */}
          {currentMetrics && (
            <div className="mt-4 pt-4 border-t border-border-secondary/30 grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <p className="text-text-tertiary mb-1">Nodes</p>
                <p className="font-semibold text-text-secondary">
                  {new Set(recentStateChanges.flatMap(c => [c.from, c.to])).size}
                </p>
              </div>
              <div className="text-center">
                <p className="text-text-tertiary mb-1">Edges</p>
                <p className="font-semibold text-text-secondary">{recentStateChanges.length}</p>
              </div>
              <div className="text-center">
                <p className="text-text-tertiary mb-1">Current</p>
                <p className="font-semibold text-text-secondary truncate">
                  {currentMetrics.currentNode}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GraphVisualization;

// Mark window for mermaid initialization tracking
declare global {
  interface Window {
    __mermaidInitialized?: boolean;
  }
}
