const CACHE_NAME = 'canny-traffic-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
  // 图标文件会自动缓存
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request);
      })
  );
});