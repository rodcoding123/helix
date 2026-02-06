/**
 * CostBurnRate Component
 *
 * Real-time cost tracking visualization showing:
 * - Burn rate per hour and per minute
 * - Recent cost delta
 * - Estimated remaining execution time
 * - Budget progress indicator
 */

import React, { useMemo } from 'react';
import { TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import { useOrchestratorMetrics } from '../../hooks';
import type {
  OrchestratorCostBurnRate,
  OrchestratorMetricsSnapshot,
} from '../../lib/types/orchestrator-metrics';

interface CostBurnRateProps {
  threadId?: string;
  className?: string;
}

/**
 * Format currency value in cents to readable string
 */
function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

/**
 * Format burn rate to readable string
 */
function formatBurnRate(ratePerSecond: number): string {
  if (ratePerSecond === 0) return '$0.00';

  const centPerSecond = ratePerSecond;
  if (centPerSecond < 0.01) {
    return `$${(centPerSecond * 3600).toFixed(4)}/hr`;
  }

  const centPerHour = centPerSecond * 3600;
  const dollars = centPerHour / 100;
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + '/hr';
}

/**
 * Format duration in minutes to readable string
 */
function formatDuration(minutes: number): string {
  if (minutes < 1) {
    return `${Math.round(minutes * 60)}s`;
  }
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = minutes / 60;
  const days = hours / 24;
  if (days >= 1) {
    return `${days.toFixed(1)}d`;
  }
  return `${hours.toFixed(1)}h`;
}

/**
 * Calculate budget health percentage (0-100)
 */
function calculateBudgetHealth(
  currentCostCents: number,
  estimatedBudgetRemaining: number
): number {
  const totalBudgetCents = currentCostCents + estimatedBudgetRemaining;
  if (totalBudgetCents === 0) return 100;
  return Math.max(0, Math.min(100, (estimatedBudgetRemaining / totalBudgetCents) * 100));
}

/**
 * Determine health color based on burn rate and remaining budget
 */
function getHealthColor(
  burnRatePerHour: number,
  estimatedRemainingMinutes: number | undefined
): 'success' | 'warning' | 'danger' {
  if (!estimatedRemainingMinutes || estimatedRemainingMinutes === undefined) {
    return 'success';
  }

  if (estimatedRemainingMinutes < 5) {
    return 'danger';
  }
  if (estimatedRemainingMinutes < 30) {
    return 'warning';
  }
  return 'success';
}

/**
 * Get color class for health status
 */
function getColorClass(color: 'success' | 'warning' | 'danger'): string {
  switch (color) {
    case 'success':
      return 'text-emerald-400';
    case 'warning':
      return 'text-yellow-400';
    case 'danger':
      return 'text-red-400';
  }
}

/**
 * Get background color for progress bar
 */
function getProgressBarColor(color: 'success' | 'warning' | 'danger'): string {
  switch (color) {
    case 'success':
      return 'bg-emerald-500/20 border-emerald-500/40';
    case 'warning':
      return 'bg-yellow-500/20 border-yellow-500/40';
    case 'danger':
      return 'bg-red-500/20 border-red-500/40';
  }
}

/**
 * Get fill color for progress bar
 */
function getProgressFillColor(color: 'success' | 'warning' | 'danger'): string {
  switch (color) {
    case 'success':
      return 'bg-emerald-500';
    case 'warning':
      return 'bg-yellow-500';
    case 'danger':
      return 'bg-red-500';
  }
}

export const CostBurnRate: React.FC<CostBurnRateProps> = ({
  threadId,
  className = '',
}) => {
  const metrics = useOrchestratorMetrics({ threadId });

  const {
    burnRate,
    currentMetrics,
    connectionStatus,
    error,
  } = metrics;

  // Compute derived values
  const computedValues = useMemo(() => {
    if (!burnRate || !currentMetrics) {
      return {
        healthColor: 'success' as const,
        budgetHealth: 100,
        hourlyRate: '$0.00/hr',
        minuteRate: '$0.00/min',
        estimatedTime: 'N/A',
        warningMessage: null,
      };
    }

    const health = getHealthColor(
      burnRate.burnRatePerHour,
      burnRate.estimatedRemainingMinutes
    );

    const budgetPercent = calculateBudgetHealth(
      currentMetrics.totalCostCents,
      currentMetrics.estimatedBudgetRemaining
    );

    return {
      healthColor: health,
      budgetHealth: budgetPercent,
      hourlyRate: formatBurnRate(burnRate.burnRatePerSecond),
      minuteRate: formatCurrency(burnRate.recentCostCents),
      estimatedTime: burnRate.estimatedRemainingMinutes
        ? formatDuration(burnRate.estimatedRemainingMinutes)
        : 'N/A',
      warningMessage:
        health === 'danger'
          ? 'Budget exhaustion imminent'
          : health === 'warning'
            ? 'High burn rate detected'
            : null,
    };
  }, [burnRate, currentMetrics]);

  // Loading state
  if (connectionStatus === 'connecting') {
    return (
      <div className={`card-glass p-6 rounded-lg border border-border-secondary/50 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-helix-400 opacity-50" />
            <h3 className="text-sm font-semibold text-text-secondary">Cost Burn Rate</h3>
          </div>
          <div className="animate-pulse">
            <div className="h-2 w-2 rounded-full bg-helix-500" />
          </div>
        </div>
        <div className="h-32 bg-bg-secondary/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  // Error state
  if (connectionStatus === 'error' || error) {
    return (
      <div className={`card-glass p-6 rounded-lg border border-border-secondary/50 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h3 className="text-sm font-semibold text-text-secondary">Cost Burn Rate</h3>
        </div>
        <p className="text-xs text-text-tertiary">
          {error || 'Failed to connect to metrics'}
        </p>
      </div>
    );
  }

  return (
    <div className={`card-glass p-6 rounded-lg border border-border-secondary/50 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className={`w-5 h-5 ${getColorClass(computedValues.healthColor)}`} />
          <h3 className="text-sm font-semibold text-text-secondary">Cost Burn Rate</h3>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded bg-bg-secondary/50 border border-border-secondary/50">
          <div
            className={`h-2 w-2 rounded-full animate-pulse ${
              computedValues.healthColor === 'success'
                ? 'bg-emerald-500'
                : computedValues.healthColor === 'warning'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
          />
          <span className="text-xs text-text-tertiary capitalize">
            {connectionStatus}
          </span>
        </div>
      </div>

      {/* Warning message */}
      {computedValues.warningMessage && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-300">{computedValues.warningMessage}</p>
        </div>
      )}

      {/* Main metrics grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Hourly rate */}
        <div className="bg-bg-secondary/30 rounded-lg p-4 border border-border-secondary/30">
          <p className="text-xs text-text-tertiary mb-2">Hourly Rate</p>
          <p className={`text-lg font-semibold ${getColorClass(computedValues.healthColor)}`}>
            {computedValues.hourlyRate}
          </p>
        </div>

        {/* Sample cost */}
        <div className="bg-bg-secondary/30 rounded-lg p-4 border border-border-secondary/30">
          <p className="text-xs text-text-tertiary mb-2">Recent Sample</p>
          <p className={`text-lg font-semibold ${getColorClass(computedValues.healthColor)}`}>
            {computedValues.minuteRate}
          </p>
        </div>
      </div>

      {/* Budget health bar */}
      {currentMetrics && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-text-tertiary">Budget Health</p>
            <p className="text-xs text-text-secondary">
              {formatCurrency(currentMetrics.estimatedBudgetRemaining)} remaining
            </p>
          </div>
          <div
            className={`h-2 rounded-full overflow-hidden border ${getProgressBarColor(
              computedValues.healthColor
            )}`}
          >
            <div
              className={`h-full transition-all duration-300 ${getProgressFillColor(
                computedValues.healthColor
              )}`}
              style={{ width: `${computedValues.budgetHealth}%` }}
            />
          </div>
        </div>
      )}

      {/* Estimated time remaining */}
      {burnRate && burnRate.estimatedRemainingMinutes !== undefined && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-bg-secondary/30 border border-border-secondary/30">
          <Clock className={`w-4 h-4 ${getColorClass(computedValues.healthColor)}`} />
          <div className="flex-1">
            <p className="text-xs text-text-tertiary">Estimated Runtime Remaining</p>
            <p className={`text-sm font-semibold ${getColorClass(computedValues.healthColor)}`}>
              {computedValues.estimatedTime}
            </p>
          </div>
        </div>
      )}

      {/* Statistics footer */}
      {burnRate && (
        <div className="mt-4 pt-4 border-t border-border-secondary/30 grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="text-xs text-text-tertiary mb-1">Per Minute</p>
            <p className="text-xs font-semibold text-text-secondary">
              ${(burnRate.burnRatePerMinute).toFixed(6)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-text-tertiary mb-1">Per Second</p>
            <p className="text-xs font-semibold text-text-secondary">
              ${(burnRate.burnRatePerSecond).toFixed(8)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-text-tertiary mb-1">Samples</p>
            <p className="text-xs font-semibold text-text-secondary">{burnRate.samplesUsed}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostBurnRate;
