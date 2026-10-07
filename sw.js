// Shuffle Up service worker.
// - The app itself (page, manifest, icons) is cached so it opens with poor or no signal.
// - playgroup.gg deck data is fetched fresh when online; the last copy is used when offline.
// Bump VERSION whenever the app files change so phones pick up the new version.
const VERSION = "v2";
const APP_CACHE = `shuffleup-app-${VERSION}`;
const DATA_CACHE = "shuffleup-data";
const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith("shuffleup-app-") && k !== APP_CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Try the network first, fall back to the cached copy.
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === "https://playgroup.gg" && url.pathname.startsWith("/api/public/")) {
    event.respondWith(networkFirst(req, DATA_CACHE));
    return;
  }
  if (url.origin === self.location.origin) {
    // Pages: network first so updates show up straight away. Other app files: cache first.
    if (req.mode === "navigate") {
      event.respondWith(networkFirst(req, APP_CACHE).catch(() => caches.match("./index.html")));
    } else {
      event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    }
  }
});
