/* Kiff Kiff — service worker.
 * Réseau d’abord (on reçoit toujours la dernière version quand il y a du réseau),
 * sinon la copie gardée au dernier passage : le jeu sur un téléphone marche hors ligne.
 * Le mode deux téléphones a besoin du réseau (relais), il n’est pas concerné. */
const CACHE = 'kiffkiff-v1';
const TEXTES = 'kiffkiff-textes'; // les textes des avertissements, changés dans l’atelier (posés là par le jeu)
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== TEXTES).map((k) => caches.delete(k))))
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
      // La page elle-même est toujours redemandée au serveur (sans le cache de 10 min de GitHub) :
      // une mise à jour du jeu arrive dès la réouverture de l’appli
      const res = await fetch(req.mode === 'navigate' ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : req);
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
 * Le message arrive chiffré pour ce téléphone seul ; il ne contient jamais l’envie elle-même.
 * Il porte le prénom de l’autre (chiffré, le serveur ne le lit pas). Depuis le 27 octobre 2026, il s’affiche partout
 * (avant : seulement sur iPhone, qui cache le contenu des avertissements tant que l’écran est verrouillé).
 * Ailleurs, l’avertissement reste discret : du nouveau, jamais qui ni quoi. */
const PARTIE = /^[a-z2-9]{12}$/;
async function textes() {
  try { const r = await (await caches.open(TEXTES)).match('./textes-notifs.json'); return r ? await r.json() : {}; } catch (err) { return {}; }
}
function avis(m, t, nom) {
  const x = (k, d) => (t && typeof t[k] === 'string' && t[k].trim() ? t[k] : d);
  // Avec le prénom : la version « -nom » du texte, {prénom} remplacé
  const y = (k, d, kn, dn) => (nom ? x(kn, dn).split('{prénom}').join(nom) : x(k, d));
  if (m.k === 'rappel') {
    if (m.ph === 'review') return y('notifs.rappel-proposition', 'Une envie t’attend encore, toute chaude.', 'notifs.rappel-proposition-nom', 'L’envie de {prénom} t’attend encore, toute chaude.');
    if (m.ph === 'celebrate') return y('notifs.rappel-kiff', 'Votre kiff kiff n’attend plus que vous.', 'notifs.rappel-kiff-nom', 'Votre kiff kiff avec {prénom} n’attend plus que vous.');
    return y('notifs.rappel-tour', 'Les roues t’attendent : à toi de jouer.', 'notifs.rappel-tour-nom', '{prénom} attend ton envie… à toi de jouer.');
  }
  if (m.k === 'message') return y('notifs.message', 'Un message t’attend.', 'notifs.message-nom', '{prénom} t’a écrit.');
  if (m.k === 'kiff') return y('notifs.kiff', 'Un kiff kiff vous attend !', 'notifs.kiff-nom', 'Kiff kiff avec {prénom} !');
  if (m.k === 'arrivee') return y('notifs.arrivee', 'Ton invitation est acceptée : la partie commence.', 'notifs.arrivee-nom', '{prénom} a rejoint la partie : elle commence.');
  if (m.ph === 'review') return y('notifs.proposition', 'Une proposition t’attend.', 'notifs.proposition-nom', '{prénom} t’a proposé une envie.');
  if (m.ph === 'reconfirm') return y('notifs.reponse', 'Du nouveau : c’est à toi de répondre.', 'notifs.reponse-nom', '{prénom} a ajusté ton envie : à toi de répondre.');
  return y('notifs.tour', 'C’est à toi de jouer.', 'notifs.tour-nom', 'À toi de jouer avec {prénom}.');
}
self.addEventListener('push', (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch (err) { m = {}; }
  const room = PARTIE.test(m.r || '') ? m.r : '';
  e.waitUntil((async () => {
    // Kiff Kiff déjà à l’écran : pas d’avertissement, l’appli montre déjà la nouvelle (sauf iPhone, qui l’exige)
    const ios = /iphone|ipad|ipod/i.test(self.navigator.userAgent);
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (!ios && wins.some((c) => c.visibilityState === 'visible' && c.focused)) return;
    const nom = typeof m.n === 'string' ? m.n.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 30) : '';
    return self.registration.showNotification('Kiff Kiff', {
    body: avis(m, await textes(), nom),
    icon: 'icons/icon-192.png',
    badge: 'icons/badge-96.png',
    tag: 'kk-' + (room || 'partie'),
    renotify: true,
    data: { r: room, kf: m.k === 'message' && /^\d{6,16}$/.test(String(m.kf || '')) ? String(m.kf) : '' }
    });
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  try { if (self.navigator.clearAppBadge) self.navigator.clearAppBadge(); } catch (err) { /* rien */ }
  const room = (e.notification.data && e.notification.data.r) || '';
  const kf = (e.notification.data && e.notification.data.kf) || '';
  const url = new URL(room ? './?jouer=' + room + (kf ? '&kiff=' + kf : '') : './', self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = wins.find((c) => new URL(c.url).origin === self.location.origin);
    if (w) {
      w.postMessage({ kk: 'jouer', r: room, kf });
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
