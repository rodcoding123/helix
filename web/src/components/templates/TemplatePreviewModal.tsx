import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { EnrichedAgentTemplate, PersonalityProfile } from '@/lib/types/agent-templates';

interface TemplatePreviewModalProps {
  template: EnrichedAgentTemplate;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (agentName: string, customPersonality?: Partial<PersonalityProfile>) => void;
  isLoading?: boolean;
}

export function TemplatePreviewModal({
  template,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: TemplatePreviewModalProps) {
  const [agentName, setAgentName] = useState(`${template.name} Agent`);
  const [customPersonality, setCustomPersonality] = useState<Partial<PersonalityProfile>>(
    template.personality
  );

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(agentName, customPersonality);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-slate-900 p-6 border border-slate-700">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">{template.name}</h2>
            <p className="text-slate-400">{template.role}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Description */}
        <div className="mb-6">
          <h3 className="mb-2 font-semibold text-slate-100">About</h3>
          <p className="text-slate-300">{template.description}</p>
        </div>

        {/* Goals & Scope */}
        {template.goals && template.goals.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-2 font-semibold text-slate-100">Goals</h3>
            <ul className="space-y-1 text-slate-300">
              {template.goals.map((goal, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">•</span>
                  <span>{goal}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Agent Name Input */}
        <div className="mb-6">
          <label className="block mb-2 font-semibold text-slate-100">Agent Name</label>
          <input
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-purple-500 focus:outline-none"
            placeholder="Enter agent name"
          />
        </div>

        {/* Personality Customization */}
        <div className="mb-6">
          <h3 className="mb-4 font-semibold text-slate-100">Personality Traits</h3>
          <div className="space-y-4">
            {(Object.keys(template.personality) as Array<keyof PersonalityProfile>).map(
              (trait) => (
                <div key={trait}>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-300 capitalize">
                      {trait}
                    </label>
                    <span className="text-xs text-slate-500">
                      {(customPersonality[trait]! * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={customPersonality[trait]! * 100}
                    onChange={(e) =>
                      setCustomPersonality({
                        ...customPersonality,
                        [trait]: parseInt(e.target.value) / 100,
                      })
                    }
                    className="w-full"
                  />
                </div>
              )
            )}
          </div>
        </div>

        {/* Use Cases */}
        {template.use_cases && template.use_cases.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-2 font-semibold text-slate-100">Use Cases</h3>
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
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || !agentName.trim()}
            className="flex-1 rounded bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating...' : 'Create Agent'}
          </button>
        </div>
      </div>
    </div>
  );
}
