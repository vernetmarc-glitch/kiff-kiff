/* Kiff Kiff — liaison entre deux téléphones.
 *
 * Pas de serveur à nous : les deux téléphones se retrouvent sur un relais MQTT public
 * (WebSocket sécurisé). Tout ce qui passe par le relais est chiffré (AES-GCM) avec une
 * clé qui ne voyage que dans le lien d’invitation, après le « # » : le relais ne voit
 * qu’un sujet au hasard et des octets illisibles.
 *
 *   kiffkiff/v1/<partie>/state   état de la partie (message conservé par le relais)
 *   kiffkiff/v1/<partie>/p/0|1   présence de chaque téléphone (« on » / « off »)
 *
 * Lien : https://…/#duo=<relais><partie>.<clé>
 *
 * Mémoire : chaque état est aussi rangé, toujours chiffré, dans la feuille Google de l’atelier
 * (window.KIFF_API, onglet « parties »). On peut ainsi jouer chacun·e à son rythme :
 * le relais sert quand les deux téléphones sont là, la feuille quand l’un revient plus tard.
 */
(() => {
  'use strict';

  const PREFIX = 'kiffkiff/v1/';
  let BROKERS = {
    h: 'wss://broker.hivemq.com:8884/mqtt',
    e: 'wss://broker.emqx.io:8084/mqtt',
    m: 'wss://test.mosquitto.org:8081/mqtt'
  };
  let ORDER = ['h', 'e', 'm'];
  // Pour les essais : ?relais=ws://localhost:8888 remplace les relais publics
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

  function newInfo(broker) {
    return { broker, room: Array.from(rand(12), (x) => ALPH[x % 32]).join(''), key: b64u.enc(rand(16)) };
  }
  function parse(hash) {
    const m = /duo=([a-z])([a-z2-9]{12})\.([A-Za-z0-9_-]{22})/.exec(hash || '');
    if (!m || !BROKERS[m[1]]) return null;
    return { broker: m[1], room: m[2], key: m[3] };
  }
  function link(info) {
    const q = relayParam ? '?relais=' + encodeURIComponent(relayParam) : '';
    return location.origin + location.pathname + q + '#duo=' + info.broker + info.room + '.' + info.key;
  }

  async function seal(key, obj) {
    const iv = rand(12);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj))));
    const out = new Uint8Array(12 + ct.length);
    out.set(iv); out.set(ct, 12);
    return out;
  }
  async function unseal(key, buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    if (b.length < 29) return null;
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, key, b.slice(12));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  /* Mémoire des parties dans la feuille de l’atelier (états chiffrés : la feuille ne lit rien) */
  const keys = new Map();
  function keyOf(info) {
    if (!keys.has(info.key)) keys.set(info.key, crypto.subtle.importKey('raw', b64u.dec(info.key), 'AES-GCM', false, ['encrypt', 'decrypt']));
    return keys.get(info.key);
  }
  const api = () => window.KIFF_API || '';
  async function storeSave(info, obj) {
    if (!api() || !obj || !obj.seq) return;
    try {
      const etat = b64u.enc(await seal(await keyOf(info), obj));
      await fetch(api(), { method: 'POST', mode: 'no-cors', keepalive: etat.length < 60000,
        body: JSON.stringify({ action: 'partie', partie: info.room, etat, seq: obj.seq }) });
    } catch (e) { /* le relais a quand même reçu le coup */ }
  }
  // infos : [{ broker, room, key }] → { room: état } (seulement les parties trouvées)
  async function storeLoad(infos, timeoutMs = 8000) {
    const out = {};
    if (!api() || !infos.length) return out;
    const ctl = window.AbortController ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), timeoutMs);
    try {
      const r = await fetch(api() + '?action=partie&p=' + infos.map((i) => i.room).join(','), ctl ? { signal: ctl.signal } : {});
      const j = await r.json();
      const found = (j && j.parties) || {};
      await Promise.all(infos.map(async (info) => {
        const f = found[info.room];
        if (!f || !f.etat) return;
        try { const st = await unseal(await keyOf(info), b64u.dec(f.etat)); if (st) out[info.room] = st; } catch (e) { /* autre clé */ }
      }));
    } catch (e) { /* hors ligne */ }
    clearTimeout(t);
    return out;
  }

  /* Une connexion au relais pour une partie et une place (0 : qui invite, 1 : qui rejoint). */
  class Conn {
    constructor(info, seat, id, on) {
      this.info = info;
      this.seat = seat;
      this.id = id;
      this.on = on; // { state(obj), presence(seat, isOn), status(connected) }
      this.base = PREFIX + info.room + '/';
      this.queue = Promise.resolve();
      this.client = null;
      this.connected = false;
      this.closed = false;
    }
    async open(timeoutMs = 9000) {
      this.key = await keyOf(this.info);
      return new Promise((resolve, reject) => {
        let settled = false;
        const c = window.mqtt.connect(BROKERS[this.info.broker], {
          clientId: 'kk' + Array.from(rand(8), (x) => x.toString(16).padStart(2, '0')).join(''),
          clean: true,
          keepalive: 25,
          reconnectPeriod: 2500,
          connectTimeout: 8000,
          resubscribe: true,
          will: { topic: this.base + 'p/' + this.seat, payload: 'off', qos: 1, retain: true }
        });
        this.client = c;
        const t = setTimeout(() => { if (!settled) { settled = true; c.end(true); reject(new Error('timeout')); } }, timeoutMs);
        c.on('connect', () => {
          this.connected = true;
          c.subscribe([this.base + 'state', this.base + 'p/+'], { qos: 1 });
          c.publish(this.base + 'p/' + this.seat, document.visibilityState === 'hidden' ? 'off' : 'on', { qos: 1, retain: true });
          if (this.on.status) this.on.status(true);
          if (!settled) { settled = true; clearTimeout(t); resolve(this); }
        });
        c.on('close', () => { this.connected = false; if (this.on.status && !this.closed) this.on.status(false); });
        c.on('error', () => { /* le client se reconnecte tout seul */ });
        c.on('message', (topic, payload) => {
          if (topic === this.base + 'state') {
            if (!payload || !payload.length) return;
            unseal(this.key, payload).then((obj) => { if (obj && this.on.state) this.on.state(obj); }).catch(() => {});
          } else if (topic.startsWith(this.base + 'p/')) {
            const s = +topic.slice(-1);
            if (s !== this.seat && this.on.presence) this.on.presence(s, String(payload) === 'on');
          }
        });
      });
    }
    publishState(obj) {
      storeSave(this.info, obj);
      this.queue = this.queue.then(async () => {
        const data = await seal(this.key, obj);
        if (this.client) this.client.publish(this.base + 'state', data, { qos: 1, retain: true });
      }).catch(() => {});
      return this.queue;
    }
    // Présence : « on » seulement quand l’appli est à l’écran (l’autre téléphone saura s’il faut l’avertir)
    here(on) {
      if (this.client && this.client.connected && !this.closed) this.client.publish(this.base + 'p/' + this.seat, on ? 'on' : 'off', { qos: 1, retain: true });
    }
    wake() {
      if (this.client && !this.client.connected && !this.closed) { try { this.client.reconnect(); } catch (e) { /* rien */ } }
    }
    async close(clearState) {
      this.closed = true;
      const c = this.client;
      if (!c) return;
      await this.queue;
      await new Promise((res) => c.publish(this.base + 'p/' + this.seat, 'off', { qos: 1, retain: true }, () => res()));
      if (clearState) await new Promise((res) => c.publish(this.base + 'state', '', { qos: 1, retain: true }, () => res()));
      c.end(false);
    }
  }

  /* Ouvre une nouvelle partie sur le premier relais qui répond. */
  async function create(id, on) {
    let last = null;
    for (const b of ORDER) {
      const conn = new Conn(newInfo(b), 0, id, on);
      try { return await conn.open(7000); } catch (e) { last = e; }
    }
    throw last || new Error('aucun relais');
  }
  async function join(info, seat, id, on) {
    const conn = new Conn(info, seat, id, on);
    return conn.open(12000);
  }

  function qrSvg(text) {
    if (typeof window.qrcode !== 'function') return '';
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }

  window.KiffDuo = { supported, parse, link, create, join, qrSvg, storeSave, storeLoad, newId: () => b64u.enc(rand(9)) };
})();
