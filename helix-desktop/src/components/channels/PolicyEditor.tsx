/**
 * Channel Policy Editor
 *
 * Configure DM/group policies, allowlists, and blocklists for channels.
 */

import { useState, useEffect, useCallback } from 'react';
import { getGatewayClient } from '../../lib/gateway-client';

export function PolicyEditor({ channelId }: { channelId?: string }) {
  const [dmMode, setDmMode] = useState('pairing');
  const [groupMode, setGroupMode] = useState('open');
  const [dmAllowlist, setDmAllowlist] = useState([]);
  const [groupAllowlist, setGroupAllowlist] = useState([]);
  const [blockList, setBlockList] = useState([]);
  const [newEntry, setNewEntry] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPolicy = useCallback(async () => {
    if (!channelId) return;

    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        setError('Gateway not connected');
        return;
      }

      const result = await client.request('policies.get', { channel: channelId });
      const policy = result.policies?.[0];

      if (policy) {
        setDmMode(policy.dmMode ?? 'pairing');
        setGroupMode(policy.groupMode ?? 'open');
        setDmAllowlist(policy.dmAllowlist ?? []);
        setGroupAllowlist(policy.groupAllowlist ?? []);
        setBlockList(policy.blockList ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load policy');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    loadPolicy();
  }, [loadPolicy]);

  const savePolicy = useCallback(async () => {
    if (!channelId) return;

    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        setError('Gateway not connected');
        return;
      }

      const policy = {
        channelId,
        dmMode,
        groupMode,
        dmAllowlist,
        groupAllowlist,
        blockList,
      };

      await client.request('policies.update', { channel: channelId, policy });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save policy');
    }
  }, [channelId, dmMode, groupMode, dmAllowlist, groupAllowlist, blockList]);

  const addToList = (list, setter) => {
    if (newEntry.trim()) {
      setter([...list, newEntry.trim()]);
      setNewEntry('');
    }
  };

  const removeFromList = (list, setter, index) => {
    setter(list.filter((_, i) => i !== index));
  };

  if (loading) return <div className="loading">Loading policy...</div>;

  return (
    <div className="policy-editor">
      <div className="policy-section">
        <h3>Direct Messages Policy</h3>

        <div className="policy-setting">
          <label>DM Access Mode</label>
          <select value={dmMode} onChange={(e) => setDmMode(e.target.value)}>
            <option value="pairing">🤝 Pairing Required</option>
            <option value="allowlist">📋 Allowlist Only</option>
            <option value="open">🌐 Open</option>
            <option value="disabled">🚫 Disabled</option>
          </select>
          <p className="hint">
            {dmMode === 'pairing' && 'Users must request pairing before sending DMs'}
            {dmMode === 'allowlist' && 'Only allowlisted users can send DMs'}
            {dmMode === 'open' && 'Anyone can send DMs'}
            {dmMode === 'disabled' && 'DMs are completely disabled'}
          </p>
        </div>

        {dmMode === 'allowlist' && (
          <div className="list-editor">
            <label>Allowed DM Senders</label>
            <div className="list-input">
              <input
                type="text"
                value={newEntry}
                onChange={(e) => setNewEntry(e.target.value)}
                placeholder="Add phone number or ID"
              />
              <button onClick={() => addToList(dmAllowlist, setDmAllowlist)} className="btn-secondary">
                Add
              </button>
            </div>
            <div className="list-items">
              {dmAllowlist.map((item, idx) => (
                <div key={idx} className="list-item">
                  <span>{item}</span>
                  <button
                    onClick={() => removeFromList(dmAllowlist, setDmAllowlist, idx)}
                    className="btn-icon delete"
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="policy-section">
        <h3>Group Messages Policy</h3>

        <div className="policy-setting">
          <label>Group Access Mode</label>
          <select value={groupMode} onChange={(e) => setGroupMode(e.target.value)}>
            <option value="open">Open All Groups</option>
            <option value="allowlist">Allowlist Only</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        {groupMode === 'allowlist' && (
          <div className="list-editor">
            <label>Allowed Groups</label>
            <div className="list-input">
              <input
                type="text"
                value={newEntry}
                onChange={(e) => setNewEntry(e.target.value)}
                placeholder="Add group ID"
              />
              <button onClick={() => addToList(groupAllowlist, setGroupAllowlist)} className="btn-secondary">
                Add
              </button>
            </div>
            <div className="list-items">
              {groupAllowlist.map((item, idx) => (
                <div key={idx} className="list-item">
                  <span>{item}</span>
                  <button
                    onClick={() => removeFromList(groupAllowlist, setGroupAllowlist, idx)}
                    className="btn-icon delete"
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="policy-section">
        <h3>Blocklist</h3>
        <div className="list-editor">
          <label>Blocked Senders</label>
          <div className="list-input">
            <input
              type="text"
              value={newEntry}
              onChange={(e) => setNewEntry(e.target.value)}
              placeholder="Add ID"
            />
            <button onClick={() => addToList(blockList, setBlockList)} className="btn-secondary">
              Add
            </button>
          </div>
          <div className="list-items">
            {blockList.map((item, idx) => (
              <div key={idx} className="list-item blocked">
                <span>{item}</span>
                <button
                  onClick={() => removeFromList(blockList, setBlockList, idx)}
                  className="btn-icon delete"
                >
                  X
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="policy-actions">
        <button onClick={savePolicy} className="btn-primary">
          Save Policy
        </button>
      </div>
    </div>
  );
}
