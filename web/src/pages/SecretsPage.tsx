import { useState } from 'react';
import { SecretsList } from '../components/secrets/SecretsList';
import { CreateSecretModal } from '../components/secrets/modals/CreateSecretModal';
import { RotateSecretModal } from '../components/secrets/modals/RotateSecretModal';
import { useSecrets } from '../lib/context/SecretsContext';
import type { UserApiKey } from '../lib/types/secrets';

export const SecretsPage: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRotateModalOpen, setIsRotateModalOpen] = useState(false);
  const [selectedSecret, setSelectedSecret] = useState<UserApiKey | null>(null);

  const { addSecret, updateSecret } = useSecrets();

  const handleCreateClick = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateSecret = async (data: {
    name: string;
    secret_type: string;
    expires_at?: Date;
  }) => {
    try {
      // Call API to create secret
      const response = await fetch('/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          secret_type: data.secret_type,
          expires_at: data.expires_at?.toISOString(),
        }),
      });

      if (!response.ok) throw new Error('Failed to create secret');

      const secret = await response.json();
      addSecret(secret);
      setIsCreateModalOpen(false);
    } catch (err) {
      console.error('Error creating secret:', err);
    }
  };

  const handleRotateSecret = async (secretId: string) => {
    try {
      const response = await fetch(`/api/secrets/${secretId}/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to rotate secret');

      const updated = await response.json();
      updateSecret(secretId, updated);
      setIsRotateModalOpen(false);
      setSelectedSecret(null);
    } catch (err) {
      console.error('Error rotating secret:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Secrets</h1>
            <p className="mt-2 text-gray-600">
              Manage your API keys and secrets securely
            </p>
          </div>
          <button
            onClick={handleCreateClick}
            className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + Create Secret
          </button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">Total Secrets</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {useSecrets().secrets.length}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">Active</p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {useSecrets().secrets.filter((s) => s.is_active).length}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">Expiring Soon</p>
            <p className="mt-1 text-2xl font-bold text-yellow-600">
              {
                useSecrets().secrets.filter((s) => {
                  if (!s.expires_at) return false;
                  const daysUntilExpiry =
                    (new Date(s.expires_at).getTime() - Date.now()) /
                    (1000 * 60 * 60 * 24);
                  return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
                }).length
              }
            </p>
          </div>
        </div>

        {/* Secrets List */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <SecretsList />
        </div>
      </div>

      {/* Modals */}
      <CreateSecretModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateSecret}
      />

      {selectedSecret && (
        <RotateSecretModal
          isOpen={isRotateModalOpen}
          secret={selectedSecret}
          onClose={() => {
            setIsRotateModalOpen(false);
            setSelectedSecret(null);
          }}
          onConfirm={handleRotateSecret}
        />
      )}
    </div>
  );
};
