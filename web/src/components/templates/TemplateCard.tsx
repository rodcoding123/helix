import { Star } from 'lucide-react';
import type { EnrichedAgentTemplate } from '@/lib/types/agent-templates';

interface TemplateCardProps {
  template: EnrichedAgentTemplate;
  onPreview?: (template: EnrichedAgentTemplate) => void;
  onFavorite?: (templateId: string) => void;
  isFavorite?: boolean;
}

export function TemplateCard({
  template,
  onPreview,
  onFavorite,
  isFavorite = false,
}: TemplateCardProps) {
  const personality = template.personality;

  return (
    <div className="group relative overflow-hidden rounded-lg border border-slate-700 bg-slate-900 p-4 transition-all hover:border-slate-600 hover:shadow-lg hover:shadow-purple-500/20">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-slate-100 group-hover:text-purple-300">
            {template.name}
          </h3>
          <p className="text-sm text-slate-400">{template.role}</p>
        </div>
        {onFavorite && (
          <button
            onClick={(e) => {
              e.preventDefault();
              onFavorite(template.id);
            }}
            className={`ml-2 p-1.5 rounded transition-colors ${
              isFavorite
                ? 'text-yellow-400'
                : 'text-slate-500 hover:text-yellow-400'
            }`}
          >
            <Star size={18} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      {/* Description */}
      <p className="mb-3 line-clamp-2 text-sm text-slate-400">
        {template.description}
      </p>

      {/* Personality Dimensions */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Verbosity</span>
          <div className="h-1.5 w-20 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500"
              style={{ width: `${personality.verbosity * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Creativity</span>
          <div className="h-1.5 w-20 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500"
              style={{ width: `${personality.creativity * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Warmth</span>
          <div className="h-1.5 w-20 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-rose-500"
              style={{ width: `${personality.warmth * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 flex justify-between text-xs text-slate-400">
        <span>{template.clone_count} cloned</span>
        <span>{template.active_instances} active</span>
        {template.rating > 0 && <span>⭐ {template.rating.toFixed(1)}</span>}
      </div>

      {/* Preview Button */}
      {onPreview && (
        <button
          onClick={() => onPreview(template)}
          className="w-full rounded bg-purple-600 py-1.5 text-sm font-medium text-white transition-colors hover:bg-purple-700"
        >
          Preview & Create
        </button>
      )}
    </div>
  );
}
