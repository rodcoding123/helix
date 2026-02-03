/**
 * Voice Command Manager Component
 * Phase 4.1 Week 3: Voice command creation and management
 *
 * Features:
 * - List all voice commands with usage statistics
 * - Create new commands with trigger phrase and action
 * - Edit command settings
 * - Test command matching with transcription input
 * - Delete commands
 * - Visual confidence indicators
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  createVoiceCommand,
  getVoiceCommands,
  updateVoiceCommand,
  deleteVoiceCommand,
  matchVoiceCommand,
  extractCommandParameters,
  recordCommandUsage,
  getCommandStatistics,
  type VoiceCommandCreateRequest,
  type VoiceCommand,
} from '../../services/voice-commands';

interface VoiceCommandManagerProps {
  onCommandExecuted?: (command: VoiceCommand) => void;
}

export const VoiceCommandManager: React.FC<VoiceCommandManagerProps> = ({
  onCommandExecuted,
}) => {
  const [commands, setCommands] = useState<VoiceCommand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<VoiceCommandCreateRequest>>({
    triggerPhrase: '',
    actionType: 'tool',
    toolId: '',
  });

  // Statistics
  const [stats, setStats] = useState({
    totalCommands: 0,
    enabledCommands: 0,
    mostUsed: null as VoiceCommand | null,
    totalExecutions: 0,
  });

  // Test matching
  const [testTranscript, setTestTranscript] = useState('');
  const [testResult, setTestResult] = useState<{
    matched: VoiceCommand | null;
    confidence: number;
    extractedParams: Record<string, any>;
  } | null>(null);

  // Load commands on mount
  useEffect(() => {
    loadCommands();
    loadStats();
  }, []);

  /**
   * Load all voice commands
   */
  const loadCommands = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getVoiceCommands();
      setCommands(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load commands';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load command statistics
   */
  const loadStats = async () => {
    try {
      const stats = await getCommandStatistics();
      setStats(stats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  /**
   * Create new voice command
   */
  const handleCreate = async () => {
    setError(null);

    if (!formData.triggerPhrase?.trim()) {
      setError('Trigger phrase is required');
      return;
    }

    try {
      const result = await createVoiceCommand(formData as VoiceCommandCreateRequest);

      if (!result.success) {
        setError(result.error || 'Failed to create command');
        return;
      }

      setFormData({
        triggerPhrase: '',
        actionType: 'tool',
        toolId: '',
      });
      setShowCreateForm(false);

      await loadCommands();
      await loadStats();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create command';
      setError(errorMsg);
    }
  };

  /**
   * Update existing voice command
   */
  const handleUpdate = async (commandId: string) => {
    setError(null);

    if (!formData.triggerPhrase?.trim()) {
      setError('Trigger phrase is required');
      return;
    }

    try {
      const result = await updateVoiceCommand(commandId, formData);

      if (!result.success) {
        setError(result.error || 'Failed to update command');
        return;
      }

      setEditingId(null);
      setFormData({
        triggerPhrase: '',
        actionType: 'tool',
        toolId: '',
      });

      await loadCommands();
      await loadStats();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update command';
      setError(errorMsg);
    }
  };

  /**
   * Delete voice command
   */
  const handleDelete = async (commandId: string) => {
    if (!window.confirm('Are you sure you want to delete this command?')) {
      return;
    }

    setError(null);

    try {
      const result = await deleteVoiceCommand(commandId);

      if (!result.success) {
        setError(result.error || 'Failed to delete command');
        return;
      }

      await loadCommands();
      await loadStats();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete command';
      setError(errorMsg);
    }
  };

  /**
   * Test command matching with transcript
   */
  const handleTestMatching = useCallback(() => {
    if (!testTranscript.trim()) {
      setTestResult(null);
      return;
    }

    const matched = matchVoiceCommand(testTranscript, commands);

    if (matched) {
      const extractedParams = extractCommandParameters(testTranscript, matched);
      setTestResult({
        matched,
        confidence: 0.85, // Would be calculated from fuzzy match score in real implementation
        extractedParams,
      });
    } else {
      setTestResult({
        matched: null,
        confidence: 0,
        extractedParams: {},
      });
    }
  }, [commands]);

  /**
   * Get confidence color
   */
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.9) return 'bg-green-500/20 text-green-400';
    if (confidence >= 0.7) return 'bg-blue-500/20 text-blue-400';
    return 'bg-slate-600/30 text-slate-300';
  };

  /**
   * Get action type label
   */
  const getActionTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      tool: '🔧 Tool',
      skill: '⚡ Skill',
      navigation: '🧭 Navigation',
      system: '⚙️ System',
    };
    return labels[type] || type;
  };

  return (
    <div className="voice-command-manager space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100 mb-2">Voice Commands</h2>
        <p className="text-slate-400 text-sm">
          {stats.totalCommands} commands ({stats.enabledCommands} enabled) • {stats.totalExecutions} total executions
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
          <p className="text-red-400 text-sm">✗ {error}</p>
        </div>
      )}

      {/* Create/Edit Form */}
      {(showCreateForm || editingId) && (
        <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg space-y-4">
          <h3 className="font-semibold text-slate-100">
            {editingId ? 'Edit Command' : 'Create New Command'}
          </h3>

          <div className="space-y-3">
            {/* Trigger Phrase */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Trigger Phrase
              </label>
              <input
                type="text"
                placeholder="e.g., 'create task', 'send email'"
                value={formData.triggerPhrase || ''}
                onChange={e => setFormData({ ...formData, triggerPhrase: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Action Type */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Action Type
              </label>
              <select
                value={formData.actionType || 'tool'}
                onChange={e =>
                  setFormData({
                    ...formData,
                    actionType: e.target.value as any,
                    toolId: undefined,
                    skillId: undefined,
                    navigationTarget: undefined,
                  })
                }
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="tool">🔧 Custom Tool</option>
                <option value="skill">⚡ Composite Skill</option>
                <option value="navigation">🧭 Navigation</option>
                <option value="system">⚙️ System</option>
              </select>
            </div>

            {/* Action Target */}
            {formData.actionType === 'tool' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Tool ID
                </label>
                <input
                  type="text"
                  placeholder="Select tool from list"
                  value={formData.toolId || ''}
                  onChange={e => setFormData({ ...formData, toolId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {formData.actionType === 'skill' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Skill ID
                </label>
                <input
                  type="text"
                  placeholder="Select skill from list"
                  value={formData.skillId || ''}
                  onChange={e => setFormData({ ...formData, skillId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {formData.actionType === 'navigation' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Navigation Target
                </label>
                <input
                  type="text"
                  placeholder="e.g., '/dashboard', '/settings'"
                  value={formData.navigationTarget || ''}
                  onChange={e =>
                    setFormData({ ...formData, navigationTarget: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  if (editingId) {
                    handleUpdate(editingId);
                  } else {
                    handleCreate();
                  }
                }}
                className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
              >
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setEditingId(null);
                  setShowCreateForm(false);
                  setFormData({
                    triggerPhrase: '',
                    actionType: 'tool',
                    toolId: '',
                  });
                }}
                className="flex-1 py-2 px-3 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Matching Section */}
      <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg space-y-3">
        <h3 className="font-semibold text-slate-100">Test Command Matching</h3>
        <p className="text-sm text-slate-400">
          Try a voice transcript to see which command would be triggered
        </p>

        <input
          type="text"
          placeholder="e.g., 'Hey Helix, create task Review PR'..."
          value={testTranscript}
          onChange={e => {
            setTestTranscript(e.target.value);
            if (e.target.value.length >= 2) {
              setTestResult(null);
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              handleTestMatching();
            }
          }}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
        />

        <button
          onClick={handleTestMatching}
          className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
        >
          Test Match
        </button>

        {/* Test Result */}
        {testResult !== null && (
          <div className="mt-3 p-3 bg-slate-700/50 rounded border border-slate-600 space-y-2">
            {testResult.matched ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Matched Command:</span>
                  <span className="text-sm font-medium text-slate-100">
                    {testResult.matched.trigger_phrase}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Confidence:</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${getConfidenceColor(
                      testResult.confidence
                    )}`}
                  >
                    {(testResult.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                {Object.keys(testResult.extractedParams).length > 0 && (
                  <div className="text-xs text-slate-400">
                    <p className="mb-1">Extracted Parameters:</p>
                    <pre className="bg-slate-800 p-2 rounded text-slate-300 overflow-x-auto">
                      {JSON.stringify(testResult.extractedParams, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">No matching command found</p>
            )}
          </div>
        )}
      </div>

      {/* Create Button (when form not shown) */}
      {!showCreateForm && !editingId && (
        <button
          onClick={() => setShowCreateForm(true)}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          + Create New Command
        </button>
      )}

      {/* Commands List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="animate-spin">⟳</span>
            <span>Loading commands...</span>
          </div>
        </div>
      ) : commands.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-slate-400">No voice commands yet. Create one to get started!</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-400 mb-3">
            {commands.length} command{commands.length !== 1 ? 's' : ''}
          </p>

          {commands.map(command => (
            <div
              key={command.id}
              className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors"
            >
              {/* Command Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <code className="px-2 py-1 bg-slate-700 rounded text-slate-100 text-sm font-medium">
                      {command.trigger_phrase}
                    </code>
                    <span
                      className={`text-xs px-2 py-1 rounded font-medium ${
                        command.enabled
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-slate-600/50 text-slate-300'
                      }`}
                    >
                      {command.enabled ? '✓ Enabled' : '⊘ Disabled'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Action: {getActionTypeLabel(command.action_type)}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditingId(command.id);
                      setFormData({
                        triggerPhrase: command.trigger_phrase,
                        actionType: command.action_type,
                        toolId: command.tool_id,
                        skillId: command.skill_id,
                        navigationTarget: command.navigation_target,
                        actionParams: command.action_params,
                      });
                    }}
                    className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-100 rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(command.id)}
                    className="px-2 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Usage Stats */}
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span>Used {command.usage_count || 0} time{command.usage_count !== 1 ? 's' : ''}</span>
                {command.last_used_at && (
                  <span>
                    Last: {new Date(command.last_used_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
