const CACHE_NAME = 'yamanoha-nc-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './horizon_export.json',
  './kanto_mountains.json',
  './kanto_map_mini.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // ナビゲーション（index.html）はネットワーク優先 → コード変更がすぐ反映される
  // オフライン時のみキャッシュにフォールバック
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // データ JSON（horizon_export.json / kanto_mountains.json）はネットワーク優先。
  // index.html は "?v=<時刻>" を付けて取得するためキャッシュのキーと一致しない。
  // そこでクエリを除いた URL をキーにして保存・参照し、オフライン時は直近の取得結果を返す。
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.endsWith('.json')) {
    const cacheKey = url.origin + url.pathname;
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(cacheKey, clone));
          }
          return response;
        })
        .catch(() => caches.match(cacheKey).then(cached => cached || Response.error()))
    );
    return;
  }

  // その他のアセット（PNG・フォントなど）はキャッシュ優先
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
