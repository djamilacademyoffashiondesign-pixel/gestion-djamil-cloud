/* SanaaPro — service worker
   But: rendre l'application installable et disponible hors-ligne,
   SANS jamais interférer avec Firebase / Firestore (données en temps réel).
   Toute requête vers un autre domaine (googleapis, gstatic, etc.) passe
   directement au réseau : le service worker ne la touche pas. */

const CACHE = 'sanaapro-v1';
const APP_SHELL = ['./', './index.html', './manifest.json'];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(APP_SHELL).catch(function () {});
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    const keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k !== CACHE; })
                          .map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Ne jamais intercepter les autres domaines (Firebase, CDN, etc.)
  if (url.origin !== self.location.origin) return;

  // Navigation (ouverture de l'app) : réseau d'abord, cache en secours hors-ligne.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (r) {
          return r || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Fichiers statiques même origine : cache d'abord, sinon réseau.
  event.respondWith(
    caches.match(req).then(function (cached) {
      return cached || fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      });
    })
  );
});
