/**
 * Phase 10 Week 3: Real-Time Monitoring Dashboard Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RealtimeMonitoringDashboard } from './RealtimeMonitoringDashboard';

// Mock the metrics streaming service
const mockMetricsStreamService = {
  connect: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn(() => vi.fn()), // Returns unsubscribe function
  subscribeMultiple: vi.fn(() => vi.fn()),
  disconnect: vi.fn(),
  isConnected: vi.fn(() => true),
  emitMetricsRequest: vi.fn(),
  getListenerCount: vi.fn(() => ({})),
};

vi.mock('@/services/monitoring/metrics-stream', () => ({
  getMetricsStreamService: vi.fn(() => mockMetricsStreamService),
}));

vi.mock('@/services/analytics/analytics.service', () => ({
  getAnalyticsService: vi.fn(() => ({})),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'test-user-123', name: 'Test User' },
  })),
}));

describe('RealtimeMonitoringDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMetricsStreamService.connect = vi.fn().mockResolvedValue(undefined);
    mockMetricsStreamService.subscribe = vi.fn(() => vi.fn());
    mockMetricsStreamService.subscribeMultiple = vi.fn(() => vi.fn());
    mockMetricsStreamService.disconnect = vi.fn();
    mockMetricsStreamService.isConnected = vi.fn(() => true);
  });

  describe('Rendering', () => {
    it('should render the dashboard header', async () => {
      render(<RealtimeMonitoringDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Real-Time Monitoring')).toBeInTheDocument();
      });
    });

    it('should render time window selector buttons', async () => {
      render(<RealtimeMonitoringDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '1H' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '24H' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '7D' })).toBeInTheDocument();
      });
    });

    it('should render metric cards', async () => {
      render(<RealtimeMonitoringDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Operations \(last hour\)/i)).toBeInTheDocument();
      });
    });

    it('should render live event stream section', async () => {
      render(<RealtimeMonitoringDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Live Event Stream')).toBeInTheDocument();
      });
    });

    it('should render operations statistics section', async () => {
      render(<RealtimeMonitoringDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Operations')).toBeInTheDocument();
      });
    });

    it('should show connection status', async () => {
      render(<RealtimeMonitoringDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Connected to metrics stream/i)).toBeInTheDocument();
      });
    });
  });

  describe('Time Window Selection', () => {
    it('should highlight active time window', async () => {
      render(<RealtimeMonitoringDashboard />);

      await waitFor(() => {
        const button1h = screen.getByRole('button', { name: '1H' });
        expect(button1h).toHaveClass('bg-blue-500');
      });
    });

    it('should change time window on button click', async () => {
      const user = userEvent.setup();
      render(<RealtimeMonitoringDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '24H' })).toBeInTheDocument();
      });

      const button24h = screen.getByRole('button', { name: '24H' });
      await user.click(button24h);

      expect(button24h).toHaveClass('bg-blue-500');
    });
  });

  describe('Event Handling', () => {
    it('should show waiting for events message initially', async () => {
      render(<RealtimeMonitoringDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Waiting for events...')).toBeInTheDocument();
      });
    });
  });

  describe('Connection Management', () => {
    it('should initialize metrics stream on mount', async () => {
      render(<RealtimeMonitoringDashboard />);

      await waitFor(() => {
        expect(mockMetricsStreamService.connect).toHaveBeenCalledWith('test-user-123');
      });
    });

    it('should subscribe to operation_complete events', async () => {
      render(<RealtimeMonitoringDashboard />);

      await waitFor(() => {
        expect(mockMetricsStreamService.subscribe).toHaveBeenCalledWith(
          'operation_complete',
          expect.any(Function)
        );
      });
    });

    it('should subscribe to operation_failed events', async () => {
      render(<RealtimeMonitoringDashboard />);

      await waitFor(() => {
        expect(mockMetricsStreamService.subscribe).toHaveBeenCalledWith(
          'operation_failed',
          expect.any(Function)
        );
      });
    });

    it('should subscribe to cost_update events', async () => {
      render(<RealtimeMonitoringDashboard />);

      await waitFor(() => {
        expect(mockMetricsStreamService.subscribe).toHaveBeenCalledWith(
          'cost_update',
          expect.any(Function)
        );
      });
    });
  });

  describe('Metric Card Display', () => {
    it('should display metric icons', async () => {
      render(<RealtimeMonitoringDashboard />);

      await waitFor(() => {
        expect(screen.getByText('⚙️')).toBeInTheDocument();
        expect(screen.getByText('❌')).toBeInTheDocument();
        expect(screen.getByText('⏱️')).toBeInTheDocument();
        expect(screen.getByText('💰')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should use grid layout for metrics cards', async () => {
      const { container } = render(<RealtimeMonitoringDashboard />);

      await waitFor(() => {
        const gridContainer = container.querySelector('.grid');
        expect(gridContainer).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('should be interactive and responsive', async () => {
      const user = userEvent.setup();
      render(<RealtimeMonitoringDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '24H' })).toBeInTheDocument();
      });

      const button24h = screen.getByRole('button', { name: '24H' });
      await user.click(button24h);

      expect(button24h).toHaveClass('bg-blue-500');
    });
  });
});
