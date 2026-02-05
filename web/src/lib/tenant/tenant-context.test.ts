/**
 * Phase 11 Week 1: Tenant Context Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCurrentTenantId,
  setCurrentTenantId,
  getTenantContext,
  onTenantChanged,
} from './tenant-context';

describe('Tenant Context', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('getCurrentTenantId', () => {
    it('should return null when no tenant set', () => {
      expect(getCurrentTenantId()).toBeNull();
    });

    it('should return tenant ID from storage', () => {
      localStorage.setItem('current_tenant_id', 'tenant-123');
      expect(getCurrentTenantId()).toBe('tenant-123');
    });

    it('should handle storage errors gracefully', () => {
      const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(getCurrentTenantId()).toBeNull();
      getItem.mockRestore();
    });
  });

  describe('setCurrentTenantId', () => {
    it('should set tenant ID in storage', () => {
      setCurrentTenantId('tenant-456');
      expect(localStorage.getItem('current_tenant_id')).toBe('tenant-456');
    });

    it('should dispatch tenant-changed event', () => {
      const listener = vi.fn();
      window.addEventListener('tenant-changed', listener);

      setCurrentTenantId('tenant-789');

      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0][0] as CustomEvent;
      expect(event.detail.tenantId).toBe('tenant-789');

      window.removeEventListener('tenant-changed', listener);
    });

    it('should handle storage errors gracefully', () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => setCurrentTenantId('tenant-123')).not.toThrow();
      setItem.mockRestore();
    });
  });

  describe('getTenantContext', () => {
    it('should throw when no tenant set', () => {
      expect(() => getTenantContext()).toThrow('No active tenant set');
    });

    it('should return tenant ID and headers', () => {
      setCurrentTenantId('tenant-123');

      const context = getTenantContext();

      expect(context.tenantId).toBe('tenant-123');
      expect(context.headers['X-Tenant-ID']).toBe('tenant-123');
    });

    it('should include Base64-encoded tenant context in headers', () => {
      setCurrentTenantId('tenant-456');

      const context = getTenantContext();
      const decodedContext = JSON.parse(
        Buffer.from(context.headers['X-Tenant-Context'], 'base64').toString()
      );

      expect(decodedContext.tenantId).toBe('tenant-456');
    });

    it('should create valid Base64 encoded context', () => {
      setCurrentTenantId('tenant-abc123');

      const context = getTenantContext();
      const encoded = context.headers['X-Tenant-Context'];

      // Should be valid base64
      expect(() => atob(encoded)).not.toThrow();

      // Should decode to valid JSON
      const decoded = JSON.parse(atob(encoded));
      expect(decoded.tenantId).toBe('tenant-abc123');
    });
  });

  describe('onTenantChanged', () => {
    it('should call callback when tenant changes', () => {
      const callback = vi.fn();
      onTenantChanged(callback);

      setCurrentTenantId('tenant-xyz');

      expect(callback).toHaveBeenCalledWith('tenant-xyz');
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = onTenantChanged(callback);

      setCurrentTenantId('tenant-1');
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      setCurrentTenantId('tenant-2');

      // Should still be called only once
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      onTenantChanged(callback1);
      onTenantChanged(callback2);

      setCurrentTenantId('tenant-multi');

      expect(callback1).toHaveBeenCalledWith('tenant-multi');
      expect(callback2).toHaveBeenCalledWith('tenant-multi');
    });

    it('should pass correct tenant ID to callback', () => {
      const callback = vi.fn();
      onTenantChanged(callback);

      setCurrentTenantId('specific-tenant-id');

      expect(callback.mock.calls[0][0]).toBe('specific-tenant-id');
    });
  });

  describe('Multi-tab synchronization', () => {
    it('should synchronize tenant changes across tabs', () => {
      const callback = vi.fn();
      onTenantChanged(callback);

      // Simulate another tab changing tenant
      const event = new CustomEvent('tenant-changed', {
        detail: { tenantId: 'tenant-shared' },
      });
      window.dispatchEvent(event);

      expect(callback).toHaveBeenCalledWith('tenant-shared');
    });

    it('should handle rapid tenant switches', () => {
      const tenantIds: string[] = [];

      onTenantChanged((id) => {
        tenantIds.push(id);
      });

      setCurrentTenantId('tenant-1');
      setCurrentTenantId('tenant-2');
      setCurrentTenantId('tenant-3');

      expect(tenantIds).toEqual(['tenant-1', 'tenant-2', 'tenant-3']);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty tenant ID', () => {
      expect(() => setCurrentTenantId('')).not.toThrow();
      expect(getCurrentTenantId()).toBeNull();
    });

    it('should handle special characters in tenant ID', () => {
      const specialId = 'tenant-!@#$%^&*()';
      setCurrentTenantId(specialId);
      expect(getCurrentTenantId()).toBe(specialId);
    });

    it('should handle very long tenant IDs', () => {
      const longId = 'tenant-' + 'x'.repeat(10000);
      setCurrentTenantId(longId);
      expect(getCurrentTenantId()).toBe(longId);
    });

    it('should handle UUIDs as tenant IDs', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      setCurrentTenantId(uuid);
      expect(getCurrentTenantId()).toBe(uuid);

      const context = getTenantContext();
      expect(context.tenantId).toBe(uuid);
    });
  });
});
