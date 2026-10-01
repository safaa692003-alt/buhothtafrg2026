// Service Worker for Mobile PWA - منظومة التفرغ العلمي
const CACHE_NAME = 'tafragh-cache-v5';
const STATIC_ASSETS = [
  './',
  './index.html',
  './tracking.html',
  './researcher_form.html',
  './tafragh_scientific.html',
  './stats.html',
  './dashboard.html',
  './director_dashboard.html',
  './hr_dashboard.html',
  './bg-tool.html',
  './bg-tool/index.html',
  './logo.png',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Pre-cache item failed', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Network-First with Cache fallback strategy for mobile reliability
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and http/https schemes
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Allow Firebase Realtime Database and Cloudinary/API calls to go directly through network
  if (event.request.url.includes('firebaseio.com') || event.request.url.includes('cloudinary.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful local GET requests
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
  );
});
