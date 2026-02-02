import React, { useState } from 'react';
import { useSecretsData } from '../../hooks/useSecretsData';
import { SecretsList } from '../secrets/SecretsList';
import { CreateSecretModal } from '../secrets/modals/CreateSecretModal';
import { RotateSecretModal } from '../secrets/modals/RotateSecretModal';
import type { UserApiKey } from '../../types/secrets';
import '../secrets/Secrets.css';

export const SecretsSettings: React.FC = () => {
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

  const handleCreate = async (data: any) => {
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

      <CreateSecretModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreate}
      />

      {selectedSecret && (
        <RotateSecretModal
          isOpen={isRotateOpen}
          secret={selectedSecret}
          onClose={() => {
            setIsRotateOpen(false);
            setSelectedSecret(null);
          }}
          onConfirm={handleRotateConfirm}
        />
      )}
    </div>
  );
};
