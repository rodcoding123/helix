/**
 * Channel Detail View
 *
 * Comprehensive channel configuration with tabs for:
 * - Account management
 * - Policies
 * - Filters
 * - Advanced settings
 */

import { useState } from 'react';
import { PolicyEditor } from './PolicyEditor';
import { FilterList } from './FilterList';
import { ChannelAccountTabs } from './ChannelAccountTabs';

export interface ChannelDetailProps {
  channelId: string;
  channelName: string;
  onClose?: () => void;
}

export type ChannelType = 'whatsapp' | 'telegram' | 'discord' | 'slack' | 'signal' | 'imessage' | 'line';

type Tab = 'accounts' | 'policies' | 'filters' | 'settings';

export function ChannelDetail({ channelId, channelName, onClose }: ChannelDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>('accounts');
  const [_activeAccountId, setActiveAccountId] = useState<string | null>(null);

  return (
    <div className="channel-detail">
      <div className="detail-header">
        <div className="detail-title">
          <h2>{channelName} Configuration</h2>
          <p className="detail-id">Channel ID: {channelId}</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="btn-icon close">
            X
          </button>
        )}
      </div>

      <div className="detail-tabs">
        <button
          className={`tab-button ${activeTab === 'accounts' ? 'active' : ''}`}
          onClick={() => setActiveTab('accounts')}
        >
          👥 Accounts
        </button>
        <button
          className={`tab-button ${activeTab === 'policies' ? 'active' : ''}`}
          onClick={() => setActiveTab('policies')}
        >
          🛡️ Policies
        </button>
        <button
          className={`tab-button ${activeTab === 'filters' ? 'active' : ''}`}
          onClick={() => setActiveTab('filters')}
        >
          🔍 Filters
        </button>
        <button
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Settings
        </button>
      </div>

      <div className="detail-content">
        {activeTab === 'accounts' && (
          <div className="tab-pane">
            <h3>Manage Accounts</h3>
            <p className="section-description">
              Add multiple accounts to run parallel bot instances on this channel.
            </p>
            <ChannelAccountTabs
              channelId={channelId}
              onAccountChange={setActiveAccountId}
            />
          </div>
        )}

        {activeTab === 'policies' && (
          <div className="tab-pane">
            <h3>Channel Policies</h3>
            <p className="section-description">
              Configure who can send messages and access rules for DMs and groups.
            </p>
            <PolicyEditor channelId={channelId} />
          </div>
        )}

        {activeTab === 'filters' && (
          <div className="tab-pane">
            <h3>Message Filters</h3>
            <p className="section-description">
              Create regex and keyword filters to block, route, or allow specific messages.
            </p>
            <FilterList />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="tab-pane">
            <h3>Advanced Settings</h3>
            <p className="section-description">
              Configure advanced channel-specific options.
            </p>

            <div className="settings-group">
              <div className="setting-item">
                <label>Media Upload Size (MB)</label>
                <input type="number" defaultValue="100" min="1" max="1000" />
              </div>

              <div className="setting-item">
                <label>Message Timeout (seconds)</label>
                <input type="number" defaultValue="30" min="5" max="300" />
              </div>

              <div className="setting-item">
                <label>Rate Limiting</label>
                <div className="rate-limit-inputs">
                  <input
                    type="number"
                    placeholder="Messages per minute"
                    defaultValue="30"
                    min="1"
                  />
                  <input
                    type="number"
                    placeholder="Messages per hour"
                    defaultValue="500"
                    min="1"
                  />
                </div>
              </div>

              <div className="setting-item checkbox">
                <input type="checkbox" id="streaming" defaultChecked />
                <label htmlFor="streaming">Enable message streaming</label>
              </div>

              <div className="setting-item checkbox">
                <input type="checkbox" id="read-receipts" defaultChecked />
                <label htmlFor="read-receipts">Show read receipts</label>
              </div>

              <div className="setting-item checkbox">
                <input type="checkbox" id="typing-indicators" />
                <label htmlFor="typing-indicators">Show typing indicators</label>
              </div>
            </div>

            <button className="btn-primary">Save Advanced Settings</button>
          </div>
        )}
      </div>
    </div>
  );
}
