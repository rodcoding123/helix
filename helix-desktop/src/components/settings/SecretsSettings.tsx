import React, { useState, Suspense, lazy } from 'react';
import { useSecretsData } from '../../hooks/useSecretsData';
import { SecretsList } from '../secrets';
import { isFeatureEnabled } from '../../lib/feature-flags';
import type { SecretType } from '../../types/secrets';
import '../secrets/Secrets.css';

// Lazy load modals for better performance
const CreateSecretModal = lazy(() =>
  import('../secrets/modals/CreateSecretModal').then(m => ({ default: m.CreateSecretModal }))
);

const RotateSecretModal = lazy(() =>
  import('../secrets/modals/RotateSecretModal').then(m => ({ default: m.RotateSecretModal }))
);

/**
 * Fallback component for lazy loaded modals
 */
const ModalFallback = () => <div className="modal-loading">Loading...</div>;

export const SecretsSettings: React.FC = () => {
  // Check if feature is enabled
  const isSecretsEnabled = isFeatureEnabled('secrets.enabled');

  if (!isSecretsEnabled) {
    return (
      <div className="secrets-settings">
        <div className="settings-header">
          <h1>Secrets Management</h1>
          <p>This feature is currently unavailable. Thank you for your patience!</p>
        </div>
      </div>
    );
  }

  const {
    secrets,
    loading,
    error,
    selectedSecret,
    setSelectedSecret,
    createSecret,
    rotateSecret,
    deleteSecret,
  } = useSecretsData();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRotateOpen, setIsRotateOpen] = useState(false);

  const handleCreate = async (data: { name: string; secret_type: SecretType; expires_at?: Date }) => {
    await createSecret(data);
    setIsCreateOpen(false);
  };

  const handleRotate = (secretId: string) => {
    const secret = secrets.find((s) => s.id === secretId);
    if (secret) {
      setSelectedSecret(secret);
      setIsRotateOpen(true);
    }
  };

  const handleRotateConfirm = async (secretId: string) => {
    await rotateSecret(secretId);
    setIsRotateOpen(false);
    setSelectedSecret(null);
  };

  const activeCount = secrets.filter((s) => s.is_active).length;
  const expiringCount = secrets.filter((s) => {
    if (!s.expires_at) return false;
    const days = (new Date(s.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 7 && days > 0;
  }).length;

  return (
    <div className="secrets-settings">
      <div className="settings-header">
        <h1>Secrets</h1>
        <p>Manage your API keys and secrets securely</p>
        <button onClick={() => setIsCreateOpen(true)}>+ Create Secret</button>
      </div>

      <div className="stats">
        <div className="stat-card">
          <p>Total Secrets</p>
          <p className="stat-value">{secrets.length}</p>
        </div>
        <div className="stat-card">
          <p>Active</p>
          <p className="stat-value">{activeCount}</p>
        </div>
        <div className="stat-card">
          <p>Expiring Soon</p>
          <p className="stat-value">{expiringCount}</p>
        </div>
      </div>

      <div className="secrets-container">
        <SecretsList
          secrets={secrets}
          loading={loading}
          error={error}
          onRotate={handleRotate}
          onDelete={deleteSecret}
        />
      </div>

      <Suspense fallback={<ModalFallback />}>
        <CreateSecretModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onCreate={handleCreate}
        />
      </Suspense>

      {selectedSecret && (
        <Suspense fallback={<ModalFallback />}>
          <RotateSecretModal
            isOpen={isRotateOpen}
            secret={selectedSecret}
            onClose={() => {
              setIsRotateOpen(false);
              setSelectedSecret(null);
            }}
            onConfirm={handleRotateConfirm}
          />
        </Suspense>
      )}
    </div>
  );
};
