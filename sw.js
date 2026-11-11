// =====================================================
// AREWA MARKET - SERVICE WORKER (v2)
// - Shafukan namu: network-first (sabbin canje-canje suna fitowa),
//   amma idan net ya yi jinkiri ko babu, ana nuna na cache.
// - Firebase SDK, fonts, icons: ana ajiye su don app ya buɗe ba tare da data ba.
// - Hotuna (profile, products, posters): ana ajiye su (iyakar 120).
// - BA a taɓa bidiyo, Firestore, Auth ko wani API.
// =====================================================

const VERSION = "v4";
const SHELL = "arewa-shell-" + VERSION;
const MEDIA = "arewa-media-" + VERSION;
const MEDIA_MAX = 120;
const SLOW_MS = 6000;

const PRECACHE = [
  "./",
  "./index.html",
  "./login.html",
  "./register.html",
  "./feed.html",
  "./reels.html",
  "./offline.html",
  "./reels.js",
  "./bottom-nav.js",
  "./firebase.js",
  "./monitor.js",
  "./splash.js",
  "./manifest.json",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      // Idan wani fayil bai wanzu ba, ba zai hana installing ba
      Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== MEDIA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStaticCdn(url) {
  return (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com" ||
    url.hostname === "cdn.jsdelivr.net" ||
    (url.hostname === "www.gstatic.com" && url.pathname.indexOf("/firebasejs/") === 0)
  );
}

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

// Shafukan namu: network-first, tare da fallback zuwa cache
async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(req, { ignoreSearch: true });

  const net = fetch(req, { cache: "no-cache" }).then((res) => {
    if (res && res.status === 200 && res.type === "basic") cache.put(req, res.clone()).catch(() => {});
    return res;
  });

  const offline = async () => {
    if (cached) return cached;
    if (req.mode === "navigate") {
      return (await cache.match("./offline.html")) || (await cache.match("./index.html")) || Response.error();
    }
    return Response.error();
  };

  // Fayilolin JS/CSS ba a taɓa ba su tsoho idan net yana jinkiri (don kada tsohon JS ya haɗu da sabon HTML)
  if (!cached || req.mode !== "navigate") return net.catch(offline);
  // Shafi kaɗai: idan net ya yi jinkiri sosai, a nuna na cache yayin da sabon ke saukowa a baya
  return Promise.race([
    net,
    new Promise((resolve) => setTimeout(() => resolve(cached), SLOW_MS))
  ]).catch(() => cached);
}

// Fonts / icons / Firebase SDK: cache da farko, a sabunta a baya
async function staleWhileRevalidate(req) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => {
    if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
    return res;
  });
  if (hit) { net.catch(() => {}); return hit; }
  return net;
}

// Hotuna: cache da farko. Ana neman su ta CORS don kada a ajiye "opaque" (masu nauyi a quota)
async function cacheFirstImage(req) {
  const cache = await caches.open(MEDIA);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  try {
    let res = null;
    try { res = await fetch(req.url, { mode: "cors", credentials: "omit" }); } catch (e) { res = null; }
    if (res && res.ok) {
      cache.put(req.url, res.clone()).then(() => trim(MEDIA, MEDIA_MAX)).catch(() => {});
      return res;
    }
    return await fetch(req); // ba a ajiye shi
  } catch (e) {
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.headers.has("range")) return;                                   // bidiyo/audio
  if (req.destination === "video" || req.destination === "audio") return; // ba a taɓa bidiyo
  const url = new URL(req.url);
  if (url.protocol !== "https:" && url.protocol !== "http:") return;

  if (url.origin === self.location.origin) { event.respondWith(networkFirst(req)); return; }
  if (isStaticCdn(url)) { event.respondWith(staleWhileRevalidate(req)); return; }
  if (req.destination === "image") { event.respondWith(cacheFirstImage(req)); return; }
  // Firestore, Auth, Cloudinary upload, da sauran: ba a taɓa su ba
});
