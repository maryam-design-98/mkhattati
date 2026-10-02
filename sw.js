/* مخططي — service worker
   Caches the app shell so it opens instantly and works offline.
   Bump CACHE_NAME whenever the icons/manifest change. index.html no
   longer needs a bump: it is fetched fresh whenever you are online. */
const CACHE_NAME  = 'mokhattati-v6';
const QURAN_CACHE = 'quran-v1';      // Qur'an pages + tafsīr: kept across app updates
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME && n !== QURAN_CACHE).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const u = event.request.url;

  /* 1. Recitation audio: let the browser stream it directly. */
  if (u.startsWith('https://cdn.islamic.network/')) return;

  /* 2. Qur'an text and tafsīr never change: cache-first, in a cache
        of their own, so what you have read stays available offline. */
  if (u.startsWith('https://api.alquran.cloud/') ||
      u.includes('/spa5k/tafsir_api') ||
      u.startsWith('https://api.quran.com/')) {
    event.respondWith(
      caches.open(QURAN_CACHE).then((cache) =>
        cache.match(event.request).then((hit) => hit || fetch(event.request).then((res) => {
          if (res && res.status === 200) cache.put(event.request, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  /* 3. The page itself: network-first, so a new index.html shows up
        the very next time you open the app; the cached copy is only
        used when you are offline. */
  if (event.request.mode === 'navigate' || u.endsWith('/index.html')) {
    event.respondWith(
      fetch(u, { cache: 'no-cache' })
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(event.request).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  /* 4. Everything else (icons, manifest, fonts): stale-while-revalidate. */
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
