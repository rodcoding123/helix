/**
 * Voice Command Manager Component
 * Manage voice command triggers for custom tools
 */

import { useState, useEffect } from 'react';
import { useCustomTools, type CustomTool } from '../../hooks/useCustomTools';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import '../../styles/components/voice.css';

interface VoiceCommand {
  id: string;
  triggerPhrase: string;
  toolId: string;
  toolName: string;
  isEnabled: boolean;
  usageCount: number;
}

export function VoiceCommandManager() {
  const { customTools } = useCustomTools();
  const [commands, setCommands] = useState<VoiceCommand[]>([]);
  const [triggerPhrase, setTriggerPhrase] = useState('');
  const [selectedToolId, setSelectedToolId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load voice commands
  useEffect(() => {
    loadCommands();
  }, []);

  const loadCommands = async () => {
    try {
      const response = await fetch('/api/voice/list-commands');
      if (response.ok) {
        const result = await response.json();
        setCommands(result.commands || []);
      }
    } catch (err) {
      console.error('Failed to load commands:', err);
    }
  };

  const handleAddCommand = async () => {
    if (!triggerPhrase.trim() || !selectedToolId) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/voice/create-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerPhrase: triggerPhrase.trim(),
          toolId: selectedToolId,
        }),
      });

      if (response.ok) {
        await loadCommands();
        setTriggerPhrase('');
        setSelectedToolId('');
      } else {
        const result = await response.json();
        setError(result.error || 'Failed to create command');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create command');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCommand = async (commandId: string) => {
    try {
      const response = await fetch(`/api/voice/command/${commandId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadCommands();
      }
    } catch (err) {
      console.error('Failed to delete command:', err);
    }
  };

  const handleToggleCommand = async (commandId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/voice/command/${commandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !enabled }),
      });

      if (response.ok) {
        await loadCommands();
      }
    } catch (err) {
      console.error('Failed to toggle command:', err);
    }
  };

  const getToolName = (toolId: string) => {
    return customTools.find((t: CustomTool) => t.id === toolId)?.name || 'Unknown Tool';
  };

  return (
    <div className="voice-command-manager">
      <div className="manager-header">
        <h3>Voice Commands</h3>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="command-form">
        <div className="form-group">
          <label>Trigger Phrase</label>
          <Input
            type="text"
            placeholder="e.g., 'create task'"
            value={triggerPhrase}
            onChange={(e) => setTriggerPhrase(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label>Custom Tool</label>
          <Select
            value={selectedToolId}
            onChange={(value) => {
              const toolId = typeof value === 'string' ? value : Array.isArray(value) ? value[0] || '' : '';
              setSelectedToolId(toolId);
            }}
            disabled={isLoading || customTools.length === 0}
            options={[
              { value: '', label: 'Select a tool...' },
              ...customTools.map((tool: CustomTool) => ({
                value: tool.id,
                label: tool.name,
              })),
            ]}
          />
        </div>

        <Button
          onClick={handleAddCommand}
          variant="primary"
          disabled={isLoading || !triggerPhrase.trim() || !selectedToolId}
          loading={isLoading}
        >
          {isLoading ? 'Adding...' : 'Add Command'}
        </Button>
      </div>

      <div className="commands-list">
        <h4>Active Commands</h4>
        {commands.length === 0 ? (
          <p className="empty-state">No voice commands yet</p>
        ) : (
          <div className="commands">
            {commands.map((command) => (
              <div key={command.id} className="command-item">
                <div className="command-info">
                  <div className="command-trigger">
                    <span className="label">Trigger:</span>
                    <code>{command.triggerPhrase}</code>
                  </div>
                  <div className="command-tool">
                    <span className="label">Tool:</span>
                    <span>{getToolName(command.toolId)}</span>
                  </div>
                  <div className="command-stats">
                    <span className={`status ${command.isEnabled ? 'enabled' : 'disabled'}`}>
                      {command.isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <span className="usage">Used {command.usageCount} times</span>
                  </div>
                </div>

                <div className="command-actions">
                  <Button
                    onClick={() => handleToggleCommand(command.id, command.isEnabled)}
                    variant="secondary"
                    size="sm"
                  >
                    {command.isEnabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    onClick={() => handleDeleteCommand(command.id)}
                    variant="danger"
                    size="sm"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
