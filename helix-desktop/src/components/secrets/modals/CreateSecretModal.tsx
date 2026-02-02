import React, { useState, useRef, useEffect } from 'react';
import type { SecretType } from '../../../types/secrets';

interface CreateSecretModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; secret_type: SecretType; expires_at?: Date }) => void;
}

const SECRET_TYPES: { value: SecretType; label: string }[] = [
  { value: 'SUPABASE_ANON_KEY', label: 'Supabase Anon Key' },
  { value: 'SUPABASE_SERVICE_ROLE', label: 'Supabase Service Role' },
  { value: 'DEEPSEEK_API_KEY', label: 'DeepSeek API Key' },
  { value: 'GEMINI_API_KEY', label: 'Gemini API Key' },
  { value: 'STRIPE_SECRET_KEY', label: 'Stripe Secret Key' },
  { value: 'STRIPE_PUBLISHABLE_KEY', label: 'Stripe Publishable Key' },
  { value: 'DISCORD_WEBHOOK', label: 'Discord Webhook' },
];

export const CreateSecretModal: React.FC<CreateSecretModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [secretType, setSecretType] = useState<SecretType>('SUPABASE_ANON_KEY');
  const [expiresAt, setExpiresAt] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = 'Name is required';
    if (!secretType) newErrors.secretType = 'Type is required';
    if (expiresAt && new Date(expiresAt) <= new Date()) {
      newErrors.expiresAt = 'Date must be in the future';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onCreate({
      name: name.trim(),
      secret_type: secretType,
      expires_at: expiresAt ? new Date(expiresAt) : undefined,
    });

    setName('');
    setSecretType('SUPABASE_ANON_KEY');
    setExpiresAt('');
    setErrors({});
    onClose();
  };

  return (
    <dialog open onKeyDown={handleKeyDown} role="dialog" aria-labelledby="modal-title" aria-modal="true">
      <h2 id="modal-title">Create New Secret</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">Secret Name</label>
          <input
            id="name"
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Production Stripe Key"
            aria-describedby={errors.name ? 'name-error' : undefined}
            aria-invalid={!!errors.name}
          />
          {errors.name && <p id="name-error" className="error">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="type">Secret Type</label>
          <select
            id="type"
            value={secretType}
            onChange={(e) => setSecretType(e.target.value as SecretType)}
            aria-describedby={errors.secretType ? 'type-error' : undefined}
            aria-invalid={!!errors.secretType}
          >
            {SECRET_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          {errors.secretType && <p id="type-error" className="error">{errors.secretType}</p>}
        </div>

        <div>
          <label htmlFor="expires">Expiration Date (Optional)</label>
          <input
            id="expires"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            aria-describedby={errors.expiresAt ? 'expires-error' : undefined}
            aria-invalid={!!errors.expiresAt}
          />
          {errors.expiresAt && <p id="expires-error" className="error">{errors.expiresAt}</p>}
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose} aria-label="Cancel creating secret">
            Cancel
          </button>
          <button type="submit" aria-label="Create secret with provided details">Create Secret</button>
        </div>
      </form>
    </dialog>
  );
};
