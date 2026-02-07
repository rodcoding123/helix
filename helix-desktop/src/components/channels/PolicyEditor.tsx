/**
 * Policy Editor Component
 *
 * Comprehensive policy configuration UI for channels.
 * - Global, channel, and account-scoped policies
 * - DM and group message policies
 * - Custom rule creation with preview
 * - Conflict resolution visualization
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Settings, Plus, Trash2, ChevronDown, AlertCircle } from 'lucide-react';
import { getGatewayClient } from '../../lib/gateway-client';
import type {
  PolicyRule,
  DmPolicyMode,
  GroupPolicyMode,
  ChannelPolicy,
} from '../../lib/types/orchestrator-metrics';

interface PolicyEditorProps {
  channelId: string;
  className?: string;
}

type TabType = 'dm' | 'group' | 'rules';

export const PolicyEditor: React.FC<PolicyEditorProps> = ({
  channelId,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('dm');
  const [dmMode, setDmMode] = useState<DmPolicyMode>('open');
  const [groupMode, setGroupMode] = useState<GroupPolicyMode>('open');
  const [dmAllowlist, setDmAllowlist] = useState<string[]>([]);
  const [groupAllowlist, setGroupAllowlist] = useState<string[]>([]);
  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [newEntry, setNewEntry] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newRule, setNewRule] = useState<Partial<PolicyRule>>({
    name: '',
    description: '',
    enabled: true,
    conditions: [],
    actions: ['deny'],
    priority: 0,
  });

  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  // Load policy from gateway
  const loadPolicy = useCallback(async () => {
    setLoading(true);
    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        setError('Gateway not connected');
        return;
      }

      const result = await client.request('policies.get', {});
      if (result?.config?.channels?.[channelId]) {
        const policy = result.config.channels[channelId];
        setDmMode(policy.dmPolicy?.mode || 'open');
        setGroupMode(policy.groupPolicy?.mode || 'open');
        setDmAllowlist(policy.dmPolicy?.allowlist || []);
        setGroupAllowlist(policy.groupPolicy?.allowlist || []);
        setRules(policy.rules || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load policy');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  // Save policy to gateway
  const savePolicy = useCallback(async () => {
    setLoading(true);
    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        setError('Gateway not connected');
        return;
      }

      // Update each rule
      for (const rule of rules) {
        await client.request('policies.rule.upsert', { rule });
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save policy');
    } finally {
      setLoading(false);
    }
  }, [rules]);

  // Add entry to allowlist
  const addToAllowlist = useCallback((list: string[], entry: string) => {
    if (!entry.trim() || list.includes(entry.trim())) return;
    return [...list, entry.trim()];
  }, []);

  // Remove from allowlist
  const removeFromAllowlist = useCallback((list: string[], entry: string) => {
    return list.filter(item => item !== entry);
  }, []);

  // Add new rule
  const addRule = useCallback(() => {
    if (!newRule.name) return;

    const rule: PolicyRule = {
      id: `rule-${Date.now()}`,
      name: newRule.name || '',
      description: newRule.description,
      enabled: newRule.enabled !== false,
      scope: 'channel',
      channel: channelId,
      conditions: newRule.conditions || [],
      actions: newRule.actions || ['deny'],
      priority: newRule.priority || 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setRules([...rules, rule]);
    setNewRule({
      name: '',
      description: '',
      enabled: true,
      conditions: [],
      actions: ['deny'],
      priority: 0,
    });
  }, [newRule, channelId, rules]);

  // Delete rule
  const deleteRule = useCallback((ruleId: string) => {
    setRules(rules.filter(r => r.id !== ruleId));
  }, [rules]);

  // Impact preview for allowlist mode
  const impactPreview = useMemo(() => {
    if (dmMode === 'allowlist' && dmAllowlist.length === 0) {
      return 'Will block ALL direct messages';
    }
    if (groupMode === 'allowlist' && groupAllowlist.length === 0) {
      return 'Will block ALL group messages';
    }
    return null;
  }, [dmMode, groupMode, dmAllowlist, groupAllowlist]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-helix-400" />
        <h3 className="text-sm font-semibold text-text-secondary">Message Policy</h3>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-red-300">Error</p>
            <p className="text-xs text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Impact warning */}
      {impactPreview && (
        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-xs text-yellow-300">{impactPreview}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border-secondary/30">
        {['dm', 'group', 'rules'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as TabType)}
            className={`px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-helix-500 text-helix-400'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {tab === 'dm' ? 'Direct Messages' : tab === 'group' ? 'Group Messages' : 'Custom Rules'}
          </button>
        ))}
      </div>

      {/* DM Policy Tab */}
      {activeTab === 'dm' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-2">
              DM Policy Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['pairing', 'allowlist', 'open', 'disabled'] as DmPolicyMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setDmMode(mode)}
                  className={`p-2 rounded-lg text-xs font-medium transition-colors ${
                    dmMode === mode
                      ? 'bg-helix-500/30 border border-helix-500/40 text-helix-300'
                      : 'bg-bg-secondary/30 border border-border-secondary/30 text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  {mode === 'pairing' && 'Pairing'}
                  {mode === 'allowlist' && 'Allowlist'}
                  {mode === 'open' && 'Open'}
                  {mode === 'disabled' && 'Disabled'}
                </button>
              ))}
            </div>
          </div>

          {/* DM Allowlist */}
          {dmMode === 'allowlist' && (
            <div>
              <label className="text-xs font-semibold text-text-secondary block mb-2">
                Allowed Senders
              </label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Phone number or ID"
                    value={newEntry}
                    onChange={e => setNewEntry(e.target.value)}
                    className="flex-1 px-2 py-1 bg-bg-secondary/50 border border-border-secondary/50 rounded text-xs text-text-secondary placeholder-text-tertiary focus:outline-none focus:border-helix-500/50"
                  />
                  <button
                    onClick={() => {
                      const updated = addToAllowlist(dmAllowlist, newEntry);
                      if (updated) {
                        setDmAllowlist(updated);
                        setNewEntry('');
                      }
                    }}
                    className="p-1 rounded bg-helix-500/30 border border-helix-500/40 hover:bg-helix-500/40 transition-colors"
                  >
                    <Plus className="w-4 h-4 text-helix-300" />
                  </button>
                </div>

                {dmAllowlist.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {dmAllowlist.map(entry => (
                      <div
                        key={entry}
                        className="flex items-center justify-between p-2 rounded bg-bg-secondary/30 border border-border-secondary/30"
                      >
                        <span className="text-xs text-text-secondary">{entry}</span>
                        <button
                          onClick={() => setDmAllowlist(removeFromAllowlist(dmAllowlist, entry))}
                          className="p-1 hover:bg-red-500/20 rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Group Policy Tab */}
      {activeTab === 'group' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-2">
              Group Policy Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['allowlist', 'open', 'disabled'] as GroupPolicyMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setGroupMode(mode)}
                  className={`p-2 rounded-lg text-xs font-medium transition-colors ${
                    groupMode === mode
                      ? 'bg-helix-500/30 border border-helix-500/40 text-helix-300'
                      : 'bg-bg-secondary/30 border border-border-secondary/30 text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  {mode === 'allowlist' && 'Allowlist'}
                  {mode === 'open' && 'Open'}
                  {mode === 'disabled' && 'Disabled'}
                </button>
              ))}
            </div>
          </div>

          {/* Group Allowlist */}
          {groupMode === 'allowlist' && (
            <div>
              <label className="text-xs font-semibold text-text-secondary block mb-2">
                Allowed Groups
              </label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Group ID or name"
                    value={newEntry}
                    onChange={e => setNewEntry(e.target.value)}
                    className="flex-1 px-2 py-1 bg-bg-secondary/50 border border-border-secondary/50 rounded text-xs text-text-secondary placeholder-text-tertiary focus:outline-none focus:border-helix-500/50"
                  />
                  <button
                    onClick={() => {
                      const updated = addToAllowlist(groupAllowlist, newEntry);
                      if (updated) {
                        setGroupAllowlist(updated);
                        setNewEntry('');
                      }
                    }}
                    className="p-1 rounded bg-helix-500/30 border border-helix-500/40 hover:bg-helix-500/40 transition-colors"
                  >
                    <Plus className="w-4 h-4 text-helix-300" />
                  </button>
                </div>

                {groupAllowlist.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {groupAllowlist.map(entry => (
                      <div
                        key={entry}
                        className="flex items-center justify-between p-2 rounded bg-bg-secondary/30 border border-border-secondary/30"
                      >
                        <span className="text-xs text-text-secondary">{entry}</span>
                        <button
                          onClick={() =>
                            setGroupAllowlist(removeFromAllowlist(groupAllowlist, entry))
                          }
                          className="p-1 hover:bg-red-500/20 rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Custom Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-3">
          {/* Add Rule Form */}
          <div className="p-3 rounded-lg bg-bg-secondary/20 border border-border-secondary/30 space-y-2">
            <input
              type="text"
              placeholder="Rule name"
              value={newRule.name || ''}
              onChange={e => setNewRule({ ...newRule, name: e.target.value })}
              className="w-full px-2 py-1 bg-bg-secondary/50 border border-border-secondary/50 rounded text-xs text-text-secondary placeholder-text-tertiary focus:outline-none focus:border-helix-500/50"
            />
            <button
              onClick={addRule}
              disabled={!newRule.name}
              className="w-full p-2 rounded bg-helix-500/30 border border-helix-500/40 hover:bg-helix-500/40 disabled:opacity-50 transition-colors text-xs font-medium text-helix-300"
            >
              Add Rule
            </button>
          </div>

          {/* Rules List */}
          {rules.length > 0 && (
            <div className="space-y-2">
              {rules.map(rule => (
                <div
                  key={rule.id}
                  className="p-3 rounded-lg bg-bg-secondary/20 border border-border-secondary/30"
                >
                  <button
                    onClick={() =>
                      setExpandedRule(expandedRule === rule.id ? null : rule.id)
                    }
                    className="w-full flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={e => {
                          const idx = rules.findIndex(r => r.id === rule.id);
                          const updated = [...rules];
                          updated[idx] = { ...rule, enabled: e.target.checked };
                          setRules(updated);
                        }}
                        className="cursor-pointer"
                      />
                      <div className="text-left">
                        <p className="text-xs font-semibold text-text-secondary">
                          {rule.name}
                        </p>
                        {rule.description && (
                          <p className="text-xs text-text-tertiary">{rule.description}</p>
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-text-tertiary transition-transform ${
                        expandedRule === rule.id ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Expanded details */}
                  {expandedRule === rule.id && (
                    <div className="mt-3 pt-3 border-t border-border-secondary/30 space-y-2">
                      <div className="text-xs text-text-tertiary">
                        <p>Actions: {rule.actions.join(', ')}</p>
                        <p>Priority: {rule.priority}</p>
                        <p>Conditions: {rule.conditions.length}</p>
                      </div>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="w-full p-2 rounded bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors text-xs font-medium text-red-300"
                      >
                        Delete Rule
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-3">
        <button
          onClick={loadPolicy}
          disabled={loading}
          className="flex-1 px-3 py-2 rounded bg-bg-secondary/30 border border-border-secondary/30 hover:bg-bg-secondary/50 disabled:opacity-50 transition-colors text-xs font-medium text-text-secondary"
        >
          {loading ? 'Loading...' : 'Reload'}
        </button>
        <button
          onClick={savePolicy}
          disabled={loading}
          className="flex-1 px-3 py-2 rounded bg-helix-500/30 border border-helix-500/40 hover:bg-helix-500/40 disabled:opacity-50 transition-colors text-xs font-medium text-helix-300"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default PolicyEditor;
