// Service Worker for auto-short Studio PWA
const CACHE_NAME = 'auto-short-v1';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Avoid caching API routes or streaming endpoints
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response ||
        fetch(event.request).then((fetchRes) => {
          if (
            event.request.method === 'GET' &&
            fetchRes.status === 200 &&
            (event.request.destination === 'style' ||
              event.request.destination === 'script' ||
              event.request.destination === 'image' ||
              event.request.destination === 'font')
          ) {
            const resClone = fetchRes.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, resClone);
            });
          }
          return fetchRes;
        })
      );
    })
  );
});
