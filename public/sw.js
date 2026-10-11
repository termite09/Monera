// v2: pages behind sign-in are no longer cached (they carry the session).
// Changing the name deletes the old cache, and anything it held, on activate.
const CACHE = "monera-v2";

// Each release adds new hashed files; old ones are dropped past this many.
const MAX_ENTRIES = 150;

const STATIC_EXTENSIONS = [".js", ".css", ".woff", ".woff2", ".png", ".ico", ".svg", ".webp"];

// Only public pages are kept for offline use. Signed-in pages carry the
// session (including the Google access token), so they never go to disk.
const PUBLIC_PAGES = new Set(["/", "/login", "/privacy", "/terms"]);

function isStaticAsset(url) {
  const path = new URL(url).pathname;
  return STATIC_EXTENSIONS.some((ext) => path.endsWith(ext)) || path.startsWith("/_next/static/");
}

/** Removes the oldest entries once the cache holds more than MAX_ENTRIES. */
async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES)).map((k) => cache.delete(k)));
}

self.addEventListener("install", () => {
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
        if (response.ok) await cache.put(request, response.clone()).then(() => trim(cache));
        return response;
      })
    );
  } else if (PUBLIC_PAGES.has(url.pathname) && request.mode === "navigate") {
    // Network-first for public pages; fall back to cache when offline.
    // Cache write is chained inside respondWith's promise so the event stays
    // active for the full duration — calling waitUntil() from an unchained
    // .then() violates the SW spec and throws InvalidStateError in Firefox.
    e.respondWith(
      fetch(request)
        .then((response) => {
          // A signed-in visitor is redirected on to the dashboard; that page mustn't be kept.
          if (response.ok && !response.redirected) {
            return caches
              .open(CACHE)
              .then((cache) => cache.put(request, response.clone()))
              .then(() => response);
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((r) => r ?? Response.error())
        )
    );
  }
  // Everything else (signed-in pages, their data requests) goes straight to the network.
});
