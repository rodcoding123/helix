import React from 'react';
import { format } from 'date-fns';
import type { UserApiKey } from '../../types/secrets';

interface SecretsListProps {
  secrets: UserApiKey[];
  onRotate: (secretId: string) => void;
  onDelete: (secretId: string) => void;
  loading?: boolean;
  error?: string | null;
}

export const SecretsList: React.FC<SecretsListProps> = ({
  secrets,
  onRotate,
  onDelete,
  loading,
  error,
}) => {
  if (loading) {
    return <div className="loading">Loading secrets...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (secrets.length === 0) {
    return (
      <div className="empty-state">
        <p>No secrets yet</p>
        <p>Create your first secret to get started</p>
      </div>
    );
  }

  return (
    <div className="secrets-list">
      {secrets.map((secret) => (
        <div key={secret.id} className="secret-item">
          <div className="secret-header">
            <h3>{secret.name}</h3>
            <div className="badges">
              <span className={`badge ${secret.is_active ? 'active' : 'inactive'}`}>
                {secret.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <div className="secret-meta">
            <p>Type: {secret.secret_type}</p>
            <p>Version: {secret.key_version}</p>
            <p>Created: {format(new Date(secret.created_at), 'MMM dd, yyyy')}</p>
          </div>
          <div className="secret-actions">
            <button onClick={() => onRotate(secret.id)}>Rotate</button>
            <button onClick={() => onDelete(secret.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
};
