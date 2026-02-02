import React from 'react';
import type { UserApiKey } from '../../../lib/types/secrets';

export interface RotateSecretModalProps {
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
  const nextVersion = secret.key_version + 1;

  const handleRotate = () => {
    onConfirm(secret.id);
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
            Confirm Secret Rotation
          </h2>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-4">
          {/* Warning Box */}
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  This action will generate a new version of this secret.
                </p>
                <p className="mt-1 text-sm text-yellow-700">
                  All new requests will use the new version. Old applications may continue
                  working with the previous version temporarily.
                </p>
              </div>
            </div>
          </div>

          {/* Secret Info */}
          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Secret Name</p>
              <p className="mt-1 text-sm text-gray-900">{secret.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Current Version: {secret.key_version}
                </p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {secret.key_version}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  New Version: {nextVersion}
                </p>
                <p className="mt-1 text-lg font-semibold text-blue-600">
                  {nextVersion}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700">Type</p>
              <p className="mt-1 text-sm text-gray-900">{secret.secret_type}</p>
            </div>
          </div>

          {/* Consequences */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-700">What happens:</p>
            <ul className="mt-2 space-y-2 text-sm text-gray-600">
              <li className="flex gap-2">
                <span className="flex-shrink-0">•</span>
                <span>A new secret value will be generated</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0">•</span>
                <span>Version number increments from {secret.key_version} to {nextVersion}</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0">•</span>
                <span>Previous version remains valid temporarily</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0">•</span>
                <span>You must update applications to use the new secret</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRotate}
            className="rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 transition-colors"
          >
            Rotate Secret
          </button>
        </div>
      </div>
    </div>
  );
};
