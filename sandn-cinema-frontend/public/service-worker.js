const CACHE_NAME = 'snevio-v2'; // 👈 NAYA: v1 ko v2 kar diya taaki naya cache bane
const urlsToCache = ['/', '/index.html'];

// 1. Install & Force Update
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting(); // 👈 NAYA: Turant naya worker activate hoga
});

// 2. Activate & Clean Old Garbage
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('🗑️ Clearing old cache:', cache);
            return caches.delete(cache); // 👈 NAYA: Purana cache uda dega
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Data
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});