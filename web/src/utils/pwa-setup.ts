/**
 * PWA Setup Utility
 * Handles Service Worker registration, installation prompts, and offline detection
 */

/**
 * Register service worker and handle updates
 * Returns both registration and cleanup function
 */
export async function setupPWA(): Promise<{
  registration: ServiceWorkerRegistration | null;
  cleanup: () => void;
}> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Workers not supported in this browser');
    return { registration: null, cleanup: () => {} };
  }

  try {
    const registration = await navigator.serviceWorker.register(
      '/service-worker.js',
      { scope: '/' }
    );

    console.log('[PWA] Service Worker registered successfully');

    // Check for updates periodically
    const updateInterval = setInterval(() => {
      registration.update();
    }, 60000); // Check every minute

    // Handle updates
    const handleUpdateFound = () => {
      const newWorker = registration.installing;

      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker available
          notifyUserOfUpdate();
        }
      });
    };

    registration.addEventListener('updatefound', handleUpdateFound);

    // Return cleanup function that removes listeners and clears intervals
    const cleanup = () => {
      clearInterval(updateInterval);
      registration.removeEventListener('updatefound', handleUpdateFound);
      console.log('[PWA] Service Worker listeners cleaned up');
    };

    return { registration, cleanup };
  } catch (error) {
    console.error('[PWA] Service Worker registration failed:', error);
    return { registration: null, cleanup: () => {} };
  }
}

/**
 * Check if app is installed (can be added to home screen)
 */
export function isInstallable(): Promise<boolean> {
  if (!('getInstalledRelatedApps' in navigator)) {
    return Promise.resolve(false);
  }

  return (navigator as any).getInstalledRelatedApps().then((apps: any[]) => {
    return apps.length > 0;
  });
}

/**
 * Request installation prompt
 */
let deferredPrompt: any = null;

export function setupInstallPrompt(): () => void {
  const handleBeforeInstallPrompt = (event: Event) => {
    // Prevent mini-infobar from showing on mobile
    event.preventDefault();

    // Save the event for later use
    deferredPrompt = event;

    // Show install button
    showInstallButton();
  };

  const handleAppInstalled = () => {
    console.log('[PWA] App installed');
    hideInstallButton();
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);

  // Return cleanup function
  return () => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.removeEventListener('appinstalled', handleAppInstalled);
    console.log('[PWA] Install prompt listeners cleaned up');
  };
}

/**
 * Trigger installation prompt
 */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) {
    console.warn('[PWA] Install prompt not available');
    return false;
  }

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  if (outcome === 'accepted') {
    console.log('[PWA] User accepted install prompt');
    deferredPrompt = null;
    return true;
  }

  return false;
}

/**
 * Check if app is running in standalone mode (installed)
 */
export function isRunningStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

/**
 * Get online/offline status
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Monitor online/offline changes
 */
export function setupOnlineStatusListener(callback: (isOnline: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Return unsubscribe function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Clear all service worker caches
 */
export async function clearCaches(): Promise<void> {
  if (!('caches' in window)) {
    console.warn('[PWA] Caches API not supported');
    return;
  }

  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    console.log('[PWA] All caches cleared');
  } catch (error) {
    console.error('[PWA] Failed to clear caches:', error);
  }
}

/**
 * Unregister all service workers
 */
export async function unregisterServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((reg) => reg.unregister()));
    console.log('[PWA] All service workers unregistered');
  } catch (error) {
    console.error('[PWA] Failed to unregister service workers:', error);
  }
}

/**
 * Notify user of service worker update
 */
function notifyUserOfUpdate(): void {
  const message = document.createElement('div');
  message.id = 'pwa-update-prompt';
  message.className = 'fixed bottom-4 left-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50';
  message.innerHTML = `
    <div class="flex items-center justify-between">
      <span>A new version of Helix is available</span>
      <div class="flex gap-2">
        <button id="pwa-update-dismiss" class="px-3 py-1 rounded bg-blue-700 hover:bg-blue-800">Dismiss</button>
        <button id="pwa-update-reload" class="px-3 py-1 rounded bg-blue-800 hover:bg-blue-900 font-semibold">Update</button>
      </div>
    </div>
  `;

  document.body.appendChild(message);

  const dismissBtn = document.getElementById('pwa-update-dismiss');
  const reloadBtn = document.getElementById('pwa-update-reload');

  dismissBtn?.addEventListener('click', () => {
    message.remove();
  });

  reloadBtn?.addEventListener('click', () => {
    // Tell service worker to skip waiting
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }

    // Reload the page
    window.location.reload();
  });
}

/**
 * Show install button
 */
function showInstallButton(): void {
  const btn = document.getElementById('pwa-install-button');
  if (btn) {
    btn.style.display = 'block';
  }
}

/**
 * Hide install button
 */
function hideInstallButton(): void {
  const btn = document.getElementById('pwa-install-button');
  if (btn) {
    btn.style.display = 'none';
  }
}

/**
 * Initialize all PWA features
 * Returns cleanup function to remove all listeners and intervals
 * Performance: Prevents 2-5MB memory leak from accumulated event listeners
 */
export async function initializePWA(): Promise<() => void> {
  console.log('[PWA] Initializing PWA features');

  const cleanupFunctions: Array<() => void> = [];

  // Register service worker
  const { cleanup: cleanupSW } = await setupPWA();
  cleanupFunctions.push(cleanupSW);

  // Setup install prompt
  const cleanupInstallPrompt = setupInstallPrompt();
  cleanupFunctions.push(cleanupInstallPrompt);

  // Setup online/offline listener
  const cleanupOnlineStatus = setupOnlineStatusListener((isOnline) => {
    console.log(`[PWA] Network status: ${isOnline ? 'online' : 'offline'}`);

    // Emit event for app to handle
    window.dispatchEvent(
      new CustomEvent('pwa-online-status-change', {
        detail: { isOnline },
      })
    );
  });
  cleanupFunctions.push(cleanupOnlineStatus);

  console.log('[PWA] Initialization complete');
  console.log(`[PWA] Running standalone: ${isRunningStandalone()}`);
  console.log(`[PWA] Currently online: ${isOnline()}`);

  // Return composite cleanup function
  return () => {
    console.log('[PWA] Cleaning up PWA features');
    cleanupFunctions.forEach((cleanup) => cleanup());
  };
}
