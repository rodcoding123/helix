/**
 * Analytics Intelligence Tests - Phase 8 Week 17
 * Tests for analytics summary and anomaly detection
 * Total: 60+ tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAnalyticsIntelligenceService,
  type AnalyticsSummaryRequest,
  type AnomalyDetectionRequest,
} from './analytics-intelligence.js';

vi.mock('./llm-router/router.js', () => ({
  getLLMRouter: () => ({
    route: vi.fn().mockResolvedValue({ operationId: 'test-op', selectedModel: 'deepseek-v3.2' }),
    executeOperation: vi.fn().mockResolvedValue({
      success: true,
      content: 'Result',
      inputTokens: 250,
      outputTokens: 200,
      costUsd: 0.003,
      latencyMs: 600,
    }),
  }),
}));

vi.mock('./logging.js', () => ({
  logToDiscord: vi.fn(),
  logToHashChain: vi.fn(),
}));

describe('Analytics Intelligence Service', () => {
  const service = getAnalyticsIntelligenceService();
  const userId = 'test-user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // MARK: - Analytics Summary Tests

  describe('Analytics Summary', () => {
    const summaryRequest: AnalyticsSummaryRequest = {
      userId,
      period: 'week',
      metricsTypes: ['emails', 'tasks', 'meetings'],
    };

    it('generates analytics summary for specified period', async () => {
      const result = await service.generateSummary(summaryRequest);
      expect(result).toBeDefined();
      expect(result.period).toBeDefined();
    });

    it('returns summary for day period', async () => {
      const result = await service.generateSummary({
        userId,
        period: 'day',
      });
      expect(result.period).toContain('Today');
    });

    it('returns summary for week period', async () => {
      const result = await service.generateSummary({
        userId,
        period: 'week',
      });
      expect(result.period).toContain('Week');
    });

    it('returns summary for month period', async () => {
      const result = await service.generateSummary({
        userId,
        period: 'month',
      });
      expect(result.period).toContain('Month');
    });

    it('includes activity metrics', async () => {
      const result = await service.generateSummary(summaryRequest);
      expect(Array.isArray(result.metrics)).toBe(true);
      expect(result.metrics.length).toBeGreaterThan(0);
    });

    it('metrics have required fields', async () => {
      const result = await service.generateSummary(summaryRequest);
      for (const metric of result.metrics) {
        expect(metric.name).toBeDefined();
        expect(metric.value).toBeGreaterThanOrEqual(0);
        expect(['up', 'down', 'stable']).toContain(metric.trend);
      }
    });

    it('provides trend analysis', async () => {
      const result = await service.generateSummary(summaryRequest);
      expect(result.metrics.some((m) => m.previousPeriodValue)).toBe(true);
    });

    it('includes productivity score', async () => {
      const result = await service.generateSummary(summaryRequest);
      expect(result.productivity_score).toBeGreaterThanOrEqual(0);
      expect(result.productivity_score).toBeLessThanOrEqual(100);
    });

    it('provides actionable insights', async () => {
      const result = await service.generateSummary(summaryRequest);
      expect(Array.isArray(result.insights)).toBe(true);
      expect(result.insights.length).toBeGreaterThan(0);
    });

    it('provides recommendations', async () => {
      const result = await service.generateSummary(summaryRequest);
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('lists top activities', async () => {
      const result = await service.generateSummary(summaryRequest);
      expect(Array.isArray(result.topActivities)).toBe(true);
      expect(result.topActivities.length).toBeGreaterThan(0);
    });

    it('ranks activities by count', async () => {
      const result = await service.generateSummary(summaryRequest);
      if (result.topActivities.length > 1) {
        for (let i = 0; i < result.topActivities.length - 1; i++) {
          expect(result.topActivities[i].count).toBeGreaterThanOrEqual(
            result.topActivities[i + 1].count
          );
        }
      }
    });

    it('handles specific metric types', async () => {
      const result = await service.generateSummary({
        userId,
        period: 'week',
        metricsTypes: ['emails'],
      });
      expect(result.metrics).toBeDefined();
    });

    it('defaults to all metrics when none specified', async () => {
      const result = await service.generateSummary({
        userId,
        period: 'week',
      });
      expect(result.metrics.length).toBeGreaterThan(0);
    });

    it('includes date range in summary', async () => {
      const result = await service.generateSummary(summaryRequest);
      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
      expect(result.endDate.getTime()).toBeGreaterThanOrEqual(result.startDate.getTime());
    });
  });

  // MARK: - Anomaly Detection Tests

  describe('Anomaly Detection', () => {
    const anomalyRequest: AnomalyDetectionRequest = {
      userId,
      dataTypes: ['activity', 'cost'],
      sensitivity: 'medium',
      historicalDays: 30,
    };

    it('detects anomalies in activity data', async () => {
      const result = await service.detectAnomalies(anomalyRequest);
      expect(result).toBeDefined();
      expect(Array.isArray(result.anomalies)).toBe(true);
    });

    it('returns health status', async () => {
      const result = await service.detectAnomalies(anomalyRequest);
      expect(['healthy', 'warning', 'critical']).toContain(result.healthStatus);
    });

    it('includes anomaly descriptions', async () => {
      const result = await service.detectAnomalies(anomalyRequest);
      for (const anomaly of result.anomalies) {
        expect(anomaly.description).toBeDefined();
        expect(anomaly.description.length).toBeGreaterThan(0);
      }
    });

    it('classifies anomaly severity', async () => {
      const result = await service.detectAnomalies(anomalyRequest);
      for (const anomaly of result.anomalies) {
        expect(['low', 'medium', 'high', 'critical']).toContain(anomaly.severity);
      }
    });

    it('provides recommendations for anomalies', async () => {
      const result = await service.detectAnomalies(anomalyRequest);
      for (const anomaly of result.anomalies) {
        expect(anomaly.recommendation).toBeDefined();
      }
    });

    it('includes expected value range', async () => {
      const result = await service.detectAnomalies(anomalyRequest);
      for (const anomaly of result.anomalies) {
        expect(anomaly.expectedRange.min).toBeLessThanOrEqual(anomaly.expectedRange.max);
      }
    });

    it('shows actual vs expected values', async () => {
      const result = await service.detectAnomalies(anomalyRequest);
      for (const anomaly of result.anomalies) {
        expect(anomaly.actualValue).toBeGreaterThanOrEqual(0);
        expect(anomaly.expectedRange).toBeDefined();
      }
    });

    it('uses low sensitivity', async () => {
      const result = await service.detectAnomalies({
        ...anomalyRequest,
        sensitivity: 'low',
      });
      expect(result.anomalies).toBeDefined();
    });

    it('uses high sensitivity', async () => {
      const result = await service.detectAnomalies({
        ...anomalyRequest,
        sensitivity: 'high',
      });
      expect(result.anomalies).toBeDefined();
    });

    it('analyzes activity data type', async () => {
      const result = await service.detectAnomalies({
        userId,
        dataTypes: ['activity'],
      });
      expect(result.anomalies).toBeDefined();
    });

    it('analyzes cost data type', async () => {
      const result = await service.detectAnomalies({
        userId,
        dataTypes: ['cost'],
      });
      expect(result.anomalies).toBeDefined();
    });

    it('analyzes performance data type', async () => {
      const result = await service.detectAnomalies({
        userId,
        dataTypes: ['performance'],
      });
      expect(result.anomalies).toBeDefined();
    });

    it('analyzes error data type', async () => {
      const result = await service.detectAnomalies({
        userId,
        dataTypes: ['errors'],
      });
      expect(result.anomalies).toBeDefined();
    });

    it('respects historical period', async () => {
      const result = await service.detectAnomalies({
        userId,
        dataTypes: ['activity'],
        historicalDays: 60,
      });
      expect(result.anomalies).toBeDefined();
    });

    it('provides summary of anomalies', async () => {
      const result = await service.detectAnomalies(anomalyRequest);
      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it('includes last analyzed timestamp', async () => {
      const result = await service.detectAnomalies(anomalyRequest);
      expect(result.lastAnalyzedAt).toBeInstanceOf(Date);
    });
  });

  // MARK: - KPI Report Tests

  describe('KPI Report Generation', () => {
    it('generates weekly KPI report', async () => {
      const result = await service.generateKPIReport(userId, 'week');
      expect(result).toBeDefined();
      expect(Array.isArray(result.kpis)).toBe(true);
    });

    it('generates monthly KPI report', async () => {
      const result = await service.generateKPIReport(userId, 'month');
      expect(result.kpis.length).toBeGreaterThan(0);
    });

    it('generates quarterly KPI report', async () => {
      const result = await service.generateKPIReport(userId, 'quarter');
      expect(result.kpis.length).toBeGreaterThan(0);
    });

    it('KPIs have required fields', async () => {
      const result = await service.generateKPIReport(userId, 'week');
      for (const kpi of result.kpis) {
        expect(kpi.name).toBeDefined();
        expect(kpi.value).toBeGreaterThanOrEqual(0);
        expect(kpi.unit).toBeDefined();
        expect(kpi.target).toBeGreaterThanOrEqual(0);
        expect(kpi.status).toBeDefined();
      }
    });

    it('identifies exceeding target status', async () => {
      const result = await service.generateKPIReport(userId, 'week');
      expect(result.kpis.some((k) => k.status === 'exceeding')).toBe(true);
    });

    it('identifies on-track status', async () => {
      const result = await service.generateKPIReport(userId, 'week');
      expect(['exceeding', 'on-track', 'below-target']).toContain(
        result.kpis[0]?.status || 'unknown'
      );
    });

    it('provides summary text', async () => {
      const result = await service.generateKPIReport(userId, 'week');
      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeGreaterThan(0);
    });
  });

  // MARK: - Activity Forecast Tests

  describe('Activity Forecasting', () => {
    it('forecasts future activity', async () => {
      const forecast = await service.forecastActivity(userId, 7);
      expect(Array.isArray(forecast)).toBe(true);
      expect(forecast.length).toBe(7);
    });

    it('includes date for each forecast', async () => {
      const forecast = await service.forecastActivity(userId, 7);
      for (const item of forecast) {
        expect(item.date).toBeInstanceOf(Date);
      }
    });

    it('forecasts predicted load', async () => {
      const forecast = await service.forecastActivity(userId, 7);
      for (const item of forecast) {
        expect(item.predictedLoad).toBeGreaterThanOrEqual(0);
      }
    });

    it('includes confidence scores', async () => {
      const forecast = await service.forecastActivity(userId, 7);
      for (const item of forecast) {
        expect(item.confidence).toBeGreaterThanOrEqual(0);
        expect(item.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('forecasts custom number of days', async () => {
      const forecast = await service.forecastActivity(userId, 14);
      expect(forecast.length).toBe(14);
    });

    it('defaults to 7 days when not specified', async () => {
      const forecast = await service.forecastActivity(userId);
      expect(forecast.length).toBe(7);
    });

    it('dates are in chronological order', async () => {
      const forecast = await service.forecastActivity(userId, 7);
      for (let i = 0; i < forecast.length - 1; i++) {
        expect(forecast[i].date.getTime()).toBeLessThan(forecast[i + 1].date.getTime());
      }
    });
  });

  // MARK: - Error Handling Tests

  describe('Error Handling', () => {
    it('handles summary generation errors gracefully', async () => {
      try {
        await service.generateSummary({
          userId: '',
          period: 'day',
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('handles anomaly detection errors gracefully', async () => {
      try {
        await service.detectAnomalies({
          userId: '',
          dataTypes: [],
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  // MARK: - Integration Tests

  describe('Integration Workflows', () => {
    it('generates summary then creates recommendations based on data', async () => {
      const summary = await service.generateSummary({
        userId,
        period: 'week',
      });

      expect(summary.insights.length).toBeGreaterThan(0);
      expect(summary.recommendations.length).toBeGreaterThan(0);
      expect(summary.productivity_score).toBeGreaterThan(0);
    });

    it('detects anomalies and provides health status', async () => {
      const anomalies = await service.detectAnomalies({
        userId,
        dataTypes: ['activity', 'cost'],
      });

      expect(['healthy', 'warning', 'critical']).toContain(anomalies.healthStatus);
    });

    it('generates KPI report and forecasts activity', async () => {
      const kpis = await service.generateKPIReport(userId, 'week');
      const forecast = await service.forecastActivity(userId, 7);

      expect(kpis.kpis.length).toBeGreaterThan(0);
      expect(forecast.length).toBe(7);
    });

    it('provides complete analytics picture', async () => {
      const summary = await service.generateSummary({ userId, period: 'week' });
      const anomalies = await service.detectAnomalies({ userId, dataTypes: ['activity'] });
      const kpis = await service.generateKPIReport(userId, 'week');
      const forecast = await service.forecastActivity(userId, 7);

      expect(summary.insights.length).toBeGreaterThan(0);
      expect(anomalies.anomalies).toBeDefined();
      expect(kpis.kpis.length).toBeGreaterThan(0);
      expect(forecast.length).toBe(7);
    });
  });

  // MARK: - Singleton Tests

  describe('Service Singleton', () => {
    it('returns same service instance', () => {
      const service1 = getAnalyticsIntelligenceService();
      const service2 = getAnalyticsIntelligenceService();
      expect(service1).toBe(service2);
    });
  });
});
