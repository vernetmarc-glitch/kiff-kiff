/* Kiff Kiff — avertir l’autre téléphone, même l’appli fermée (notifications Web Push).
 *
 * Chaque téléphone qui accepte les avertissements obtient de son navigateur une « adresse »
 * (chez Google, Apple, Mozilla ou Microsoft) et deux clés. Il la range dans l’état chiffré
 * de la partie : seul l’autre téléphone la lit.
 * Quand c’est au tour de l’autre, ce téléphone chiffre lui-même un petit message pour lui
 * (RFC 8291 : seul le téléphone destinataire peut le lire) et le confie au script de l’atelier,
 * qui le signe (RFC 8292) et le transmet. Le script ne voit qu’une adresse et des octets illisibles.
 */
(() => {
  'use strict';

  const api = () => window.KIFF_API || '';
  const enc = new TextEncoder();
  const b64u = {
    enc(bytes) { let s = ''; new Uint8Array(bytes).forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
    dec(str) { const s = atob(String(str).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(str).length + 3) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); }
  };
  const cat = (...parts) => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let k = 0;
    parts.forEach((p) => { out.set(p, k); k += p.length; });
    return out;
  };
  const get = (k, d) => { try { const v = localStorage.getItem('roue:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem('roue:' + k, JSON.stringify(v)); } catch (e) { /* rien */ } };

  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const capable = () => !!(api() && window.isSecureContext && 'serviceWorker' in navigator && window.PushManager && window.Notification && window.crypto && crypto.subtle);

  /* La clé publique du script (créée par lui au premier appel) : sans elle, pas d’avertissements */
  let keyP = null;
  function serverKey() {
    const c = get('vapid', null);
    if (c && c.api === api() && c.cle) return Promise.resolve(c.cle);
    if (!keyP) {
      keyP = fetch(api() + '?action=vapid').then((r) => r.json()).then((j) => {
        if (!j || !j.cle || !/^[A-Za-z0-9_-]{86,88}$/.test(j.cle)) return '';
        put('vapid', { api: api(), cle: j.cle });
        return j.cle;
      }).catch(() => { keyP = null; return ''; });
    }
    return keyP;
  }

  // Le service worker prêt (sans attendre indéfiniment : navigation privée, réglages…)
  let reg = null;
  function ready() {
    if (reg) return Promise.resolve(reg);
    return Promise.race([navigator.serviceWorker.ready, new Promise((res) => setTimeout(() => res(null), 6000))])
      .then((r) => { reg = r || null; return reg; }).catch(() => null);
  }
  let cleVue = '';

  /* État pour l’interface :
     'off' (possible, pas activé) · 'on' · 'blocked' (refusé dans le navigateur)
     'install' (iPhone : il faut d’abord l’écran d’accueil) · 'none' (impossible ici) */
  async function status() {
    if (!capable()) return ios && !standalone() && api() ? 'install' : 'none';
    // La clé et le service worker se préparent en fond : la cloche s’affiche sans les attendre,
    // et un souci éventuel se dit au toucher (au lieu de cacher la cloche sans rien dire)
    serverKey().then((c) => { cleVue = c || cleVue; });
    ready();
    if (Notification.permission === 'denied') return 'blocked';
    return get('push', false) && Notification.permission === 'granted' ? 'on' : 'off';
  }

  const compact = (sub) => {
    const j = sub && sub.toJSON ? sub.toJSON() : null;
    return j && j.endpoint && j.keys && j.keys.p256dh && j.keys.auth ? { e: j.endpoint, p: j.keys.p256dh, a: j.keys.auth } : null;
  };
  const sameKey = (sub, cle) => {
    const k = sub && sub.options && sub.options.applicationServerKey;
    return !k || b64u.enc(k) === cle;
  };

  /* Mon adresse d’avertissement, ou null (sans rien demander à la personne) */
  async function current() {
    try {
      if (!capable() || !get('push', false) || Notification.permission !== 'granted') return null;
      const cle = await serverKey();
      if (!cle) return null;
      if (!(await ready())) return null;
      let sub = await reg.pushManager.getSubscription();
      if (sub && !sameKey(sub, cle)) { await sub.unsubscribe().catch(() => {}); sub = null; }
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u.dec(cle) });
      return compact(sub);
    } catch (e) { return null; }
  }

  /* Activer : à appeler directement dans un toucher, après status().
     L’abonnement part tout de suite (iPhone et Firefox n’acceptent la demande que pendant le toucher) ;
     c’est lui qui fait demander l’autorisation par le navigateur. */
  // Résultat : { sub } quand c’est activé, sinon { erreur: 'cle' | 'sw' | 'refus' | 'abo' }
  async function enable() {
    if (!capable()) return { erreur: 'sw' };
    // Tout est prêt : l’abonnement part pendant le toucher. Sinon on prépare d’abord (un second toucher suffira sur iPhone).
    if (!reg || !cleVue) {
      cleVue = cleVue || await serverKey();
      if (!cleVue) return { erreur: 'cle' };
      if (!(await ready())) return { erreur: 'sw' };
    }
    const opts = { userVisibleOnly: true, applicationServerKey: b64u.dec(cleVue) };
    return reg.pushManager.subscribe(opts)
      .catch(async () => {
        // Un ancien abonnement avec une autre clé : on le remplace (l’autorisation est déjà donnée)
        if (Notification.permission !== 'granted') return null;
        const old = await reg.pushManager.getSubscription();
        if (old) await old.unsubscribe();
        return reg.pushManager.subscribe(opts);
      })
      .then((sub) => { const c = compact(sub); if (c) put('push', true); return c ? { sub: c } : { erreur: 'abo' }; })
      .catch(() => ({ erreur: Notification.permission === 'denied' ? 'refus' : (Notification.permission === 'default' ? 'attente' : 'abo') }));
  }
  async function disable() {
    put('push', false);
    try {
      if (!(await ready())) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch (e) { /* rien */ }
  }

  /* Chiffrer pour le téléphone de l’autre (RFC 8291, aes128gcm) */
  async function hkdf(salt, ikm, info, len) {
    const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
  }
  async function encrypt(sub, obj) {
    const ua = b64u.dec(sub.p), auth = b64u.dec(sub.a);
    const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const mine = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const as = new Uint8Array(await crypto.subtle.exportKey('raw', mine.publicKey));
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, mine.privateKey, 256));
    const ikm = await hkdf(auth, shared, cat(enc.encode('WebPush: info\0'), ua, as), 32);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
    const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
    const body = cat(enc.encode(JSON.stringify(obj)), new Uint8Array([2]));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, body));
    const head = new Uint8Array(21);
    head.set(salt);
    new DataView(head.buffer).setUint32(16, 4096);
    head[20] = as.length;
    return cat(head, as, ct);
  }

  /* Avertir : sub (l’adresse de l’autre, prise dans la partie), msg (petit objet, lu par sw.js) */
  async function send(sub, msg) {
    if (!api() || !sub || !sub.e || !sub.p || !sub.a) return false;
    try {
      const corps = b64u.enc(await encrypt(sub, msg));
      await fetch(api(), { method: 'POST', mode: 'no-cors', keepalive: true, body: JSON.stringify({ action: 'push', adresse: sub.e, corps }) });
      return true;
    } catch (e) { return false; }
  }

  /* Un rappel, deux jours plus tard, si la partie n’a pas bougé : chiffré ici comme l’avertissement */
  async function remind(sub, msg, partie, seq) {
    if (!api() || !sub || !sub.e || !sub.p || !sub.a || !partie || !seq) return false;
    try {
      const corps = b64u.enc(await encrypt(sub, msg));
      await fetch(api(), { method: 'POST', mode: 'no-cors', keepalive: true, body: JSON.stringify({ action: 'rappel', partie, seq, adresse: sub.e, corps }) });
      return true;
    } catch (e) { return false; }
  }

  const sameSub = (a, b) => (!a && !b) || (!!a && !!b && a.e === b.e && a.p === b.p && a.a === b.a);

  window.KiffPush = { status, current, enable, disable, send, remind, sameSub, ios, standalone, _encrypt: encrypt };
})();
