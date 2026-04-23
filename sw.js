// ============================================
// CANNY Traffic Analysis - Service Worker
// 每次更新时修改 CACHE_VERSION，浏览器会自动获取新版本
// ============================================

const CACHE_VERSION = 'v2';  // ← 每次更新 index.html 时，把这个版本号+1
const CACHE_NAME = `canny-cache-${CACHE_VERSION}`;

// 需要缓存的核心文件列表
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png'
  // 如果有其他静态资源（CSS、JS分离文件等），在这里添加
];

// ============================================
// 安装阶段：缓存新版本资源
// ============================================
self.addEventListener('install', event => {
  console.log(`[SW] Installing ${CACHE_VERSION}...`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] Skip waiting');
        return self.skipWaiting();  // 立即激活，不等待旧版本
      })
      .catch(err => {
        console.error('[SW] Cache failed:', err);
      })
  );
});

// ============================================
// 激活阶段：清理旧缓存 + 接管所有客户端
// ============================================
self.addEventListener('activate', event => {
  console.log(`[SW] Activating ${CACHE_VERSION}...`);
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => {
              // 只保留当前版本的缓存，删除所有旧版本
              const isOldCache = name.startsWith('canny-cache-') && name !== CACHE_NAME;
              if (isOldCache) {
                console.log(`[SW] Deleting old cache: ${name}`);
              }
              return isOldCache;
            })
            .map(name => caches.delete(name))
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim();  // 立即接管所有页面
      })
      .then(() => {
        // 通知所有客户端：新版本已激活
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SW_ACTIVATED',
              version: CACHE_VERSION
            });
          });
        });
      })
  );
});

// ============================================
// 拦截请求：缓存优先，后台更新
// ============================================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理同源请求
  if (url.origin !== self.location.origin) {
    return;
  }

  // 对于 HTML 请求：网络优先（确保获取最新内容）
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          // 网络成功：更新缓存
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // 网络失败：回退到缓存
          return caches.match(request);
        })
    );
    return;
  }

  // 对于其他资源：缓存优先
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        // 返回缓存，同时后台更新
        fetch(request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, networkResponse.clone());
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      // 缓存未命中：从网络获取并缓存
      return fetch(request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return networkResponse;
      });
    })
  );
});

// ============================================
// 处理客户端消息
// ============================================
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});