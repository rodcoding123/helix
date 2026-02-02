/**
 * Auto-Reply Manager - Create pattern-based automatic responses
 */

import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import './AutoReplyManager.css';

interface AutoReplyRule {
  id: string;
  name: string;
  pattern: string;
  patternType: 'exact' | 'contains' | 'regex' | 'starts_with' | 'ends_with';
  response: string;
  responseType: 'text' | 'template' | 'action';
  enabled: boolean;
  priority: number;
  channels: string[];
  cooldown?: number; // seconds
  lastTriggered?: string;
  triggerCount: number;
  conditions?: {
    timeRange?: { start: string; end: string };
    dayOfWeek?: number[];
    userPattern?: string;
  };
}

const PATTERN_TYPES = [
  { id: 'contains', name: 'Contains', description: 'Message contains the pattern' },
  { id: 'exact', name: 'Exact Match', description: 'Message exactly matches the pattern' },
  { id: 'starts_with', name: 'Starts With', description: 'Message starts with the pattern' },
  { id: 'ends_with', name: 'Ends With', description: 'Message ends with the pattern' },
  { id: 'regex', name: 'Regex', description: 'Pattern is a regular expression' },
];

const RESPONSE_TYPES = [
  { id: 'text', name: 'Text Response', description: 'Send a plain text message' },
  { id: 'template', name: 'Template', description: 'Use variables like {{user}}, {{time}}' },
  { id: 'action', name: 'Run Action', description: 'Execute a slash command or tool' },
];

const CHANNELS = [
  { id: 'discord', name: 'Discord', icon: '💬' },
  { id: 'slack', name: 'Slack', icon: '📱' },
  { id: 'email', name: 'Email', icon: '📧' },
  { id: 'web', name: 'Web Chat', icon: '🌐' },
  { id: 'api', name: 'API', icon: '🔌' },
];

export function AutoReplyManager() {
  const { getClient } = useGateway();
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoReplyRule | null>(null);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<{ matched: boolean; rule?: string; response?: string } | null>(null);

  // Editor state
  const [name, setName] = useState('');
  const [pattern, setPattern] = useState('');
  const [patternType, setPatternType] = useState<AutoReplyRule['patternType']>('contains');
  const [response, setResponse] = useState('');
  const [responseType, setResponseType] = useState<AutoReplyRule['responseType']>('text');
  const [enabled, setEnabled] = useState(true);
  const [priority, setPriority] = useState(0);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['web']);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    const client = getClient();
    if (client?.connected) {
      try {
        const result = await client.request('autoreply.list') as { rules: AutoReplyRule[] };
        setRules(result.rules || []);
      } catch (err) {
        console.error('Failed to load auto-reply rules:', err);
      }
    } else {
      // Mock data
      setRules([
        {
          id: '1',
          name: 'Greeting Response',
          pattern: '(hello|hi|hey)',
          patternType: 'regex',
          response: 'Hello! How can I help you today?',
          responseType: 'text',
          enabled: true,
          priority: 10,
          channels: ['web', 'discord'],
          cooldown: 60,
          lastTriggered: '2026-02-01 14:30',
          triggerCount: 42,
        },
        {
          id: '2',
          name: 'Away Message',
          pattern: 'urgent',
          patternType: 'contains',
          response: "I'm currently away but will respond to urgent matters within the hour. {{time}}",
          responseType: 'template',
          enabled: true,
          priority: 20,
          channels: ['email', 'slack'],
          conditions: {
            timeRange: { start: '22:00', end: '08:00' },
          },
          triggerCount: 15,
        },
        {
          id: '3',
          name: 'Status Check',
          pattern: '/status',
          patternType: 'exact',
          response: '/helix-status',
          responseType: 'action',
          enabled: true,
          priority: 5,
          channels: ['discord'],
          triggerCount: 8,
        },
      ]);
    }
    setLoading(false);
  };

  const resetEditor = () => {
    setName('');
    setPattern('');
    setPatternType('contains');
    setResponse('');
    setResponseType('text');
    setEnabled(true);
    setPriority(0);
    setSelectedChannels(['web']);
    setCooldown(0);
    setEditingRule(null);
  };

  const openEditor = (rule?: AutoReplyRule) => {
    if (rule) {
      setEditingRule(rule);
      setName(rule.name);
      setPattern(rule.pattern);
      setPatternType(rule.patternType);
      setResponse(rule.response);
      setResponseType(rule.responseType);
      setEnabled(rule.enabled);
      setPriority(rule.priority);
      setSelectedChannels(rule.channels);
      setCooldown(rule.cooldown || 0);
    } else {
      resetEditor();
    }
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    resetEditor();
  };

  const toggleChannel = (channelId: string) => {
    setSelectedChannels(prev =>
      prev.includes(channelId)
        ? prev.filter(c => c !== channelId)
        : [...prev, channelId]
    );
  };

  const handleSave = async () => {
    if (!name.trim() || !pattern.trim() || !response.trim()) return;

    const ruleData = {
      name: name.trim(),
      pattern: pattern.trim(),
      patternType,
      response: response.trim(),
      responseType,
      enabled,
      priority,
      channels: selectedChannels,
      cooldown: cooldown > 0 ? cooldown : undefined,
    };

    const client = getClient();

    if (editingRule) {
      if (client?.connected) {
        try {
          await client.request('autoreply.update', { id: editingRule.id, ...ruleData });
        } catch (err) {
          console.error('Failed to update rule:', err);
          return;
        }
      }
      setRules(prev => prev.map(r =>
        r.id === editingRule.id ? { ...r, ...ruleData } : r
      ));
    } else {
      const newRule: AutoReplyRule = {
        ...ruleData,
        id: String(Date.now()),
        triggerCount: 0,
      };

      if (client?.connected) {
        try {
          const result = await client.request('autoreply.create', ruleData) as { rule: AutoReplyRule };
          newRule.id = result.rule.id;
        } catch (err) {
          console.error('Failed to create rule:', err);
          return;
        }
      }
      setRules(prev => [...prev, newRule]);
    }

    closeEditor();
  };

  const toggleRule = async (id: string) => {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;

    setRules(prev => prev.map(r =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    ));

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('autoreply.update', { id, enabled: !rule.enabled });
      } catch (err) {
        console.error('Failed to toggle rule:', err);
        setRules(prev => prev.map(r =>
          r.id === id ? { ...r, enabled: rule.enabled } : r
        ));
      }
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm('Delete this auto-reply rule?')) return;

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('autoreply.delete', { id });
      } catch (err) {
        console.error('Failed to delete rule:', err);
        return;
      }
    }
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const testRules = () => {
    if (!testInput.trim()) {
      setTestResult(null);
      return;
    }

    const input = testInput.toLowerCase();
    const sortedRules = [...rules]
      .filter(r => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      let matched = false;
      const rulePattern = rule.pattern.toLowerCase();

      switch (rule.patternType) {
        case 'exact':
          matched = input === rulePattern;
          break;
        case 'contains':
          matched = input.includes(rulePattern);
          break;
        case 'starts_with':
          matched = input.startsWith(rulePattern);
          break;
        case 'ends_with':
          matched = input.endsWith(rulePattern);
          break;
        case 'regex':
          try {
            matched = new RegExp(rule.pattern, 'i').test(testInput);
          } catch {
            matched = false;
          }
          break;
      }

      if (matched) {
        setTestResult({
          matched: true,
          rule: rule.name,
          response: rule.response,
        });
        return;
      }
    }

    setTestResult({ matched: false });
  };

  const getPatternTypeLabel = (type: string): string => {
    return PATTERN_TYPES.find(p => p.id === type)?.name || type;
  };

  const getResponseTypeLabel = (type: string): string => {
    return RESPONSE_TYPES.find(r => r.id === type)?.name || type;
  };

  if (loading) {
    return <div className="autoreply-loading">Loading auto-reply rules...</div>;
  }

  if (showEditor) {
    return (
      <div className="autoreply-editor">
        <h3>{editingRule ? 'Edit Rule' : 'Create Rule'}</h3>

        <div className="editor-field">
          <label>Rule Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Greeting Response"
          />
        </div>

        <div className="editor-row">
          <div className="editor-field flex-1">
            <label>Pattern</label>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder={patternType === 'regex' ? '(hello|hi|hey)' : 'hello'}
            />
          </div>
          <div className="editor-field">
            <label>Pattern Type</label>
            <select value={patternType} onChange={(e) => setPatternType(e.target.value as AutoReplyRule['patternType'])}>
              {PATTERN_TYPES.map(pt => (
                <option key={pt.id} value={pt.id}>{pt.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="editor-field">
          <label>Response Type</label>
          <div className="response-type-options">
            {RESPONSE_TYPES.map(rt => (
              <label key={rt.id} className={`response-type-option ${responseType === rt.id ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="responseType"
                  checked={responseType === rt.id}
                  onChange={() => setResponseType(rt.id as AutoReplyRule['responseType'])}
                />
                <span className="option-name">{rt.name}</span>
                <span className="option-desc">{rt.description}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="editor-field">
          <label>
            {responseType === 'action' ? 'Command to Run' : 'Response Message'}
          </label>
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder={
              responseType === 'action'
                ? '/helix-status'
                : responseType === 'template'
                ? 'Hello {{user}}! The time is {{time}}.'
                : 'Hello! How can I help you?'
            }
            rows={3}
          />
          {responseType === 'template' && (
            <span className="field-hint">
              Available variables: {'{{user}}'}, {'{{time}}'}, {'{{date}}'}, {'{{channel}}'}, {'{{message}}'}
            </span>
          )}
        </div>

        <div className="editor-field">
          <label>Channels</label>
          <div className="channels-grid">
            {CHANNELS.map(channel => (
              <label key={channel.id} className={`channel-checkbox ${selectedChannels.includes(channel.id) ? 'selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={selectedChannels.includes(channel.id)}
                  onChange={() => toggleChannel(channel.id)}
                />
                <span className="channel-icon">{channel.icon}</span>
                <span className="channel-name">{channel.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="editor-row">
          <div className="editor-field">
            <label>Priority</label>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              min={0}
              max={100}
            />
            <span className="field-hint">Higher priority rules are checked first</span>
          </div>
          <div className="editor-field">
            <label>Cooldown (seconds)</label>
            <input
              type="number"
              value={cooldown}
              onChange={(e) => setCooldown(Number(e.target.value))}
              min={0}
            />
            <span className="field-hint">0 = no cooldown</span>
          </div>
        </div>

        <div className="editor-field toggle-field">
          <label>Enabled</label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="editor-actions">
          <button className="btn-secondary" onClick={closeEditor}>Cancel</button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!name.trim() || !pattern.trim() || !response.trim() || selectedChannels.length === 0}
          >
            {editingRule ? 'Save Changes' : 'Create Rule'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="autoreply-manager">
      <div className="autoreply-header">
        <h3>Auto-Reply Rules</h3>
        <button className="btn-primary btn-sm" onClick={() => openEditor()}>
          + Add Rule
        </button>
      </div>

      {/* Test Section */}
      <div className="test-section">
        <div className="test-input-row">
          <input
            type="text"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="Test a message against your rules..."
            className="test-input"
          />
          <button className="btn-secondary btn-sm" onClick={testRules}>
            Test
          </button>
        </div>
        {testResult && (
          <div className={`test-result ${testResult.matched ? 'matched' : 'no-match'}`}>
            {testResult.matched ? (
              <>
                <span className="result-icon">✓</span>
                <span className="result-text">
                  Matched rule: <strong>{testResult.rule}</strong>
                </span>
                <code className="result-response">{testResult.response}</code>
              </>
            ) : (
              <>
                <span className="result-icon">✗</span>
                <span className="result-text">No rules matched</span>
              </>
            )}
          </div>
        )}
      </div>

      {rules.length === 0 ? (
        <div className="autoreply-empty">
          <span className="empty-icon">🤖</span>
          <p>No auto-reply rules configured</p>
          <button className="btn-primary" onClick={() => openEditor()}>
            Create your first rule
          </button>
        </div>
      ) : (
        <div className="rules-list">
          {[...rules].sort((a, b) => b.priority - a.priority).map(rule => (
            <div key={rule.id} className={`rule-card ${rule.enabled ? 'enabled' : 'disabled'}`}>
              <div className="rule-header">
                <div className="rule-info">
                  <span className="rule-name">{rule.name}</span>
                  <span className="rule-priority">Priority: {rule.priority}</span>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => toggleRule(rule.id)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="rule-pattern">
                <span className="pattern-type">{getPatternTypeLabel(rule.patternType)}</span>
                <code className="pattern-value">{rule.pattern}</code>
              </div>

              <div className="rule-response">
                <span className="response-type">{getResponseTypeLabel(rule.responseType)}</span>
                <span className="response-preview">{rule.response}</span>
              </div>

              <div className="rule-channels">
                {rule.channels.map(channelId => {
                  const channel = CHANNELS.find(c => c.id === channelId);
                  return (
                    <span key={channelId} className="channel-tag">
                      {channel?.icon} {channel?.name || channelId}
                    </span>
                  );
                })}
              </div>

              <div className="rule-stats">
                {rule.lastTriggered && (
                  <span className="stat">Last: {rule.lastTriggered}</span>
                )}
                <span className="stat">Triggers: {rule.triggerCount}</span>
                {rule.cooldown && (
                  <span className="stat">Cooldown: {rule.cooldown}s</span>
                )}
              </div>

              <div className="rule-actions">
                <button className="btn-sm btn-secondary" onClick={() => openEditor(rule)}>
                  Edit
                </button>
                <button className="btn-sm btn-danger" onClick={() => deleteRule(rule.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
