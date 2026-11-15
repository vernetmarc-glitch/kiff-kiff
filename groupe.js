/* Kiff Kiff — la partie à plusieurs (15 novembre 2026).
 *
 * Une partie ouverte, de 3 à 100 téléphones, sur le même relais MQTT public que les parties à deux.
 * Rien n’est un « état de la partie » : chaque chose a son propre sujet, conservé par le relais,
 * pour qu’un téléphone qui arrive en cours de soirée retrouve tout.
 *
 *   kiffkiff/g1/<partie>/h            la partie : pseudo de l’hôte, piment maximum, heure de départ
 *   kiffkiff/g1/<partie>/p/<id>       un·e joueur·se : pseudo, couleur du moment, clé publique, parti·e ou non
 *   kiffkiff/g1/<partie>/e/<envie>    une envie, chiffrée pour ses seuls destinataires (auteur et destinataires cachés)
 *   kiffkiff/g1/<partie>/r/<envie>/<x>   une réponse, chiffrée avec la clé de l’envie, sous un nom tiré au hasard
 *   kiffkiff/g1/<partie>/f/<envie>    un kiff kiff a eu lieu (rien d’autre) : le compteur de la soirée
 *   kiffkiff/g1/<partie>/m/<x>          un message de la discussion de toute la soirée (clé de la partie)
 *   kiffkiff/g1/<partie>/c/<envie>/<x>   un message de la discussion d’un kiff kiff, chiffré avec la clé de l’envie
 *
 * Deux niveaux de chiffrement :
 * - la clé de la partie (dans le lien, après le « # ») : le relais ne lit rien ;
 * - chaque envie a sa propre clé, remise à chacun de ses destinataires par un échange de clés (ECDH P-256, avec une
 *   clé jetable) : les autres joueurs de la partie ne peuvent ni la lire, ni savoir qui l’a écrite ni à qui.
 * Les réponses sont chiffrées avec la clé de l’envie : seules les personnes nommées peuvent les lire, et le jeu
 * n’affiche jamais qui a dit non.
 *
 * Lien : https://…/#groupe=<relais><partie>.<clé>
 */
(() => {
  'use strict';

  const PREFIX = 'kiffkiff/g1/';
  let BROKERS = {
    h: 'wss://broker.hivemq.com:8884/mqtt',
    e: 'wss://broker.emqx.io:8084/mqtt',
    m: 'wss://test.mosquitto.org:8081/mqtt'
  };
  let ORDER = ['h', 'e', 'm'];
  // Pour les essais : ?relais=ws://localhost:8888 remplace les relais publics (comme pour les parties à deux)
  let relayParam = '';
  try {
    relayParam = new URLSearchParams(location.search).get('relais') || '';
    if (relayParam) { BROKERS = { l: relayParam }; ORDER = ['l']; }
  } catch (e) { /* rien */ }

  const ALPH = 'abcdefghijkmnpqrstuvwxyz23456789';
  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
  const b64u = {
    enc(bytes) { let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
    dec(str) { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); }
  };
  const supported = () => !!(window.crypto && crypto.subtle && window.WebSocket);
  const newId = (n = 9) => Array.from(rand(n), (x) => ALPH[x % 32]).join('');

  function newInfo(broker) {
    return { broker: broker || ORDER[0], room: newId(12), key: b64u.enc(rand(16)) };
  }
  function parse(hash) {
    const m = /groupe=([a-z])([a-z2-9]{12})\.([A-Za-z0-9_-]{22})/.exec(hash || '');
    if (!m || !BROKERS[m[1]]) return null;
    return { broker: m[1], room: m[2], key: m[3] };
  }
  function link(info) {
    const q = relayParam ? '?relais=' + encodeURIComponent(relayParam) : '';
    return location.origin + location.pathname + q + '#groupe=' + info.broker + info.room + '.' + info.key;
  }

  /* ---------- Chiffrement ---------- */
  const enc = new TextEncoder(), dec = new TextDecoder();
  async function sealBytes(key, bytes) {
    const iv = rand(12);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
    const out = new Uint8Array(12 + ct.length);
    out.set(iv); out.set(ct, 12);
    return out;
  }
  async function openBytes(key, buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    if (b.length < 29) return null;
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, key, b.slice(12)));
  }
  const seal = async (key, obj) => sealBytes(key, enc.encode(JSON.stringify(obj)));
  async function unseal(key, buf) {
    const pt = await openBytes(key, buf);
    return pt ? JSON.parse(dec.decode(pt)) : null;
  }
  const roomKeys = new Map();
  function roomKey(info) {
    if (!roomKeys.has(info.key)) roomKeys.set(info.key, crypto.subtle.importKey('raw', b64u.dec(info.key), 'AES-GCM', false, ['encrypt', 'decrypt']));
    return roomKeys.get(info.key);
  }

  // Les clés d’échange d’un téléphone pour une partie : la publique va dans son profil, la privée ne quitte pas le téléphone
  async function newKeys() {
    const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
    return {
      pub: b64u.enc(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))),
      priv: await crypto.subtle.exportKey('jwk', kp.privateKey)
    };
  }
  const privCache = new Map(), kekCache = new Map();
  function privOf(jwk) {
    const k = jwk.d;
    if (!privCache.has(k)) privCache.set(k, crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']));
    return privCache.get(k);
  }
  // La clé partagée entre ma clé privée et la clé publique de l’autre (la même des deux côtés)
  async function kek(myJwk, theirPub) {
    const id = myJwk.d + '|' + theirPub;
    if (!kekCache.has(id)) {
      kekCache.set(id, (async () => {
        const pub = await crypto.subtle.importKey('raw', b64u.dec(theirPub), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
        return crypto.subtle.deriveKey({ name: 'ECDH', public: pub }, await privOf(myJwk), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      })());
    }
    return kekCache.get(id);
  }
  /* Une envie pour ses destinataires (l’auteur compris) : une clé neuve chiffre le contenu ; elle est remise à chacun·e
     par une clé d’échange jetable (ek). Les enveloppes ne portent aucun nom et sont mélangées : le reste de la partie
     ne sait ni qui a écrit l’envie, ni à qui elle s’adresse. destinataires = [clé publique]. Renvoie { ct, w, ek, key }. */
  async function envelope(payload, pubs) {
    const raw = rand(32);
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
    const ct = b64u.enc(await seal(key, payload));
    const eph = await newKeys();
    const w = [];
    for (const pub of pubs) { if (pub) w.push(b64u.enc(await sealBytes(await kek(eph.priv, pub), raw))); }
    for (let i = w.length - 1; i > 0; i--) { const j = rand(1)[0] % (i + 1); [w[i], w[j]] = [w[j], w[i]]; }
    return { ct, w, ek: eph.pub, key };
  }
  // Ouvre une envie qui m’est adressée : null si elle ne l’est pas (ou si quelque chose cloche)
  async function openEnvelope(env, myJwk) {
    if (!env || !Array.isArray(env.w) || !env.ek || !env.ct) return null;
    let k;
    try { k = await kek(myJwk, env.ek); } catch (e) { return null; }
    for (const w of env.w) {
      try {
        const raw = await openBytes(k, b64u.dec(w));
        if (!raw) continue;
        const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
        const payload = await unseal(key, b64u.dec(env.ct));
        if (payload) return { payload, key };
      } catch (e) { /* pas pour moi */ }
    }
    return null;
  }

  /* ---------- La connexion ---------- */
  class Conn {
    constructor(info, me, on) {
      this.info = info;
      this.me = me; // { id }
      this.on = on; // { host(obj, old), profile(id, obj|null, old), envie(id, obj|null, old), reponse(envie, x, bytes|null, old), fanfare(id, obj, old), status(bool) }
      this.base = PREFIX + info.room + '/';
      this.client = null;
      this.closed = false;
      this.queue = Promise.resolve();
      this.seen = new Set(); // les sujets conservés par le relais (pour que l’hôte puisse tout effacer en clôturant la soirée)
    }
    async open(timeoutMs = 10000) {
      this.key = await roomKey(this.info);
      return new Promise((resolve, reject) => {
        let settled = false;
        const c = window.mqtt.connect(BROKERS[this.info.broker], {
          clientId: 'kg' + Array.from(rand(8), (x) => x.toString(16).padStart(2, '0')).join(''),
          clean: true, keepalive: 25, reconnectPeriod: 2500, connectTimeout: 8000, resubscribe: true
        });
        this.client = c;
        const t = setTimeout(() => { if (!settled) { settled = true; c.end(true); reject(new Error('timeout')); } }, timeoutMs);
        c.on('connect', () => {
          c.subscribe(this.base + '#', { qos: 1 });
          if (this.on.status) this.on.status(true);
          if (!settled) { settled = true; clearTimeout(t); resolve(this); }
        });
        c.on('close', () => { if (this.on.status && !this.closed) this.on.status(false); });
        c.on('error', () => { /* le client se reconnecte tout seul */ });
        c.on('message', (topic, payload, packet) => this.recv(topic, payload, !!(packet && packet.retain)));
      });
    }
    // old : un message conservé par le relais (l’historique de la soirée), pas une nouveauté
    recv(topic, payload, old) {
      if (!topic.startsWith(this.base)) return;
      const sub = topic.slice(this.base.length), parts = sub.split('/');
      const empty = !payload || !payload.length;
      if (empty) this.seen.delete(sub); else this.seen.add(sub);
      const sealed = (fn) => { if (empty) { fn(null); return; } unseal(this.key, payload).then((o) => fn(o)).catch(() => {}); };
      if (parts[0] === 'h' && parts.length === 1) sealed((o) => { if (o && this.on.host) this.on.host(o, old); });
      else if (parts[0] === 'p' && parts.length === 2) sealed((o) => { if (this.on.profile) this.on.profile(parts[1], o, old); });
      else if (parts[0] === 'e' && parts.length === 2) sealed((o) => { if (this.on.envie) this.on.envie(parts[1], o, old); });
      else if (parts[0] === 'f' && parts.length === 2) sealed((o) => { if (this.on.fanfare) this.on.fanfare(parts[1], o, old); });
      else if (parts[0] === 'm' && parts.length === 2) sealed((o) => { if (this.on.msg) this.on.msg(parts[1], o, old); });
      else if (parts[0] === 'c' && parts.length === 3 && this.on.chat) this.on.chat(parts[1], parts[2], empty ? null : new Uint8Array(payload), old);
      else if (parts[0] === 'r' && parts.length === 3 && this.on.reponse) this.on.reponse(parts[1], parts[2], empty ? null : new Uint8Array(payload), old);
    }
    pub(sub, data, retain = true) {
      this.queue = this.queue.then(() => new Promise((res) => {
        if (!this.client) { res(); return; }
        this.client.publish(this.base + sub, data, { qos: 1, retain }, () => res());
      })).catch(() => {});
      return this.queue;
    }
    async host(obj) { return this.pub('h', await seal(this.key, obj)); }
    async profile(obj) { return this.pub('p/' + this.me.id, await seal(this.key, obj)); }
    async envie(id, obj) { return this.pub('e/' + id, await seal(this.key, obj)); }
    clearEnvie(id) { return this.pub('e/' + id, ''); }
    // Une réponse sous un nom de sujet tiré au hasard : le reste de la partie ne sait pas qui répond
    async reponse(envieId, envieKey, obj, x) { return this.pub('r/' + envieId + '/' + (x || newId(8)), await seal(envieKey, obj)); }
    clearReponse(envieId, x) { return this.pub('r/' + envieId + '/' + x, ''); }
    // La discussion d’un kiff kiff : seules ses personnes ont la clé de l’envie
    async chat(envieId, envieKey, obj, x) { return this.pub('c/' + envieId + '/' + (x || newId(10)), await seal(envieKey, obj)); }
    clearChat(envieId, x) { return this.pub('c/' + envieId + '/' + x, ''); }
    clearFanfare(envieId) { return this.pub('f/' + envieId, ''); }
    clearProfile() { return this.pub('p/' + this.me.id, ''); }
    // La discussion de toute la soirée
    async msg(obj, x) { return this.pub('m/' + (x || newId(10)), await seal(this.key, obj)); }
    clearMsg(x) { return this.pub('m/' + x, ''); }
    // Clore la soirée : tout ce que le relais garde, sauf la partie elle-même (qui dit « terminée »)
    clearAll() { [...this.seen].filter((t) => t !== 'h').forEach((t) => this.pub(t, '')); return this.queue; }
    async fanfare(envieId, obj) { return this.pub('f/' + envieId, await seal(this.key, obj)); }
    wake() { if (this.client && !this.client.connected && !this.closed) { try { this.client.reconnect(); } catch (e) { /* rien */ } } }
    async close() {
      this.closed = true;
      await this.queue;
      if (this.client) this.client.end(false);
    }
  }
  async function connect(info, me, on) {
    const conn = new Conn(info, me, on);
    return conn.open();
  }
  // Une réponse (chiffrée avec la clé de l’envie) : { a: 'oui' | 'non', t }
  async function readReponse(envieKey, bytes) {
    try { return await unseal(envieKey, bytes); } catch (e) { return null; }
  }

  window.KiffGroupe = { supported, newInfo, parse, link, newId, newKeys, envelope, openEnvelope, connect, readReponse, readSealed: readReponse };
})();
