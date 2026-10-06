/* Service worker : mode hors ligne de l'inventaire.
   À placer dans le même dossier que inventaire.html (ou index.html). */
var V = 'inventaire-v2';
var LIB = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(V).then(function (c) {
      return Promise.all(['./', LIB].map(function (u) { return c.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var u = new URL(r.url);
  /* La synchronisation Firebase ne passe jamais par le cache */
  if (/firebaseio\.com$|firebasedatabase\.app$/.test(u.hostname)) return;

  if (r.mode === 'navigate' || u.origin === location.origin) {
    /* Page de l'app : réseau d'abord (pour recevoir les mises à jour), cache si hors ligne */
    e.respondWith(
      fetch(r).then(function (res) {
        var cp = res.clone();
        caches.open(V).then(function (c) { c.put(r, cp); });
        return res;
      }).catch(function () {
        return caches.match(r, { ignoreSearch: true }).then(function (m) { return m || caches.match('./'); });
      })
    );
  } else {
    /* Bibliothèque de scan et polices : cache d'abord */
    e.respondWith(
      caches.match(r).then(function (m) {
        return m || fetch(r).then(function (res) {
          var cp = res.clone();
          caches.open(V).then(function (c) { c.put(r, cp); });
          return res;
        });
      })
    );
  }
});
