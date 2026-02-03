/**
 * Helix PWA Service Worker
 * Enables offline functionality with cache-first strategy for assets
 * and network-first strategy for API calls
 */

const CACHE_NAME = 'helix-v1';
const RUNTIME_CACHE = 'helix-runtime-v1';
const API_CACHE = 'helix-api-v1';

// Assets to cache on install
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
];

// Patterns to treat as API calls (network-first)
const API_PATTERNS = [
  '/api/',
  '/invoke',
  '/gateway',
  '/stream',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching core assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('[ServiceWorker] Install failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return (
                cacheName !== CACHE_NAME &&
                cacheName !== RUNTIME_CACHE &&
                cacheName !== API_CACHE
              );
            })
            .map((cacheName) => {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - cache strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const { url, method } = request;

  // Skip non-GET requests
  if (method !== 'GET') {
    return;
  }

  // Skip chrome extensions and other non-http requests
  if (!url.startsWith('http')) {
    return;
  }

  // API requests - network first, fall back to cache
  if (API_PATTERNS.some((pattern) => url.includes(pattern))) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Static assets - cache first, fall back to network
  event.respondWith(cacheFirst(request, CACHE_NAME, RUNTIME_CACHE));
});

/**
 * Cache-first strategy: use cache if available, fall back to network
 */
function cacheFirst(request, cacheName, runtimeCache) {
  return caches
    .match(request)
    .then((response) => {
      if (response) {
        return response;
      }

      return fetch(request).then((response) => {
        // Only cache successful responses
        if (
          !response ||
          response.status !== 200 ||
          response.type === 'error'
        ) {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache the response for next time
        caches
          .open(runtimeCache)
          .then((cache) => {
            cache.put(request, responseToCache);
          });

        return response;
      });
    })
    .catch(() => {
      // Return offline page or cached response
      return caches.match(request);
    });
}

/**
 * Network-first strategy: try network first, fall back to cache
 */
function networkFirst(request, cacheName) {
  return fetch(request)
    .then((response) => {
      // Only cache successful responses
      if (!response || response.status !== 200 || response.type === 'error') {
        return response;
      }

      // Clone the response
      const responseToCache = response.clone();

      // Cache the response
      caches.open(cacheName).then((cache) => {
        cache.put(request, responseToCache);
      });

      return response;
    })
    .catch(() => {
      // Fall back to cached response
      return caches.match(request);
    });
}

// Message event - handle skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    clearAllCaches();
  }
});

/**
 * Clear all caches (for debugging or storage management)
 */
function clearAllCaches() {
  caches.keys().then((cacheNames) => {
    Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  });
}

// Handle push notifications (for future enhancement)
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  const data = event.data.json();

  const options = {
    body: data.body,
    icon: '/logos/helix-icon.svg',
    badge: '/logos/helix-logomark.svg',
    tag: data.tag || 'helix-notification',
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Helix', options)
  );
});

// Handle notification clicks (for future enhancement)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      // Check if there's already a window open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }

      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

console.log('[ServiceWorker] Loaded');
