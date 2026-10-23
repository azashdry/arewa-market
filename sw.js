// =====================================================
// AREWA MARKET - SERVICE WORKER
// Yana sa app ya zama installable kuma yana bada ɗan
// offline fallback. Network-first ne, don haka sabbin
// canje-canje suna fitowa kai tsaye (babu tsohon cache).
// =====================================================

const CACHE = "arewa-market-v2";

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


/* =====================================================
   PUSH NOTIFICATIONS (Firebase Cloud Messaging)
===================================================== */

self.addEventListener("push", (event) => {

  let payload = {};
  try{
    payload = event.data ? event.data.json() : {};
  }catch(e){
    payload = { title: "Arewa Market", body: event.data ? event.data.text() : "" };
  }

  // FCM yana saka bayanai a cikin "data"
  const d = payload.data || payload.notification || payload;

  const title = d.title || "Arewa Market";
  const options = {
    body: d.body || "",
    icon: d.icon || "icon-192.png",
    badge: "icon-192.png",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || "index.html" }
  };

  event.waitUntil(
    // Idan mutum yana kallon app a yanzu, kada a nuna sanarwa (kamar Messenger)
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const focused = list.some((c) => c.visibilityState === "visible" && c.focused);
      if(focused) return;
      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener("notificationclick", (event) => {

  event.notification.close();

  const target = new URL(
    (event.notification.data && event.notification.data.url) || "index.html",
    self.registration.scope
  ).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for(const c of list){
        if("focus" in c){
          return c.focus().then((w) => (w && "navigate" in w) ? w.navigate(target) : w);
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
