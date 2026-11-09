// VODA Prime offline support: keeps a copy of the app on the phone so it opens without signal.
// Truck data is not cached here; the app keeps its own last-known copy.
const CACHE = "voda-fleet-v50";
const SHELL = ["./", "./index.html", "./config.js", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./favicon-32.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request) {
  const network = fetch(request).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(request, copy)); }
    return res;
  });
  const fallback = () => caches.match(request, { ignoreSearch: true })
    .then(hit => hit || (request.mode === "navigate" ? caches.match("./index.html") : undefined));
  // Wait at most 4 seconds for the network before using the saved copy.
  const timeout = new Promise(resolve => setTimeout(resolve, 4000)).then(fallback);
  return Promise.race([network.catch(fallback), timeout.then(hit => hit || network)]);
}

function cacheFirst(request) {
  return caches.match(request).then(hit => hit || fetch(request).then(res => {
    if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(request, copy)); }
    return res;
  }));
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(req));
  else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") event.respondWith(cacheFirst(req));
  // Everything else (the Google Sheet) goes straight to the network.
});
