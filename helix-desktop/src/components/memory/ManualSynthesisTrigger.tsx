/**
 * Manual Synthesis Trigger
 *
 * On-demand memory synthesis job triggering
 * Phase G.3 - Synthesis Monitoring & Templates
 */

import { useState, useCallback } from 'react';
import { useGateway } from '../../hooks/useGateway';

type SynthesisType = 'emotional_patterns' | 'prospective_self' | 'relational_memory' | 'narrative_coherence' | 'full_synthesis';

interface ManualSynthesisTriggerProps {
  sessionKey?: string;
}

export function ManualSynthesisTrigger({ sessionKey }: ManualSynthesisTriggerProps) {
  const { getClient, _connected } = useGateway();
  const [selectedType, setSelectedType] = useState<SynthesisType>('emotional_patterns');
  const [triggering, setTriggering] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<'pending' | 'running' | 'completed' | 'failed' | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const synthesisOptions: { value: SynthesisType; label: string; description: string }[] = [
    {
      value: 'emotional_patterns',
      label: 'Emotional Patterns',
      description: 'Analyze emotional triggers, regulation patterns, and emotional intensity variations',
    },
    {
      value: 'prospective_self',
      label: 'Prospective Self',
      description: 'Identify goals, aspirations, fears, and possible future selves',
    },
    {
      value: 'relational_memory',
      label: 'Relational Memory',
      description: 'Analyze relationship patterns, attachment dynamics, and trust networks',
    },
    {
      value: 'narrative_coherence',
      label: 'Narrative Coherence',
      description: 'Evaluate life narrative, sense-making patterns, and identity development',
    },
    {
      value: 'full_synthesis',
      label: 'Full Synthesis',
      description: 'Comprehensive analysis across all 7 psychological layers',
    },
  ];

  const handleTriggerSynthesis = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) {
      setError('Gateway not connected');
      return;
    }

    setTriggering(true);
    setError(null);
    setJobStatus('pending');
    setProgress(0);

    try {
      // Get conversation history for synthesis
      const historyResult = (await client.request('chat.history', {
        sessionKey: sessionKey || 'default',
        limit: 100,
      })) as any;

      if (!historyResult?.messages || historyResult.messages.length === 0) {
        setError('No conversation history available for synthesis');
        setTriggering(false);
        return;
      }

      // Prepare conversations for synthesis
      const conversations = historyResult.messages.map((msg: any) => ({
        id: msg.id || `msg-${Math.random().toString(36).slice(7)}`,
        text: msg.content || '',
        timestamp: msg.timestamp || new Date().toISOString(),
      }));

      setJobStatus('running');
      setProgress(20);

      // Trigger synthesis job
      const synthesisResult = (await client.request('memory.synthesize', {
        synthesisType: selectedType,
        conversations,
      })) as any;

      if (synthesisResult?.status === 'completed') {
        setJobId(synthesisResult.jobId);
        setJobStatus('completed');
        setProgress(100);
      } else {
        setJobId(synthesisResult?.jobId || null);
        setJobStatus(synthesisResult?.status || 'running');
        setProgress(synthesisResult?.progress ? synthesisResult.progress * 100 : 50);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger synthesis');
      setJobStatus('failed');
    } finally {
      setTriggering(false);
    }
  }, [selectedType, sessionKey, getClient]);

  const handleReset = useCallback(() => {
    setJobId(null);
    setJobStatus(null);
    setProgress(0);
    setError(null);
  }, []);

  return (
    <div className="manual-synthesis-trigger">
      <style>{manualSynthesisTriggerStyles}</style>

      <div className="trigger-header">
        <h4>Run Memory Synthesis</h4>
        <p className="subtitle">Analyze conversation patterns and detect psychological insights</p>
      </div>

      {jobStatus === null ? (
        <>
          {/* Synthesis Type Selection */}
          <div className="synthesis-type-selector">
            <label className="selector-label">Select Analysis Type</label>
            <div className="options-grid">
              {synthesisOptions.map((option) => (
                <label
                  key={option.value}
                  className={`option-card ${selectedType === option.value ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="synthesisType"
                    value={option.value}
                    checked={selectedType === option.value}
                    onChange={(e) => setSelectedType(e.target.value as SynthesisType)}
                  />
                  <div className="option-content">
                    <strong>{option.label}</strong>
                    <p>{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Trigger Button */}
          <div className="trigger-section">
            <button
              className="trigger-btn"
              onClick={handleTriggerSynthesis}
              disabled={triggering}
            >
              {triggering ? '⏳ Running Synthesis...' : '🧠 Start Analysis'}
            </button>
            <p className="help-text">
              This will analyze your conversation history and detect psychological patterns using AI.
              Typically takes 30-60 seconds.
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Status Display */}
          <div className={`status-box status-${jobStatus}`}>
            <div className="status-header">
              <span className="status-icon">
                {jobStatus === 'completed' && '✓'}
                {jobStatus === 'running' && '⏳'}
                {jobStatus === 'failed' && '✕'}
              </span>
              <span className="status-text">
                {jobStatus === 'completed' && 'Synthesis Complete'}
                {jobStatus === 'running' && 'Synthesis Running'}
                {jobStatus === 'failed' && 'Synthesis Failed'}
              </span>
            </div>

            {jobStatus === 'running' && (
              <div className="progress-section">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="progress-text">{Math.round(progress)}%</span>
              </div>
            )}

            {jobId && (
              <div className="job-info">
                <div className="info-row">
                  <label>Job ID:</label>
                  <code>{jobId}</code>
                </div>
                <div className="info-row">
                  <label>Type:</label>
                  <span>{selectedType}</span>
                </div>
                <div className="info-row">
                  <label>Status:</label>
                  <span className={`status-badge status-${jobStatus}`}>
                    {jobStatus.toUpperCase()}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="error-message">
                <strong>Error:</strong> {error}
              </div>
            )}

            <div className="result-actions">
              {jobStatus === 'completed' && (
                <>
                  <button className="btn btn-primary">View Results</button>
                  <button className="btn btn-secondary" onClick={handleReset}>
                    Run Another
                  </button>
                </>
              )}
              {jobStatus === 'failed' && (
                <button className="btn btn-primary" onClick={handleReset}>
                  Try Again
                </button>
              )}
              {jobStatus === 'running' && (
                <button className="btn btn-secondary" onClick={handleReset} disabled>
                  Running... (Cannot cancel)
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Info Box */}
      <div className="info-box">
        <strong>💡 How it works:</strong>
        <ul>
          <li>Analyzes conversation history using Claude AI</li>
          <li>Detects patterns across psychological layers</li>
          <li>Generates insights and recommendations</li>
          <li>Results saved to memory for future reference</li>
          <li>Cost tracked and logged per synthesis job</li>
        </ul>
      </div>
    </div>
  );
}

const manualSynthesisTriggerStyles = `
.manual-synthesis-trigger {
  padding: 1.5rem;
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.trigger-header {
  margin-bottom: 1.5rem;
}

.trigger-header h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.subtitle {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
}

.synthesis-type-selector {
  margin-bottom: 1.5rem;
}

.selector-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-tertiary, #606080);
  margin-bottom: 1rem;
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

.option-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.option-card:hover {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.25);
}

.option-card.selected {
  background: rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.4);
}

.option-card input {
  margin-top: 0.25rem;
  cursor: pointer;
  flex-shrink: 0;
}

.option-content {
  flex: 1;
}

.option-content strong {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--text-primary, #fff);
}

.option-content p {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}

.trigger-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 6px;
}

.trigger-btn {
  width: 100%;
  padding: 0.875rem;
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 0.75rem;
}

.trigger-btn:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  transform: translateY(-2px);
}

.trigger-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.help-text {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
}

.status-box {
  padding: 1.5rem;
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 6px;
  margin-bottom: 1.5rem;
}

.status-box.status-completed {
  background: rgba(16, 185, 129, 0.05);
  border-color: rgba(16, 185, 129, 0.2);
}

.status-box.status-failed {
  background: rgba(239, 68, 68, 0.05);
  border-color: rgba(239, 68, 68, 0.2);
}

.status-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  font-weight: 600;
}

.status-icon {
  font-size: 1.5rem;
}

.status-box.status-completed .status-icon {
  color: #10b981;
}

.status-box.status-running .status-icon {
  animation: pulse 1s infinite;
}

.status-box.status-failed .status-icon {
  color: #ef4444;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.status-text {
  color: var(--text-primary, #fff);
}

.progress-section {
  margin-bottom: 1rem;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #818cf8);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.8125rem;
  color: #818cf8;
  font-weight: 600;
}

.job-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8125rem;
}

.info-row label {
  color: var(--text-secondary, #a0a0c0);
  font-weight: 500;
}

.info-row code {
  font-family: monospace;
  color: #818cf8;
  background: rgba(99, 102, 241, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
}

.info-row span {
  color: var(--text-primary, #fff);
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.status-badge.status-completed {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status-badge.status-failed {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.error-message {
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 4px;
  color: #fca5a5;
  font-size: 0.8125rem;
  margin-bottom: 1rem;
}

.error-message strong {
  color: #fca5a5;
}

.result-actions {
  display: flex;
  gap: 1rem;
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

.btn-primary {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  transform: translateY(-2px);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary, #fff);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.info-box {
  padding: 1rem;
  background: rgba(96, 165, 250, 0.05);
  border: 1px solid rgba(96, 165, 250, 0.2);
  border-radius: 6px;
  font-size: 0.8125rem;
}

.info-box strong {
  color: #60a5fa;
  display: block;
  margin-bottom: 0.5rem;
}

.info-box ul {
  margin: 0;
  padding-left: 1.5rem;
  color: var(--text-secondary, #a0a0c0);
}

.info-box li {
  margin: 0.25rem 0;
}
`;
