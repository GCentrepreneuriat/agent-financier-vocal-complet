// Service worker minimal : permet l'installation (PWA) et un cache léger
// de la coquille de l'app. On ne met JAMAIS en cache l'API ni le flux audio.
const CACHE = "agent-financier-v1";
const COQUILLE = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(COQUILLE)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Laisser passer l'API, le WebSocket et tout ce qui n'est pas GET
  if (e.request.method !== "GET" || url.pathname.startsWith("/api") || url.pathname.startsWith("/audio")) {
    return;
  }
  // Réseau d'abord, repli sur le cache hors-ligne
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then((r) => r || caches.match("/"))));
});
