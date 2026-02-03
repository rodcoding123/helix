/**
 * Desktop Memory Synthesis Page
 * Phase 3: Automated psychological layer analysis via Claude
 */

import React, { FC, useEffect, useState } from 'react';
import { Play, Loader, CheckCircle, AlertCircle, Clock, TrendingUp, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMemorySynthesis } from '@/hooks/useMemorySynthesis';
import type { SynthesisType } from '@/lib/types/memory-synthesis';

export const MemorySynthesisPage: FC = () => {
  const { user } = useAuth();
  const {
    synthesisJobs,
    memoryPatterns,
    recommendations,
    isLoading,
    error,
    createSynthesisJob,
    loadSynthesisJobs,
    loadMemoryPatterns,
    loadRecommendations,
    runSynthesis,
    confirmPattern,
    scheduleRecurringSynthesis,
  } = useMemorySynthesis();

  const [selectedSynthesisType, setSelectedSynthesisType] = useState<SynthesisType>('emotional_patterns');
  const [selectedLayer, setSelectedLayer] = useState<number | null>(null);
  const [showScheduler, setShowScheduler] = useState(false);
  const [cronSchedule, setCronSchedule] = useState('0 2 * * *');
  const [isRunning, setIsRunning] = useState(false);

  const synthesisTypes: Array<{ id: SynthesisType; name: string; description: string }> = [
    {
      id: 'emotional_patterns',
      name: 'Emotional Patterns',
      description: 'Analyze emotional triggers and patterns (Layer 2)',
    },
    {
      id: 'prospective_self',
      name: 'Prospective Self',
      description: 'Analyze goals, fears, and future aspirations (Layer 4)',
    },
    {
      id: 'relational_memory',
      name: 'Relational Memory',
      description: 'Analyze relationships and attachment patterns (Layer 3)',
    },
    {
      id: 'narrative_coherence',
      name: 'Narrative Coherence',
      description: 'Analyze life narrative consistency and themes (Layer 1)',
    },
    {
      id: 'full_synthesis',
      name: 'Full Synthesis',
      description: 'Complete analysis across all psychological layers',
    },
  ];

  const layers = [
    { num: 1, name: 'Narrative Core', emoji: '📖' },
    { num: 2, name: 'Emotional Memory', emoji: '💭' },
    { num: 3, name: 'Relational Memory', emoji: '🤝' },
    { num: 4, name: 'Prospective Self', emoji: '🎯' },
    { num: 5, name: 'Integration Rhythms', emoji: '⏳' },
    { num: 6, name: 'Transformation', emoji: '🌱' },
    { num: 7, name: 'Purpose Engine', emoji: '✨' },
  ];

  useEffect(() => {
    if (user?.id) {
      loadSynthesisJobs(user.id);
      loadMemoryPatterns(user.id);
      loadRecommendations(user.id);
    }
  }, [user?.id]);

  const handleStartSynthesis = async () => {
    if (!user?.id) return;

    setIsRunning(true);
    try {
      const job = await createSynthesisJob(user.id, {
        synthesis_type: selectedSynthesisType,
      });

      await runSynthesis(user.id, job.id, selectedSynthesisType);

      if (user?.id) {
        loadSynthesisJobs(user.id);
        loadMemoryPatterns(user.id);
      }
    } catch (err) {
      alert(`Synthesis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleScheduleSynthesis = async () => {
    if (!user?.id || !cronSchedule) return;

    try {
      await scheduleRecurringSynthesis(user.id, selectedSynthesisType, cronSchedule);
      setShowScheduler(false);
      setCronSchedule('0 2 * * *');
      alert('Synthesis scheduled successfully!');
    } catch (err) {
      alert(`Failed to schedule: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const getPatternColor = (layer: number) => {
    const colors = [
      'bg-blue-500/20 text-blue-300 border-blue-500/50',
      'bg-red-500/20 text-red-300 border-red-500/50',
      'bg-purple-500/20 text-purple-300 border-purple-500/50',
      'bg-green-500/20 text-green-300 border-green-500/50',
      'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
      'bg-pink-500/20 text-pink-300 border-pink-500/50',
      'bg-cyan-500/20 text-cyan-300 border-cyan-500/50',
    ];
    return colors[layer - 1];
  };

  const recentJob = synthesisJobs[0];

  return (
    <div className="h-full bg-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Memory Synthesis</h1>
        <p className="text-slate-400">Automated analysis across your psychological layers</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Seven Layers Overview */}
          <div>
            <h2 className="text-lg font-semibold text-slate-100 mb-3">Psychological Layers</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {layers.map((layer) => (
                <div
                  key={layer.num}
                  className="p-3 rounded-lg border border-slate-700 bg-slate-900 cursor-pointer hover:border-slate-600 transition-colors"
                  onClick={() => setSelectedLayer(selectedLayer === layer.num ? null : layer.num)}
                >
                  <p className="text-2xl">{layer.emoji}</p>
                  <p className="text-sm font-semibold text-slate-100">L{layer.num}</p>
                  <p className="text-xs text-slate-400">{layer.name}</p>
                  {memoryPatterns.filter((p) => p.layer === layer.num).length > 0 && (
                    <p className="text-xs text-purple-400 mt-1">
                      {memoryPatterns.filter((p) => p.layer === layer.num).length} patterns
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Synthesis Types */}
          <div>
            <h2 className="text-lg font-semibold text-slate-100 mb-3">Run Analysis</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {synthesisTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedSynthesisType(type.id)}
                  className={`p-3 rounded-lg border transition-all text-left ${
                    selectedSynthesisType === type.id
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                  }`}
                >
                  <p className="font-semibold text-slate-100 text-sm">{type.name}</p>
                  <p className="text-xs text-slate-400">{type.description}</p>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleStartSynthesis}
                disabled={isRunning || isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 transition-colors text-sm"
              >
                {isRunning ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    Start Analysis
                  </>
                )}
              </button>
              <button
                onClick={() => setShowScheduler(!showScheduler)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm"
              >
                <Clock size={18} />
                Schedule
              </button>
            </div>

            {showScheduler && (
              <div className="mt-4 p-4 rounded-lg border border-slate-700 bg-slate-900">
                <label className="block text-sm font-semibold text-slate-100 mb-2">
                  Cron Schedule (e.g., "0 2 * * *" for daily at 2 AM)
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={cronSchedule}
                    onChange={(e) => setCronSchedule(e.target.value)}
                    className="flex-1 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 text-sm"
                    placeholder="0 2 * * *"
                  />
                  <button
                    onClick={handleScheduleSynthesis}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors text-sm"
                  >
                    Schedule
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Recent Job Status */}
          {recentJob && (
            <div className="p-4 rounded-lg border border-slate-700 bg-slate-900">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-slate-100">Recent Analysis</h3>
                {recentJob.status === 'completed' && <CheckCircle className="text-green-400" size={20} />}
                {recentJob.status === 'running' && <Loader className="text-blue-400 animate-spin" size={20} />}
                {recentJob.status === 'failed' && <AlertCircle className="text-red-400" size={20} />}
              </div>

              <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                  <p className="text-xs text-slate-400">Status</p>
                  <p className="text-base font-semibold text-slate-100 capitalize">{recentJob.status}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Patterns Detected</p>
                  <p className="text-base font-semibold text-slate-100">{recentJob.patterns_detected || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Progress</p>
                  <div className="w-full bg-slate-800 rounded-full h-1 mt-1">
                    <div
                      className="bg-purple-500 h-1 rounded-full transition-all"
                      style={{ width: `${(recentJob.progress || 0) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {recentJob.error_message && (
                <div className="p-2 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-xs">
                  {recentJob.error_message}
                </div>
              )}
            </div>
          )}

          {/* Memory Patterns */}
          <div>
            <h2 className="text-lg font-bold text-slate-100 mb-3 flex items-center gap-2">
              <TrendingUp size={20} />
              Detected Patterns
            </h2>

            {memoryPatterns.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                No patterns detected yet. Run an analysis to get started!
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {memoryPatterns
                  .filter((p) => !selectedLayer || p.layer === selectedLayer)
                  .map((pattern) => (
                    <div
                      key={pattern.id}
                      className={`p-3 rounded-lg border text-sm ${getPatternColor(pattern.layer)}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold">{pattern.description}</p>
                          <p className="text-xs opacity-75">
                            L{pattern.layer} • {pattern.pattern_type}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{(pattern.confidence * 100).toFixed(0)}%</p>
                          <p className="text-xs opacity-75">{pattern.observation_count}x</p>
                        </div>
                      </div>

                      {pattern.user_confirmed && (
                        <p className="text-xs">
                          {pattern.user_confirmed ? '✓ Confirmed' : '✗ Not relevant'}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-slate-100 mb-3">Recommendations</h2>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {recommendations.map((rec) => (
                  <div key={rec.id} className="p-3 rounded-lg border border-slate-700 bg-slate-900 text-sm">
                    <p className="font-semibold text-slate-100 text-sm">{rec.recommendation}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                      <span className="px-2 py-1 bg-slate-800 rounded">{rec.category}</span>
                      <span
                        className={`px-2 py-1 rounded ${
                          rec.priority === 'high'
                            ? 'bg-red-500/20 text-red-300'
                            : rec.priority === 'medium'
                            ? 'bg-yellow-500/20 text-yellow-300'
                            : 'bg-green-500/20 text-green-300'
                        }`}
                      >
                        {rec.priority.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded bg-red-500/10 border border-red-500/50 text-red-400 flex gap-2 text-sm">
              <AlertCircle size={20} />
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
