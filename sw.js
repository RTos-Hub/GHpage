// ルート（視点切り替えページ）用の Service Worker。
// 各ビューア（./NC ./TC ./SJ）はそれぞれ自分の sw.js を持つので、
// ここではルート直下のファイルだけを扱い、サブフォルダへの要求には関与しない。
const CACHE_NAME = 'yamanoha-root-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './yamanoha_icon.png'
];

const SCOPE_PATH = new URL('./', self.location).pathname;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // 他のビューアのキャッシュは消さない（自分の旧バージョンだけ削除）
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k.startsWith('yamanoha-root-') && k !== CACHE_NAME)
        .map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // ルート直下のファイルだけを対象にする（サブフォルダはブラウザ既定の処理に任せる）
  const rest = url.pathname.slice(SCOPE_PATH.length);
  if (!url.pathname.startsWith(SCOPE_PATH) || rest.includes('/')) return;

  // ページはネットワーク優先 → コード変更がすぐ反映される。オフライン時のみキャッシュ
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(url.origin + url.pathname, clone));
          return response;
        })
        .catch(() => caches.match(url.origin + url.pathname)
          .then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // その他（アイコン・manifest）はキャッシュ優先
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
