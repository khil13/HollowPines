/* Hollow Pines service worker: keeps the whole game on the device so it opens offline from the home screen.
   build.py fills in the cache name (changes with every build) and the file list. */
const CACHE = 'hollowpines-__BUILD__', FONTS = 'hollowpines-fonts', FILES = __FILES__;
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
// a new build replaces the old cache; the page picks it up the next time the game is opened
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('hollowpines-') && k !== CACHE && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return; const url = new URL(req.url);
  if (url.origin === location.origin) { e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req))); return; }
  // Google Fonts: keep a copy so the lettering looks the same offline; fall back to system fonts if never fetched
  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) e.respondWith(caches.open(FONTS).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { c.put(req, res.clone()); return res; }).catch(() => new Response('', { status: 503 })))));
});
