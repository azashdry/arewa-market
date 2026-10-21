// =====================================================
// AREWA MARKET - SERVICE WORKER
// Yana sa app ya zama installable kuma yana bada ɗan
// offline fallback. Network-first ne, don haka sabbin
// canje-canje suna fitowa kai tsaye (babu tsohon cache).
// =====================================================

const CACHE = "arewa-market-v1";

const PRECACHE = [
  "./",
  "./index.html",
  "./login.html",
  "./register.html",
  "./manifest.json",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Idan wani fayil bai wanzu ba, ba zai hana installing ba
      Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {

  const req = event.request;
  const url = new URL(req.url);

  // Fayilolin shafin namu kaɗai (ba Firebase/Firestore/Cloudinary ba)
  if(req.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if(res && res.ok){
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) =>
          hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined)
        )
      )
  );
});
