const CACHE = 'ic-tracker-v24';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/stone.png',
  './assets/bag-of-telvar.png',
  './assets/telvar.png',
  './assets/map-bg.png',
  './assets/alliance-ep.png',
  './assets/alliance-dc.png',
  './assets/alliance-ad.jpg',
  './assets/alliance-ep-crest.png',
  './assets/alliance-dc-crest.png',
  './assets/alliance-ad-crest.png',
  './assets/boss-skull.png',
  './assets/chud.webp',
  './assets/chad.webp',
  './assets/streak.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // Never cache the test harness — the suite must always run the latest code.
  if (url.pathname.startsWith('/tests/')) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
