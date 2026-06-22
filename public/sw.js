/* ═══ Wasserlage 3.0 · Service Worker · Offline-fähiges Revier-Cockpit ═══
 * Strategien:
 *  - Navigation  → network-first, Fallback gecachte Shell, dann Offline-Hinweis
 *  - JS/CSS/Font → stale-while-revalidate
 *  - Revierdaten (pois/de/gelbewelle/pegel JSON) → stale-while-revalidate (offline verfügbar)
 *  - Kartenkacheln (openfreemap/openseamap) → cache-first, gedeckelt
 *  - Live-Daten (Wetter/ELWIS/Pegelonline/Supabase) → network-only (kein veralteter Fake-Live)
 */
const V = 'wl3-v70';
const SHELL = `${V}-shell`, ASSET = `${V}-asset`, DATA = `${V}-data`, TILE = `${V}-tile`;
const SHELL_URLS = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png'];
const TILE_MAX = 600;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_URLS).catch(()=>{})).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => !k.startsWith(V)).map(k => caches.delete(k))
  )).then(()=>self.clients.claim()));
});

const isLive = (h) => /open-meteo\.com|pegelonline\.wsv\.de|supabase\.co|github\.io|nominatim\.openstreetmap\.org|overpass/.test(h);
const isTile = (h) => /tiles\.openfreemap\.org|tiles\.openseamap\.org|basemaps\.cartocdn|tile\./.test(h);
const isData = (u) => /\/data\/.*\.(json|geojson)$/.test(u);

async function swr(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const net = fetch(req).then(r => { if (r && r.ok) cache.put(req, r.clone()); return r; }).catch(()=>null);
  return cached || net || new Response('', { status: 504 });
}
async function tileCache(req) {
  const cache = await caches.open(TILE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const r = await fetch(req).catch(()=>null);
  if (r && r.ok) {
    cache.put(req, r.clone());
    cache.keys().then(ks => { if (ks.length > TILE_MAX) cache.delete(ks[0]); });
  }
  return r || new Response('', { status: 504 });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const h = url.host;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => { caches.open(SHELL).then(c => c.put('./index.html', r.clone())); return r; })
        .catch(async () => (await caches.match('./index.html')) || (await caches.match('./')) ||
          new Response('<!doctype html><meta charset=utf-8><title>Offline</title><body style="font-family:system-ui;background:#04121f;color:#eafaff;display:grid;place-items:center;height:100vh;text-align:center"><div><h1>⚓ Offline</h1><p>Wasserlage ist gerade ohne Netz. Sobald du wieder online bist, lädt alles automatisch.</p></div>', { headers: { 'content-type': 'text/html' } }))
    );
    return;
  }
  if (isLive(h)) return; // network-only: keine veralteten Live-Daten als Wahrheit cachen
  if (isTile(h)) { e.respondWith(tileCache(req)); return; }
  if (url.origin === location.origin && isData(url.pathname)) { e.respondWith(swr(req, DATA)); return; }
  if (url.origin === location.origin && /\.(js|css|woff2?|png|svg|webmanifest)$/.test(url.pathname)) {
    e.respondWith(swr(req, ASSET)); return;
  }
  if (/fonts\.(googleapis|gstatic)\.com/.test(h)) { e.respondWith(swr(req, ASSET)); return; }
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
