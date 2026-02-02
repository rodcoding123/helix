import React, { useState } from 'react';
import type { SecretType } from '../../../lib/types/secrets';

export interface CreateSecretModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    secret_type: SecretType;
    expires_at?: Date;
  }) => void;
}

const SECRET_TYPES: { value: SecretType; label: string }[] = [
  { value: 'api_key', label: 'API Key' },
  { value: 'stripe_key', label: 'Stripe Key' },
  { value: 'gemini_api_key', label: 'Gemini API Key' },
  { value: 'deepseek_api_key', label: 'DeepSeek API Key' },
  { value: 'database_url', label: 'Database URL' },
  { value: 'webhook_secret', label: 'Webhook Secret' },
  { value: 'oauth_token', label: 'OAuth Token' },
];

export const CreateSecretModal: React.FC<CreateSecretModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [secretType, setSecretType] = useState<SecretType>('api_key');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!secretType) {
      newErrors.secretType = 'Secret type is required';
    }

    if (expiresAt) {
      const expiresDate = new Date(expiresAt);
      if (expiresDate <= new Date()) {
        newErrors.expiresAt = 'Expiration date must be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      onCreate({
        name: name.trim(),
        secret_type: secretType,
        expires_at: expiresAt ? new Date(expiresAt) : undefined,
      });

      // Reset form after successful creation
      setName('');
      setSecretType('api_key');
      setExpiresAt('');
      setErrors({});
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div
        className="w-full max-w-md rounded-lg bg-white shadow-lg"
        role="dialog"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
            Create New Secret
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          {/* Name Field */}
          <div>
            <label
              htmlFor="secret-name"
              className="block text-sm font-medium text-gray-700"
            >
              Secret Name
            </label>
            <input
              id="secret-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production Stripe Key"
              className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-300 bg-white'
              }`}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Type Field */}
          <div>
            <label
              htmlFor="secret-type"
              className="block text-sm font-medium text-gray-700"
            >
              Secret Type
            </label>
            <select
              id="secret-type"
              value={secretType}
              onChange={(e) => setSecretType(e.target.value as SecretType)}
              className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.secretType
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-300 bg-white'
              }`}
            >
              {SECRET_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {errors.secretType && (
              <p className="mt-1 text-sm text-red-600">{errors.secretType}</p>
            )}
          </div>

          {/* Expiration Date Field */}
          <div>
            <label
              htmlFor="secret-expires"
              className="block text-sm font-medium text-gray-700"
            >
              Expiration Date (Optional)
            </label>
            <input
              id="secret-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.expiresAt
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-300 bg-white'
              }`}
            />
            {errors.expiresAt && (
              <p className="mt-1 text-sm text-red-600">{errors.expiresAt}</p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Creating...' : 'Create Secret'}
          </button>
        </div>
      </div>
    </div>
  );
};
