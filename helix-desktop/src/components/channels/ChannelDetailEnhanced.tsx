/**
 * Enhanced ChannelDetail with E.2.B Features Integration
 *
 * Extends ChannelDetail to include:
 * - Multi-account management (ChannelAccountTabs, AccountCredentialManager)
 * - Channel-specific features (WhatsApp broadcasts, Telegram keyboards, etc.)
 * - Policies and filtering configuration
 * - Monitoring dashboard
 *
 * Acts as the primary integration point for Phase E
 */

import { useState, useCallback } from 'react';
import { ChevronLeft, Users, Zap, Shield, BarChart3, TestTube } from 'lucide-react';
import { ChannelDetail, type ChannelDetailProps } from './ChannelDetail';
import { ChannelAccountTabs } from './ChannelAccountTabs';
import { AccountCredentialManager } from './AccountCredentialManager';
import { WhatsAppBroadcasts } from './whatsapp/WhatsAppBroadcasts';
import { TelegramKeyboardBuilder } from './telegram/TelegramKeyboardBuilder';
import { DiscordThreadSettings } from './discord/DiscordThreadSettings';
import { SlackBlockKitBuilder } from './slack/SlackBlockKitBuilder';
import { ChannelMonitoringDashboard } from './ChannelMonitoringDashboard';
import type { ChannelAccount } from './ChannelAccountTabs';
import type { ChannelType } from './ChannelDetail';
import './channel-detail-enhanced.css';

type TabId = 'general' | 'accounts' | 'credentials' | 'features' | 'policies' | 'monitoring' | 'testing';

interface ChannelDetailEnhancedProps extends ChannelDetailProps {
  channelType: ChannelType;
}

interface TabDefinition {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  visible: (channel: ChannelType) => boolean;
}

const TABS: TabDefinition[] = [
  {
    id: 'general',
    label: 'General',
    icon: <ChevronLeft size={16} />,
    visible: () => true,
  },
  {
    id: 'accounts',
    label: 'Accounts',
    icon: <Users size={16} />,
    visible: () => true,
  },
  {
    id: 'credentials',
    label: 'Credentials',
    icon: <Shield size={16} />,
    visible: () => true,
  },
  {
    id: 'features',
    label: 'Features',
    icon: <Zap size={16} />,
    visible: (channel) => ['whatsapp', 'telegram', 'discord', 'slack'].includes(channel),
  },
  {
    id: 'policies',
    label: 'Policies',
    icon: <Shield size={16} />,
    visible: () => true,
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    icon: <BarChart3 size={16} />,
    visible: () => true,
  },
  {
    id: 'testing',
    label: 'Testing',
    icon: <TestTube size={16} />,
    visible: () => true,
  },
];

export function ChannelDetailEnhanced(props: ChannelDetailEnhancedProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [selectedAccount, setSelectedAccount] = useState<ChannelAccount | null>(null);

  const visibleTabs = TABS.filter(tab => tab.visible(props.channelType));

  const handleAccountSelected = useCallback((account: ChannelAccount) => {
    setSelectedAccount(account);
    setActiveTab('features');
  }, []);

  const renderTabContent = () => {
    const mockAccount: ChannelAccount = {
      id: 'account-mock',
      channelId: props.channelType,
      name: 'Primary Account',
      displayName: 'Primary',
      accountIdentifier: '1234567890',
      isActive: true,
      isPrimary: true,
      status: props.status === 'connected' ? 'connected' : 'disconnected',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const accountToUse = selectedAccount || mockAccount;

    switch (activeTab) {
      case 'general':
        return <ChannelDetail {...props} />;

      case 'accounts':
        return (
          <div className="tab-section">
            <h3>Account Management</h3>
            <p className="section-desc">
              Manage multiple accounts per channel (e.g., personal and business WhatsApp)
            </p>
            <div className="feature-content">
              <ChannelAccountTabs
                channelId={props.channelType}
                onAccountSelected={handleAccountSelected}
              />
            </div>
          </div>
        );

      case 'credentials':
        return (
          <div className="tab-section">
            <h3>Credential Management</h3>
            <p className="section-desc">
              Store and manage API keys, tokens, and authentication credentials securely
            </p>
            <div className="feature-content">
              {accountToUse && (
                <AccountCredentialManager account={accountToUse} channelId={props.channelType} />
              )}
            </div>
          </div>
        );

      case 'features':
        if (!selectedAccount && accountToUse.id === 'account-mock') {
          return (
            <div className="empty-state">
              <Zap size={48} />
              <h3>Select an Account</h3>
              <p>Choose an account from the Accounts tab to access channel-specific features</p>
            </div>
          );
        }

        return (
          <div className="tab-section">
            <h3>{props.channelName} Features</h3>
            <p className="section-desc">Account: {accountToUse.name}</p>

            <div className="feature-content">
              {props.channelType === 'whatsapp' && (
                <WhatsAppBroadcasts account={accountToUse} channelId={props.channelType} />
              )}

              {props.channelType === 'telegram' && (
                <TelegramKeyboardBuilder account={accountToUse} channelId={props.channelType} />
              )}

              {props.channelType === 'discord' && (
                <DiscordThreadSettings account={accountToUse} channelId={props.channelType} />
              )}

              {props.channelType === 'slack' && (
                <SlackBlockKitBuilder account={accountToUse} channelId={props.channelType} />
              )}

              {!['whatsapp', 'telegram', 'discord', 'slack'].includes(props.channelType) && (
                <div className="empty-state">
                  <p>No channel-specific features available for {props.channelName}</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'policies':
        return (
          <div className="tab-section">
            <h3>Channel Policies</h3>
            <p className="section-desc">
              Configure DM/group policies, rate limiting, allowlists, and filtering rules
            </p>
            <div className="placeholder-content">
              <Shield size={32} />
              <p>Policy configuration UI coming in Phase E.1</p>
            </div>
          </div>
        );

      case 'monitoring':
        return (
          <div className="tab-section">
            <h3>Channel Monitoring</h3>
            <p className="section-desc">
              View real-time metrics, connection status, message flow, and error logs
            </p>
            <div className="feature-content">
              <ChannelMonitoringDashboard channelId={props.channelType} />
            </div>
          </div>
        );

      case 'testing':
        return (
          <div className="tab-section">
            <h3>Testing Tools</h3>
            <p className="section-desc">
              Test message routing, simulate events, and debug channel connectivity
            </p>
            <div className="placeholder-content">
              <TestTube size={32} />
              <p>Testing tools coming in Phase E.3</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="channel-detail-enhanced">
      {/* Tab Navigation */}
      <div className="enhanced-tab-nav">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
          >
            {tab.icon}
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="enhanced-tab-content">
        {renderTabContent()}
      </div>
    </div>
  );
}

export default ChannelDetailEnhanced;
