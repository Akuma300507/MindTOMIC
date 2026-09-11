/**
 * Service Worker: Mind to Mic PWA & Offline Shell Caching
 *
 * Strategy:
 * 1. App Shell (HTML, JS, CSS, Fonts, Icons): Cache-First / Stale-While-Revalidate so app opens offline.
 * 2. API Requests (/api/*): STRICTLY PASS-THROUGH. Never cached by Service Worker to ensure
 *    our IndexedDB local data layer and sync engine have full deterministic control over data safety.
 */

const CACHE_NAME = 'mindtomic-shell-v1';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/logo.svg',
  '/inspire-logo.svg',
  '/manifest.json',
];

// Install: Pre-cache essential app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching application shell assets');
      return cache.addAll(SHELL_ASSETS).catch((err) => {
        console.warn('[SW] Non-fatal pre-cache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: Clean up older cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache version:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Intercept and serve cached shell assets; pass-through APIs
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. NEVER cache API calls or Server-Sent Events in Service Worker cache
  if (url.pathname.startsWith('/api/')) {
    return; // Normal browser network fetch
  }

  // 2. Navigation requests: Network-first, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // 3. Static assets (JS, CSS, images, fonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed (offline), cachedResponse will be returned
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
