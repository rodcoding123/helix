import React from 'react';
import { X, Copy } from 'lucide-react';
import type { EnrichedAgentTemplate } from '@/lib/types/agent-templates';

interface TemplateDetailModalProps {
  template: EnrichedAgentTemplate;
  isOpen: boolean;
  onClose: () => void;
  onClone: () => void;
  onRate: (rating: number) => void;
  isLoading?: boolean;
}

export function TemplateDetailModal({
  template,
  isOpen,
  onClose,
  onClone,
  onRate,
  isLoading = false,
}: TemplateDetailModalProps) {
  const [userRating, setUserRating] = React.useState<number | null>(null);

  if (!isOpen) return null;

  const handleRate = (rating: number) => {
    setUserRating(rating);
    onRate(rating);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-slate-900 p-6 border border-slate-700">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-100">{template.name}</h2>
            <p className="text-slate-400">{template.role}</p>
            <p className="text-sm text-slate-500 mt-1">
              by {template.creator_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Rating */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleRate(star)}
                className={`text-2xl transition-colors ${
                  (userRating || Math.round(template.rating)) >= star
                    ? 'text-yellow-400'
                    : 'text-slate-700 hover:text-yellow-300'
                }`}
              >
                ⭐
              </button>
            ))}
          </div>
          <span className="text-sm text-slate-400">
            {template.rating > 0 ? `${template.rating.toFixed(1)} (${template.clone_count} ratings)` : 'No ratings yet'}
          </span>
        </div>

        {/* Description */}
        <div className="mb-6">
          <h3 className="mb-2 font-semibold text-slate-100">Description</h3>
          <p className="text-slate-300">{template.description}</p>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="p-3 rounded bg-slate-800">
            <p className="text-xs text-slate-500">Cloned</p>
            <p className="text-xl font-bold text-slate-100">{template.clone_count}</p>
          </div>
          <div className="p-3 rounded bg-slate-800">
            <p className="text-xs text-slate-500">Active Instances</p>
            <p className="text-xl font-bold text-slate-100">{template.active_instances}</p>
          </div>
          <div className="p-3 rounded bg-slate-800">
            <p className="text-xs text-slate-500">Rating</p>
            <p className="text-xl font-bold text-slate-100">
              {template.rating > 0 ? template.rating.toFixed(1) : 'N/A'}
            </p>
          </div>
        </div>

        {/* Goals */}
        {template.goals && template.goals.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-2 font-semibold text-slate-100">Goals</h3>
            <ul className="space-y-1">
              {template.goals.map((goal, idx) => (
                <li key={idx} className="flex items-start gap-2 text-slate-300">
                  <span className="text-purple-400 mt-0.5">•</span>
                  <span>{goal}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Personality */}
        <div className="mb-6">
          <h3 className="mb-3 font-semibold text-slate-100">Personality Profile</h3>
          <div className="space-y-2">
            {(Object.entries(template.personality) as any[]).map(([trait, value]) => (
              <div key={trait}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400 capitalize">{trait}</span>
                  <span className="text-slate-500">{(value * 100).toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${value * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Use Cases */}
        {template.use_cases && template.use_cases.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-3 font-semibold text-slate-100">Use Cases</h3>
            <div className="flex flex-wrap gap-2">
              {template.use_cases.map((useCase, idx) => (
                <span
                  key={idx}
                  className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300"
                >
                  {useCase}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded border border-slate-700 px-4 py-2 font-medium text-slate-300 transition-colors hover:bg-slate-800"
            disabled={isLoading}
          >
            Close
          </button>
          <button
            onClick={onClone}
            disabled={isLoading}
            className="flex-1 rounded bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Copy size={18} />
            {isLoading ? 'Cloning...' : 'Clone Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
