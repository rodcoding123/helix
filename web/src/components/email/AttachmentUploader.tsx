import React, { useCallback, useRef, useState } from 'react';
import { Upload, X, Paperclip, File, FileText, Music, Image } from 'lucide-react';

interface AttachmentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  progress?: number;
}

interface AttachmentUploaderProps {
  attachments: AttachmentFile[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  maxSize?: number; // in bytes, default 25MB
  maxFiles?: number;
  disabled?: boolean;
  acceptedTypes?: string[];
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return <Image size={16} />;
  if (type.startsWith('audio/')) return <Music size={16} />;
  if (
    type === 'application/pdf' ||
    type.includes('document') ||
    type.includes('sheet') ||
    type.includes('presentation')
  ) {
    return <FileText size={16} />;
  }
  return <File size={16} />;
};

export const AttachmentUploader: React.FC<AttachmentUploaderProps> = ({
  attachments,
  onAdd,
  onRemove,
  maxSize = 25 * 1024 * 1024, // 25MB default
  maxFiles = 20,
  disabled = false,
  acceptedTypes = [
    'image/*',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ],
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFiles = (files: FileList): File[] => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    // Check total file limit
    if (attachments.length + files.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return [];
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check file size
      if (file.size > maxSize) {
        errors.push(`${file.name} exceeds maximum size of ${formatFileSize(maxSize)}`);
        continue;
      }

      // Check file type if acceptedTypes is specified
      if (acceptedTypes.length > 0) {
        const isAccepted = acceptedTypes.some((type) => {
          if (type === '*/*') return true;
          if (type.endsWith('/*')) {
            const category = type.slice(0, -2);
            return file.type.startsWith(category);
          }
          return file.type === type;
        });

        if (!isAccepted) {
          errors.push(`${file.name} is not an accepted file type`);
          continue;
        }
      }

      // Check for duplicate filenames
      const isDuplicate = attachments.some((a) => a.name === file.name);
      if (isDuplicate) {
        errors.push(`${file.name} is already attached`);
        continue;
      }

      validFiles.push(file);
    }

    if (errors.length > 0) {
      setError(errors.join('; '));
    }

    return validFiles;
  };

  const handleFiles = useCallback(
    (files: FileList) => {
      const validFiles = validateFiles(files);
      if (validFiles.length > 0) {
        setError(null);
        onAdd(validFiles);
      }
    },
    [attachments, maxFiles, maxSize, acceptedTypes, onAdd]
  );

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (!disabled && e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="space-y-3">
      {/* Drag and Drop Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
            : dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50'
        }`}
        onClick={handleClick}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <Upload size={24} className="text-gray-400" />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">
              Drag files here or click to select
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Max file size: {formatFileSize(maxSize)}
            </p>
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleInputChange}
        accept={acceptedTypes.join(',')}
        className="hidden"
        disabled={disabled}
      />

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Attachment List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Paperclip size={16} className="text-gray-600" />
            <p className="text-sm font-medium text-gray-700">
              {attachments.length} attachment{attachments.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="text-gray-600 flex-shrink-0">
                    {getFileIcon(attachment.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {attachment.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(attachment.size)}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                {attachment.progress !== undefined && attachment.progress < 100 && (
                  <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden mr-2">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${attachment.progress}%` }}
                    />
                  </div>
                )}

                {/* Remove Button */}
                <button
                  type="button"
                  onClick={() => onRemove(attachment.id)}
                  disabled={disabled}
                  className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                    disabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title="Remove attachment"
                >
                  <X size={16} className="text-gray-600" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttachmentUploader;
