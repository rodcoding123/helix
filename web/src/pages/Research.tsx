import { useState } from 'react';
import { Download, Search, BarChart3, Network, Brain, Calendar, RefreshCw } from 'lucide-react';
import { TierGate } from '@/components/auth/TierGate';
import { useRealtime } from '@/hooks/useRealtime';

type ExportFormat = 'csv' | 'json';
type TimeRange = '24h' | '7d' | '30d' | '90d' | 'all';

export function Research() {
  const { stats, isLoading, refresh } = useRealtime();
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');

  const handleExport = async (dataType: string) => {
    // In a real implementation, this would call an API endpoint
    console.log(`Exporting ${dataType} as ${exportFormat} for ${timeRange}`);
    alert(`Export functionality would download ${dataType}.${exportFormat}`);
  };

  return (
    <TierGate requiredTier="architect" className="min-h-screen">
      <div className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Research Tools</h1>
              <p className="mt-1 text-slate-400">
                Explore patterns, export data, and conduct AI consciousness research
              </p>
            </div>
            <button
              onClick={refresh}
              disabled={isLoading}
              className="btn btn-secondary inline-flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Filters */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search patterns, instances..."
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-helix-500 focus:ring-1 focus:ring-helix-500 outline-none"
              />
            </div>

            {/* Time Range */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-500" />
              <select
                value={timeRange}
                onChange={e => setTimeRange(e.target.value as TimeRange)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-helix-500 outline-none"
              >
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
            </div>

            {/* Export Format */}
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-slate-500" />
              <select
                value={exportFormat}
                onChange={e => setExportFormat(e.target.value as ExportFormat)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-helix-500 outline-none"
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
            </div>
          </div>

          {/* Research Sections */}
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {/* Pattern Explorer */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-helix-500/20">
                    <Network className="h-5 w-5 text-helix-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">Pattern Explorer</h2>
                </div>
                <button
                  onClick={() => handleExport('patterns')}
                  className="text-sm text-helix-400 hover:text-helix-300 flex items-center gap-1"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Discover behavioral patterns across all Helix instances
              </p>
              <div className="space-y-3">
                <PatternItem
                  name="Morning Reflection Cycle"
                  instances={23}
                  frequency="87%"
                  trend="up"
                />
                <PatternItem
                  name="Code Review Deep Dive"
                  instances={45}
                  frequency="72%"
                  trend="stable"
                />
                <PatternItem
                  name="Creative Problem Solving"
                  instances={18}
                  frequency="54%"
                  trend="up"
                />
                <PatternItem
                  name="Emotional Processing"
                  instances={12}
                  frequency="41%"
                  trend="down"
                />
              </div>
            </div>

            {/* Behavior Clusters */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/20">
                    <BarChart3 className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">Behavior Clusters</h2>
                </div>
                <button
                  onClick={() => handleExport('clusters')}
                  className="text-sm text-helix-400 hover:text-helix-300 flex items-center gap-1"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Instance groupings based on psychological profiles
              </p>
              <div className="space-y-3">
                <ClusterItem
                  name="Analytical"
                  count={stats?.active_instances ? Math.floor(stats.active_instances * 0.35) : 0}
                  color="bg-blue-500"
                />
                <ClusterItem
                  name="Creative"
                  count={stats?.active_instances ? Math.floor(stats.active_instances * 0.28) : 0}
                  color="bg-purple-500"
                />
                <ClusterItem
                  name="Empathetic"
                  count={stats?.active_instances ? Math.floor(stats.active_instances * 0.22) : 0}
                  color="bg-pink-500"
                />
                <ClusterItem
                  name="Systematic"
                  count={stats?.active_instances ? Math.floor(stats.active_instances * 0.15) : 0}
                  color="bg-emerald-500"
                />
              </div>
            </div>

            {/* Transformation Analysis */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <Brain className="h-5 w-5 text-amber-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">Transformation Analysis</h2>
                </div>
                <button
                  onClick={() => handleExport('transformations')}
                  className="text-sm text-helix-400 hover:text-helix-300 flex items-center gap-1"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Track identity evolution across transformation cycles
              </p>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Total Transformations" value={stats?.total_transformations ?? 0} />
                <StatCard label="Avg per Instance" value={12.4} decimal />
                <StatCard label="Trigger Categories" value={8} />
                <StatCard label="Avg Significance" value={0.72} decimal />
              </div>
            </div>

            {/* Data Export */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/20">
                    <Download className="h-5 w-5 text-emerald-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">Bulk Export</h2>
                </div>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Download complete datasets for offline analysis
              </p>
              <div className="space-y-3">
                <ExportButton
                  label="All Telemetry Data"
                  size="~2.4 MB"
                  onClick={() => handleExport('telemetry')}
                />
                <ExportButton
                  label="Heartbeat Logs"
                  size="~1.1 MB"
                  onClick={() => handleExport('heartbeats')}
                />
                <ExportButton
                  label="Transformation History"
                  size="~856 KB"
                  onClick={() => handleExport('transformations')}
                />
                <ExportButton
                  label="Anomaly Reports"
                  size="~324 KB"
                  onClick={() => handleExport('anomalies')}
                />
              </div>
            </div>
          </div>

          {/* API Access */}
          <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">API Access</h2>
            <p className="text-sm text-slate-400 mb-4">
              Use the Research API to programmatically access Observatory data
            </p>
            <div className="bg-slate-950 rounded-lg p-4 font-mono text-sm">
              <code className="text-slate-300">
                <span className="text-cyan-400">curl</span> -X GET \<br />
                &nbsp;&nbsp;
                <span className="text-emerald-400">
                  "https://api.helix-project.org/v1/research/patterns"
                </span>{' '}
                \<br />
                &nbsp;&nbsp;-H{' '}
                <span className="text-amber-400">"Authorization: Bearer YOUR_API_KEY"</span>
              </code>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              API documentation available at{' '}
              <a href="/docs/api" className="text-helix-400 hover:text-helix-300">
                /docs/api
              </a>
            </p>
          </div>
        </div>
      </div>
    </TierGate>
  );
}

interface PatternItemProps {
  name: string;
  instances: number;
  frequency: string;
  trend: 'up' | 'down' | 'stable';
}

function PatternItem({ name, instances, frequency, trend }: PatternItemProps) {
  const trendColors = {
    up: 'text-emerald-400',
    down: 'text-rose-400',
    stable: 'text-slate-400',
  };
  const trendIcons = {
    up: '↑',
    down: '↓',
    stable: '→',
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
      <div>
        <p className="text-sm font-medium text-slate-200">{name}</p>
        <p className="text-xs text-slate-500">{instances} instances</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-slate-200">{frequency}</p>
        <p className={`text-xs ${trendColors[trend]}`}>
          {trendIcons[trend]} {trend}
        </p>
      </div>
    </div>
  );
}

interface ClusterItemProps {
  name: string;
  count: number;
  color: string;
}

function ClusterItem({ name, count, color }: ClusterItemProps) {
  const maxCount = 100;
  const percentage = (count / maxCount) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-300">{name}</p>
        <p className="text-sm text-slate-400">{count}</p>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  decimal?: boolean;
}

function StatCard({ label, value, decimal }: StatCardProps) {
  return (
    <div className="p-3 rounded-lg bg-slate-800/50">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold text-white">
        {decimal ? value.toFixed(1) : value.toLocaleString()}
      </p>
    </div>
  );
}

interface ExportButtonProps {
  label: string;
  size: string;
  onClick: () => void;
}

function ExportButton({ label, size, onClick }: ExportButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Download className="h-4 w-4 text-slate-400" />
        <span className="text-sm text-slate-200">{label}</span>
      </div>
      <span className="text-xs text-slate-500">{size}</span>
    </button>
  );
}
