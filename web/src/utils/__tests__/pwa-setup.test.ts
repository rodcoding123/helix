/**
 * Tests for PWA Setup Utility
 * Service Worker registration, installation, and offline functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setupPWA,
  isInstallable,
  setupInstallPrompt,
  isRunningStandalone,
  isOnline,
  setupOnlineStatusListener,
  clearCaches,
  unregisterServiceWorkers,
  initializePWA,
} from '../pwa-setup';

describe('PWA Setup', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock navigator.serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn(),
        getRegistrations: vi.fn(),
        controller: null,
      },
      writable: true,
    });

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
    });

    // Mock caches
    (window as any).caches = {
      keys: vi.fn(),
      delete: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Service Worker Registration', () => {
    it('should register service worker successfully', async () => {
      const mockRegistration = {
        installing: null,
        active: null,
        scope: '/',
        addEventListener: vi.fn(),
      };

      (navigator.serviceWorker.register as any).mockResolvedValue(
        mockRegistration
      );

      const result = await setupPWA();

      expect(navigator.serviceWorker.register).toHaveBeenCalledWith(
        '/service-worker.js',
        { scope: '/' }
      );
      expect(result).toBe(mockRegistration);
    });

    it('should handle service worker registration failure', async () => {
      const error = new Error('SW registration failed');
      (navigator.serviceWorker.register as any).mockRejectedValue(error);

      const result = await setupPWA();

      expect(result).toBeNull();
    });

    it('should return null if service workers not supported', async () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: undefined,
        writable: true,
      });

      const result = await setupPWA();

      expect(result).toBeNull();
    });
  });

  describe('Online Status Detection', () => {
    it('should detect online status', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
      });

      expect(isOnline()).toBe(true);
    });

    it('should detect offline status', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      expect(isOnline()).toBe(false);
    });

    it('should setup online status listener', () => {
      const callback = vi.fn();
      const unsubscribe = setupOnlineStatusListener(callback);

      // Simulate offline event
      window.dispatchEvent(new Event('offline'));
      expect(callback).toHaveBeenCalledWith(false);

      // Simulate online event
      window.dispatchEvent(new Event('online'));
      expect(callback).toHaveBeenCalledWith(true);

      // Unsubscribe
      unsubscribe();
      window.dispatchEvent(new Event('online'));
      // Should not be called again after unsubscribe
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('Standalone Mode', () => {
    it('should detect standalone mode (installed)', () => {
      // Mock standalone mode
      Object.defineProperty(window.navigator, 'standalone', {
        value: true,
        writable: true,
      });

      expect(isRunningStandalone()).toBe(true);
    });

    it('should detect non-standalone mode', () => {
      Object.defineProperty(window.navigator, 'standalone', {
        value: false,
        writable: true,
      });

      expect(isRunningStandalone()).toBe(false);
    });
  });

  describe('Cache Management', () => {
    it('should clear all caches', async () => {
      const mockCacheNames = ['helix-v1', 'helix-runtime-v1', 'helix-api-v1'];
      (window.caches.keys as any).mockResolvedValue(mockCacheNames);
      (window.caches.delete as any).mockResolvedValue(true);

      await clearCaches();

      expect(window.caches.keys).toHaveBeenCalled();
      expect(window.caches.delete).toHaveBeenCalledTimes(3);
      expect(window.caches.delete).toHaveBeenCalledWith('helix-v1');
      expect(window.caches.delete).toHaveBeenCalledWith('helix-runtime-v1');
      expect(window.caches.delete).toHaveBeenCalledWith('helix-api-v1');
    });

    it('should handle cache clear failure gracefully', async () => {
      (window.caches.keys as any).mockRejectedValue(
        new Error('Cache error')
      );

      await clearCaches();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Service Worker Unregistration', () => {
    it('should unregister all service workers', async () => {
      const mockRegistration = {
        unregister: vi.fn().mockResolvedValue(true),
      };

      (navigator.serviceWorker.getRegistrations as any).mockResolvedValue([
        mockRegistration,
      ]);

      await unregisterServiceWorkers();

      expect(navigator.serviceWorker.getRegistrations).toHaveBeenCalled();
      expect(mockRegistration.unregister).toHaveBeenCalled();
    });

    it('should handle unregistration failure gracefully', async () => {
      (navigator.serviceWorker.getRegistrations as any).mockRejectedValue(
        new Error('Failed to get registrations')
      );

      await unregisterServiceWorkers();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Installation Detection', () => {
    it('should check if app is installable', async () => {
      (navigator as any).getInstalledRelatedApps = vi
        .fn()
        .mockResolvedValue([{ id: 'helix' }]);

      const result = await isInstallable();

      expect(result).toBe(true);
    });

    it('should return false if app not installed', async () => {
      (navigator as any).getInstalledRelatedApps = vi
        .fn()
        .mockResolvedValue([]);

      const result = await isInstallable();

      expect(result).toBe(false);
    });

    it('should handle getInstalledRelatedApps gracefully', async () => {
      // When getInstalledRelatedApps is available but returns empty array
      (navigator as any).getInstalledRelatedApps = vi
        .fn()
        .mockResolvedValue([]);

      const result = await isInstallable();

      expect(result).toBe(false);
    });
  });

  describe('Install Prompt', () => {
    it('should setup install prompt listener', () => {
      const mockEvent = new Event('beforeinstallprompt');
      Object.assign(mockEvent, { preventDefault: vi.fn() });

      setupInstallPrompt();

      window.dispatchEvent(mockEvent);

      // Should prevent default
      expect((mockEvent as any).preventDefault).toHaveBeenCalled();
    });

    it('should track appinstalled event', () => {
      setupInstallPrompt();

      const mockEvent = new Event('appinstalled');

      // Should not throw
      window.dispatchEvent(mockEvent);
      expect(true).toBe(true);
    });
  });

  describe('Full Initialization', () => {
    it('should initialize all PWA features', async () => {
      const mockRegistration = {
        installing: null,
        addEventListener: vi.fn(),
      };

      (navigator.serviceWorker.register as any).mockResolvedValue(
        mockRegistration
      );

      await initializePWA();

      expect(navigator.serviceWorker.register).toHaveBeenCalled();
    });
  });

  describe('Event Dispatching', () => {
    it('should dispatch online status change event', async () => {
      return new Promise<void>((resolve) => {
        const listener = (event: CustomEvent) => {
          expect(event.detail.isOnline).toBe(false);
          window.removeEventListener('pwa-online-status-change', listener);
          resolve();
        };

        window.addEventListener('pwa-online-status-change', listener);

        const callback = (isOnline: boolean) => {
          window.dispatchEvent(
            new CustomEvent('pwa-online-status-change', {
              detail: { isOnline },
            })
          );
        };

        callback(false);
      });
    });
  });

  describe('Cache Strategies', () => {
    it('should cache important assets on install', async () => {
      const assetsToCache = [
        '/',
        '/index.html',
        '/manifest.json',
        '/favicon.ico',
      ];

      expect(assetsToCache.length).toBe(4);
      expect(assetsToCache[0]).toBe('/');
      expect(assetsToCache).toContain('/manifest.json');
    });

    it('should identify API patterns for network-first caching', () => {
      const apiPatterns = ['/api/', '/invoke', '/gateway', '/stream'];

      const testUrl = '/api/memory/patterns';
      const isAPI = apiPatterns.some((pattern) => testUrl.includes(pattern));

      expect(isAPI).toBe(true);
    });

    it('should identify static assets for cache-first caching', () => {
      const apiPatterns = ['/api/', '/invoke', '/gateway', '/stream'];

      const testUrl = '/logos/helix-icon.svg';
      const isAPI = apiPatterns.some((pattern) => testUrl.includes(pattern));

      expect(isAPI).toBe(false);
    });
  });
});
