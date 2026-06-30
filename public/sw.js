// Loop Vocabulary Service Worker
// Handles: push notifications, offline cache

const CACHE_NAME = "lv-v1";
const PRECACHE_URLS = ["/", "/offline", "/dashboard", "/review", "/learn"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

// Network-first with offline fallback
self.addEventListener("fetch", (e) => {
  // Only handle GET requests for same-origin navigation/pages
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  // Skip API routes — always go to network
  if (url.pathname.startsWith("/api/")) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Cache successful page responses
        if (res.ok && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(e.request);
        if (cached) return cached;
        // Navigation requests → offline page
        if (e.request.mode === "navigate") {
          return caches.match("/offline") ?? Response.error();
        }
        return Response.error();
      })
  );
});

// Push notification handler
self.addEventListener("push", (e) => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || "Loop Vocabulary";
  const options = {
    body: data.body || "今日の復習をしましょう！",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    data: { url: data.url || "/review" },
    vibrate: [200, 100, 200],
    actions: [
      { action: "open", title: "今すぐ復習" },
      { action: "dismiss", title: "後で" },
    ],
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  if (e.action === "dismiss") return;
  const url = e.notification.data?.url || "/review";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
