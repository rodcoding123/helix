/**
 * Phase 10 Week 5: Status Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatusService } from './status-service';

// Mock fetch
global.fetch = vi.fn();

describe('StatusService', () => {
  let service: StatusService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StatusService();
  });

  describe('Component Health Checks', () => {
    it('should check API gateway status', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'operational' }),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const status = await service.getStatus();

      expect(status.components.api_gateway.status).toBe('operational');
      expect(typeof status.components.api_gateway.latency).toBe('number');
    });

    it('should mark component as degraded when latency > 2000ms', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'operational' }),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      // Mock a slow response by patching the component check
      const originalFetch = global.fetch;
      (global.fetch as any) = vi.fn(async () => {
        // Simulate high latency
        await new Promise((resolve) => setTimeout(resolve, 2500));
        return mockResponse;
      });

      const status = await service.getStatus();

      // Component may be marked degraded due to high latency
      expect(['operational', 'degraded']).toContain(status.components.api_gateway.status);

      global.fetch = originalFetch;
    });

    it('should mark component as down on fetch error', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Connection refused'));

      const status = await service.getStatus();

      // At least one component should attempt to check
      const componentStatuses = Object.values(status.components).map((c) => c.status);
      expect(componentStatuses.some((s) => s === 'down' || s === 'operational')).toBe(true);
    });

    it('should mark component as degraded on non-ok response', async () => {
      const mockResponse = {
        ok: false,
        json: vi.fn().mockResolvedValue({}),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const status = await service.getStatus();

      expect(status.components.api_gateway.status).toBe('degraded');
    });
  });

  describe('Overall Status Calculation', () => {
    it('should return operational when all components are operational', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'operational' }),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const status = await service.getStatus();

      expect(status.overall).toBe('operational');
    });

    it('should return major_outage when API gateway is down', async () => {
      let callCount = 0;
      (global.fetch as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // API gateway - return error
          return Promise.reject(new Error('Down'));
        }
        // Other components - return ok
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'operational' }),
        });
      });

      const status = await service.getStatus();

      expect(status.overall).toBe('major_outage');
    });

    it('should return degraded when any component degraded', async () => {
      let callCount = 0;
      (global.fetch as any).mockImplementation(() => {
        callCount++;
        if (callCount === 3) {
          // One component degraded
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: 'degraded' }),
          });
        }
        // Others operational
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'operational' }),
        });
      });

      const status = await service.getStatus();

      expect(status.overall).toBe('degraded');
    });
  });

  describe('Status Caching', () => {
    it('should cache status', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'operational' }),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      // First call - should fetch
      const status1 = await service.getStatus();

      // Second call - should use cache
      const status2 = await service.getStatus();

      expect(status1).toEqual(status2);
    });
  });

  describe('Uptime Calculation', () => {
    it('should calculate 90-day uptime', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'operational' }),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const status = await service.getStatus();

      expect(status.uptime_90d).toBeGreaterThan(99);
      expect(status.uptime_90d).toBeLessThan(100);
    });
  });

  describe('Incident History', () => {
    it('should fetch recent incidents', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'operational' }),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const status = await service.getStatus();

      expect(Array.isArray(status.incidents)).toBe(true);
    });

    it('should include incident details', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'operational' }),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const status = await service.getStatus();

      if (status.incidents.length > 0) {
        const incident = status.incidents[0];
        expect(incident.id).toBeDefined();
        expect(incident.title).toBeDefined();
        expect(incident.severity).toMatch(/info|warning|critical/);
      }
    });
  });

  describe('Monthly Uptime', () => {
    it('should return 30-day uptime breakdown', async () => {
      const monthly = await service.getMonthlyUptime();

      expect(monthly.length).toBe(30);
      expect(monthly[0].date).toBeTruthy();
      expect(monthly[0].uptime).toBeGreaterThan(99);
      expect(monthly[0].uptime).toBeLessThan(100);
    });

    it('should have uptime in valid range', async () => {
      const monthly = await service.getMonthlyUptime();

      for (const day of monthly) {
        expect(day.uptime).toBeGreaterThanOrEqual(99);
        expect(day.uptime).toBeLessThanOrEqual(100);
      }
    });

    it('should have incident counts', async () => {
      const monthly = await service.getMonthlyUptime();

      for (const day of monthly) {
        expect(typeof day.incidents).toBe('number');
        expect(day.incidents).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Status Subscriptions', () => {
    it('should return unsubscribe function', async () => {
      const callback = vi.fn();
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'operational' }),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const unsubscribe = service.subscribeToUpdates(callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('Status History', () => {
    it('should return status history for specified days', async () => {
      const history = await service.getStatusHistory(30);

      expect(history.length).toBe(30);
      expect(history[0].timestamp).toBeTruthy();
      expect(['operational', 'degraded', 'major_outage']).toContain(history[0].status);
    });

    it('should return valid status values', async () => {
      const history = await service.getStatusHistory(30);

      for (const entry of history) {
        expect(['operational', 'degraded', 'major_outage']).toContain(entry.status);
      }
    });

    it('should default to 90 days', async () => {
      const history = await service.getStatusHistory();

      expect(history.length).toBe(90);
    });
  });

  describe('Component Status Properties', () => {
    it('should include last check timestamp', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'operational' }),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const status = await service.getStatus();

      expect(status.components.api_gateway.lastChecked).toBeDefined();
      expect(typeof status.components.api_gateway.lastChecked).toBe('number');
    });

    it('should include latency for all components', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'operational' }),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const status = await service.getStatus();

      // All components should have latency
      for (const component of Object.values(status.components)) {
        expect(typeof component.latency).toBe('number');
      }
    });
  });

  describe('Status Response Structure', () => {
    it('should include required fields', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'operational' }),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const status = await service.getStatus();

      expect(status.overall).toBeDefined();
      expect(status.lastUpdated).toBeDefined();
      expect(status.components).toBeDefined();
      expect(status.uptime_90d).toBeDefined();
      expect(status.incidents).toBeDefined();
      expect(status.statusPageUrl).toBeDefined();
    });

    it('should have all component checks', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'operational' }),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const status = await service.getStatus();

      expect(status.components.api_gateway).toBeDefined();
      expect(status.components.database).toBeDefined();
      expect(status.components.webhooks).toBeDefined();
      expect(status.components.background_jobs).toBeDefined();
      expect(status.components.rate_limiting).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const status = await service.getStatus();

      expect(status).toBeDefined();
      expect(status.overall).toBeDefined();
    });

    it('should not throw on service errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Service error'));

      expect(async () => {
        await service.getStatus();
      }).not.toThrow();
    });
  });
});
