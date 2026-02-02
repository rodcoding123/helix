import React from 'react';
import type { UserApiKey } from '../../../types/secrets';

interface RotateSecretModalProps {
  isOpen: boolean;
  secret: UserApiKey;
  onClose: () => void;
  onConfirm: (secretId: string) => void;
}

export const RotateSecretModal: React.FC<RotateSecretModalProps> = ({
  isOpen,
  secret,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  const nextVersion = secret.key_version + 1;

  return (
    <dialog open>
      <h2>Rotate Secret</h2>

      <div className="warning-box">
        <p>This will generate a new version of this secret.</p>
        <p>All new requests will use the new version.</p>
      </div>

      <div className="secret-info">
        <p><strong>Name:</strong> {secret.name}</p>
        <p><strong>Current Version:</strong> {secret.key_version}</p>
        <p><strong>New Version:</strong> {nextVersion}</p>
        <p><strong>Type:</strong> {secret.secret_type}</p>
      </div>

      <div className="consequences">
        <h3>What happens:</h3>
        <ul>
          <li>A new secret value will be generated</li>
          <li>Version increments from {secret.key_version} to {nextVersion}</li>
          <li>Previous version remains valid temporarily</li>
          <li>You must update applications to use the new secret</li>
        </ul>
      </div>

      <div className="modal-actions">
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button onClick={() => onConfirm(secret.id)}>Rotate Secret</button>
      </div>
    </dialog>
  );
};
