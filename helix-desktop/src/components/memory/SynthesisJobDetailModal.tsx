/**
 * Synthesis Job Detail Modal
 *
 * Detailed view of a completed synthesis job with patterns and insights
 * Phase G.3 - Synthesis Monitoring & Templates
 */

import { useEffect, useState } from 'react';

export interface SynthesisJob {
  id: string;
  synthesisType: 'emotional_patterns' | 'prospective_self' | 'relational_memory' | 'narrative_coherence' | 'full_synthesis';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt: string;
  completedAt?: string;
  patternsDetected: number;
  costUsd: number;
  model: string;
  error?: string;
  insights?: Record<string, unknown>;
}

export interface SynthesisJobDetailModalProps {
  job: SynthesisJob;
  isOpen: boolean;
  onClose: () => void;
}

export function SynthesisJobDetailModal({ job, isOpen, onClose }: SynthesisJobDetailModalProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary']));
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && job.insights) {
      setInsights(job.insights);
      setLoading(false);
    }
  }, [isOpen, job.insights]);

  const toggleSection = (section: string) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(section)) {
      newSet.delete(section);
    } else {
      newSet.add(section);
    }
    setExpandedSections(newSet);
  };

  if (!isOpen) return null;

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const durationMs = endTime - startTime;

    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    return `${(durationMs / 60000).toFixed(1)}m`;
  };

  const patterns = insights?.patterns || [];
  const summary = insights?.summary || '';

  return (
    <div className="synthesis-job-detail-modal">
      <style>{synthesisJobDetailModalStyles}</style>

      <div className="modal-overlay" onClick={onClose} />

      <div className="modal-content">
        {/* Header */}
        <div className="modal-header">
          <div className="title-section">
            <h2>{job.synthesisType.split('_').join(' ').toUpperCase()}</h2>
            <span className={`status-badge status-${job.status}`}>
              {job.status.toUpperCase()}
            </span>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Metadata */}
        <div className="metadata-section">
          <div className="metadata-row">
            <label>Job ID</label>
            <code>{job.id}</code>
          </div>
          <div className="metadata-row">
            <label>Started</label>
            <span>{new Date(job.startedAt).toLocaleString()}</span>
          </div>
          {job.completedAt && (
            <div className="metadata-row">
              <label>Duration</label>
              <span>{formatDuration(job.startedAt, job.completedAt)}</span>
            </div>
          )}
          <div className="metadata-row">
            <label>Model Used</label>
            <span>{job.model}</span>
          </div>
          <div className="metadata-row">
            <label>Cost</label>
            <span className="cost-value">${job.costUsd.toFixed(6)}</span>
          </div>
          <div className="metadata-row">
            <label>Patterns Detected</label>
            <span className="patterns-count">{job.patternsDetected}</span>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="loading-state">Loading job details...</div>
        ) : (
          <>
            {/* Summary */}
            <div className="expandable-section">
              <button
                className="section-header"
                onClick={() => toggleSection('summary')}
              >
                <span className="toggle-arrow">
                  {expandedSections.has('summary') ? '▼' : '▶'}
                </span>
                <strong>Summary</strong>
              </button>
              {expandedSections.has('summary') && (
                <div className="section-content">
                  <p>{summary || 'No summary available'}</p>
                </div>
              )}
            </div>

            {/* Patterns */}
            {patterns.length > 0 && (
              <div className="expandable-section">
                <button
                  className="section-header"
                  onClick={() => toggleSection('patterns')}
                >
                  <span className="toggle-arrow">
                    {expandedSections.has('patterns') ? '▼' : '▶'}
                  </span>
                  <strong>Patterns ({patterns.length})</strong>
                </button>
                {expandedSections.has('patterns') && (
                  <div className="section-content">
                    <div className="patterns-list">
                      {patterns.map((pattern: any, idx: number) => (
                        <div key={idx} className="pattern-item">
                          <div className="pattern-header">
                            <span className="pattern-type">{pattern.type || 'Unknown'}</span>
                            <span className="confidence-badge">
                              {Math.round((pattern.confidence || 0) * 100)}%
                            </span>
                          </div>
                          <p className="pattern-description">{pattern.description}</p>
                          {pattern.evidence && pattern.evidence.length > 0 && (
                            <div className="pattern-evidence">
                              <strong>Evidence:</strong>
                              <ul>
                                {pattern.evidence.slice(0, 3).map((e: string, i: number) => (
                                  <li key={i}>{e}</li>
                                ))}
                                {pattern.evidence.length > 3 && (
                                  <li>... and {pattern.evidence.length - 3} more</li>
                                )}
                              </ul>
                            </div>
                          )}
                          {pattern.recommendations && pattern.recommendations.length > 0 && (
                            <div className="pattern-recommendations">
                              <strong>Recommendations:</strong>
                              <ul>
                                {pattern.recommendations.map((r: string, i: number) => (
                                  <li key={i}>{r}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error Details */}
            {job.error && (
              <div className="expandable-section error">
                <button
                  className="section-header"
                  onClick={() => toggleSection('error')}
                >
                  <span className="toggle-arrow">
                    {expandedSections.has('error') ? '▼' : '▶'}
                  </span>
                  <strong>Error Details</strong>
                </button>
                {expandedSections.has('error') && (
                  <div className="section-content error-content">
                    <pre>{job.error}</pre>
                  </div>
                )}
              </div>
            )}

            {/* Raw Insights */}
            <div className="expandable-section advanced">
              <button
                className="section-header"
                onClick={() => toggleSection('raw')}
              >
                <span className="toggle-arrow">
                  {expandedSections.has('raw') ? '▼' : '▶'}
                </span>
                <strong>Raw Data</strong>
              </button>
              {expandedSections.has('raw') && (
                <div className="section-content">
                  <pre className="raw-data">
                    {JSON.stringify(insights, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary">
            Export Results
          </button>
        </div>
      </div>
    </div>
  );
}

const synthesisJobDetailModalStyles = `
.synthesis-job-detail-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
}

.modal-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
  max-width: 700px;
  max-height: 90vh;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translate(-50%, calc(-50% + 20px));
    opacity: 0;
  }
  to {
    transform: translate(-50%, -50%);
    opacity: 1;
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  position: sticky;
  top: 0;
  background: var(--bg-primary, #0a0a1a);
  z-index: 10;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.status-badge {
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.status-completed {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status-badge.status-running {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.status-badge.status-failed {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: color 0.2s ease;
}

.close-btn:hover {
  color: var(--text-primary, #fff);
}

.metadata-section {
  padding: 1.5rem;
  background: rgba(99, 102, 241, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.metadata-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.metadata-row label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-tertiary, #606080);
}

.metadata-row span,
.metadata-row code {
  font-size: 0.875rem;
  color: var(--text-primary, #fff);
}

.metadata-row code {
  font-family: monospace;
  background: rgba(255, 255, 255, 0.02);
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  word-break: break-all;
}

.cost-value {
  color: #818cf8;
  font-weight: 600;
}

.patterns-count {
  color: #10b981;
  font-weight: 600;
}

.loading-state {
  padding: 3rem;
  text-align: center;
  color: var(--text-tertiary, #606080);
}

.expandable-section {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.expandable-section.error {
  background: rgba(239, 68, 68, 0.05);
}

.expandable-section.advanced {
  background: rgba(99, 102, 241, 0.02);
}

.section-header {
  width: 100%;
  padding: 1rem 1.5rem;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-primary, #fff);
  font-size: 0.95rem;
  transition: background 0.2s ease;
}

.section-header:hover {
  background: rgba(255, 255, 255, 0.03);
}

.toggle-arrow {
  display: inline-block;
  width: 1rem;
  text-align: center;
  color: var(--text-tertiary, #606080);
}

.section-content {
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.01);
}

.section-content p {
  margin: 0;
  color: var(--text-secondary, #a0a0c0);
  line-height: 1.5;
}

.patterns-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pattern-item {
  padding: 1rem;
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 6px;
}

.pattern-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.pattern-type {
  font-weight: 600;
  color: #818cf8;
  text-transform: capitalize;
}

.confidence-badge {
  padding: 0.25rem 0.5rem;
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  font-size: 0.75rem;
  border-radius: 3px;
  font-weight: 600;
}

.pattern-description {
  margin: 0 0 0.75rem 0;
  color: var(--text-primary, #fff);
  font-size: 0.9rem;
}

.pattern-evidence,
.pattern-recommendations {
  margin-bottom: 0.75rem;
  font-size: 0.8125rem;
}

.pattern-evidence strong,
.pattern-recommendations strong {
  color: var(--text-secondary, #a0a0c0);
  display: block;
  margin-bottom: 0.25rem;
}

.pattern-evidence ul,
.pattern-recommendations ul {
  margin: 0;
  padding-left: 1.5rem;
  color: var(--text-tertiary, #606080);
}

.pattern-evidence li,
.pattern-recommendations li {
  margin: 0.25rem 0;
}

.error-content {
  background: rgba(239, 68, 68, 0.05);
}

.error-content pre {
  margin: 0;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 4px;
  color: #fca5a5;
  font-size: 0.8rem;
  overflow-x: auto;
}

.raw-data {
  margin: 0;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #818cf8;
  font-size: 0.75rem;
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.01);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  position: sticky;
  bottom: 0;
}

.btn {
  flex: 1;
  padding: 0.75rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary, #fff);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.btn-primary {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff;
}

.btn-primary:hover {
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  transform: translateY(-2px);
}
`;
