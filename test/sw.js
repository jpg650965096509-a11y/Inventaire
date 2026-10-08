/* Service worker : mode hors ligne de l'inventaire.
   CE FICHIER EST IDENTIQUE pour la production (/Inventaire/) et le test (/Inventaire/test/) : à envoyer tel quel aux deux endroits.
   Le nom du cache est déduit du dossier d'où il est servi, et seules les anciennes versions du cache de CET environnement sont supprimées. */
var VERSION_CACHE = 5; /* à augmenter seulement si la logique du cache change */
var TEST = /\/test\/[^/]*$/.test(self.location.pathname);
var PREFIX = TEST ? 'inventaire-test-v' : 'inventaire-v';
var V = PREFIX + VERSION_CACHE;
var FAM = new RegExp('^' + PREFIX + '\\d+$');
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
      return Promise.all(ks.filter(function (k) { return FAM.test(k) && k !== V; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var u = new URL(r.url);
  /* Seulement http(s) : les requêtes d'extensions du navigateur (chrome-extension:, etc.) ne sont pas mises en cache */
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
  /* La synchronisation Firebase ne passe jamais par le cache */
  if (/firebaseio\.com$|firebasedatabase\.app$/.test(u.hostname)) return;

  if (r.mode === 'navigate' || u.origin === location.origin) {
    /* Page de l'app : réseau d'abord (pour recevoir les mises à jour), cache si hors ligne.
       no-cache = on revalide toujours auprès du serveur (sinon le navigateur peut resservir une ancienne version pendant ~10 minutes) */
    e.respondWith(
      fetch(r, { cache: 'no-cache' }).then(function (res) {
        var cp = res.clone();
        caches.open(V).then(function (c) { return c.put(r, cp); }).catch(function () {});
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
          caches.open(V).then(function (c) { return c.put(r, cp); }).catch(function () {});
          return res;
        });
      })
    );
  }
});
