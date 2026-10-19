/* Kiff Kiff — service worker.
 * Réseau d’abord (on reçoit toujours la dernière version quand il y a du réseau),
 * sinon la copie gardée au dernier passage : le jeu sur un téléphone marche hors ligne.
 * Le mode deux téléphones a besoin du réseau (relais), il n’est pas concerné. */
const CACHE = 'kiffkiff-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!same && !fonts) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const home = await cache.match('./index.html') || await cache.match('./');
        if (home) return home;
      }
      throw err;
    }
  })());
});

/* Avertissements (« À toi de jouer »), même l’appli fermée.
 * Le message arrive chiffré pour ce téléphone seul ; il ne contient jamais l’envie elle-même,
 * seulement le genre de nouvelle, la partie et le prénom de l’autre. */
const PARTIE = /^[a-z2-9]{12}$/;
function avis(m) {
  const n = String(m.n || '').replace(/\s+/g, ' ').trim().slice(0, 20) || 'L’autre';
  if (m.k === 'kiff') return 'Kiff kiff avec ' + n + ' : viens voir.';
  if (m.ph === 'review') return n + ' attend ta réponse.';
  if (m.ph === 'reconfirm') return n + ' a changé une chose : à toi de répondre.';
  if (m.ph === 'compose') return 'À toi de proposer : ' + n + ' attend.';
  return n + ' t’attend : c’est à toi.';
}
self.addEventListener('push', (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch (err) { m = {}; }
  const room = PARTIE.test(m.r || '') ? m.r : '';
  e.waitUntil(self.registration.showNotification('Kiff Kiff', {
    body: avis(m),
    icon: 'icons/icon-192.png',
    badge: 'icons/badge-96.png',
    tag: 'kk-' + (room || 'partie'),
    renotify: true,
    data: { r: room }
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const room = (e.notification.data && e.notification.data.r) || '';
  const url = new URL(room ? './?jouer=' + room : './', self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = wins.find((c) => new URL(c.url).origin === self.location.origin);
    if (w) {
      w.postMessage({ kk: 'jouer', r: room });
      return w.focus ? w.focus() : null;
    }
    return self.clients.openWindow(url);
  })());
});
// Le navigateur a changé l’adresse : on en reprend une ; l’appli la donnera aux parties à son prochain passage
self.addEventListener('pushsubscriptionchange', (e) => {
  const opts = e.oldSubscription && e.oldSubscription.options;
  if (opts && opts.applicationServerKey) e.waitUntil(self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: opts.applicationServerKey }).catch(() => {}));
});
