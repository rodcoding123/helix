import React from 'react';
import { SecretListItem } from './SecretListItem';
import { useSecrets } from '../../lib/context/SecretsContext';

export const SecretsList: React.FC = () => {
  const { secrets, loading, error } = useSecrets();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <p className="mt-4 text-sm text-gray-600">Loading secrets...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-800">Error loading secrets</p>
        <p className="mt-1 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (secrets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-12">
        <svg
          className="h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
          />
        </svg>
        <p className="mt-4 text-sm font-medium text-gray-900">
          No secrets yet
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Create your first secret to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {secrets.map((secret) => (
        <SecretListItem
          key={secret.id}
          secret={secret}
          onCopy={() => console.log('Copy:', secret.id)}
          onRotate={() => console.log('Rotate:', secret.id)}
          onDelete={() => console.log('Delete:', secret.id)}
        />
      ))}
    </div>
  );
};
