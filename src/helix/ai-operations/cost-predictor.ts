/**
 * Cost Predictor - Phase 5
 *
 * Predicts operation costs, detects anomalies, and monitors budget usage.
 */

export interface OperationStats {
  operationType: string;
  count: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
}

const ANOMALY_THRESHOLD_SIGMA = 2; // 2 standard deviations
const BUDGET_ALERT_THRESHOLDS = [0.5, 0.75, 0.9, 0.99];

export class CostPredictor {
  private operationCosts: Map<string, number[]> = new Map();
  private dailySpend = 0;
  private lastAlertThreshold = 0;

  /**
   * Record a cost observation for an operation type
   */
  recordCost(operationType: string, costUsd: number): void {
    if (!this.operationCosts.has(operationType)) {
      this.operationCosts.set(operationType, []);
    }

    this.operationCosts.get(operationType)!.push(costUsd);
    this.dailySpend += costUsd;
  }

  /**
   * Get statistics for an operation type
   */
  getOperationStats(operationType: string): OperationStats | null {
    const costs = this.operationCosts.get(operationType);
    if (!costs || costs.length === 0) {
      return null;
    }

    const count = costs.length;
    const mean = costs.reduce((a, b) => a + b, 0) / count;
    const variance = costs.reduce((sum, cost) => sum + Math.pow(cost - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...costs);
    const max = Math.max(...costs);

    return {
      operationType,
      count,
      mean,
      stdDev,
      min,
      max,
    };
  }

  /**
   * Predict cost for an operation with variance factor
   */
  predictCost(operationType: string): number {
    const stats = this.getOperationStats(operationType);
    if (!stats) {
      return 0;
    }

    // Predicted cost = mean + (1 std dev)
    return stats.mean + stats.stdDev;
  }

  /**
   * Detect if a cost is anomalous (>2 std devs from mean)
   */
  isAnomaly(operationType: string, costUsd: number): boolean {
    const stats = this.getOperationStats(operationType);
    if (!stats || stats.stdDev === 0) {
      return false;
    }

    const zScore = Math.abs((costUsd - stats.mean) / stats.stdDev);
    return zScore > ANOMALY_THRESHOLD_SIGMA;
  }

  /**
   * Get daily spend so far
   */
  getDailySpend(): number {
    return this.dailySpend;
  }

  /**
   * Calculate budget usage as percentage
   */
  getBudgetUsagePercent(dailyBudgetUsd: number): number {
    return (this.dailySpend / dailyBudgetUsd) * 100;
  }

  /**
   * Check if should alert at budget threshold
   */
  shouldAlertBudget(dailyBudgetUsd: number): boolean {
    const usagePercent = this.getBudgetUsagePercent(dailyBudgetUsd);
    const usageRatio = usagePercent / 100;

    for (const threshold of BUDGET_ALERT_THRESHOLDS) {
      if (usageRatio >= threshold && this.lastAlertThreshold < threshold) {
        this.lastAlertThreshold = threshold;
        return true;
      }
    }

    return false;
  }

  /**
   * Reset daily spend (call at midnight UTC)
   */
  resetDailySpend(): void {
    this.dailySpend = 0;
    this.lastAlertThreshold = 0;
  }
}
