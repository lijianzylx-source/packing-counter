/* 离线缓存：网络优先 + 缓存兜底
   - 在线时始终拿到最新版本（改样式后刷新即可生效）
   - 断网时回退到缓存，页面照常可用
   - /api/ 接口请求不走缓存（账号与令牌校验必须实时） */
var CACHE = 'pkgstat-v1.0.1';

var ASSETS = [
  './',
  './index.html',
  './assets/style.css',
  './assets/core.js',
  './assets/app.js',
  './assets/icon.svg',
  './manifest.webmanifest'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;               // 跨源请求（如指向另一台服务器）不拦截
  if (url.pathname.indexOf('/api/') === 0) return;               // 接口不缓存

  event.respondWith(
    fetch(req).then(function (response) {
      var copy = response.clone();
      caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
      return response;
    }).catch(function () {
      return caches.match(req).then(function (cached) {
        if (cached) return cached;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
