/*
  Arewa Market — minimal service worker.

  This exists mainly to satisfy PWA installability
  requirements (so browsers show "Add to Home Screen" /
  "Install app"). It also gives basic offline caching
  for the app's own static files.

  It does NOT cache Firebase/Firestore data, so the app's
  live data (products, users, messages, etc.) always comes
  fresh from the network as normal.
*/

const CACHE_NAME = "arewa-market-v1";

const APP_SHELL = [
  "./index.html",
  "./login.html",
  "./register.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(APP_SHELL).catch(() => {
        /* Ignore individual file failures during install */
      })
    )
  );

  self.skipWaiting();

});


self.addEventListener("activate", event => {

  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();

});


self.addEventListener("fetch", event => {

  const request = event.request;

  /*
    Only handle simple same-origin GET requests for our own
    static files. Everything else (Firebase Auth, Firestore,
    external images, etc.) is left completely untouched and
    goes straight to the network as normal.
  */

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {

      const networkFetch = fetch(request)
        .then(response => {

          if (response && response.ok) {

            const responseClone = response.clone();

            caches.open(CACHE_NAME).then(cache =>
              cache.put(request, responseClone)
            );

          }

          return response;

        })
        .catch(() => cached);

      return cached || networkFetch;

    })
  );

});
