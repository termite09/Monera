const CACHE = "monera-v1";

const STATIC_EXTENSIONS = [".js", ".css", ".woff", ".woff2", ".png", ".ico", ".svg", ".webp"];

function isStaticAsset(url) {
  const path = new URL(url).pathname;
  return STATIC_EXTENSIONS.some((ext) => path.endsWith(ext)) || path.startsWith("/_next/static/");
}

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never intercept auth or API routes
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  // Never intercept cross-origin requests (Google APIs, etc.)
  if (url.origin !== self.location.origin) return;

  if (isStaticAsset(request.url)) {
    // Cache-first for static assets
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
  } else {
    // Network-first for pages; fall back to cache when offline
    e.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});
