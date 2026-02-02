import type { ToolCapability } from '@/lib/types/custom-tools';

interface ToolCapabilityBadgeProps {
  capability: ToolCapability;
  selected: boolean;
  onChange: (selected: boolean) => void;
}

const CAPABILITY_INFO: Record<ToolCapability, { icon: string; label: string; riskLevel: 'low' | 'medium' | 'high'; description: string }> = {
  'filesystem:read': {
    icon: '📖',
    label: 'File Read',
    riskLevel: 'low',
    description: 'Can read files from disk',
  },
  'filesystem:write': {
    icon: '✍️',
    label: 'File Write',
    riskLevel: 'medium',
    description: 'Can write/modify files on disk',
  },
  'network:outbound': {
    icon: '🌐',
    label: 'Network Access',
    riskLevel: 'high',
    description: 'Can make outbound network requests',
  },
  'network:localhost': {
    icon: '🔌',
    label: 'Local Network',
    riskLevel: 'medium',
    description: 'Can connect to localhost services',
  },
  'process:spawn': {
    icon: '⚙️',
    label: 'Process Spawn',
    riskLevel: 'high',
    description: 'Can execute system commands',
  },
  'mcp:tools': {
    icon: '🔧',
    label: 'MCP Tools',
    riskLevel: 'medium',
    description: 'Can call other MCP tools',
  },
};

export function ToolCapabilityBadge({
  capability,
  selected,
  onChange,
}: ToolCapabilityBadgeProps) {
  const info = CAPABILITY_INFO[capability];
  const riskColors = {
    low: 'bg-green-500/20 border-green-500/50 text-green-300',
    medium: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
    high: 'bg-red-500/20 border-red-500/50 text-red-300',
  };

  return (
    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${riskColors[info.riskLevel]} ${selected ? 'ring-2 ring-purple-500' : ''}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">{info.icon}</span>
          <span className="font-medium">{info.label}</span>
          <span className="text-xs px-2 py-1 bg-black/30 rounded">
            {info.riskLevel.toUpperCase()}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">{info.description}</p>
      </div>
    </label>
  );
}
