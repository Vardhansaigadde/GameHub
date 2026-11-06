// Keeps the app shell and the movie list cached so Dumb Charades works offline.
// Network first (so updates show up straight away), the saved copy as the fallback.
const CACHE = 'gamehub-v24';
const SHELL = ['/', '/index.html', '/style.css', '/arena.css', '/arcade.css', '/games-arcade.js', '/battle-scenes.js', '/battle-scenes.css', '/theme-light.css', '/games-battle.js', '/games-telephone.js', '/app.js', '/fx.js', '/icons/icon.svg', '/sound.js', '/games-party.js', '/games-ipl.js', '/data/telugu-movies.json', '/manifest.webmanifest', '/terms', '/privacy', '/legal.css', '/socket.io/socket.io.js', '/icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// A sleeping server is slow or answers with its own waking-up page, so:
//  - never store anything that isn't really ours
//  - if the network hasn't answered in time, open the saved copy; our own loading screen takes it from there
const NETWORK_WAIT_MS = 3000;

async function isOurs(res, isNav, url) {
  if (!res.ok) return false;
  const type = res.headers.get('content-type') || '';
  if (isNav) return /id="(bootSplash|legalPage)"/.test(await res.clone().text());
  return url.pathname.endsWith('.html') || !type.includes('text/html');
}

async function respond(request, url) {
  const isNav = request.mode === 'navigate';
  // every address of the game itself is the same saved page; other pages are saved as themselves
  const isApp = url.pathname === '/' || url.pathname === '/index.html';
  const key = isApp ? '/' : isNav ? url.pathname : request;
  const cached = await caches.match(key);
  const network = fetch(request).then(async res => {
    const good = await isOurs(res, isNav, url);
    if (good) (await caches.open(CACHE)).put(key, res.clone());
    return { res, good };
  });
  if (!cached) return network.then(n => n.res);
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(cached), NETWORK_WAIT_MS);
    network.then(n => { clearTimeout(timer); resolve(n.good ? n.res : cached); }, () => { clearTimeout(timer); resolve(cached); });
  });
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const live = url.pathname.startsWith('/socket.io') && url.pathname !== '/socket.io/socket.io.js';
  if (e.request.method !== 'GET' || url.origin !== location.origin || live || url.pathname.startsWith('/api/')) return;
  e.respondWith(respond(e.request, url));
});
