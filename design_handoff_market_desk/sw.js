// MARKETDESK Service Worker
// 전략:
//  - 정적 자산(HTML/JS/CSS/아이콘): Cache-First (오프라인에서도 화면은 뜸)
//  - data.json: Network-First, 실패 시 캐시 (항상 최신 시도)

const VERSION = 'v1.0.0';
const STATIC_CACHE = `marketdesk-static-${VERSION}`;
const DATA_CACHE = `marketdesk-data-${VERSION}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.jsx',
  './components.jsx',
  './tweaks_panel.jsx',
  './data.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== STATIC_CACHE && k !== DATA_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // data.json: Network-First
  if (url.pathname.endsWith('/data.json') || url.pathname.endsWith('data.json')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(DATA_CACHE).then(cache => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(r => r || new Response('null', { headers: { 'Content-Type': 'application/json' }})))
    );
    return;
  }

  // 외부 도메인(unpkg, googlefonts 등): 네트워크 그대로
  if (url.origin !== self.location.origin) {
    return;
  }

  // 정적 자산: Cache-First
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        if (response.ok && response.type === 'basic') {
          const cloned = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, cloned));
        }
        return response;
      });
    })
  );
});
