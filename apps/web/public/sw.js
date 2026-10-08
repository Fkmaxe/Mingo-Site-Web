// BDE Mingo service worker: offline tickets, offline check-in screen, cached static assets,
// push notifications.
// Plain JS on purpose (served as is, no build step).
const VERSION = "v2";
const STATIC_CACHE = `static-${VERSION}`;
const PAGES_CACHE = `pages-${VERSION}`;
const OFFLINE_URL = "/offline";

// Pages kept for offline use: own tickets and the door check-in screen.
const OFFLINE_PAGES = [/^\/tickets(\/|$)/, /^\/manage\/events\/[^/]+\/checkin$/];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== PAGES_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  // Sent on sign-out: personal pages must not stay on the device.
  if (event.data === "clear-pages") event.waitUntil(caches.delete(PAGES_CACHE));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Versioned build assets never change: cache first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    const keep = OFFLINE_PAGES.some((pattern) => pattern.test(url.pathname));
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (keep && response.ok) {
            const copy = response.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL))
            .then((response) => response || Response.error()),
        ),
    );
  }
});

// --- Push notifications (payload: { title, body, url, tag }, sent by the API) ---

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = typeof data.title === "string" ? data.title : "BDE Mingo";
  // Only paths of this site are opened: a payload cannot send the user elsewhere.
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/home";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      icon: "/icons/192",
      badge: "/icons/192",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/home", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) return open.navigate(url).then((w) => (w || open).focus());
      return self.clients.openWindow(url);
    }),
  );
});
