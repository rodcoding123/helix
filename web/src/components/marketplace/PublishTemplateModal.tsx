import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { AgentTemplateCategory } from '@/lib/types/agent-templates';

interface PublishTemplateModalProps {
  templateName: string;
  categories: AgentTemplateCategory[];
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (visibility: 'public' | 'unlisted', categoryId?: string) => void;
  isLoading?: boolean;
}

export function PublishTemplateModal({
  templateName,
  categories,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: PublishTemplateModalProps) {
  const [visibility, setVisibility] = useState<'public' | 'unlisted'>('public');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(visibility, selectedCategory);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-slate-900 p-6 border border-slate-700">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-100">Publish Template</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Template Info */}
        <div className="mb-6 p-4 bg-slate-800 rounded-lg">
          <p className="text-slate-100 font-semibold">{templateName}</p>
          <p className="text-sm text-slate-400 mt-1">Ready to share with the community</p>
        </div>

        {/* Category */}
        <div className="mb-6">
          <label className="block mb-2 font-semibold text-slate-100">Category</label>
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value || undefined)}
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-purple-500 focus:outline-none"
          >
            <option value="">Select a category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Visibility */}
        <div className="mb-6">
          <label className="block mb-3 font-semibold text-slate-100">Visibility</label>
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 border border-slate-700 rounded cursor-pointer hover:bg-slate-800 transition-colors"
              style={{ borderColor: visibility === 'public' ? '#9333ea' : undefined }}
            >
              <input
                type="radio"
                name="visibility"
                value="public"
                checked={visibility === 'public'}
                onChange={() => setVisibility('public')}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <p className="font-medium text-slate-100">Public</p>
                <p className="text-sm text-slate-400">Visible in marketplace to all users</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border border-slate-700 rounded cursor-pointer hover:bg-slate-800 transition-colors"
              style={{ borderColor: visibility === 'unlisted' ? '#9333ea' : undefined }}
            >
              <input
                type="radio"
                name="visibility"
                value="unlisted"
                checked={visibility === 'unlisted'}
                onChange={() => setVisibility('unlisted')}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <p className="font-medium text-slate-100">Unlisted</p>
                <p className="text-sm text-slate-400">Only visible via direct link</p>
              </div>
            </label>
          </div>
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
            disabled={isLoading || !selectedCategory}
            className="flex-1 rounded bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}
