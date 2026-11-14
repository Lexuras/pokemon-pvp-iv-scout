const CACHE_NAME = 'iv-scout-v13';
const OWN_CACHE_PREFIX = 'iv-scout-';
const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './modules/cache-controls.js',
  './modules/collection.js',
  './modules/dom.js',
  './modules/navigation.js',
  './modules/nickname.js',
  './modules/ocr.js',
  './modules/pokemon-data.js',
  './modules/scanner.js',
  './modules/settings.js',
  './modules/storage.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith(OWN_CACHE_PREFIX) && name !== CACHE_NAME)
        .map((name) => caches.delete(name)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) return cached;

    const response = await fetch(event.request);
    if (new URL(event.request.url).origin === location.origin) {
      await cache.put(event.request, response.clone());
    }
    return response;
  })());
});
