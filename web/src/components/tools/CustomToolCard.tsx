import { Copy, Trash2, Edit2, Play } from 'lucide-react';
import type { CustomTool } from '@/lib/types/custom-tools';

interface CustomToolCardProps {
  tool: CustomTool;
  onEdit?: (tool: CustomTool) => void;
  onDelete?: (toolId: string) => void;
  onClone?: (toolId: string) => void;
  onExecute?: (tool: CustomTool) => void;
}

export function CustomToolCard({
  tool,
  onEdit,
  onDelete,
  onClone,
  onExecute,
}: CustomToolCardProps) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 hover:border-slate-600 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{tool.icon}</span>
            <div>
              <h3 className="font-semibold text-slate-100">{tool.name}</h3>
              <p className="text-xs text-slate-500">{tool.version}</p>
            </div>
          </div>
        </div>
        {tool.visibility === 'public' && (
          <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded">
            Public
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-slate-300 mb-3 line-clamp-2">{tool.description}</p>

      {/* Capabilities & Profile */}
      <div className="mb-3 space-y-2">
        {tool.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tool.capabilities.map((cap) => (
              <span
                key={cap}
                className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs rounded"
              >
                {cap}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Sandbox: {tool.sandbox_profile}</span>
          <span>{tool.usage_count} executions</span>
        </div>
      </div>

      {/* Tags */}
      {tool.tags && tool.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {tool.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-slate-800 text-slate-400 text-xs rounded-full"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {onExecute && (
          <button
            onClick={() => onExecute(tool)}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
          >
            <Play size={16} />
            Execute
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(tool)}
            className="flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded transition-colors"
          >
            <Edit2 size={16} />
          </button>
        )}
        {onClone && (
          <button
            onClick={() => onClone(tool.id)}
            className="flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded transition-colors"
          >
            <Copy size={16} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => {
              if (confirm('Delete this tool?')) {
                onDelete(tool.id);
              }
            }}
            className="flex items-center justify-center gap-1 px-3 py-1.5 bg-red-900/20 hover:bg-red-900/30 text-red-400 text-sm rounded transition-colors"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
