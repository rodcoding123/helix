/**
 * VoiceCommandManager Component
 * Manage voice command triggers and test them
 *
 * Features:
 * - Create voice commands (trigger phrase → tool)
 * - List existing commands
 * - Enable/disable commands
 * - Delete commands
 */

import React, { useState, useEffect } from 'react';
import {
  listVoiceCommands,
  createVoiceCommand,
  deleteVoiceCommand,
} from '../../services/voice';

interface VoiceCommand {
  id: string;
  triggerPhrase: string;
  toolId: string;
  isEnabled: boolean;
  usageCount: number;
}

interface VoiceCommandManagerProps {
  customToolId?: string;
  onCommandCreated?: (command: VoiceCommand) => void;
  onError?: (error: string) => void;
}

export const VoiceCommandManager: React.FC<VoiceCommandManagerProps> = ({
  customToolId,
  onCommandCreated,
  onError,
}) => {
  const [commands, setCommands] = useState<VoiceCommand[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newTrigger, setNewTrigger] = useState('');
  const [selectedToolId, setSelectedToolId] = useState(customToolId || '');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load commands on mount
  useEffect(() => {
    loadCommands();
  }, []);

  const loadCommands = async () => {
    setIsLoading(true);
    try {
      const result = await listVoiceCommands();
      if (result.success) {
        setCommands(result.commands || []);
      } else {
        throw new Error(result.error || 'Failed to load commands');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load commands';
      setError(msg);
      onError?.(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!newTrigger.trim()) {
      setError('Trigger phrase is required');
      return;
    }

    if (!selectedToolId) {
      setError('Tool selection is required');
      return;
    }

    try {
      const result = await createVoiceCommand(newTrigger, selectedToolId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to create command');
      }

      setSuccessMessage(`Command created: "${newTrigger}"`);
      setNewTrigger('');
      if (!customToolId) {
        setSelectedToolId('');
      }

      // Reload commands
      await loadCommands();

      // Trigger callback
      onCommandCreated?.({
        id: result.commandId,
        triggerPhrase: newTrigger,
        toolId: selectedToolId,
        isEnabled: true,
        usageCount: 0,
      });

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create command';
      setError(msg);
      onError?.(msg);
    }
  };

  const handleDeleteCommand = async (commandId: string) => {
    setError(null);

    if (!confirm('Delete this voice command?')) {
      return;
    }

    try {
      const result = await deleteVoiceCommand(commandId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete command');
      }

      setSuccessMessage('Command deleted');
      await loadCommands();

      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete command';
      setError(msg);
      onError?.(msg);
    }
  };

  return (
    <div className="voice-command-manager">
      <div className="manager-header">
        <h3>Voice Commands</h3>
        <p className="manager-subtitle">Create voice triggers for your tools</p>
      </div>

      {/* Create Command Form */}
      <form onSubmit={handleCreateCommand} className="command-form">
        <div className="form-group">
          <label htmlFor="trigger-phrase">Trigger Phrase</label>
          <input
            id="trigger-phrase"
            type="text"
            placeholder='e.g., "create task" or "send email"'
            value={newTrigger}
            onChange={e => setNewTrigger(e.target.value)}
            disabled={isLoading}
            maxLength={100}
            className="form-input"
          />
          <p className="form-help">What phrase should trigger this command?</p>
        </div>

        {!customToolId && (
          <div className="form-group">
            <label htmlFor="tool-select">Tool</label>
            <input
              id="tool-select"
              type="text"
              placeholder="Tool ID (UUID)"
              value={selectedToolId}
              onChange={e => setSelectedToolId(e.target.value)}
              disabled={isLoading}
              className="form-input"
            />
            <p className="form-help">Select a custom tool to execute</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !newTrigger.trim() || !selectedToolId}
          className="form-submit"
        >
          {isLoading ? 'Creating...' : '+ Create Command'}
        </button>
      </form>

      {/* Status Messages */}
      {error && (
        <div className="message error-message">
          <span>⚠️ {error}</span>
        </div>
      )}

      {successMessage && (
        <div className="message success-message">
          <span>✓ {successMessage}</span>
        </div>
      )}

      {/* Commands List */}
      <div className="commands-list">
        <div className="list-header">
          <h4>Your Commands ({commands.length})</h4>
        </div>

        {commands.length === 0 ? (
          <div className="empty-state">
            <p>No voice commands yet. Create one above to get started!</p>
          </div>
        ) : (
          <div className="command-items">
            {commands.map(cmd => (
              <div key={cmd.id} className="command-item">
                <div className="command-info">
                  <div className="command-trigger">
                    <span className="trigger-label">🎤 "{cmd.triggerPhrase}"</span>
                    <span className={`status-badge ${cmd.isEnabled ? 'enabled' : 'disabled'}`}>
                      {cmd.isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="command-meta">
                    <span className="meta-item">Tool: {cmd.toolId.slice(0, 8)}...</span>
                    <span className="meta-item">Used: {cmd.usageCount} times</span>
                  </div>
                </div>
                <div className="command-actions">
                  <button
                    onClick={() => handleDeleteCommand(cmd.id)}
                    disabled={isLoading}
                    className="delete-button"
                    title="Delete command"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="manager-info">
        <p>💡 Tip: Use simple, memorable phrases for your voice commands</p>
        <p>Example: "create task", "send message", "show calendar"</p>
      </div>
    </div>
  );
};
