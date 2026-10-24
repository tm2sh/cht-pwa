/* Increase this version when changing the files cached at installation. */
const CACHE_PREFIX = 'cht-pwa-layout:' + self.registration.scope + ':';
const CACHE_NAME = CACHE_PREFIX + 'v27';
const APP_FILES = [
  './',
  './index.html',
  './styles.css?v=21',
  './app.js?v=24',
  './media/lake-boat.jpg',
  './media/lake-shore.jpg',
  './media/flowers-poster.jpg',
  './media/flowers-5s.mp4',
  './media/grandma-voice.m4a',
  './media/max-voice.m4a',
  './manifest.webmanifest',
  './vendor/lucide.min.js',
  './icons/icon.svg',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_FILES.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Include the scope in the cleanup boundary: other PWAs on this origin are unrelated.
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

async function rangedResponse(response, range) {
  const bytes = await response.arrayBuffer();
  const size = bytes.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const invalid = () => new Response(null, {status:416, headers:{'Content-Range':'bytes */'+size}});
  if(!match || (!match[1] && !match[2]) || !size) return invalid();
  let start, end;
  if(!match[1]) {
    const suffix = Number(match[2]);
    if(!suffix) return invalid();
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }
  if(start >= size || start > end) return invalid();
  const headers = new Headers(response.headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Range', 'bytes '+start+'-'+end+'/'+size);
  headers.set('Content-Length', String(end - start + 1));
  headers.delete('Content-Encoding');
  return new Response(bytes.slice(start, end + 1), {status:206, statusText:'Partial Content', headers});
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Native video players request byte ranges, including when the PWA is offline.
    const range = request.headers.get('Range');
    if(range) {
      const complete = await cache.match(url.href);
      if(complete?.status === 200) return rangedResponse(complete, range);
    }
    try {
      // Prefer fresh files during layout iterations; the cache is the offline fallback.
      const response = await fetch(request, { cache: 'no-cache' });
      if (response.ok && response.status !== 206 && response.type === 'basic') await cache.put(request, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return range ? rangedResponse(cached, range) : cached;
      if (request.mode === 'navigate') {
        const shell = await cache.match(new URL('./index.html', scope));
        if (shell) return shell;
      }
      throw error;
    }
  })());
});
