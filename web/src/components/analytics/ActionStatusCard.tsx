import React from 'react';
import type { AutonomyMetrics } from '@/lib/types/analytics';

interface ActionStatusCardProps {
  metrics: AutonomyMetrics;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Pending' },
  approved: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Approved' },
  rejected: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Rejected' },
  executed: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Executed' },
  failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' },
};

export function ActionStatusCard({ metrics }: ActionStatusCardProps) {
  const total = metrics.total_actions || 1; // Prevent division by zero
  const statuses = [
    { key: 'pending', value: metrics.pending_actions },
    { key: 'approved', value: metrics.approved_actions },
    { key: 'rejected', value: metrics.rejected_actions },
    { key: 'executed', value: metrics.executed_actions },
  ];

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <h3 className="mb-4 font-semibold text-slate-100">Action Status</h3>

      {/* Status bars */}
      <div className="space-y-3 mb-6">
        {statuses.map(({ key, value }) => {
          const config = STATUS_COLORS[key];
          const percentage = (value / total) * 100;

          return (
            <div key={key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">{config.label}</span>
                <span className={`font-medium ${config.text}`}>{value}</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${config.bg}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Risk distribution */}
      <div className="border-t border-slate-700 pt-4">
        <h4 className="text-sm font-medium text-slate-300 mb-3">Risk Distribution</h4>
        <div className="space-y-2">
          {Object.entries(metrics.risk_distribution || {}).map(([risk, count]) => (
            <div key={risk} className="flex items-center justify-between">
              <span className="text-sm text-slate-400 capitalize">{risk}</span>
              <span className="text-sm font-medium text-slate-100">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
