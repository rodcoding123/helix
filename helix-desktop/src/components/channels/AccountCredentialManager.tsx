/**
 * Account Credential Manager Component
 *
 * Secure credential storage and management for channel accounts.
 * Features:
 * - Add/update/delete credentials
 * - Credential validation per channel type
 * - Test credential connectivity
 * - Credential types: token, password, oauth, api_key
 * - Encryption integration with OS keyring
 */

import React, { useState, useCallback } from 'react';
import { Lock, Eye, EyeOff, Plus, Trash2, Check, AlertCircle } from 'lucide-react';
import { getGatewayClient } from '../../lib/gateway-client';
import './account-credential-manager.css';

interface Credential {
  id: string;
  accountId: string;
  type: 'token' | 'password' | 'oauth' | 'api_key' | 'webhook_url';
  label: string;
  value?: string; // Only available during creation/edit
  isStored: boolean; // True if encrypted in keyring
  createdAt: number;
  expiresAt?: number;
}

interface AccountCredentialManagerProps {
  accountId: string;
  channelId: string;
  credentialTypes: Array<{
    type: 'token' | 'password' | 'oauth' | 'api_key' | 'webhook_url';
    label: string;
    required: boolean;
    helpText?: string;
  }>;
  className?: string;
}

export const AccountCredentialManager: React.FC<AccountCredentialManagerProps> = ({
  accountId,
  credentialTypes,
  className = '',
}) => {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedType, setSelectedType] = useState<Credential['type']>('token');
  const [credentialValue, setCredentialValue] = useState('');
  const [credentialLabel, setCredentialLabel] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleAddCredential = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);

      try {
        if (!credentialValue.trim()) {
          throw new Error('Credential value is required');
        }

        const client = getGatewayClient();
        if (!client?.connected) {
          throw new Error('Gateway not connected');
        }

        const result = await client.request('channels.accounts.addCredential', {
          accountId,
          type: selectedType,
          label: credentialLabel || selectedType,
          value: credentialValue,
        }) as { credential?: Credential };

        if (result?.credential) {
          setCredentials(prev => [...prev, result.credential as Credential]);
          setCredentialValue('');
          setCredentialLabel('');
          setShowAddForm(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add credential');
      } finally {
        setLoading(false);
      }
    },
    [accountId, selectedType, credentialLabel, credentialValue]
  );

  const handleDeleteCredential = useCallback(
    async (credentialId: string) => {
      if (!confirm('Delete this credential? This cannot be undone.')) return;

      try {
        const client = getGatewayClient();
        if (!client?.connected) {
          throw new Error('Gateway not connected');
        }

        await client.request('channels.accounts.deleteCredential', {
          accountId,
          credentialId,
        });

        setCredentials(prev => prev.filter(c => c.id !== credentialId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete credential');
      }
    },
    [accountId]
  );

  const handleTestCredential = useCallback(
    async (credentialId: string) => {
      setTestingId(credentialId);

      try {
        const client = getGatewayClient();
        if (!client?.connected) {
          throw new Error('Gateway not connected');
        }

        const result = await client.request('channels.accounts.testCredential', {
          accountId,
          credentialId,
        }) as { ok?: boolean; error?: string };

        if (result?.ok) {
          alert('Credential test passed! ✅');
        } else {
          alert('Credential test failed: ' + (result?.error || 'Unknown error'));
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Credential test failed');
      } finally {
        setTestingId(null);
      }
    },
    [accountId]
  );

  const getMissingCredentials = () => {
    const required = credentialTypes.filter(ct => ct.required);
    return required.filter(
      ct => !credentials.some(c => c.type === ct.type)
    );
  };

  const missingCredentials = getMissingCredentials();

  return (
    <div className={`account-credential-manager ${className}`}>
      <div className="manager-header">
        <h4>
          <Lock size={16} /> Credentials
        </h4>
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={14} />
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {missingCredentials.length > 0 && (
        <div className="warning-banner">
          <AlertCircle size={14} />
          <span>
            Missing required credentials: {missingCredentials.map(c => c.label).join(', ')}
          </span>
        </div>
      )}

      {credentials.length === 0 && !showAddForm ? (
        <div className="empty-state">
          <Lock size={24} />
          <p>No credentials stored</p>
          <button onClick={() => setShowAddForm(true)} className="btn-primary-small">
            <Plus size={14} /> Add Credential
          </button>
        </div>
      ) : (
        <div className="credentials-list">
          {credentials.map(cred => (
            <div key={cred.id} className="credential-item">
              <div className="credential-info">
                <div className="credential-type">
                  <span className={`badge type-${cred.type}`}>{cred.type}</span>
                </div>
                <div className="credential-label">{cred.label}</div>
                {cred.expiresAt && (
                  <div className="credential-expires">
                    Expires: {new Date(cred.expiresAt).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div className="credential-actions">
                {cred.isStored && (
                  <button
                    className="btn-icon"
                    onClick={() => handleTestCredential(cred.id)}
                    disabled={testingId === cred.id}
                    title="Test this credential"
                  >
                    {testingId === cred.id ? (
                      <div className="spinner-small" />
                    ) : (
                      <Check size={16} />
                    )}
                  </button>
                )}
                <button
                  className="btn-icon danger"
                  onClick={() => handleDeleteCredential(cred.id)}
                  title="Delete credential"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          {!showAddForm && credentialTypes.length > credentials.length && (
            <button
              className="btn-add-credential"
              onClick={() => setShowAddForm(true)}
            >
              <Plus size={14} /> Add Another Credential
            </button>
          )}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleAddCredential} className="add-credential-form">
          <div className="form-group">
            <label htmlFor="cred-type">Credential Type</label>
            <select
              id="cred-type"
              value={selectedType}
              onChange={e => setSelectedType(e.target.value as Credential['type'])}
              disabled={loading}
            >
              {credentialTypes
                .filter(ct => !credentials.some(c => c.type === ct.type))
                .map(ct => (
                  <option key={ct.type} value={ct.type}>
                    {ct.label}
                  </option>
                ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="cred-label">Label (optional)</label>
            <input
              id="cred-label"
              type="text"
              placeholder="e.g., Bot Token, Personal Account"
              value={credentialLabel}
              onChange={e => setCredentialLabel(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="cred-value">Value</label>
            <div className="input-with-toggle">
              <input
                id="cred-value"
                type={showValue ? 'text' : 'password'}
                placeholder="Paste your credential"
                value={credentialValue}
                onChange={e => setCredentialValue(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className="btn-toggle-visibility"
                onClick={() => setShowValue(!showValue)}
                title={showValue ? 'Hide' : 'Show'}
              >
                {showValue ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowAddForm(false)}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading || !credentialValue.trim()}>
              {loading ? 'Saving...' : 'Save Credential'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
