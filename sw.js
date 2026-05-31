/* =============================================
   Service Worker — 全国役所マップ
   ============================================= */
const CACHE = 'yakusho-map-v3';
const PRECACHE_URLS = ['/index.html', '/data.json', '/icon.svg', '/manifest.json'];

// ── インストール：主要アセットをキャッシュ ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ── アクティベート：古いキャッシュを削除 ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── フェッチ戦略 ──
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Google Maps API / Maps tiles → 常にネットワーク（キャッシュしない）
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('maps.google.com') ||
    url.hostname.includes('gstatic.com')
  ) return;

  // CDN（MarkerClusterer等）→ キャッシュファースト
  if (url.hostname.includes('unpkg.com')) {
    event.respondWith(
      caches.match(req).then(cached =>
        cached || fetch(req).then(res => {
          caches.open(CACHE).then(c => c.put(req, res.clone()));
          return res;
        })
      )
    );
    return;
  }

  // data.json / fiscal_detail.json → Stale-While-Revalidate（即座にキャッシュ返却しつつバックグラウンド更新）
  if (url.pathname === '/data.json' || url.pathname === '/fiscal_detail.json') {
    event.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(req).then(cached => {
          const networkFetch = fetch(req).then(res => {
            cache.put(req, res.clone());
            return res;
          }).catch(() => null);
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // その他（index.html等）→ ネットワークファースト、失敗時はキャッシュ
  event.respondWith(
    fetch(req)
      .then(res => {
        caches.open(CACHE).then(c => c.put(req, res.clone()));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
