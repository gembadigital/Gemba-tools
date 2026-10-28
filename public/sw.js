// Gemba Tools service worker (Faz 6.3 — PWA). Keeps the app shell and built assets so the app opens
// from the home screen on a weak connection. It never caches /api/ (data, sessions, photos): those
// always go to the network. Pages are network-first, so a new deploy shows up on the next launch.
const VERSION = "gemba-shell-v1";
const SHELL = ["/", "/index.html", "/favicon.png", "/manifest.webmanifest", "/kaizen-icon-192.png", "/kaizen-icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Pages: network first, cached shell when offline (the SPA routes everything through index.html).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put("/index.html", copy)); return res; })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }
  // Built assets have content hashes in their names: cache first, fill the cache on first use.
  if (url.pathname.startsWith("/assets/") || SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
