// Offline support. The app itself is fetched fresh whenever there is internet
// (so updates show up right away); the stored copy is only used offline.
const CACHE = "orderboken-v3";
const FILES = ["./", "./index.html", "./manifest.json", "./icon-180.png", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const mine = url.origin === location.origin;
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!mine && !fonts) return; // e.g. the optional Claude API: always live
  if (mine) {
    // network first, bypassing the browser's HTTP cache; fall back to the stored copy offline
    e.respondWith(
      fetch(req, { cache: "no-store" })
        .then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(h => h || caches.match("./")))
    );
    return;
  }
  // fonts: stored copy first (they never change)
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req);
    if (hit) return hit;
    const r = await fetch(req);
    if (r.ok || r.type === "opaque") c.put(req, r.clone());
    return r;
  }));
});
