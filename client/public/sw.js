const CACHE_NAME = "focus-walker-v2"; // Incremented version
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon.png",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", // Cache the Leaflet CSS!
];

// 1. Install - Cache core UI
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 2. Activate - Cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
});

// 3. Fetch - Smart Caching
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Special logic for Map Tiles (CartoDB or OpenStreetMap)
  if (
    url.hostname.includes("basemaps.cartocdn.com") ||
    url.hostname.includes("tile.openstreetmap.org")
  ) {
    event.respondWith(
      caches.open("map-tiles").then((cache) => {
        return cache.match(request).then((response) => {
          // Return from cache OR fetch and save to cache
          return (
            response ||
            fetch(request).then((networkResponse) => {
              cache.put(request, networkResponse.clone());
              return networkResponse;
            })
          );
        });
      })
    );
  } else {
    // Default strategy for UI: Check cache first, then network
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request);
      })
    );
  }
});
