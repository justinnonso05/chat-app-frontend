const CACHE_NAME = "Voxs-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/light.jpg",
  "/dark.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Network-first for API/WS, cache-first for static
  if (event.request.url.includes("/ws/") || event.request.url.includes("localhost:8000")) {
    return; // Don't intercept WebSocket or backend
  }
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).catch(() => caches.match("/"))
    )
  );
});
