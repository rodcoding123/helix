import React from 'react';
import { format } from 'date-fns';
import type { UserApiKey } from '../../lib/types/secrets';

interface SecretListItemProps {
  secret: UserApiKey;
  onRotate?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
}

export const SecretListItem: React.FC<SecretListItemProps> = ({
  secret,
  onRotate,
  onDelete,
  onCopy,
}) => {
  const isExpired =
    secret.expires_at && new Date(secret.expires_at) < new Date();
  const isExpiringSoon =
    secret.expires_at &&
    !isExpired &&
    new Date(secret.expires_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000; // 7 days

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Secret Info */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">
            {secret.key_name}
          </h3>
          {secret.is_active && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              Active
            </span>
          )}
          {!secret.is_active && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
              Inactive
            </span>
          )}
          {isExpired && (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
              Expired
            </span>
          )}
          {isExpiringSoon && !isExpired && (
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
              Expiring Soon
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          <p>Type: {secret.secret_type}</p>
          <p>
            Created: {format(new Date(secret.created_at), 'MMM dd, yyyy')}
          </p>
          {secret.expires_at && (
            <p>
              Expires: {format(new Date(secret.expires_at), 'MMM dd, yyyy')}
            </p>
          )}
          <p>Version: {secret.key_version}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {onCopy && (
          <button
            onClick={onCopy}
            className="inline-flex items-center rounded-md bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
            aria-label={`Copy ${secret.key_name}`}
          >
            Copy
          </button>
        )}
        {onRotate && (
          <button
            onClick={onRotate}
            className="inline-flex items-center rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
            aria-label={`Rotate ${secret.key_name}`}
          >
            Rotate
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="inline-flex items-center rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
            aria-label={`Delete ${secret.key_name}`}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
};
