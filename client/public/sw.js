/**
 * Minimal safe service worker: never uses Cache.put on POST/PUT/etc.
 * The Cache API only supports GET requests; caching uploads breaks file APIs.
 *
 * Updated: Explicitly bypass API requests to avoid auth issues.
 */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never intercept API requests - let them go directly to server
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(req));
    return;
  }

  // Only handle GET/HEAD for potential caching
  if (req.method !== "GET" && req.method !== "HEAD") {
    event.respondWith(fetch(req));
    return;
  }

  // For static assets, try cache first, then network
  event.respondWith(
    fetch(req).catch(() => {
      // If network fails, try cache
      return caches.match(req);
    })
  );
});

// Listen for messages from the main thread
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});
