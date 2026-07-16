// Service Worker offline-first para CorreosTest
// Solo se activa cuando la app se sirve por http(s) — no funciona desde file://
//
// Estrategia:
//   - Shell (HTML/JS/CSS/datos): network-first con fallback a caché.
//     Así cada deploy llega a los usuarios sin depender de bumps manuales
//     de versión, y la app sigue funcionando entera sin conexión.
//   - Estáticos pesados e inmutables (iconos, audio, fuentes): cache-first.
//   - /api/*: nunca se cachea.

const CACHE_NAME = 'correostest-v6';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './css/cartito.css',
  './css/tutor.css',
  './data/temario.js',
  './data/temario_content.js',
  './data/temario_resumen.js',
  './data/questions.js',
  './data/extra_questions.js',
  './data/explanations.js',
  './data/activation_hashes.js',
  './js/storage.js',
  './js/srs.js',
  './js/stats.js',
  './js/data.js',
  './js/app.js',
  './js/tutor.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

const CACHE_FIRST = /\.(png|jpg|jpeg|svg|ico|mp3|woff2?)$/i;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      );
    }).then(() => self.clients.claim())
  );
});

function cachePut(request, response) {
  if (!response || response.status !== 200 || response.type !== 'basic') return response;
  const clone = response.clone();
  caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
  return response;
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Nunca cachear el endpoint del tutor IA
  if (url.pathname.startsWith('/api/')) return;

  // Estáticos inmutables: cache-first
  if (CACHE_FIRST.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(r => cachePut(event.request, r))
      )
    );
    return;
  }

  // Shell y datos: network-first con fallback a caché (offline)
  event.respondWith(
    fetch(event.request)
      .then(r => cachePut(event.request, r))
      .catch(() =>
        caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        })
      )
  );
});
