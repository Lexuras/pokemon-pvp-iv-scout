const CACHE='iv-scout-v11';
const OWN_CACHE_PREFIX='iv-scout-';
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(['./','./index.html','./styles.css','./app.js','./data.js','./manifest.webmanifest']);await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith(OWN_CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim()})()));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(event.request);if(cached)return cached;const response=await fetch(event.request);if(new URL(event.request.url).origin===location.origin)await cache.put(event.request,response.clone());return response})())});
