/**
 * Minimal safe service worker: never uses Cache.put on POST/PUT/etc.
 * The Cache API only supports GET requests; caching uploads breaks file APIs.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" && req.method !== "HEAD") {
    event.respondWith(fetch(req));
    return;
  }
  event.respondWith(fetch(req));
});
