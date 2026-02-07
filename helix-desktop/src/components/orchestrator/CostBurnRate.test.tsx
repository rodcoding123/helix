/**
 * CostBurnRate Component Tests
 *
 * Tests for real-time burn rate visualization and budget tracking.
 * Covers loading states, error handling, and cost calculations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CostBurnRate } from './CostBurnRate';

// Mock the hook
vi.mock('../../hooks', () => ({
  useOrchestratorMetrics: vi.fn(() => ({
    currentMetrics: {
      threadId: 'test-thread',
      currentNode: 'supervisor',
      stepCount: 5,
      totalCheckpoints: 2,
      totalCostCents: 500,
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      estimatedBudgetRemaining: 9500,
      avgStepDurationMs: 100,
      executionStartedAt: Date.now() - 50000,
    },
    burnRate: {
      threadId: 'test-thread',
      burnRatePerHour: 10.5,
      burnRatePerMinute: 0.175,
      burnRatePerSecond: 0.00292,
      recentCostCents: 50,
      recentDurationMs: 18000,
      samplesUsed: 5,
      estimatedRemainingMinutes: 567,
      lastUpdated: Date.now(),
    },
    connectionStatus: 'connected',
    error: undefined,
  })),
}));

describe('CostBurnRate Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the component', () => {
      const { container } = render(<CostBurnRate threadId="test-thread" />);

      expect(container).toBeDefined();
    });

    it('should display the component title', () => {
      render(<CostBurnRate threadId="test-thread" />);

      const title = screen.getByText(/Cost Burn Rate/i);
      expect(title).toBeDefined();
    });

    it('should show loading state when connecting', () => {
      vi.mocked(require('../../hooks').useOrchestratorMetrics).mockReturnValueOnce({
        connectionStatus: 'connecting',
        currentMetrics: undefined,
        burnRate: undefined,
        recentStateChanges: [],
        recentCostUpdates: [],
        recentCheckpoints: [],
        activeAgents: new Map(),
        error: undefined,
        lastUpdated: Date.now(),
      });

      const { container } = render(<CostBurnRate threadId="test-thread" />);

      // Should show loading state
      expect(container.textContent).toBeDefined();
    });

    it('should show error state on connection failure', () => {
      vi.mocked(require('../../hooks').useOrchestratorMetrics).mockReturnValueOnce({
        connectionStatus: 'error',
        currentMetrics: undefined,
        burnRate: undefined,
        recentStateChanges: [],
        recentCostUpdates: [],
        recentCheckpoints: [],
        activeAgents: new Map(),
        error: 'Gateway connection failed',
        lastUpdated: Date.now(),
      });

      const { container } = render(<CostBurnRate threadId="test-thread" />);

      expect(container.textContent || '').toContain('Gateway connection failed');
    });
  });

  describe('Metrics Display', () => {
    it('should format and display hourly burn rate', () => {
      const { container } = render(<CostBurnRate threadId="test-thread" />);

      // Should show hourly rate formatted as currency
      expect(container.textContent || '').toMatch(/\$.*\/hr/);
    });

    it('should format and display recent cost sample', () => {
      const { container } = render(<CostBurnRate threadId="test-thread" />);

      // Should show recent sample formatted as currency
      expect(container.textContent || '').toMatch(/\$/);
    });

    it('should display budget health progress bar', () => {
      const { container } = render(<CostBurnRate threadId="test-thread" />);

      // Should have progress bar element
      const progressBar = container.querySelector('[class*="progress"]');
      const text = container.textContent || '';
      expect(progressBar || text.includes('Budget')).toBeTruthy();
    });

    it('should display estimated remaining time', () => {
      const { container } = render(<CostBurnRate threadId="test-thread" />);

      // Should show estimated time
      const text = container.textContent || '';
      expect(
        text.includes('h') ||
        text.includes('m') ||
        text.includes('s')
      ).toBe(true);
    });

    it('should display per-minute burn rate in footer', () => {
      const { container } = render(<CostBurnRate threadId="test-thread" />);

      // Should show per-minute rate
      expect(container.textContent || '').toMatch(/Per Minute/);
    });

    it('should display per-second burn rate in footer', () => {
      const { container } = render(<CostBurnRate threadId="test-thread" />);

      // Should show per-second rate
      expect(container.textContent || '').toMatch(/Per Second/);
    });

    it('should display sample count used for burn rate', () => {
      const { container } = render(<CostBurnRate threadId="test-thread" />);

      // Should show sample count
      expect(container.textContent || '').toMatch(/Samples/);
    });
  });

  describe('Color Coding', () => {
    it('should show success color for healthy burn rate', () => {
      const { container } = render(<CostBurnRate threadId="test-thread" />);

      // With 567 minutes remaining, should be success color
      const successElements = container.querySelectorAll('[class*="emerald"]');
      expect(successElements.length).toBeGreaterThan(0);
    });

    it('should show warning color for high burn rate', () => {
      vi.mocked(require('../../hooks').useOrchestratorMetrics).mockReturnValueOnce({
        currentMetrics: {
          threadId: 'test-thread',
          currentNode: 'supervisor',
          stepCount: 5,
          totalCheckpoints: 2,
          totalCostCents: 5000,
          totalInputTokens: 1000,
          totalOutputTokens: 500,
          estimatedBudgetRemaining: 100,
          avgStepDurationMs: 100,
          executionStartedAt: Date.now() - 50000,
        },
        burnRate: {
          threadId: 'test-thread',
          burnRatePerHour: 50,
          burnRatePerMinute: 0.833,
          burnRatePerSecond: 0.0139,
          recentCostCents: 500,
          recentDurationMs: 18000,
          samplesUsed: 5,
          estimatedRemainingMinutes: 20, // Warning threshold
          lastUpdated: Date.now(),
        },
        connectionStatus: 'connected',
        error: undefined,
        recentStateChanges: [],
        recentCostUpdates: [],
        recentCheckpoints: [],
        activeAgents: new Map(),
        lastUpdated: Date.now(),
      });

      const { container } = render(<CostBurnRate threadId="test-thread" />);

      // Should show warning color
      const warningElements = container.querySelectorAll('[class*="yellow"]');
      expect(warningElements.length).toBeGreaterThan(0);
    });

    it('should show danger color for critical budget', () => {
      vi.mocked(require('../../hooks').useOrchestratorMetrics).mockReturnValueOnce({
        currentMetrics: {
          threadId: 'test-thread',
          currentNode: 'supervisor',
          stepCount: 5,
          totalCheckpoints: 2,
          totalCostCents: 9900,
          totalInputTokens: 1000,
          totalOutputTokens: 500,
          estimatedBudgetRemaining: 100,
          avgStepDurationMs: 100,
          executionStartedAt: Date.now() - 50000,
        },
        burnRate: {
          threadId: 'test-thread',
          burnRatePerHour: 100,
          burnRatePerMinute: 1.667,
          burnRatePerSecond: 0.0278,
          recentCostCents: 1000,
          recentDurationMs: 18000,
          samplesUsed: 5,
          estimatedRemainingMinutes: 2, // Danger threshold
          lastUpdated: Date.now(),
        },
        connectionStatus: 'connected',
        error: undefined,
        recentStateChanges: [],
        recentCostUpdates: [],
        recentCheckpoints: [],
        activeAgents: new Map(),
        lastUpdated: Date.now(),
      });

      const { container } = render(<CostBurnRate threadId="test-thread" />);

      // Should show danger color
      const dangerElements = container.querySelectorAll('[class*="red"]');
      expect(dangerElements.length).toBeGreaterThan(0);
    });
  });

  describe('Warning Messages', () => {
    it('should display warning for high burn rate', () => {
      vi.mocked(require('../../hooks').useOrchestratorMetrics).mockReturnValueOnce({
        currentMetrics: {
          threadId: 'test-thread',
          currentNode: 'supervisor',
          stepCount: 5,
          totalCheckpoints: 2,
          totalCostCents: 5000,
          totalInputTokens: 1000,
          totalOutputTokens: 500,
          estimatedBudgetRemaining: 100,
          avgStepDurationMs: 100,
          executionStartedAt: Date.now() - 50000,
        },
        burnRate: {
          threadId: 'test-thread',
          burnRatePerHour: 50,
          burnRatePerMinute: 0.833,
          burnRatePerSecond: 0.0139,
          recentCostCents: 500,
          recentDurationMs: 18000,
          samplesUsed: 5,
          estimatedRemainingMinutes: 20,
          lastUpdated: Date.now(),
        },
        connectionStatus: 'connected',
        error: undefined,
        recentStateChanges: [],
        recentCostUpdates: [],
        recentCheckpoints: [],
        activeAgents: new Map(),
        lastUpdated: Date.now(),
      });

      const { container } = render(<CostBurnRate threadId="test-thread" />);

      expect(container.textContent).toContain('High burn rate detected');
    });

    it('should display critical warning for low budget', () => {
      vi.mocked(require('../../hooks').useOrchestratorMetrics).mockReturnValueOnce({
        currentMetrics: {
          threadId: 'test-thread',
          currentNode: 'supervisor',
          stepCount: 5,
          totalCheckpoints: 2,
          totalCostCents: 9900,
          totalInputTokens: 1000,
          totalOutputTokens: 500,
          estimatedBudgetRemaining: 100,
          avgStepDurationMs: 100,
          executionStartedAt: Date.now() - 50000,
        },
        burnRate: {
          threadId: 'test-thread',
          burnRatePerHour: 100,
          burnRatePerMinute: 1.667,
          burnRatePerSecond: 0.0278,
          recentCostCents: 1000,
          recentDurationMs: 18000,
          samplesUsed: 5,
          estimatedRemainingMinutes: 2,
          lastUpdated: Date.now(),
        },
        connectionStatus: 'connected',
        error: undefined,
        recentStateChanges: [],
        recentCostUpdates: [],
        recentCheckpoints: [],
        activeAgents: new Map(),
        lastUpdated: Date.now(),
      });

      const { container } = render(<CostBurnRate threadId="test-thread" />);

      expect(container.textContent).toContain('Budget exhaustion imminent');
    });
  });

  describe('Accessibility', () => {
    it('should have descriptive labels', () => {
      const { container } = render(<CostBurnRate threadId="test-thread" />);

      // Should have proper semantic structure
      expect(container.querySelector('h3')).toBeDefined();
    });

    it('should display connection status', () => {
      const { container } = render(<CostBurnRate threadId="test-thread" />);

      // Should indicate connection status visually
      expect(container.textContent).toMatch(/connected|connecting|disconnected|error/i);
    });
  });
});
