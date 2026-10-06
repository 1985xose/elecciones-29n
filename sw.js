/* Service worker: la carcasa se guarda para abrir al instante, los datos siempre se piden a la red y se guarda copia por si no hay cobertura */
const CACHE = "29n-v12";
const CARCASA = ["./", "./index.html", "./assets/style.css", "./assets/app.js", "./assets/modelo.js", "./assets/media.js", "./manifest.json", "./assets/icono-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CARCASA)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.includes("/data/")) {
    e.respondWith(fetch(e.request).then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r; }).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(fetch(e.request).then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  }
});
