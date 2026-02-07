/**
 * Channel Monitoring Dashboard Tests
 *
 * Tests component structure and props handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ChannelMonitoringDashboard } from '../ChannelMonitoringDashboard';

// Mock useGateway hook
vi.mock('../../../hooks/useGateway', () => ({
  useGateway: () => ({
    getClient: () => ({
      connected: true,
      request: vi.fn().mockResolvedValue({ ok: true }),
    }),
    connected: true,
  }),
}));

describe('ChannelMonitoringDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without errors', () => {
    expect(() => {
      render(<ChannelMonitoringDashboard />);
    }).not.toThrow();
  });

  it('should have dashboard container', () => {
    const { container } = render(<ChannelMonitoringDashboard />);
    expect(container.querySelector('.cmd-dashboard')).toBeTruthy();
  });

  it('should have header section', () => {
    const { container } = render(<ChannelMonitoringDashboard />);
    expect(container.querySelector('.cmd-header')).toBeTruthy();
  });

  it('should have tabs navigation', () => {
    const { container } = render(<ChannelMonitoringDashboard />);
    expect(container.querySelector('.cmd-tabs')).toBeTruthy();
  });

  it('should have tab content area', () => {
    const { container } = render(<ChannelMonitoringDashboard />);
    expect(container.querySelector('.cmd-tab-content')).toBeTruthy();
  });

  it('should accept selectedChannel prop', () => {
    const { container } = render(
      <ChannelMonitoringDashboard selectedChannel="telegram" />
    );
    expect(container.querySelector('.cmd-dashboard')).toBeTruthy();
  });

  it('should accept onChannelSelect callback', () => {
    const callback = vi.fn();
    const { container } = render(
      <ChannelMonitoringDashboard onChannelSelect={callback} />
    );
    expect(container.querySelector('.cmd-dashboard')).toBeTruthy();
  });

  it('should have select dropdown', () => {
    const { container } = render(<ChannelMonitoringDashboard />);
    expect(container.querySelector('select')).toBeTruthy();
  });

  it('should have refresh button', () => {
    const { container } = render(<ChannelMonitoringDashboard />);
    expect(container.querySelectorAll('button').length).toBeGreaterThan(0);
  });

  it('should render quickly', () => {
    const start = performance.now();
    render(<ChannelMonitoringDashboard />);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(1000);
  });
});
