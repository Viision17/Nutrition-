/* Service worker : fonctionne hors connexion, se met à jour dès qu'il y a du réseau,
   et prévient quand le repos est terminé même si l'appli est en arrière-plan. */
const V = "forme-v15";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
let restId = 0, restCancelled = false;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((res) => { const copy = res.clone(); caches.open(V).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then((m) => m || caches.match("./index.html")))
  );
});

/* Fin de repos : notification si l'appli n'est pas au premier plan */
self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "rest-cancel") { restCancelled = true; restId++; return; }
  if (d.type !== "rest") return;
  const my = ++restId; restCancelled = false;
  const wait = Math.max(0, d.end - Date.now());
  if (wait > 290000) return; // un événement de service worker ne peut pas durer plus de ~5 min
  e.waitUntil(new Promise((resolve) => {
    setTimeout(async () => {
      try {
        if (my === restId && !restCancelled) {
          const cs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
          if (!cs.some((c) => c.visibilityState === "visible")) {
            await self.registration.showNotification("Repos terminé", {
              body: d.body || "C'est reparti !", tag: "rest", renotify: true,
              vibrate: [300, 120, 300, 120, 500], icon: "icon-192.png", badge: "icon-192.png"
            });
          }
        }
      } catch (x) {}
      resolve();
    }, wait);
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    for (const c of cs) if ("focus" in c) return c.focus();
    return self.clients.openWindow("./index.html");
  }));
});
