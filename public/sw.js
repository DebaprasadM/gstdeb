/* HisabKitab service worker: app-shell offline support.
 * - Navigations: network-first, fallback to cached shell (dashboard) when offline.
 * - Static assets (_next/static, icons): cache-first.
 * - NEVER caches /api/* (auth + financial data always go to network).
 */
const VERSION = "hk-v3";
const STATIC_CACHE = `hk-static-${VERSION}`;
const PAGES_CACHE = `hk-pages-${VERSION}`;
const SHELL_FALLBACK = "/dashboard";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(["/", "/login", "/icons/icon-192.png"])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) return; // never cache API
  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(PAGES_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit ?? caches.match(SHELL_FALLBACK)))
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
            return res;
          })
      )
    );
  }
});
