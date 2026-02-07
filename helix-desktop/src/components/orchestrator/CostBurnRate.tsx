/**
 * Cost Burn Rate Visualization
 *
 * Real-time display of cost burn rate in $/hour and $/minute.
 * Shows budget remaining and estimated time to exhaustion.
 * 
 * Features:
 * - Real-time updates from WebSocket
 * - Budget progress bar with percentage
 * - Trend indicator (up/down/stable)
 * - Time remaining estimate
 */

import { useMemo } from 'react';
import { useOrchestratorMetrics } from '../../hooks/useOrchestratorMetrics';
import './CostBurnRate.css';

interface CostBurnRateProps {
  threadId: string;
}

function formatUSD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 0) return 'N/A';
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export function CostBurnRate({ threadId }: CostBurnRateProps) {
  const { metrics, costBurnRate, isLoading, error } = useOrchestratorMetrics(threadId);

  const trendIndicator = useMemo(() => {
    if (!costBurnRate) return null;
    const trend = costBurnRate.costTrendPercentage;
    
    if (trend > 5) return { icon: '📈', label: 'Increasing', color: 'alert' };
    if (trend > 0) return { icon: '📊', label: 'Stable', color: 'info' };
    return { icon: '📉', label: 'Decreasing', color: 'success' };
  }, [costBurnRate]);

  if (isLoading) {
    return <div className="cost-burn-loading">Loading metrics...</div>;
  }

  if (error) {
    return <div className="cost-burn-error">Error: {error}</div>;
  }

  if (!metrics || !costBurnRate) {
    return <div className="cost-burn-empty">No metrics available</div>;
  }

  return (
    <div className="cost-burn-rate">
      <div className="cbr-header">
        <h3>💰 Cost Burn Rate</h3>
        {trendIndicator && (
          <span className={`cbr-trend cbr-trend--${trendIndicator.color}`}>
            {trendIndicator.icon} {trendIndicator.label}
          </span>
        )}
      </div>

      <div className="cbr-grid">
        {/* Burn Rate Metrics */}
        <div className="cbr-metric">
          <div className="cbr-metric__label">Per Hour</div>
          <div className="cbr-metric__value">
            {formatUSD(Math.round(costBurnRate.burnRatePerHour * 100))}
          </div>
          <div className="cbr-metric__hint">hourly cost</div>
        </div>

        <div className="cbr-metric">
          <div className="cbr-metric__label">Per Minute</div>
          <div className="cbr-metric__value">
            {formatUSD(Math.round(costBurnRate.burnRatePerMinute * 100))}
          </div>
          <div className="cbr-metric__hint">per-message average</div>
        </div>

        <div className="cbr-metric">
          <div className="cbr-metric__label">Budget Used</div>
          <div className="cbr-metric__value">{metrics.percentBudgetUsed}%</div>
          <div className="cbr-metric__hint">
            {formatUSD(metrics.costCents)} of {formatUSD(metrics.costCents + metrics.budgetRemainingCents)}
          </div>
        </div>

        <div className="cbr-metric">
          <div className="cbr-metric__label">Time Remaining</div>
          <div className="cbr-metric__value">
            {formatDuration(costBurnRate.estimatedMinutesRemaining)}
          </div>
          <div className="cbr-metric__hint">until budget exhausted</div>
        </div>
      </div>

      {/* Budget Progress Bar */}
      <div className="cbr-progress">
        <div className="cbr-progress__label">Budget Remaining</div>
        <div className="cbr-progress__bar-container">
          <div
            className="cbr-progress__bar"
            style={{ width: `${metrics.percentBudgetUsed}%` }}
          />
        </div>
        <div className="cbr-progress__info">
          <span>{formatUSD(metrics.budgetRemainingCents)}</span>
          <span>{100 - metrics.percentBudgetUsed}% remaining</span>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="cbr-status">
        {costBurnRate.estimatedMinutesRemaining < 60 && costBurnRate.estimatedMinutesRemaining > 0 && (
          <div className="cbr-status__warning">
            ⚠️ Budget running low - approximately {formatDuration(costBurnRate.estimatedMinutesRemaining)} remaining
          </div>
        )}
        {costBurnRate.estimatedMinutesRemaining <= 0 && (
          <div className="cbr-status__critical">
            🚨 Budget exhausted
          </div>
        )}
      </div>
    </div>
  );
}
