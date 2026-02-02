/**
 * Memory Synthesis Route - Enhanced Desktop Edition
 * Use Claude AI to analyze conversation history and detect psychological patterns
 */

import { useEffect, useState } from 'react';
import { Loader, Brain, TrendingUp, Clock, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { useMemorySynthesis } from '../hooks/useMemorySynthesis';
import '../components/synthesis/SynthesisEnhanced.css';

interface SynthesisOption {
  id: 'emotional_patterns' | 'prospective_self' | 'relational_memory' | 'narrative_coherence' | 'full_synthesis';
  name: string;
  description: string;
  icon: string;
  color: string;
  estimatedTime: string;
}

export default function MemorySynthesisEnhanced() {
  const {
    synthesisJobs,
    currentJob,
    memoryPatterns,
    isLoading,
    error,
    listMemoryPatterns,
    submitSynthesisJob,
    pollJobStatus,
    clearJobs
  } = useMemorySynthesis();

  const [synthesisType, setSynthesisType] = useState<'emotional_patterns' | 'prospective_self' | 'relational_memory' | 'narrative_coherence' | 'full_synthesis'>('emotional_patterns');
  const [filterType, setFilterType] = useState<string>('all');
  const [showHistory, setShowHistory] = useState(false);
  const [expandedPattern, setExpandedPattern] = useState<string | null>(null);

  const SYNTHESIS_OPTIONS: SynthesisOption[] = [
    {
      id: 'emotional_patterns',
      name: 'Emotional Patterns',
      description: 'Detect emotional triggers and regulation patterns',
      icon: '😊',
      color: '#fbbf24',
      estimatedTime: '2-3 min'
    },
    {
      id: 'prospective_self',
      name: 'Prospective Self',
      description: 'Identify goals, fears, and future possibilities',
      icon: '🎯',
      color: '#60a5fa',
      estimatedTime: '2-3 min'
    },
    {
      id: 'relational_memory',
      name: 'Relational Patterns',
      description: 'Analyze relationships and attachment dynamics',
      icon: '🤝',
      color: '#ec4899',
      estimatedTime: '3-4 min'
    },
    {
      id: 'narrative_coherence',
      name: 'Narrative Analysis',
      description: 'Examine life narrative and identity development',
      icon: '📖',
      color: '#8b5cf6',
      estimatedTime: '3-4 min'
    },
    {
      id: 'full_synthesis',
      name: 'Full Synthesis',
      description: 'Comprehensive analysis across all 7 psychological layers',
      icon: '🧠',
      color: '#10b981',
      estimatedTime: '8-10 min'
    }
  ];

  useEffect(() => {
    listMemoryPatterns();
  }, [listMemoryPatterns]);

  const handleRunSynthesis = async () => {
    try {
      // Mock conversations for demo
      const mockConversations = [
        {
          id: 'conv-1',
          text: 'I feel anxious about deadlines',
          timestamp: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: 'conv-2',
          text: 'Work stress is affecting my sleep',
          timestamp: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: 'conv-3',
          text: 'I want to learn more about managing stress',
          timestamp: new Date(Date.now() - 1800000).toISOString()
        }
      ];

      const job = await submitSynthesisJob(synthesisType as any, mockConversations);

      if (job) {
        await pollJobStatus(job.jobId);
      }
    } catch (err) {
      console.error('Failed to run synthesis:', err);
    }
  };

  const filteredPatterns = filterType === 'all'
    ? memoryPatterns
    : memoryPatterns.filter(p => p.type === filterType);

  const patternTypes = Array.from(new Set(memoryPatterns.map(p => p.type)));

  return (
    <div className="synthesis-container">
      {/* Header */}
      <div className="synthesis-header">
        <div className="header-content">
          <div className="header-icon">
            <Brain size={32} />
          </div>
          <div className="header-text">
            <h1>Memory Synthesis</h1>
            <p>Analyze patterns in your conversations with advanced AI insights</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="synthesis-main">
        {/* Left Panel - Synthesis Selector */}
        <div className="synthesis-panel">
          <div className="panel-header">
            <h2>Analysis Types</h2>
            <span className="panel-badge">{SYNTHESIS_OPTIONS.length}</span>
          </div>

          <div className="synthesis-grid">
            {SYNTHESIS_OPTIONS.map(option => (
              <div
                key={option.id}
                className={`synthesis-card ${synthesisType === option.id ? 'active' : ''}`}
                onClick={() => setSynthesisType(option.id)}
                style={{
                  borderColor: synthesisType === option.id ? option.color : '#e5e7eb',
                  backgroundColor: synthesisType === option.id ? `${option.color}15` : '#ffffff'
                }}
              >
                <div className="card-icon" style={{ color: option.color }}>
                  {option.icon}
                </div>
                <div className="card-name">{option.name}</div>
                <div className="card-desc">{option.description}</div>
                <div className="card-time">
                  <Clock size={14} />
                  {option.estimatedTime}
                </div>
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary btn-block"
            onClick={handleRunSynthesis}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader className="spinner" size={18} />
                Running Analysis...
              </>
            ) : (
              <>
                <Zap size={18} />
                Run Synthesis
              </>
            )}
          </button>
        </div>

        {/* Right Panel - Results and History */}
        <div className="results-panel">
          {/* Current Job Status */}
          {currentJob && (
            <div className="status-section">
              <div className="section-header">
                <h3>Current Analysis</h3>
                <span className={`status-badge ${currentJob.status}`}>
                  {currentJob.status === 'running' && <Loader size={14} className="spinner-small" />}
                  {currentJob.status === 'completed' && <CheckCircle size={14} />}
                  {currentJob.status === 'failed' && <AlertCircle size={14} />}
                  {currentJob.status}
                </span>
              </div>

              {currentJob.status === 'running' && (
                <div className="progress-container">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${(currentJob.progress || 0) * 100}%` }}
                    />
                  </div>
                  <div className="progress-text">
                    {Math.round((currentJob.progress || 0) * 100)}% Complete
                  </div>
                </div>
              )}

              {currentJob.status === 'completed' && currentJob.analysis && (
                <div className="analysis-results">
                  <div className="results-summary">
                    <div className="summary-title">Summary</div>
                    <p>{currentJob.analysis.summary}</p>
                  </div>

                  {currentJob.analysis.patterns && currentJob.analysis.patterns.length > 0 && (
                    <div className="patterns-found">
                      <div className="patterns-header">
                        <h4>Patterns Detected</h4>
                        <span className="pattern-count">{currentJob.analysis.patterns.length}</span>
                      </div>

                      <div className="patterns-list">
                        {currentJob.analysis.patterns.map((pattern, idx) => (
                          <div key={idx} className="pattern-card">
                            <div className="pattern-header">
                              <div className="pattern-type">{pattern.type}</div>
                              <div
                                className="confidence-badge"
                                style={{
                                  backgroundColor: pattern.confidence > 0.8 ? '#10b981' :
                                                  pattern.confidence > 0.6 ? '#f59e0b' : '#ef4444'
                                }}
                              >
                                {(pattern.confidence * 100).toFixed(0)}%
                              </div>
                            </div>
                            <p className="pattern-desc">{pattern.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentJob.error && (
                    <div className="error-message">
                      <AlertCircle size={16} />
                      {currentJob.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Memory Patterns */}
          <div className="patterns-section">
            <div className="section-header">
              <h3>All Detected Patterns</h3>
              <div className="filter-controls">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Types</option>
                  {patternTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {filteredPatterns.length === 0 ? (
              <div className="empty-state">
                <Brain size={32} />
                <p>No patterns detected yet.</p>
                <small>Run a synthesis to discover psychological patterns in your conversations.</small>
              </div>
            ) : (
              <div className="patterns-display">
                {filteredPatterns.map((pattern) => (
                  <div
                    key={pattern.id}
                    className="pattern-item"
                    onClick={() => setExpandedPattern(expandedPattern === pattern.id ? null : pattern.id)}
                  >
                    <div className="pattern-row">
                      <div className="pattern-left">
                        <div className="pattern-title">{pattern.description}</div>
                        <div className="pattern-meta">
                          <span className="meta-type">{pattern.type}</span>
                          <span className="meta-layer">Layer {pattern.layer}</span>
                        </div>
                      </div>
                      <div className="pattern-confidence">
                        <div className="confidence-value">
                          {(pattern.confidence * 100).toFixed(0)}%
                        </div>
                        <div className="confidence-bar">
                          <div
                            className="confidence-fill"
                            style={{ width: `${pattern.confidence * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {expandedPattern === pattern.id && (
                      <div className="pattern-details">
                        <div className="details-content">
                          <div className="detail-row">
                            <div className="detail-label">Confidence Score:</div>
                            <div className="detail-value">{(pattern.confidence * 100).toFixed(1)}%</div>
                          </div>
                          <div className="detail-row">
                            <div className="detail-label">Psychology Layer:</div>
                            <div className="detail-value">Layer {pattern.layer}</div>
                          </div>
                          <div className="detail-row">
                            <div className="detail-label">Pattern Type:</div>
                            <div className="detail-value">{pattern.type}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Job History Toggle */}
          <div className="history-toggle">
            <button
              className="toggle-button"
              onClick={() => setShowHistory(!showHistory)}
            >
              <TrendingUp size={16} />
              {showHistory ? 'Hide' : 'Show'} Synthesis History
            </button>
          </div>

          {/* Job History */}
          {showHistory && (
            <div className="history-section">
              <div className="section-header">
                <h3>Recent Synthesis Jobs</h3>
                {synthesisJobs.length > 0 && (
                  <button className="clear-button" onClick={clearJobs}>
                    Clear History
                  </button>
                )}
              </div>

              {synthesisJobs.length === 0 ? (
                <div className="empty-state">
                  <Clock size={24} />
                  <p>No synthesis jobs yet</p>
                </div>
              ) : (
                <div className="history-list">
                  {synthesisJobs.map((job, idx) => (
                    <div key={job.jobId} className="history-item">
                      <div className="history-left">
                        <div className="job-number">#{synthesisJobs.length - idx}</div>
                        <div className="job-details">
                          <div className="job-type">{job.synthesisType}</div>
                          <div className="job-time">
                            {job.executionTimeMs && `${job.executionTimeMs}ms`}
                          </div>
                        </div>
                      </div>
                      <span className={`history-badge ${job.status}`}>
                        {job.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <div className="error-text">
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}
    </div>
  );
}
