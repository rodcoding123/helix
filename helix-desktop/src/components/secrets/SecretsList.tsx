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
  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  if (loading) {
    return <div className="loading" role="status" aria-live="polite">Loading secrets...</div>;
  }

  if (error) {
    return <div className="error" role="alert">{error}</div>;
  }

  if (secrets.length === 0) {
    return (
      <div className="empty-state" role="status">
        <p>No secrets yet</p>
        <p>Create your first secret to get started</p>
      </div>
    );
  }

  return (
    <div className="secrets-list" role="list">
      {secrets.map((secret) => (
        <div key={secret.id} className="secret-item" role="listitem">
          <div className="secret-header">
            <h3>{secret.name}</h3>
            <div className="badges">
              <span
                className={`badge ${secret.is_active ? 'active' : 'inactive'}`}
                aria-label={`Status: ${secret.is_active ? 'Active' : 'Inactive'}`}
              >
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
            <button
              onClick={() => onRotate(secret.id)}
              onKeyDown={(e) => handleKeyDown(e, () => onRotate(secret.id))}
              aria-label={`Rotate ${secret.name}`}
            >
              Rotate
            </button>
            <button
              onClick={() => onDelete(secret.id)}
              onKeyDown={(e) => handleKeyDown(e, () => onDelete(secret.id))}
              aria-label={`Delete ${secret.name}`}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
