import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  limit?: number;
}

export function StatCard({ label, value, icon: Icon, trend, limit }: StatCardProps) {
  const percentage = typeof limit === 'number' && typeof value === 'number'
    ? ((value / limit) * 100).toFixed(0)
    : null;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-400 mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-100">{value}</p>
          {percentage && (
            <p className="text-xs text-slate-500 mt-1">{percentage}% of limit</p>
          )}
          {trend && (
            <p className={`text-xs mt-1 ${trend.isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {Icon && (
          <Icon className="text-slate-500" size={24} />
        )}
      </div>
    </div>
  );
}
