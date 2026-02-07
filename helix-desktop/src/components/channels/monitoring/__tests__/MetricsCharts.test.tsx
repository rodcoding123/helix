/**
 * Metrics Charts Component Tests
 *
 * Tests chart rendering and calculations
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MetricsCharts } from '../MetricsCharts';

interface ChannelMetrics {
  channel: string;
  timestamp: number;
  messagesReceived: number;
  messagesSent: number;
  messagesFailed: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
}

describe('MetricsCharts', () => {
  it('should render empty state', () => {
    const { container } = render(<MetricsCharts channel="whatsapp" history={[]} />);
    expect(container.querySelector('.metrics-empty')).toBeTruthy();
  });

  it('should render with data', () => {
    const metrics: ChannelMetrics[] = [
      {
        channel: 'whatsapp',
        timestamp: Date.now(),
        messagesReceived: 100,
        messagesSent: 95,
        messagesFailed: 2,
        avgLatencyMs: 150,
        p95LatencyMs: 350,
        p99LatencyMs: 500,
      },
    ];

    const { container } = render(
      <MetricsCharts channel="whatsapp" history={metrics} />
    );
    expect(container.querySelector('.metrics-charts')).toBeTruthy();
  });

  it('should have statistics row', () => {
    const metrics: ChannelMetrics[] = [
      {
        channel: 'telegram',
        timestamp: Date.now(),
        messagesReceived: 50,
        messagesSent: 48,
        messagesFailed: 1,
        avgLatencyMs: 100,
        p95LatencyMs: 250,
        p99LatencyMs: 300,
      },
    ];

    const { container } = render(
      <MetricsCharts channel="telegram" history={metrics} />
    );
    expect(container.querySelector('.metrics-stats-row')).toBeTruthy();
  });

  it('should have chart sections', () => {
    const metrics: ChannelMetrics[] = [
      {
        channel: 'discord',
        timestamp: Date.now(),
        messagesReceived: 75,
        messagesSent: 72,
        messagesFailed: 0,
        avgLatencyMs: 120,
        p95LatencyMs: 300,
        p99LatencyMs: 400,
      },
    ];

    const { container } = render(
      <MetricsCharts channel="discord" history={metrics} />
    );

    const chartSections = container.querySelectorAll('.metrics-chart-section');
    expect(chartSections.length).toBeGreaterThan(0);
  });

  it('should have legend', () => {
    const metrics: ChannelMetrics[] = [
      {
        channel: 'slack',
        timestamp: Date.now(),
        messagesReceived: 100,
        messagesSent: 95,
        messagesFailed: 2,
        avgLatencyMs: 150,
        p95LatencyMs: 350,
        p99LatencyMs: 500,
      },
    ];

    const { container } = render(
      <MetricsCharts channel="slack" history={metrics} />
    );
    expect(container.querySelector('.metrics-legend')).toBeTruthy();
  });

  it('should handle single data point', () => {
    const metrics: ChannelMetrics[] = [
      {
        channel: 'signal',
        timestamp: Date.now(),
        messagesReceived: 1,
        messagesSent: 1,
        messagesFailed: 0,
        avgLatencyMs: 100,
        p95LatencyMs: 100,
        p99LatencyMs: 100,
      },
    ];

    expect(() => {
      render(<MetricsCharts channel="signal" history={metrics} />);
    }).not.toThrow();
  });

  it('should handle large dataset', () => {
    const metrics: ChannelMetrics[] = Array.from({ length: 100 }, (_, i) => ({
      channel: 'line',
      timestamp: Date.now() + i * 1000,
      messagesReceived: Math.floor(Math.random() * 100),
      messagesSent: Math.floor(Math.random() * 100),
      messagesFailed: Math.floor(Math.random() * 10),
      avgLatencyMs: Math.random() * 1000,
      p95LatencyMs: Math.random() * 2000,
      p99LatencyMs: Math.random() * 3000,
    }));

    expect(() => {
      render(<MetricsCharts channel="line" history={metrics} />);
    }).not.toThrow();
  });

  it('should render quickly', () => {
    const metrics: ChannelMetrics[] = [
      {
        channel: 'whatsapp',
        timestamp: Date.now(),
        messagesReceived: 100,
        messagesSent: 95,
        messagesFailed: 0,
        avgLatencyMs: 150,
        p95LatencyMs: 350,
        p99LatencyMs: 500,
      },
    ];

    const start = performance.now();
    render(<MetricsCharts channel="whatsapp" history={metrics} />);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(500);
  });

  it('should handle zero failures', () => {
    const metrics: ChannelMetrics[] = [
      {
        channel: 'teams',
        timestamp: Date.now(),
        messagesReceived: 100,
        messagesSent: 100,
        messagesFailed: 0,
        avgLatencyMs: 150,
        p95LatencyMs: 350,
        p99LatencyMs: 500,
      },
    ];

    const { container } = render(
      <MetricsCharts channel="teams" history={metrics} />
    );
    expect(container.querySelector('.metrics-charts')).toBeTruthy();
  });

  it('should handle high latency', () => {
    const metrics: ChannelMetrics[] = [
      {
        channel: 'whatsapp',
        timestamp: Date.now(),
        messagesReceived: 50,
        messagesSent: 45,
        messagesFailed: 0,
        avgLatencyMs: 3000,
        p95LatencyMs: 5000,
        p99LatencyMs: 6000,
      },
    ];

    const { container } = render(
      <MetricsCharts channel="whatsapp" history={metrics} />
    );
    expect(container.querySelector('.metrics-charts')).toBeTruthy();
  });
});
