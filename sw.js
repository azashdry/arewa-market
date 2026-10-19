/*
  Arewa Market — service worker (v8)

  - Shafukan HTML: network-first (kullum sabon fayil yake zuwa),
    idan babu network sai a yi amfani da wanda aka adana.
  - Sauran fayiloli (css/js/hotuna): adanawa da sabuntawa a baya.
  - Ba ya taba Firebase/Firestore ko wasu shafukan waje.
  - Idan komai ya gaza, yana mayar da sako mai sauki maimakon
    ya bar browser ya nuna ERR_FAILED.
*/

const CACHE_NAME = "arewa-market-v8";

const APP_SHELL = [
  "./index.html",
  "./login.html",
  "./register.html",
  "./friends.html",
  "./messages.html",
  "./groups.html",
  "./status.html",
  "./manifest.json",
  "./i18n.js",
  "./bottom-nav.js",
  "./report.js",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(APP_SHELL.map(url => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function offlineResponse() {
  return new Response("Offline - ba a samu haɗin intanet ko server ba.", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isPage =
    request.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith("/");

  if (isPage) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request, { ignoreSearch: true })
            .then(cached => cached || caches.match("./index.html"))
            .then(cached => cached || offlineResponse())
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, copy));
          }
          return response;
        })
        .catch(() => cached || offlineResponse());

      return cached || network;
    })
  );
});
