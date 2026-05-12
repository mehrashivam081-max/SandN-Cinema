const CACHE_NAME = 'snevio-v3'; // Version 3
const urlsToCache = ['/', '/index.html'];

// 1. Install
self.addEventListener('install', event => {
  self.skipWaiting();
});

// 2. Activate & Clean Old Garbage
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('🗑️ Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Smart Fetch (Ignore Google APIs & POST requests)
self.addEventListener('fetch', event => {
  // 🔥 FIREWALL: Sirf apni website (same origin) aur GET requests ko handle karo
  // Google, Firebase, Cloudinary ya POST API calls ko bypass kar do!
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return; 
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});