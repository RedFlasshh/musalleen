/* Musalleen service worker — offline-capable + gentle reminders.
   Strategy:
   - App shell & Next.js assets: cache-first, so the app opens with NO network.
   - Supabase / API calls: network-first (never cached — always fresh data).
   - Navigations offline: fall back to the cached app shell.
*/

// Every production build stamps a real Next.js build ID in here automatically
// (see scripts/inject-sw-version.mjs, wired into `npm run build`) — this
// literal only matters for local `next dev`, where that script never runs.
const CACHE = "musalleen-v1";
const APP_SHELL = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png"];
const NAV_TIMEOUT_MS = 2500; // don't let a slow/flaky connection hang the launch — fall back to cache quickly

function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("nav-timeout")), ms);
    fetch(req).then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // drop old caches from previous versions
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

function isApiRequest(url) {
  return (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("supabase.in") ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/rest") ||
    url.pathname.includes("/functions/")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never cache writes

  const url = new URL(req.url);

  // 1) API / auth / data → network-first, never serve stale data
  if (isApiRequest(url)) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // 2) Page navigations → try network (briefly), fall back to cached shell on
  //    slow/flaky or dead connections — a bare fetch() can hang for 20-30s on
  //    a weak signal, which shows Chrome's own offline page before our catch
  //    ever runs, so we race it against a short timeout instead.
  if (req.mode === "navigate") {
    event.respondWith(
      fetchWithTimeout(req, NAV_TIMEOUT_MS)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/")))
    );
    return;
  }

  // 3) Same-origin assets (JS/CSS/fonts/images) → cache-first, update in background
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // 4) Everything else (CDNs, fonts) → network, fall back to cache
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

/* ---------- Reminders ---------- */
// The daily and Friday pushes use DIFFERENT tags (server sets payload.tag) so
// a Friday push never replaces/suppresses the same day's daily push, or vice
// versa — Chrome collapses same-tag notifications into one, which would
// silently drop the second push the habit-engine plan explicitly asked for.
self.addEventListener("push", (event) => {
  let payload = { title: "Musalleen", body: "Send blessings on the Prophet ﷺ today.", url: "/", tag: "musalleen-daily" };
  try { if (event.data) payload = { ...payload, ...event.data.json() }; } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.tag,
      renotify: false,
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
