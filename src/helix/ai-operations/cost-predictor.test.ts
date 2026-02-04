import { describe, it, expect, beforeEach } from 'vitest';
import { CostPredictor } from './cost-predictor.js';

describe('CostPredictor', () => {
  let predictor: CostPredictor;

  beforeEach(() => {
    predictor = new CostPredictor();
  });

  describe('Cost Estimation', () => {
    it('records historical costs', () => {
      predictor.recordCost('email_analysis', 0.005);
      predictor.recordCost('email_analysis', 0.006);
      predictor.recordCost('email_analysis', 0.004);

      const stats = predictor.getOperationStats('email_analysis');
      expect(stats?.count).toBe(3);
      expect(stats?.mean).toBeCloseTo(0.005);
    });

    it('calculates mean cost', () => {
      predictor.recordCost('tts', 0.01);
      predictor.recordCost('tts', 0.02);
      predictor.recordCost('tts', 0.03);

      const stats = predictor.getOperationStats('tts');
      expect(stats?.mean).toBeCloseTo(0.02);
    });

    it('calculates standard deviation', () => {
      predictor.recordCost('video', 0.1);
      predictor.recordCost('video', 0.1);
      predictor.recordCost('video', 0.1);

      const stats = predictor.getOperationStats('video');
      expect(stats?.stdDev).toBeCloseTo(0);
    });

    it('predicts cost with variance factor', () => {
      // Add some variance
      for (let i = 0; i < 10; i++) {
        predictor.recordCost('audio', 0.001 + Math.random() * 0.002);
      }

      const predicted = predictor.predictCost('audio');
      expect(predicted).toBeGreaterThan(0);
    });
  });

  describe('Anomaly Detection', () => {
    it('detects cost anomalies', () => {
      for (let i = 0; i < 10; i++) {
        predictor.recordCost('email_analysis', 0.005);
      }

      // Normal cost (within 2 std devs)
      const normal = predictor.isAnomaly('email_analysis', 0.005);
      expect(normal).toBe(false);

      // Anomaly (way above)
      const anomaly = predictor.isAnomaly('email_analysis', 0.05);
      expect(anomaly).toBe(true);
    });
  });

  describe('Budget Alerts', () => {
    it('tracks daily spend', () => {
      predictor.recordCost('email_analysis', 10);
      predictor.recordCost('tts', 20);

      const dailySpend = predictor.getDailySpend();
      expect(dailySpend).toBe(30);
    });

    it('calculates budget usage percentage', () => {
      predictor.recordCost('email_analysis', 50);

      const usage = predictor.getBudgetUsagePercent(100);
      expect(usage).toBe(50);
    });

    it('alerts at threshold levels', () => {
      const alerts: string[] = [];

      predictor.recordCost('email_analysis', 25);
      let shouldAlert = predictor.shouldAlertBudget(100);
      if (shouldAlert) alerts.push('50%');

      predictor.recordCost('email_analysis', 26);
      shouldAlert = predictor.shouldAlertBudget(100);
      if (shouldAlert) alerts.push('75%');

      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  describe('Daily Reset', () => {
    it('resets daily spend', () => {
      predictor.recordCost('email_analysis', 50);
      expect(predictor.getDailySpend()).toBe(50);

      predictor.resetDailySpend();
      expect(predictor.getDailySpend()).toBe(0);
    });
  });
});
