import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { EnrichedAgentTemplate } from '@/lib/types/agent-templates';

interface CloneTemplateModalProps {
  template: EnrichedAgentTemplate;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (templateName: string) => void;
  isLoading?: boolean;
}

export function CloneTemplateModal({
  template,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: CloneTemplateModalProps) {
  const [templateName, setTemplateName] = useState(`${template.name} (Clone)`);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (templateName.trim()) {
      onConfirm(templateName);
      setTemplateName(`${template.name} (Clone)`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-slate-900 p-6 border border-slate-700">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-100">Clone Template</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Info */}
        <div className="mb-6 p-4 bg-slate-800 rounded-lg">
          <p className="text-sm text-slate-300 mb-2">
            <span className="font-semibold text-slate-100">Original: </span>
            {template.name}
          </p>
          <p className="text-xs text-slate-400">
            by {template.creator_name}
          </p>
        </div>

        {/* Form */}
        <div className="mb-6">
          <label className="block mb-2 font-semibold text-slate-100">Template Name</label>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-purple-500 focus:outline-none"
            placeholder="Enter template name"
          />
          <p className="mt-2 text-xs text-slate-500">
            This clones the template as a private copy you can modify and customize.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded border border-slate-700 px-4 py-2 font-medium text-slate-300 transition-colors hover:bg-slate-800"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || !templateName.trim()}
            className="flex-1 rounded bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Cloning...' : 'Clone'}
          </button>
        </div>
      </div>
    </div>
  );
}
