/* eslint-disable no-restricted-globals */
// MediScan Offline-First PWA Service Worker
const CACHE_PREFIX = 'mediscan-pwa-';
const CACHE_VERSION = '__SW_CACHE_VERSION__';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION === '__SW_CACHE_' + 'VERSION__' ? 'v1' : CACHE_VERSION}`;

const CORE_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

// Populated at build time by scripts/inject-sw-precache.js
const INJECTED_PRECACHE_ASSETS = /* __SW_PRECACHE_ASSETS__ */ [];

const PRECACHE_ASSETS = Array.from(new Set([...CORE_SHELL_ASSETS, ...INJECTED_PRECACHE_ASSETS]));

function isDevServer() {
  return (
    self.location.hostname === 'localhost' &&
    self.location.port === '8081'
  );
}

function isImmutableStaticAsset(pathname) {
  return pathname.startsWith('/_expo/static/') || pathname.startsWith('/assets/');
}

function extractHtmlBundleUrls(htmlText) {
  const urls = [];
  const regex = /(?:src|href)=["'](\/(?:_expo\/static|assets)\/[^"']+)["']/g;
  let match = regex.exec(htmlText);
  while (match !== null) {
    urls.push(match[1]);
    match = regex.exec(htmlText);
  }
  return urls;
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  if (isDevServer()) return;

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(
        PRECACHE_ASSETS.map(async (url) => {
          const response = await fetch(url, { cache: 'reload' });
          if (response.ok) {
            await cache.put(url, response.clone());
            if (url === '/index.html') {
              const html = await response.text();
              const discovered = extractHtmlBundleUrls(html);
              await Promise.allSettled(
                discovered.map(async (assetUrl) => {
                  const existing = await cache.match(assetUrl);
                  if (!existing) {
                    const assetRes = await fetch(assetUrl);
                    if (assetRes.ok) await cache.put(assetUrl, assetRes);
                  }
                }),
              );
            }
          }
        }),
      );
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  if (isDevServer()) return;

  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept cross-origin requests (e.g., Supabase Auth/REST/Realtime/Storage)
  if (url.origin !== self.location.origin) return;

  // Never intercept API routes, Vercel internals, or the service worker script itself
  if (
    url.pathname === '/sw.js' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_vercel/')
  ) {
    return;
  }

  // 1. HTML Navigation requests: Network-First with Offline App-Shell Fallback (/index.html)
  const acceptHeader = request.headers.get('accept') || '';
  if (request.mode === 'navigate' || acceptHeader.includes('text/html')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            await cache.put(request, networkResponse.clone());
            if (url.pathname === '/' || url.pathname === '/index.html') {
              await cache.put('/index.html', networkResponse.clone());
            }
          }
          return networkResponse;
        } catch {
          const cachedExact = await cache.match(request, { ignoreSearch: true });
          if (cachedExact) return cachedExact;

          const cachedIndex =
            (await cache.match('/index.html')) || (await cache.match('/'));
          if (cachedIndex) return cachedIndex;

          return new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }
      })(),
    );
    return;
  }

  // 2. Content-hashed Expo bundles, SQLite WASM, Workers, Fonts, Images: Cache-First
  if (isImmutableStaticAsset(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;

        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
          await cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      })(),
    );
    return;
  }

  // 3. Same-origin metadata/icons (manifest.json, icon-192.png, etc.): Stale-While-Revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      const networkPromise = fetch(request)
        .then(async (networkResponse) => {
          if (networkResponse.ok) {
            await cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(networkPromise);
        return cached;
      }

      const networkResponse = await networkPromise;
      if (networkResponse) return networkResponse;

      return new Response('Offline', { status: 503 });
    })(),
  );
});
