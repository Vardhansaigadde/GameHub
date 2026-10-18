// Keeps the app shell and the movie list cached so Dumb Charades works offline.
// Network first (so updates show up straight away), cache as the fallback.
const CACHE = 'gamehub-v3';
const SHELL = ['/', '/index.html', '/style.css', '/app.js', '/sound.js', '/games-party.js', '/games-ipl.js', '/data/telugu-movies.json', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/socket.io') || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(url.pathname === '/' ? '/' : e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(url.pathname === '/' || url.search.includes('charades') ? '/' : e.request))
  );
});
