/* Service worker. Todo se pide siempre a la red (revalidando contra GitHub, que es barato) y la copia
   guardada solo se usa si no hay cobertura. Así nunca se queda una versión vieja pegada. */
const CACHE = "29n-v16";
const CARCASA = ["./", "./index.html", "./assets/style.css", "./assets/app.js", "./assets/modelo.js", "./assets/media.js", "./manifest.json", "./assets/icono-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CARCASA.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: "no-cache" })
    .then((r) => { if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
