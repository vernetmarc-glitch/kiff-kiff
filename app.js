/* Kiff Kiff — logique du jeu.
 *
 * Déroulé d’un tour (A propose, B répond) :
 *   compose   : A règle « que tu me / de te » et les trois rouleaux, puis « Proposer à B ».
 *   review    : B lit l’envie dans une modale : « J’ai envie aussi » → célébration,
 *               « Oui, mais… » → adjust, ou « On passe ».
 *   adjust    : B change UNE chose (une roue, ou le sens) ; les choix de A restent surlignés.
 *               « J’ai fini ma modification » → reconfirm.
 *   reconfirm : A lit l’envie ajustée dans une modale : « J’ai envie » → célébration, ou « On passe ».
 *   celebrate : puis les rôles s’inversent.
 * « On passe » est disponible à tout moment.
 *
 * Deux téléphones (duo.js) : chaque téléphone tient une place (0 invite, 1 rejoint).
 * L’état de la partie est partagé ; le téléphone qui n’a pas la main affiche un écran
 * d’attente au lieu de l’écran « passe le téléphone ».
 */
(() => {
  'use strict';

  const D = window.ROUE_DATA;
  const $ = (s) => document.querySelector(s);

  /* ---------- Les textes : textes.js (la liste d’origine), modifiables dans l’Atelier ----------
     T(clé, { variable: valeur }) rend un texte simple ; TH(…) le rend en HTML (**gras**).
     La typographie se fait toute seule : apostrophe courbe, espace insécable devant ? ! : ; ». */
  const TX = window.KIFF_TX || {};
  const typo = (s) => String(s).replace(/'/g, '’').replace(/ +([?!:;»]|\p{Extended_Pictographic})/gu, '\u00a0$1').replace(/« +/g, '«\u00a0');
  const tidy = (s) => s.replace(/([!?…])\.(?=\s|$)/g, '$1');
  function T(k, v) {
    const raw = TX[k];
    if (raw == null) return '';
    const s = typo(raw).replace(/\*\*/g, '');
    return tidy(v ? s.replace(/\{([^{}]+)\}/g, (m, n) => (v[n] != null ? String(v[n]) : m)) : s);
  }
  const escT = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function TH(k, v) {
    const raw = TX[k];
    if (raw == null) return '';
    const s = escT(typo(raw)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    return tidy(v ? s.replace(/\{([^{}]+)\}/g, (m, n) => (v[n] == null ? m : typeof v[n] === 'object' ? v[n].html : escT(v[n]))) : s);
  }
  // Une liste : une ligne par élément
  const TL = (k) => T(k).split('\n').map((x) => x.trim()).filter(Boolean);
  // Les textes posés dans la page (data-t) ; les éléments marqués data-tk y gardent leur place : {prénom}…
  function fillT(node, k) {
    const raw = TX[k];
    if (raw == null) return;
    const kids = {};
    node.querySelectorAll('[data-tk]').forEach((c) => { kids[c.dataset.tk] = c; });
    const frag = document.createDocumentFragment();
    const used = new Set();
    const vars = (into, txt) => txt.split(/(\{[^{}]+\})/).forEach((p) => {
      if (!p) return;
      const kid = /^\{[^{}]+\}$/.test(p) && kids[p.slice(1, -1)];
      if (kid && !used.has(kid)) { used.add(kid); kid.hidden = false; into.appendChild(kid); } else into.appendChild(document.createTextNode(p));
    });
    const inline = (into, txt) => tidy(typo(txt)).split(/(\*\*.+?\*\*)/).forEach((p) => {
      if (!p) return;
      if (/^\*\*.+\*\*$/.test(p)) { const b = document.createElement('b'); vars(b, p.slice(2, -2)); into.appendChild(b); } else vars(into, p);
    });
    if (node.hasAttribute('data-t-par')) {
      String(raw).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean).forEach((para) => { const p = document.createElement('p'); inline(p, para); frag.appendChild(p); });
    } else inline(frag, raw);
    // Un élément du jeu (un prénom…) que le texte n’utilise plus reste là, caché : le jeu s’en sert encore
    Object.values(kids).forEach((kid) => { if (!used.has(kid)) { kid.hidden = true; frag.appendChild(kid); } });
    node.textContent = '';
    node.appendChild(frag);
    if (node.hasAttribute('data-ink')) node.setAttribute('data-ink', node.textContent);
  }
  function applyTexts(root = document) {
    root.querySelectorAll('[data-t]').forEach((n) => fillT(n, n.dataset.t));
    root.querySelectorAll('[data-t-ph]').forEach((n) => { if (TX[n.dataset.tPh] != null) n.placeholder = T(n.dataset.tPh); });
  }
  // Les noms et descriptions du piment viennent aussi des textes
  D.niveaux.forEach((lv) => {
    if (TX['roues.niveau-' + lv.n] != null) lv.nom = T('roues.niveau-' + lv.n);
    if (TX['roues.niveau-' + lv.n + '-desc'] != null) lv.desc = T('roues.niveau-' + lv.n + '-desc');
  });
  const mod = (a, n) => ((a % n) + n) % n;

  /* Piment : les roues ne montrent que les cases de niveau inférieur ou égal */
  const FREE = [{ free: true }, { free: true }, { free: true }];
  const SOURCE = [D.actions, D.objets, D.manieres].map((l) => l.map((x) => (typeof x === 'string' ? { t: x } : x)));
  const LISTS = [[], [], []];
  /* Niveaux actifs : on coche 1, 2 et/ou 3 indépendamment (au moins un) */
  function parseLevels(v) {
    const arr = Array.isArray(v) ? v : String(v == null ? '' : v).split('');
    const out = [1, 2, 3].filter((n) => arr.map(Number).includes(n));
    return out.length ? out : [1, 2];
  }
  /* ---------- Les roues : un tirage d’une vingtaine de mots, rangé en dégradé ----------
     Le stock complet (piment et ton choisis) est la réserve ; chaque roue n’en montre qu’un tirage,
     refait à chaque tour de composition (et au dé) : les mots jamais proposés entre vous d’abord.
     Dans la roue, du plus tendre au plus brûlant, le décalé et le premier degré en alternance.
     La loupe cherche dans toute la réserve ; un mot choisi là reste dans la roue pour la partie. */
  const DRAW_N = 20;
  /* La version gratuite : toujours les mêmes 20 mots par roue, Tendre et Pimenté, choisis dans l’atelier
     (case « gratuit ») ; le jeu complet ouvre toute la réserve, Brûlant, le ton, la recherche et ses propres mots.
     À deux téléphones, il suffit que l’un des deux ait le jeu complet. */
  const OFFRE = window.KIFF_OFFRE || 'tout';
  let openComplet = () => {};
  function isComplet() {
    if (OFFRE === 'tout') return true;
    return !!load('complet', false) || !!S.cpOther;
  }
  // La version gratuite : 20 mots par roue, pris parmi les mots cochés « gratuit » de chaque piment choisi,
  // à parts égales (Tendre seul : 20 tendres ; Tendre et Pimenté : 10 + 10). S’il en manque, le reste des cochés
  // comble, puis les premiers mots de la liste (un tendre, un pimenté…). Même calcul dans l’Atelier (gratuitServi).
  function freePick(r, levels) {
    const lv = [1, 2].filter((n) => levels.includes(n));
    if (!lv.length) return [];
    const of = (n, g) => SOURCE[r].filter((x) => (x.lvl || 1) === n && !!x.g === g);
    const quota = Math.floor(DRAW_N / lv.length);
    const pick = [];
    lv.forEach((n) => pick.push(...of(n, true).slice(0, quota)));
    const fill = (lists) => {
      for (let i = 0; pick.length < DRAW_N && lists.some((l) => i < l.length); i++) lists.forEach((l) => { if (l[i] && pick.length < DRAW_N && !pick.includes(l[i])) pick.push(l[i]); });
    };
    fill(lv.map((n) => of(n, true)));
    fill(lv.map((n) => of(n, false)));
    return [1, 2].flatMap((n) => interleave(pick.filter((x) => (x.lvl || 1) === n)));
  }
  function dkey(x) { return [x.s || '', x.i || '', x.t || ''].join('|'); }
  // La réserve d’une roue : le piment, puis le ton (une roue sans mot de ce ton garde tous les siens)
  function poolOf(r, levels, anyTon) {
    const all = SOURCE[r].filter((x) => levels.includes(x.lvl || 1));
    if (anyTon) return all;
    const t = S.ton === 'b' || S.ton === 'e' ? S.ton : 'm';
    const l = t === 'm' ? all : all.filter((x) => (t === 'b') === !!x.dc);
    return l.length ? l : all;
  }
  const shuffled = (l) => { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // Dans un niveau : le décalé et le premier degré en alternance, au prorata
  function interleave(l) {
    const a = shuffled(l.filter((x) => !x.dc)), b = shuffled(l.filter((x) => x.dc)), out = [];
    let i = 0, j = 0;
    while (i < a.length || j < b.length) {
      if (j >= b.length || (i < a.length && i / a.length <= j / b.length)) out.push(a[i++]); else out.push(b[j++]);
    }
    return out;
  }
  function makeDraw(r, pool, keep) {
    const seen = (S.seen && S.seen[r]) || [];
    const found = foundSet();
    const n = Math.min(DRAW_N, pool.length);
    const lv = [1, 2, 3].filter((l) => pool.some((x) => (x.lvl || 1) === l));
    const size = (l) => pool.filter((x) => (x.lvl || 1) === l).length;
    // Chaque niveau a sa part, au prorata de sa réserve (au moins quatre mots quand il en a)
    const quota = {};
    lv.forEach((l) => { quota[l] = Math.min(size(l), Math.max(Math.min(4, size(l)), Math.round(n * size(l) / pool.length))); });
    let over = lv.reduce((t, l) => t + quota[l], 0) - n;
    while (over > 0) { const l = lv.slice().sort((a, b) => quota[b] - quota[a])[0]; quota[l]--; over--; }
    const out = [];
    lv.forEach((l) => {
      const g = pool.filter((x) => (x.lvl || 1) === l);
      // Les mots jamais sortis dans vos roues d’abord, puis ceux déjà vus mais jamais proposés, puis les plus anciens
      const unseen = g.filter((x) => !seen.includes(dkey(x)));
      const neuf = shuffled(unseen.filter((x) => !found.has(wordHash(dkey(x)))));
      const vu = shuffled(unseen.filter((x) => found.has(wordHash(dkey(x)))));
      const old = g.filter((x) => seen.includes(dkey(x))).sort((a, b) => seen.indexOf(dkey(a)) - seen.indexOf(dkey(b)));
      let pick = neuf.concat(vu, old).slice(0, quota[l]);
      if (keep && (keep.lvl || 1) === l && g.includes(keep) && !pick.includes(keep)) pick = [keep].concat(pick.slice(0, -1));
      out.push(...interleave(pick));
    });
    return out;
  }
  // Les mots écrits à la main (« vos mots à vous deux ») et ceux choisis à la loupe restent dans la roue
  /* Les roues du tour, partagées (26 octobre 2026) : le téléphone qui compose envoie ses roues avec l’envie ;
     l’autre les reprend telles quelles. Ainsi « Oui, mais… » change un mot dans les mêmes roues, même si les mots
     de l’atelier ont changé entre-temps ou si les deux téléphones n’ont pas le même tirage. */
  const wheelKey = (x) => { const o = {}; FIELDS.concat('lvl').forEach((f) => { if (x[f] != null && x[f] !== '') o[f] = x[f]; }); return o; };
  const wheelsOf = () => LISTS.map((l) => (l || []).filter((x) => x && !x.free && !x.m).map(wheelKey));
  // (S.shared d’abord : au démarrage, la partie à deux n’existe pas encore)
  function useShared() { return Array.isArray(S.shared) && S.shared.length === 3 && !!duo && duo.stage === 'game' && !(S.phase === 'compose' && myTurn()); }
  function sharedPick(r) {
    const out = [];
    (S.shared[r] || []).forEach((k) => {
      if (!k || typeof k !== 'object' || !FIELDS.some((f) => typeof k[f] === 'string' && k[f])) return;
      let x = SOURCE[r].find((y) => sameItem(y, k));
      if (!x) {
        // Un mot que ce téléphone n’a pas (atelier pas encore à jour) : il le prend pour cette partie
        x = {}; FIELDS.concat('lvl').forEach((f) => { if (k[f] != null) x[f] = String(k[f]).slice(0, 80); });
        x.lvl = +x.lvl || 1;
        SOURCE[r].push(x);
      }
      if (!out.includes(x)) out.push(x);
    });
    return out;
  }
  function buildLists(levels) {
    S.draw = S.draw || [null, null, null];
    S.kept = S.kept || [[], [], []];
    const sig = levels.join('') + (S.ton || 'm') + '|' + SOURCE.map((l) => l.length).join(',');
    const shared = useShared();
    for (let r = 0; r < 3; r++) {
      const pool = poolOf(r, levels);
      let pick = shared ? sharedPick(r) : null;
      if (shared && pick.length) { /* les roues de l’autre téléphone, telles quelles */ }
      else if (S.draw[r] && S.draw[r].sig === sig) {
        const byKey = new Map(pool.map((x) => [dkey(x), x]));
        pick = S.draw[r].keys.map((k) => byKey.get(k)).filter(Boolean);
      }
      if (shared && pick && pick.length) { /* rien à tirer */ }
      else if (!isComplet()) {
        // Version gratuite : le même tirage, gardé pour toute la partie
        if (!pick || pick.length < Math.min(6, pool.length)) { pick = freePick(r, levels); S.draw[r] = { sig, keys: pick.map(dkey) }; }
      } else if (!pick || pick.length < Math.min(6, pool.length)) {
        const cur = LISTS[r] && S.idx ? LISTS[r][S.idx[r]] : null;
        pick = makeDraw(r, pool, cur);
        S.draw[r] = { sig, keys: pick.map(dkey) };
      }
      // Les mots gardés depuis la loupe rejoignent leur niveau, à la fin
      const all = SOURCE[r].filter((x) => levels.includes(x.lvl || 1));
      S.kept[r].forEach((k) => {
        const x = all.find((y) => dkey(y) === k);
        if (!x || pick.includes(x)) return;
        let at = -1;
        pick.forEach((y, i) => { if ((y.lvl || 1) <= (x.lvl || 1)) at = i; });
        pick.splice(at + 1, 0, x);
      });
      LISTS[r] = pick.concat(S.mine[r] || [], [FREE[r]]);
    }
  }
  // Un nouveau tirage (nouveau tour, dé, piment ou ton changé) ; chaque roue garde le mot qu’elle montrait
  function newDraw() { S.draw = [null, null, null]; }
  /* Les mots découverts : tous ceux qu’un tirage a mis dans les roues, pour ces deux prénoms (ou cette partie à distance).
     Gardés sur le téléphone seulement, en empreintes courtes ; « Vos kiff kiff » dit combien sur toute la réserve. */
  function wordHash(k) { let h = 2166136261; for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function foundKey() { return duo && duo.info ? 'd:' + duo.info.room : pairKey(); }
  function addFound(keys) {
    if (!S.started || !keys.length) return;
    const all = load('decouverts', {}) || {};
    const k = foundKey(), cur = all[k] && Array.isArray(all[k].h) ? all[k].h : [];
    const set = new Set(cur);
    keys.forEach((x) => set.add(wordHash(x)));
    if (set.size === cur.length) return;
    all[k] = { h: [...set].slice(-3000), t: Date.now() };
    const keep = Object.keys(all).sort((a, b) => (all[b].t || 0) - (all[a].t || 0)).slice(0, 20);
    save('decouverts', Object.fromEntries(keep.map((x) => [x, all[x]])));
  }
  function foundSet() {
    if (!S.started) return new Set();
    const all = load('decouverts', {}) || {};
    return new Set((all[foundKey()] || {}).h || []);
  }
  function foundCount() {
    const mine = foundSet();
    let n = 0, total = 0;
    SOURCE.forEach((l) => l.forEach((x) => { total++; if (mine.has(wordHash(dkey(x)))) n++; }));
    return { n, total };
  }
  const PLACEHOLDER = { get 0() { return T('jeu.vide-0'); }, get 1() { return T('jeu.vide-1'); }, get 2() { return T('jeu.vide-2'); } };
  const REEL_NAMES = { get 0() { return T('jeu.nom-0'); }, get 1() { return T('jeu.nom-1'); }, get 2() { return T('jeu.nom-2'); } };

  /* ---------- Stockage local (confort, jamais indispensable) ---------- */
  let store = null;
  try { store = window.localStorage; } catch (e) { store = null; }
  const load = (k, d) => {
    try { const v = store && store.getItem('roue:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
  };
  const save = (k, v) => { try { if (store) store.setItem('roue:' + k, JSON.stringify(v)); } catch (e) { /* rien */ } };

  /* ---------- État ---------- */
  const S = {
    names: load('names', ['', '']),
    proposer: 0,
    phase: 'start',
    dir: 'me',
    idx: [0, 0, 0],
    custom: ['', '', ''],
    original: null,
    muted: load('muted', false),
    levels: parseLevels(window.KIFF_LEVELS || load('levels', [1, 2])),
    lvOk: null, // à deux téléphones : les niveaux de piment acceptés par les deux
    kiff: null, // à deux téléphones : le dernier kiff kiff trouvé { n, text, by }
    kiffs: [], // l’historique de la partie : [{ t: phrase, w: qui l’a proposée, d: date }]
    mine: [[], [], []], // vos mots à vous deux : le texte libre déjà proposé dans cette partie
    seen: [[], [], []], // les mots déjà proposés entre vous : les tirages puisent d’abord dans les autres
    started: false,
    bottom: false,
    pass: null,
    prog: false, // partie à distance où le piment se débloque en jouant (Tendre, puis Pimenté, puis Brûlant)
    gift: null, // l’envie glissée dans l’invitation { keys, custom, dir }
    gifting: false, // je compose l’envie de l’invitation
    ton: 'm' // le ton des roues : 'b' barjot (mots décalés), 'm' un peu de tout, 'e' premier degré
  };
  buildLists(S.levels);
  const nameOf = (i) => (S.names[i] || '').trim() || (i === 0 ? 'Cerise' : 'Pistache');
  const other = (i) => 1 - i;
  // Un prénom est demandé avant de jouer : le champ vide tremble et prend la main
  function needName(input) {
    if (input.value.trim()) return false;
    if (!input.dataset.ph) input.dataset.ph = input.placeholder;
    input.placeholder = '';
    input.setAttribute('aria-invalid', 'true');
    input.classList.remove('is-missing'); void input.offsetWidth; input.classList.add('is-missing');
    input.focus();
    sNope(); haptic(20);
    return true;
  }
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.classList || !t.classList.contains('is-missing')) return;
    t.classList.remove('is-missing'); t.removeAttribute('aria-invalid');
    if (t.dataset.ph) t.placeholder = t.dataset.ph;
  });

  /* ---------- Grammaire ---------- */
  const VOWEL = /^[aeiouyàâäéèêëîïôöûüùœæh]/i;
  const isFree = (r, i) => !!LISTS[r][i].free;

  /* Une action qui finit par « de » ou « à » (« … le long de ») laisse la préposition
     à l’endroit, qui fait la contraction : du bas du dos, des fesses, d’une épaule. */
  const PREP_TAIL = /\s+(de|d[’']|à)$/i;
  function actionRaw(i, dir) {
    const a = LISTS[0][i];
    if (a.free) return S.custom[0].trim();
    return (dir === 'me' ? a.s : a.i) || '';
  }
  function actionForm(i, dir) {
    return actionRaw(i, dir).replace(PREP_TAIL, '');
  }
  function actionPrep(i) {
    const a = LISTS[0][i];
    if (!a.free && a.p) return a.p;
    const m = PREP_TAIL.exec(a.free ? S.custom[0].trim() : (a.s || a.i || ''));
    if (!m) return '';
    return m[1].toLowerCase() === 'à' ? 'à' : 'de';
  }
  function withA(o) {
    if (/^le\s/i.test(o)) return 'au ' + o.slice(3);
    if (/^les\s/i.test(o)) return 'aux ' + o.slice(4);
    return 'à ' + o;
  }
  function withDe(o) {
    if (/^(le|au)\s/i.test(o)) return 'du ' + o.slice(3);
    if (/^(les|aux)\s/i.test(o)) return 'des ' + o.slice(o.indexOf(' ') + 1);
    if (/^à\s/i.test(o)) return withDe(o.slice(2).trim());
    if (/^(du|des|de)\s/i.test(o) || /^d[’']/i.test(o)) return o;
    if (/^[aeiouyàâäéèêëîïôöûüùœæ]/i.test(o)) return 'd’' + o;
    return 'de ' + o;
  }
  function objetForm(j, prep, dir = S.dir) {
    const o = LISTS[1][j];
    const base = o.free ? S.custom[1].trim() : (o.t || (dir === 'me' ? o.s : o.i));
    if (!base) return '';
    if (prep === 'de') return withDe(base);
    return prep === 'à' && !/^(à|au|aux)\s/i.test(base) ? withA(base) : base;
  }
  function maniereForm(k, dir = S.dir) {
    const m = LISTS[2][k];
    if (m.free) return S.custom[2].trim();
    return m.t || (dir === 'me' ? m.s : m.i);
  }
  function dirForm(dir, act) {
    const el = !!act && VOWEL.test(act);
    if (dir === 'me') return el ? 'que tu m’' : 'que tu me';
    return el ? 'de t’' : 'de te';
  }
  const glue = (a, b) => (a.endsWith('’') ? a + b : a + ' ' + b);

  function parts(idx = S.idx, dir = S.dir) {
    const act = actionForm(idx[0], dir);
    return {
      dir: dirForm(dir, act),
      act,
      obj: objetForm(idx[1], actionPrep(idx[0]), dir),
      man: maniereForm(idx[2], dir)
    };
  }
  function sentence() {
    const p = parts();
    const s = ('J’ai envie ' + glue(p.dir, p.act) + ' ' + p.obj + ' ' + p.man).replace(/\s+/g, ' ').replace(/ ,/g, ',').trim();
    return /[.!?…]$/.test(s) ? s : s + '.';
  }

  function labelFor(r, i) {
    let t = '';
    if (r === 0) t = actionForm(i, S.dir);
    else if (r === 1) t = objetForm(i, actionPrep(reels[0] ? reels[0].index : S.idx[0]));
    else t = maniereForm(i);
    return t || PLACEHOLDER[r];
  }
  const isPlaceholder = (r, i) => isFree(r, i) && !S.custom[r].trim();

  /* ---------- Son (très discret) et haptique ---------- */
  let ac = null;
  function audio() {
    if (S.muted) return null;
    if (!ac) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { ac = new C(); } catch (e) { return null; }
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }
  function blip(freq, at, dur, vol, type = 'sine', slideTo) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + at;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  const sClick = () => blip(2400, 0, 0.022, 0.018, 'triangle', 1500);
  const sSwitchOn = () => { blip(620, 0, 0.09, 0.05); blip(930, 0.07, 0.12, 0.045); pulse(); };
  const sSwitchOff = () => blip(520, 0, 0.1, 0.035, 'sine', 380);
  const sNope = () => blip(220, 0, 0.12, 0.03, 'triangle', 160);
  const sParty = () => [523, 659, 784, 1047, 1319].forEach((f, i) => blip(f, i * 0.085, 0.32, 0.04, 'triangle'));

  let iosHaptic = null;
  function haptic(ms = 6) {
    if (typeof navigator.vibrate === 'function') { try { navigator.vibrate(ms); } catch (e) { /* rien */ } return; }
    // Safari iOS 18+ : basculer un <input switch> déclenche un petit retour haptique.
    try {
      if (!iosHaptic) {
        const l = document.createElement('label');
        l.setAttribute('aria-hidden', 'true');
        l.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
        const inp = document.createElement('input');
        inp.type = 'checkbox'; inp.setAttribute('switch', ''); inp.tabIndex = -1;
        l.appendChild(inp); document.body.appendChild(l);
        iosHaptic = l;
      }
      iosHaptic.click();
    } catch (e) { /* rien */ }
  }
  let lastTickAt = 0;
  function tick() {
    const now = performance.now();
    if (now - lastTickAt < 38) return;
    lastTickAt = now;
    sClick(); haptic(5);
  }

  /* ---------- Rouleaux ---------- */
  const ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    outBack: (t) => { const c = 1.25; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  };

  class Reel {
    constructor(r) {
      this.r = r;
      this.el = document.querySelector('[data-reel="' + r + '"]');
      this.strip = this.el.querySelector('.reel-strip');
      this.nodes = [];
      for (let k = 0; k < 7; k++) {
        const d = document.createElement('div');
        d.className = 'reel-item';
        this.strip.appendChild(d);
        this.nodes.push(d);
      }
      this.p = S.idx[r];
      this.lastTick = Math.round(this.p);
      this.raf = 0;
      this.drag = null;
      this.locked = false;
      this.bind();
      this.render();
    }
    get n() { return LISTS[this.r].length; }
    get index() { return mod(Math.round(this.p), this.n); }
    get busy() { return !!this.raf || !!this.drag; }
    itemH() { return parseFloat(getComputedStyle(this.el).getPropertyValue('--item-h')) || 38; }

    render() {
      // Un vrai tambour : une facette par mot (20 tirés, vos mots, la case à écrire), un tour complet ramène le même mot
      const h = this.itemH();
      const nf = Math.max(this.n, 10);
      const theta = 2 * Math.PI / nf;
      const R = (h / 2) / Math.tan(Math.PI / nf);
      const base = Math.round(this.p);
      for (let j = 0; j < 7; j++) {
        const node = this.nodes[j];
        const i = base + j - 3;
        const d = i - this.p;
        const a = d * theta;
        const idx = mod(i, this.n);
        const txt = labelFor(this.r, idx);
        const lvl = LISTS[this.r][idx].lvl || 1;
        const perso = !!LISTS[this.r][idx].m;
        const ph = isPlaceholder(this.r, idx);
        const key = txt + '|' + lvl + '|' + perso + '|' + ph;
        if (node._t !== key) {
          node.textContent = '';
          // La case libre : un crayon plutôt qu’une phrase
          if (ph) {
            const pen = document.createElement('span');
            pen.className = 'reel-pen';
            pen.innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-ecrire"/></svg>';
            node.appendChild(pen);
          }
          const tx = document.createElement('span');
          tx.className = 'reel-txt';
          tx.textContent = txt;
          node.appendChild(tx);
          if (perso) {
            const tag = document.createElement('span');
            tag.className = 'reel-perso';
            tag.innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-ecrire"/></svg>';
            node.appendChild(tag);
          }
          // Estampille piment : 2 ou 3 piments, sur le mot du centre seulement, posés après le texte centré :
          // ils ne prennent pas de place au texte (le mot d’avant et celui d’après ont presque toujours le même piment)
          if (lvl > 1) {
            const tag = document.createElement('span');
            tag.className = 'reel-chilis reel-chilis--' + lvl;
            tag.innerHTML = '<svg class="chili is-on" viewBox="0 0 24 24" aria-hidden="true"><use href="#chili"/></svg>'.repeat(lvl);
            tx.appendChild(tag);
          }
          node._t = key;
          const len = txt.length;
          node.classList.toggle('is-long', len > 22 && len <= 28);
          node.classList.toggle('is-xlong', len > 28);
          node.classList.toggle('is-xxlong', len > 36);
        }
        node.classList.toggle('is-placeholder', isPlaceholder(this.r, idx));
        // Pendant l’ajustement, les choix d’origine restent repérables
        node.classList.toggle('is-original', S.phase === 'adjust' && !!S.original && S.original.idx[this.r] === idx);
        node.classList.toggle('is-center', Math.abs(d) < 0.5);
        const vis = Math.abs(a) < Math.PI / 2;
        const c = Math.cos(a);
        node.style.opacity = vis ? Math.pow(c, 2).toFixed(3) : '0';
        node.style.transform = 'translateY(' + (Math.sin(a) * R).toFixed(2) + 'px) translateZ(' + ((c - 1) * R).toFixed(2) + 'px) rotateX(' + (-a * 57.2958).toFixed(2) + 'deg)';
      }
      const cur = LISTS[this.r][this.index];
      const orig = S.phase === 'adjust' && S.original && S.original.idx[this.r] === this.index;
      this.el.setAttribute('aria-valuetext', labelFor(this.r, this.index) + ((cur.lvl || 1) > 1 ? (cur.lvl === 3 ? ', brûlant' : ', pimenté') : '') + (cur.m ? ', vos mots' : '') + (orig ? ', choix de ' + nameOf(S.proposer) : ''));
      const t = Math.round(this.p);
      if (t !== this.lastTick) {
        this.lastTick = t;
        tick();
        if (this.r === 0) { reels[1].render(); renderDir(); }
      }
    }

    canMove() {
      if (!myTurn()) return false;
      if (S.phase === 'compose') return true;
      if (S.phase === 'adjust') return !this.locked && !reels.some((o) => o !== this && o.busy);
      return false;
    }
    nope() {
      this.el.classList.remove('is-nope');
      void this.el.offsetWidth;
      this.el.classList.add('is-nope', 'show-lock');
      sNope(); haptic(20);
      clearTimeout(this._nopeT);
      this._nopeT = setTimeout(() => this.el.classList.remove('show-lock'), 1400);
      if (S.phase === 'adjust' && this.locked) flashHint(T('jeu.une-seule', { prénom: nameOf(S.proposer) }));
    }
    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }

    animateTo(target, dur, fn = ease.outCubic, done) {
      this.stop();
      const from = this.p;
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        this.p = from + (target - from) * fn(k);
        this.render();
        if (k < 1) { this.raf = requestAnimationFrame(step); return; }
        this.raf = 0;
        this.p = target;
        this.render();
        this.settle();
        if (done) done();
      };
      this.raf = requestAnimationFrame(step);
    }
    step(dir) {
      if (!this.canMove()) { this.nope(); return; }
      this.animateTo(Math.round(this.p) + dir, 170);
    }
    coast(v) {
      const proj = Math.max(-14, Math.min(14, v * 300));
      const target = Math.round(this.p + proj);
      const dist = Math.abs(target - this.p);
      this.animateTo(target, Math.min(1500, 220 + dist * 70), dist > 2 ? ease.outBack : ease.outCubic);
    }
    spinTo(targetIdx, turns, dur) {
      const base = Math.round(this.p);
      const target = base + turns * this.n + mod(targetIdx - mod(base, this.n), this.n);
      this.animateTo(target, dur, ease.outBack);
    }
    settle() {
      const remote = !!this._remote;
      this._remote = false;
      S.idx[this.r] = this.index;
      onReelSettled(this.r, remote);
    }
    setLocked(on) {
      this.locked = on;
      this.el.classList.toggle('is-locked', on);
      this.el.setAttribute('aria-disabled', on ? 'true' : 'false');
    }

    bind() {
      const el = this.el;
      el.addEventListener('pointerdown', (e) => {
        if (e.button > 0 || e.target.closest('.stamp')) return;
        audio();
        if (!this.canMove()) { this.nope(); return; }
        this.stop();
        this.drag = { y: e.clientY, y0: e.clientY, t: performance.now(), v: 0, moved: false };
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* rien */ }
      });
      el.addEventListener('pointermove', (e) => {
        const g = this.drag; if (!g) return;
        const now = performance.now();
        const dy = e.clientY - g.y;
        const dt = Math.max(1, now - g.t);
        if (Math.abs(e.clientY - g.y0) > 6) g.moved = true;
        const di = -dy / this.itemH();
        this.p += di;
        g.v = g.v * 0.55 + (di / dt) * 0.45;
        g.y = e.clientY; g.t = now;
        this.render();
      });
      const end = (e) => {
        const g = this.drag; if (!g) return;
        this.drag = null;
        if (!g.moved) {
          // Petit retour à la case si le doigt a frôlé le rouleau
          this.p = Math.round(this.p);
          this.render();
          this.tap(e);
          return;
        }
        if (performance.now() - g.t > 90) g.v = 0;
        this.coast(g.v);
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);

      let wheelAcc = 0;
      el.addEventListener('wheel', (e) => {
        e.preventDefault();
        wheelAcc += e.deltaY;
        if (Math.abs(wheelAcc) > 30) { this.step(wheelAcc > 0 ? 1 : -1); wheelAcc = 0; }
      }, { passive: false });

      el.addEventListener('keydown', (e) => {
        if (e.target !== el) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); this.step(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); this.step(-1); }
        else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!this.canMove()) this.nope();
          else if (isFree(this.r, this.index)) openEditor(this.r);
          else openLoupe(this.r);
        }
      });
    }
    tap(e) {
      const rect = this.el.getBoundingClientRect();
      const y = e.clientY - rect.top - rect.height / 2;
      const h = this.itemH();
      if (y < -h / 2) this.step(-1);
      else if (y > h / 2) this.step(1);
      else if (isFree(this.r, this.index)) openEditor(this.r);
      else if (this.canMove()) openLoupe(this.r);
      else this.settle();
    }
  }

  let reels = [];

  /* ---------- Éléments ---------- */
  const el = {
    hint: $('#hint'),
    swTop: $('#sw-top'),
    ownerTop: $('#owner-top'),
    actMain: $('#act-main'), actAlt: $('#act-alt'),
    dir: $('#dir'), dice: $('#dice'), cabinet: $('#cabinet'),
    mute: $('#mute'), pass: $('#pass'), home: $('#home'),
    ovStart: $('#ov-start'), ovHandoff: $('#ov-handoff'), ovPass: $('#ov-pass'),
    ovEdit: $('#ov-edit'), ovParty: $('#ov-party'), ovOffer: $('#ov-offer'), ovOne: $('#ov-one')
  };

  /* ---------- Comparaison avec la proposition d’origine ---------- */
  const reelValue = (r, idx = S.idx, custom = S.custom) => (isFree(r, idx[r]) ? 'free:' + custom[r].trim() : String(idx[r]));
  function changedReels() {
    if (!S.original) return [];
    return [0, 1, 2].filter((r) => reelValue(r) !== reelValue(r, S.original.idx, S.original.custom));
  }
  // La réponse ne change qu’une chose : une roue, ou le sens « que tu me / de te »
  function changes() {
    const ch = changedReels();
    if (S.original && S.dir !== S.original.dir) ch.push('dir');
    return ch;
  }
  const CHANGE_NAMES = { get 0() { return T('jeu.nom-0'); }, get 1() { return T('jeu.nom-1'); }, get 2() { return T('jeu.nom-2'); }, get dir() { return T('jeu.nom-sens'); } };

  /* ---------- Rendu ---------- */
  function renderDir() {
    const a0 = reels[0] ? reels[0].index : S.idx[0];
    el.dir.dataset.dir = S.dir;
    el.dir.querySelectorAll('button[data-dir]').forEach((b) => {
      const d = b.dataset.dir;
      b.textContent = dirForm(d, actionForm(a0, d));
      b.setAttribute('aria-pressed', d === S.dir ? 'true' : 'false');
      b.classList.toggle('is-original', S.phase === 'adjust' && !!S.original && S.original.dir === d);
    });
  }

  let hintFlashT = 0;
  let hintFlash = '';
  function flashHint(text, ms) {
    hintFlash = text;
    el.hint.textContent = text;
    clearTimeout(hintFlashT);
    hintFlashT = setTimeout(() => { hintFlash = ''; renderHint(); }, ms || 2600);
  }
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function renderHint() {
    if (hintFlash) { el.hint.textContent = hintFlash; return; }
    const A = esc(nameOf(S.proposer));
    const B = esc(nameOf(other(S.proposer)));
    const ch = changes();
    let h = '';
    const nA = nameOf(S.proposer);
    if (S.phase === 'compose') h = TH('jeu.consigne', { prénom: { html: '<b>' + A + '</b>' } });
    else if (S.phase === 'adjust' && !ch.length) h = TH('jeu.consigne-mais', { prénom: { html: '<b>' + B + '</b>' }, autre: nA });
    else if (S.phase === 'adjust') h = TH('jeu.change', { chose: CHANGE_NAMES[ch[0]] }) + ' <button class="undo" type="button" id="undo">' + TH('jeu.revenir', { prénom: nA }) + '</button>';
    el.hint.innerHTML = h;
    const u = $('#undo');
    if (u) u.addEventListener('click', () => { audio(); resetAdjust(); });
  }

  function pulse() {
    document.body.classList.remove('is-pulse');
    void document.body.offsetWidth;
    document.body.classList.add('is-pulse');
    clearTimeout(pulse.t);
    pulse.t = setTimeout(() => document.body.classList.remove('is-pulse'), 950);
  }

  function render() {
    if (S.phase === 'compose') coachSoon();
    const ph = S.phase;
    const B = nameOf(other(S.proposer));
    const ch = changes();
    document.body.dataset.phase = ph;
    el.ownerTop.textContent = nameOf(S.proposer);
    if (!duo || duo.stage !== 'game') { $('#top-who').hidden = true; document.querySelector('.top > .logo').hidden = false; }

    // En bas : « On passe » et le bouton principal de la personne qui a la main
    el.actAlt.hidden = false;
    if (ph === 'compose') { el.actMain.textContent = S.gifting ? T('jeu.glisser') : T('jeu.proposer', { prénom: B }); el.actMain.disabled = false; }
    else if (ph === 'adjust') { el.actMain.textContent = ch.length ? T('jeu.fait') : T('jeu.aussi'); el.actMain.disabled = false; }
    else { el.actMain.disabled = true; }
    el.actMain.classList.toggle('is-done', ph === 'adjust' && ch.length > 0);
    // « On passe » vit en bas, à gauche du bouton principal ; #pass garde seulement son action
    el.actAlt.textContent = S.gifting && ph === 'compose' ? T('jeu.sans-envie') : T('jeu.passe');

    // « que tu me / de te » : à la composition, ou comme unique changement de l’ajustement
    const dirFree = ph === 'compose' || (ph === 'adjust' && (!ch.length || ch.includes('dir')));
    el.dir.classList.toggle('is-locked', !dirFree);
    el.dir.classList.toggle('is-changed', ph === 'adjust' && ch.includes('dir'));
    el.dir.parentElement.classList.toggle('is-changed', ph === 'adjust' && ch.includes('dir'));
    el.dice.hidden = ph !== 'compose';

    reels.forEach((rl) => {
      let lock = !(ph === 'compose' || ph === 'adjust');
      if (ph === 'adjust') lock = ch.length > 0 && !ch.includes(rl.r);
      rl.setLocked(lock);
      rl.el.classList.toggle('is-changed', (ph === 'adjust' || ph === 'reconfirm') && ch.includes(rl.r));
    });

    // Le bouton « annuler » prend la place du badge « changé », sur ce qui a changé
    document.querySelectorAll('.stamp').forEach((st) => {
      const on = ph === 'adjust' && !!st.closest('.is-changed');
      st.tabIndex = on ? 0 : -1;
      st.setAttribute('aria-hidden', on ? 'false' : 'true');
    });

    renderDir();
    renderHint();
    el.mute.setAttribute('aria-pressed', S.muted ? 'true' : 'false');
    $('#mute-state').textContent = S.muted ? 'coupé' : 'activé';
  }
  const renderReels = () => reels.forEach((r) => r.render());

  function onReelSettled(r, remote) {
    if (r === 0) { reels[1].render(); renderDir(); }
    render();
    if (!remote && (S.phase === 'compose' || S.phase === 'adjust')) sync();
  }

  /* ---------- Overlays ---------- */
  function show(ov) { ov.hidden = false; }
  function hide(ov) { ov.hidden = true; }

  /* La phrase, avec la partie changée surlignée */
  function sentenceHtml(marks = []) {
    const p = parts();
    const m = (t, on) => (on && t ? '<mark>' + esc(t) + '</mark>' : esc(t));
    const head = m(p.dir, marks.includes('dir')) + (p.dir.endsWith('’') ? '' : ' ') + m(p.act, marks.includes(0));
    const s = ('J’ai envie ' + head + ' ' + m(p.obj, marks.includes(1)) + ' ' + m(p.man, marks.includes(2))).replace(/\s+/g, ' ').replace(/ (<mark>)?,/g, '$1,').trim();
    return s + (/[.!?…]$/.test(p.man.trim()) ? '' : '.');
  }

  /* ---------- Modales du tour ---------- */
  // offer : l’envie de A présentée à B · reconfirm : l’envie ajustée présentée à A
  let offerKind = '';
  function showOffer(kind) {
    offerKind = kind;
    const A = nameOf(S.proposer), B = nameOf(other(S.proposer));
    const to = kind === 'offer' ? B : A;
    const kick = $('#offer-kicker');
    kick.textContent = duo ? (kind === 'offer' ? lowered : '') : T('offre.passe-tel', { prénom: to });
    kick.hidden = !kick.textContent;
    lowered = '';
    $('#offer-title').textContent = kind === 'offer' ? T('offre.titre', { prénom: A }) : T('offre.titre-ajuste', { prénom: B });
    $('#offer-sentence').innerHTML = sentenceHtml(kind === 'reconfirm' ? changes() : []);
    $('#offer-yes').textContent = kind === 'offer' ? T('offre.oui') : T('offre.oui-ajuste');
    $('#offer-but').hidden = kind !== 'offer';
    const back = $('#offer-back');
    back.hidden = !!duo;
    back.textContent = T('offre.oups', { prénom: kind === 'offer' ? A : B });
    hide(el.ovOne);
    show(el.ovOffer);
    $('#offer-yes').focus({ preventScroll: true });
  }
  function hideOffer() { hide(el.ovOffer); hide(el.ovOne); offerKind = ''; }

  /* Deux téléphones : le piment se règle par celui ou celle qui compose ; s’il monte,
     l’autre l’accepte avant de voir l’envie. S’il baisse, c’est accepté d’office. */
  const ovHot = $('#ov-hot');
  const hotter = () => !!duo && S.levels.some((n) => !(S.lvOk || S.levels).includes(n));
  let lowered = '';
  function showTurnModal() {
    if (!duo) return;
    const want = myTurn() && S.phase === 'review' ? 'offer' : (myTurn() && S.phase === 'reconfirm' ? 'reconfirm' : '');
    if (want === 'offer' && hotter()) {
      if (offerKind) hideOffer();
      if (ovHot.hidden) showHot();
      return;
    }
    hide(ovHot);
    if (want === 'offer' && S.lvOk && S.levels.join() !== S.lvOk.join()) {
      lowered = T('montee.baisse', { prénom: nameOf(S.proposer), piment: levelNames() });
      S.lvOk = S.levels.slice();
    }
    if (want && (offerKind !== want || el.ovOffer.hidden)) showOffer(want);
    else if (!want && offerKind) hideOffer();
  }
  function showHot() {
    const A = nameOf(S.proposer);
    const added = S.levels.filter((n) => !S.lvOk.includes(n));
    $('#hot-title').textContent = T('montee.titre', { prénom: A });
    $('#hot-text').textContent = T(added.length > 1 ? 'montee.texte-plusieurs' : 'montee.texte', { piment: levelNames(S.lvOk), prénom: A, niveaux: added.map((n) => D.niveaux[n - 1].nom).join(' et ') });
    $('#hot-levels').innerHTML = added.map((n) => '<p class="hot-level"><span class="pgroup pgroup--' + n + ' is-on">' + CHILI.repeat(n) + '</span>' +
      '<span><b>' + esc(D.niveaux[n - 1].nom) + '</b> · ' + esc(D.niveaux[n - 1].desc) + '</span></p>').join('');
    $('#hot-no').textContent = T('montee.non', { piment: levelNames(S.lvOk) });
    show(ovHot);
    sSwitchOn(); haptic(30);
    $('#hot-yes').focus({ preventScroll: true });
  }
  $('#hot-yes').addEventListener('click', () => {
    audio(); sClick(); haptic(8);
    report('monte', null, 'oui');
    S.lvOk = S.levels.slice();
    hide(ovHot);
    sync();
    showOffer('offer');
  });
  $('#hot-no').addEventListener('click', () => {
    audio(); haptic(20);
    report('monte', null, 'non');
    hide(ovHot);
    // On revient au piment accepté, et l’envie repart chez celui ou celle qui l’a proposée
    setLevels(S.lvOk, { silent: true, remote: true });
    duoPass(S.proposer, 'piment');
  });

  $('#offer-yes').addEventListener('click', () => {
    audio();
    if (!myTurn() || (offerKind === 'offer' && S.phase !== 'review') || (offerKind === 'reconfirm' && S.phase !== 'reconfirm')) return;
    hideOffer();
    sSwitchOn(); haptic(15);
    report('kiff', choiceLabels()); pushKiff();
    if (duo) { S.phase = 'celebrate'; noteKiff(); sync(); }
    setTimeout(celebrate, 220);
  });
  $('#offer-but').addEventListener('click', () => {
    audio();
    if (S.phase !== 'review' || !myTurn()) return;
    report('mais');
    $('#one-text').textContent = T('mais.texte');
    show(el.ovOne);
    sClick(); haptic(8);
    $('#one-ok').focus({ preventScroll: true });
  });
  $('#one-back').addEventListener('click', () => { audio(); hide(el.ovOne); });
  $('#one-ok').addEventListener('click', () => {
    audio();
    if (S.phase !== 'review' || !myTurn()) return;
    hideOffer();
    S.phase = 'adjust';
    renderReels();
    render();
    sync();
    sClick(); haptic(8);
  });
  $('#offer-pass').addEventListener('click', () => el.pass.click());
  $('#offer-back').addEventListener('click', () => {
    audio();
    const kind = offerKind;
    hideOffer();
    if (kind === 'offer') { S.phase = 'compose'; S.original = null; }
    else S.phase = 'adjust';
    renderReels();
    render();
  });

  /* ---------- Actions ---------- */
  function startComposition(proposer) {
    const turned = S.proposer !== proposer;
    S.proposer = proposer;
    S.phase = 'compose';
    S.original = null;
    S.bottom = false;
    hideOffer();
    render();
    if (!duo && S.started && !S.gifting) savePair(!turned); // à qui le tour : retrouvé à l’accueil
  }

  // Une case au hasard, ou parmi les formules les plus kiffées (premier tirage d’une partie)
  const ROUE_KEYS = ['action', 'endroit', 'maniere'];
  const labelOf = (x) => (x && !x.free ? (x.s || x.t || '') : '');
  // D’abord ce qu’on ne s’est jamais proposé ; quand tout est sorti, les mots les plus anciens
  function pickIndex(r, best) {
    const n = LISTS[r].length - 1; // la case texte libre ne sort pas au hasard
    let pool = [];
    for (let i = 0; i < n; i++) {
      const x = LISTS[r][i];
      if (r === 0 && x.m && x.d && x.d !== S.dir) continue; // une action écrite à la main garde son sens
      pool.push(i);
    }
    if (!pool.length) for (let i = 0; i < n; i++) pool.push(i);
    const seen = S.seen[r] || [];
    const fresh = pool.filter((i) => !seen.includes(wordKey(LISTS[r][i])));
    if (fresh.length) pool = fresh;
    else {
      const age = (i) => seen.indexOf(wordKey(LISTS[r][i]));
      pool = pool.slice().sort((a, b) => age(a) - age(b)).slice(0, Math.max(1, Math.ceil(pool.length / 2)));
    }
    if (best) {
      const m = (load('meilleurs', null) || {})[ROUE_KEYS[r]];
      if (Array.isArray(m) && m.length) {
        const c = pool.filter((i) => m.includes(labelOf(LISTS[r][i])));
        if (c.length) pool = c;
      }
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* ---------- Vos mots à vous deux, et ce qu’on s’est déjà proposé ---------- */
  const wordKey = (x) => [x.s || '', x.i || '', x.t || ''].join('|');
  const MINE_MAX = 30, SEEN_MAX = 240;
  // Les listes changent (un mot ajouté) : chaque roue garde la case qu’elle montrait
  function relist() {
    const cur = LISTS.map((l, r) => l[S.idx[r]]);
    const org = S.original ? S.original.idx.map((i, r) => LISTS[r][i]) : null;
    buildLists(S.levels);
    const at = (r, x) => { const i = LISTS[r].indexOf(x); return i < 0 ? LISTS[r].length - 1 : i; };
    S.idx = cur.map((x, r) => at(r, x));
    if (org) S.original.idx = org.map((x, r) => at(r, x));
    reels.forEach((rl, r) => { rl.stop(); rl.drag = null; rl.p = S.idx[r]; rl.lastTick = S.idx[r]; });
  }
  // « que tu me » → « de te » (et l’inverse), comme dans l’atelier ; à défaut, le texte tel quel
  const IRR = { fasses: 'faire', mettes: 'mettre', mordes: 'mordre', lises: 'lire', dises: 'dire', prennes: 'prendre', rendes: 'rendre',
    'écrives': 'écrire', offres: 'offrir', ouvres: 'ouvrir', sentes: 'sentir', boives: 'boire', tendes: 'tendre', ailles: 'aller',
    viennes: 'venir', tiennes: 'tenir', fesses: 'fesser', suces: 'sucer', circlues: 'circlure' };
  const IRR_INV = Object.fromEntries(Object.entries(IRR).map(([a, b]) => [b, a]));
  function toInf(t) {
    const m = t.match(/^(\S+)(.*)$/); if (!m) return t;
    const v = m[1], lc = v.toLowerCase();
    let inf = IRR[lc];
    if (!inf) inf = /è([^aeiouyéèê\s]+)es$/i.test(v) ? v.replace(/è([^aeiouyéèê\s]+)es$/i, 'e$1er') : /es$/i.test(v) ? v.slice(0, -2) + 'er' : v;
    return inf + m[2].replace(/\btes\b/g, 'mes').replace(/\bton\b/g, 'mon').replace(/\bta\b/g, 'ma');
  }
  function toSubj(t) {
    const m = t.match(/^(\S+)(.*)$/); if (!m) return t;
    const v = m[1], lc = v.toLowerCase();
    let s = IRR_INV[lc];
    if (!s) s = /er$/i.test(v) ? v.slice(0, -2) + 'es' : /ir$/i.test(v) ? v.slice(0, -2) + 'isses' : v;
    return s + m[2].replace(/\bmes\b/g, 'tes').replace(/\bmon\b/g, 'ton').replace(/\bma\b/g, 'ta');
  }
  function mineItem(r, text, dir) {
    if (r !== 0) return { t: text, m: 1 };
    return dir === 'me' ? { s: text, i: toInf(text), d: 'me', m: 1 } : { s: toSubj(text), i: text, d: 'te', m: 1 };
  }
  // Le texte libre d’une envie proposée devient un mot de la partie, pour les deux
  function adoptFree() {
    const tgt = [null, null, null];
    [0, 1, 2].forEach((r) => {
      const text = S.custom[r].replace(/\s+/g, ' ').trim();
      if (!isFree(r, S.idx[r]) || !text) return;
      const item = mineItem(r, text, S.dir);
      let x = S.mine[r].find((y) => sameItem(y, item));
      if (!x) { x = item; S.mine[r] = S.mine[r].concat(x).slice(-MINE_MAX); }
      tgt[r] = x;
      S.custom[r] = '';
    });
    if (!tgt.some(Boolean)) return false;
    relist();
    tgt.forEach((x, r) => {
      if (!x) return;
      const i = LISTS[r].indexOf(x);
      S.idx[r] = i;
      if (reels[r]) { reels[r].p = i; reels[r].lastTick = i; }
    });
    renderReels();
    return true;
  }
  function markSeen(idx = S.idx) {
    idx.forEach((i, r) => {
      const x = LISTS[r][i];
      if (!x || x.free) return;
      const k = wordKey(x);
      S.seen[r] = (S.seen[r] || []).filter((y) => y !== k).concat(k).slice(-SEEN_MAX);
    });
  }
  // Sur un seul téléphone, la mémoire va avec les deux prénoms : on la retrouve à la partie suivante
  const pairKey = () => [0, 1].map((i) => nameOf(i).trim().toLowerCase()).sort().join('|');
  const cleanMine = (l) => (Array.isArray(l) ? l : []).filter((x) => x && x.m && (typeof x.t === 'string' || (typeof x.s === 'string' && typeof x.i === 'string')))
    .map((x) => { const o = { m: 1 }; ['s', 'i', 't', 'd'].forEach((f) => { if (typeof x[f] === 'string') o[f] = x[f].slice(0, 60); }); return o; }).slice(-MINE_MAX);
  const cleanSeen = (l) => (Array.isArray(l) ? l : []).filter((k) => typeof k === 'string').slice(-SEEN_MAX);
  function setMemory(mem) {
    S.mine = [0, 1, 2].map((r) => cleanMine(mem && mem.mine && mem.mine[r]));
    S.seen = [0, 1, 2].map((r) => cleanSeen(mem && mem.seen && mem.seen[r]));
    relist();
  }
  // still : enregistrer sans faire remonter la partie dans la liste (on l’a seulement rouverte)
  function savePair(still) {
    if (duo) return;
    const all = load('paires', {}) || {};
    const was = all[pairKey()] || {};
    // names, p (à qui le tour), lv (piment) : la partie se retrouve à l’accueil, même après avoir fermé l’appli
    all[pairKey()] = { mine: S.mine, seen: S.seen, kiffs: (S.kiffs || []).slice(-60), ton: S.ton, t: still && was.t ? was.t : Date.now(),
      names: [nameOf(0), nameOf(1)], p: S.proposer, lv: S.levels.slice(), live: S.started ? 1 : (was.live || 0) };
    const keep = Object.keys(all).sort((a, b) => (all[b].t || 0) - (all[a].t || 0)).slice(0, 20);
    save('paires', Object.fromEntries(keep.map((k) => [k, all[k]])));
  }
  function shuffle(includeDir, best, announce) {
    if (includeDir) { S.dir = Math.random() < 0.5 ? 'me' : 'te'; }
    newDraw(); relist(); renderReels(); // de nouveaux mots dans les roues
    S.draw.forEach((d) => { if (d) addFound(d.keys); });
    pulse();
    // Un nouveau tour : les roues tournent seules sur un nouveau tirage, et la consigne le dit un instant
    if (announce && isComplet()) setTimeout(() => flashHint(T('jeu.nouveaux-mots'), 3000), 0);
    let pending = 3;
    reels.forEach((rl, k) => {
      const target = pickIndex(k, best);
      rl.spinTo(target, 2 + k, 1100 + k * 380);
      const prev = rl.settle.bind(rl);
      rl.settle = () => {
        rl.settle = prev; prev();
        if (--pending === 0) pulse();
      };
    });
    renderReels();
    render();
  }

  function missingFree() {
    return [0, 1, 2].find((r) => isPlaceholder(r, S.idx[r]));
  }
  function blockedByFree() {
    const m = missingFree();
    if (m === undefined) return false;
    reels[m].nope();
    flashHint(T('jeu.ecris', { roue: REEL_NAMES[m] }));
    return true;
  }

  /* ---------- Les premiers gestes : trois bulles, la première fois que quelqu’un compose une envie ---------- */
  const COACH = [['.strips', 'gestes.roues'], ['.press-row', 'gestes.reglages'], ['#act-main', 'gestes.proposer']];
  let coachI = -1, coachWho = '', coachT = 0;
  const composer = () => (duo ? nameOf(duo.seat) : nameOf(S.proposer)).trim().toLowerCase();
  function gestesVus() {
    let v = load('gestesVus', null);
    // Avant le 27 octobre 2026 : qui a déjà proposé une envie sur ce téléphone connaît les gestes
    if (!Array.isArray(v)) { v = load('envieFaite', false) ? knownList() : []; save('gestesVus', v); }
    return v;
  }
  function gesteVu(who) { const v = gestesVus(); if (who && !v.includes(who)) save('gestesVus', v.concat(who).slice(-60)); }
  function coachSoon() {
    if (coachT || !$('#coach').hidden || gestesVus().includes(composer())) return;
    coachT = setTimeout(() => { coachT = 0; maybeCoach(); }, 1400);
  }
  function maybeCoach() {
    if (!$('#coach').hidden || S.phase !== 'compose' || !S.started || !myTurn()) return;
    const who = composer();
    if (!who || gestesVus().includes(who)) return;
    // Rien par-dessus le jeu, et les roues à l’arrêt
    if (document.querySelector('.overlay:not([hidden])') || reels.some((r) => r.busy)) { coachSoon(); return; }
    coachWho = who; coachI = 0;
    show($('#coach'));
    placeCoach();
  }
  function placeCoach() {
    const [sel, key] = COACH[coachI];
    const t = document.querySelector(sel);
    if (!t) { endCoach(); return; }
    t.scrollIntoView({ block: 'nearest' });
    const r = t.getBoundingClientRect(), pad = 6;
    const ring = $('#coach-ring'), bub = $('#coach-bubble');
    Object.assign(ring.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
    const otherName = (duo ? (S.names[other(duo.seat)] || '') : nameOf(other(S.proposer))).trim() || T('principe.autre');
    $('#coach-text').textContent = T(key, { prénom: otherName });
    $('#coach-count').textContent = T('gestes.compte', { nombre: coachI + 1 });
    $('#coach-next').textContent = T(coachI === COACH.length - 1 ? 'gestes.fin' : 'gestes.suivant');
    // La bulle sous l’élément s’il y a la place, sinon au-dessus ; la flèche vise son milieu
    const below = r.bottom + 16 + 190 < innerHeight;
    bub.classList.toggle('is-above', !below);
    bub.style.top = below ? (r.bottom + pad + 14) + 'px' : '';
    bub.style.bottom = below ? '' : (innerHeight - r.top + pad + 14) + 'px';
    const bx = bub.getBoundingClientRect();
    bub.style.setProperty('--arrow-x', Math.max(24, Math.min(bx.width - 24, r.left + r.width / 2 - bx.left)) + 'px');
    $('#coach-next').focus({ preventScroll: true });
  }
  function endCoach() { hide($('#coach')); gesteVu(coachWho); coachI = -1; }
  $('#coach-next').addEventListener('click', () => { audio(); sClick(); haptic(8); if (coachI >= COACH.length - 1) { endCoach(); return; } coachI++; placeCoach(); });
  $('#coach-skip').addEventListener('click', () => { audio(); endCoach(); });
  window.addEventListener('resize', () => { if (!$('#coach').hidden) placeCoach(); });

  /* A propose son envie */
  function propose() {
    if (S.phase !== 'compose' || !myTurn() || reels.some((r) => r.busy) || blockedByFree()) return;
    gesteVu(composer());
    if (S.gifting) { endGift(true); return; }
    adoptFree();
    markSeen();
    savePair();
    report('envie', choiceLabels());
    if (!load('envieFaite', false)) { save('envieFaite', true); save('accueilApres', 0); }
    S.original = { idx: S.idx.slice(), custom: S.custom.slice(), dir: S.dir };
    S.phase = 'review';
    sSwitchOn(); haptic(15);
    render();
    if (duo) { sync(); renderWait(); return; }
    setTimeout(() => showOffer('offer'), 300);
  }
  /* B a fini d’ajuster (ou dit finalement oui tel quel) */
  function finishAdjust() {
    if (S.phase !== 'adjust' || !myTurn() || reels.some((r) => r.busy) || blockedByFree()) return;
    sSwitchOn(); haptic(15);
    if (changes().length) { adoptFree(); markSeen(); savePair(); }
    if (!changes().length) {
      report('kiff', choiceLabels()); pushKiff();
      if (duo) { S.phase = 'celebrate'; noteKiff(); sync(); }
      setTimeout(celebrate, 220);
      return;
    }
    S.phase = 'reconfirm';
    render();
    if (duo) { sync(); renderWait(); return; }
    setTimeout(() => showOffer('reconfirm'), 300);
  }
  el.actMain.addEventListener('click', () => {
    audio();
    if (S.phase === 'compose') propose();
    else if (S.phase === 'adjust') finishAdjust();
  });
  el.actAlt.addEventListener('click', () => el.pass.click());
  document.querySelectorAll('.stamp').forEach((st) => st.addEventListener('click', (e) => {
    e.stopPropagation();
    if (S.phase !== 'adjust' || !st.closest('.is-changed')) return;
    audio();
    haptic(10);
    resetAdjust();
  }));

  /* Revenir à l’envie d’origine, pour éventuellement changer autre chose */
  function resetAdjust() {
    if (S.phase !== 'adjust' || !S.original) return;
    S.dir = S.original.dir;
    S.custom = S.original.custom.slice();
    reels.forEach((rl, r) => {
      if (rl.index !== S.original.idx[r]) rl.animateTo(Math.round(rl.p) + shortest(rl.index, S.original.idx[r], rl.n), 380, ease.outBack);
    });
    sSwitchOff();
    renderReels();
    render();
    sync();
  }
  function shortest(from, to, n) {
    let d = mod(to - from, n);
    if (d > n / 2) d -= n;
    return d;
  }

  el.dir.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-dir]'); if (!b) return;
    audio();
    if (!myTurn()) return;
    const A = nameOf(S.proposer);
    if (S.phase === 'adjust') {
      const ch = changes();
      if (ch.length && !ch.includes('dir')) { sNope(); haptic(20); flashHint(T('jeu.une-seule-sens', { prénom: A })); return; }
      if (isFree(0, S.idx[0])) { sNope(); haptic(20); flashHint(T('jeu.sens-libre')); return; }
    } else if (S.phase !== 'compose') { sNope(); haptic(20); return; }
    if (S.dir === b.dataset.dir) return;
    S.dir = b.dataset.dir;
    sClick(); haptic(8);
    renderReels();
    render();
    sync();
  });

  el.dice.addEventListener('click', () => {
    audio();
    if (S.phase !== 'compose' || !myTurn() || reels.some((r) => r.busy)) return;
    shuffle(true);
  });

  el.mute.addEventListener('click', () => {
    S.muted = !S.muted;
    save('muted', S.muted);
    render();
    if (!S.muted) sClick();
  });

  /* On passe */
  el.pass.addEventListener('click', () => {
    audio();
    if (S.gifting) { endGift(false); return; } // finalement, inviter sans envie
    const A = nameOf(S.proposer), B = nameOf(other(S.proposer));
    $('#pass-same').textContent = T('passe.meme', { prénom: A });
    $('#pass-other').textContent = T('passe.autre', { prénom: B });
    show(el.ovPass);
    sSwitchOff();
  });
  function duoPass(to, why) {
    S.pass = { by: duo.seat, n: (S.pass ? S.pass.n : 0) + 1 };
    if (why) S.pass.why = why;
    hide(el.ovParty); stopConfetti();
    startComposition(to);
    sync();
    renderWait();
    if (myTurn()) setTimeout(() => { if (S.phase === 'compose' && myTurn()) shuffle(false, false, true); }, 500);
  }
  // Un nouveau tour sur un téléphone, après « On passe » : nouvelles roues
  const freshTurn = () => setTimeout(() => { if (S.phase === 'compose') shuffle(false, false, true); }, 400);
  $('#pass-same').addEventListener('click', () => {
    hide(el.ovPass);
    report('passe');
    hide(el.ovParty); stopConfetti();
    if (duo) { duoPass(S.proposer); return; }
    const A = S.proposer;
    // Si c’est l’autre qui tient le téléphone, on le rend à A
    if (S.phase === 'review' || S.phase === 'adjust') { hideOffer(); handoffNewTurn(A, null, freshTurn); return; }
    startComposition(A); freshTurn();
  });
  $('#pass-other').addEventListener('click', () => {
    hide(el.ovPass);
    report('passe');
    hide(el.ovParty); stopConfetti();
    const to = other(S.proposer);
    if (duo) { duoPass(to); return; }
    hideOffer();
    if (S.phase === 'review' || S.phase === 'adjust') { startComposition(to); freshTurn(); return; }
    handoffNewTurn(to, null, freshTurn);
  });
  $('#pass-cancel').addEventListener('click', () => { hide(el.ovPass); if (S.phase === 'celebrate') show(el.ovParty); });

  function handoffNewTurn(to, text, then) {
    $('#handoff-title').textContent = T('passage.titre', { prénom: nameOf(to) });
    $('#handoff-kicker').textContent = T('passage.kicker');
    $('#handoff-text').textContent = text || T('passage.texte');
    const go = $('#handoff-go');
    go.textContent = T('passage.go', { prénom: nameOf(to) });
    go.onclick = () => { hide(el.ovHandoff); startComposition(to); if (then) then(); };
    $('#handoff-back').hidden = true;
    show(el.ovHandoff);
  }

  /* Texte libre */
  let editing = -1;
  const editInput = $('#edit-input');
  function editPreview() {
    const r = editing;
    const backup = S.custom[r];
    S.custom[r] = editInput.value || '…';
    const idx = S.idx.slice(); idx[r] = reels[r].index;
    const p = parts(idx);
    S.custom[r] = backup;
    const seg = [glue(p.dir, p.act), p.obj, p.man];
    // la partie en cours d’écriture est surlignée
    const html = seg.map((s, k) => {
      const t = esc(s);
      if (k !== r) return t;
      if (r === 0) { const pre = esc(p.dir); return t.startsWith(pre) ? pre + (pre.endsWith('’') ? '' : ' ') + '<mark>' + esc(p.act) + '</mark>' : '<mark>' + t + '</mark>'; }
      return '<mark>' + t + '</mark>';
    }).join(' ');
    const body = html.replace(/(’) /g, '$1').replace(/ (<mark>)?,/g, '$1,');
    $('#edit-preview').innerHTML = 'J’ai envie ' + body + (/[.!?…](<\/mark>)?$/.test(body.trim()) ? '' : '.');
  }
  function openEditor(r) {
    if (!isComplet()) { openComplet('ecrire'); return; }
    editing = r;
    S.idx[r] = reels[r].index;
    const titles = [T('libre.titre-0'), T('libre.titre-1'), T('libre.titre-2')];
    const hints = [S.dir === 'me' ? T('libre.aide-0-me') : T('libre.aide-0-te'), T('libre.aide-1'), T('libre.aide-2')];
    $('#edit-label').textContent = titles[r];
    $('#edit-hint').textContent = hints[r];
    editInput.value = S.custom[r];
    show(el.ovEdit);
    editPreview();
    setTimeout(() => editInput.focus(), 60);
  }
  editInput.addEventListener('input', editPreview);

  /* La loupe : toucher le mot du centre ouvre toute la roue en grand. C’est un vrai tambour : une facette
     par mot, un rayon calculé pour que les facettes en fassent le tour exactement (un tour complet ramène
     au même mot), une courbure d’autant plus douce que la roue a de mots. Un champ cherche ou écrit. */
  const ovLoupe = $('#ov-loupe'), loupeQ = $('#loupe-q'), drumEl = $('#loupe-drum');
  const drumStrip = drumEl.querySelector('.reel-strip');
  let loupeR = -1, loupeFrom = null;
  const plain = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' ');
  const LOUPE_PH = { get 0() { return T('loupe.chercher-0'); }, get 1() { return T('loupe.chercher-1'); }, get 2() { return T('loupe.chercher-2'); } };
  const drum = { items: [], nodes: [], p: 0, raf: 0, drag: null, lastTick: 0, nf: 8, h: 38, R: 100, theta: 1 };
  const drumMod = (i, n) => ((i % n) + n) % n;
  // Le texte d’un mot de la réserve, tel qu’il s’afficherait dans la roue
  function itemLabel(r, x) {
    if (r === 0) return ((S.dir === 'me' ? x.s : x.i) || '').replace(PREP_TAIL, '');
    if (r === 1) {
      const base = x.t || (S.dir === 'me' ? x.s : x.i) || '';
      const prep = actionPrep(reels[0] ? reels[0].index : S.idx[0]);
      if (prep === 'de') return withDe(base);
      return prep === 'à' && !/^(à|au|aux)\s/i.test(base) ? withA(base) : base;
    }
    return x.t || (S.dir === 'me' ? x.s : x.i) || '';
  }
  // La loupe montre la roue elle-même, en grand : les mots tirés pour ce tour (et vos mots), dans le même ordre.
  function loupeItems() {
    const r = loupeR, out = [];
    LISTS[r].forEach((x) => {
      if (x.free || (r === 0 && x.m && x.d && x.d !== S.dir)) return;
      const t = itemLabel(r, x);
      if (t) out.push({ x, t, lvl: x.lvl || 1, m: !!x.m });
    });
    return out;
  }
  /* En tapant, la loupe cherche dans tous les mots du jeu (au piment et au ton choisis) : d’abord ceux qui contiennent
     ce qu’on tape, puis « Vous cherchez peut-être… », les mots proches par le sens (semantique.js). Le passage qui
     correspond est surligné. Choisir un mot hors du tirage le met dans la roue pour toute la partie. */
  const fold = (c) => c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[’`]/g, "'");
  function folded(t) {
    let f = ''; const map = [];
    for (let i = 0; i < t.length; i++) { const c = fold(t[i]); for (let k = 0; k < c.length; k++) { f += c[k]; map.push(i); } }
    map.push(t.length);
    return { f, map };
  }
  const markAt = (t, fm, a, b) => esc(t.slice(0, fm.map[a])) + '<mark>' + esc(t.slice(fm.map[a], fm.map[b])) + '</mark>' + esc(t.slice(fm.map[b]));
  const FAMILLES = (window.KIFF_FAMILLES || []).map((g) => g.map(fold));
  const wordStart = (f, i) => i === 0 || /[\s'(\-«]/.test(f[i - 1]);
  function searchWords(qRaw) {
    const r = loupeR, q = fold(qRaw.trim()).replace(/\s+/g, ' ');
    const seen = new Set(), pool = [];
    LISTS[r].concat(poolOf(r, S.levels)).forEach((x) => {
      if (!x || x.free || seen.has(x) || (r === 0 && x.m && x.d && x.d !== S.dir)) return;
      seen.add(x); pool.push(x);
    });
    const exact = [], near = [];
    // Un verbe tapé à l’infinitif ou conjugué trouve ses autres formes : « sucer » donne « suces » et « suçotes », pas « suçon »
    const vm = /^([a-z]{3,}?)(?:er|ir|re|ee|ees|es|ez|ent|e)$/.exec(q.length >= 4 && !/[\s']/.test(q) ? q : '');
    const verb = vm && vm[1].length >= 3 ? new RegExp('(^|[\\s\'(\\-«])(' + vm[1] + '(?:ot|ouill)?(?:e|es|er|ent|ez|ons|ee|ees|ant)?)(?![a-z0-9])') : null;
    pool.forEach((x) => {
      const t = itemLabel(r, x); if (!t) return;
      const fm = folded(t), i = fm.f.indexOf(q);
      if (i >= 0) { exact.push({ x, t, lvl: x.lvl || 1, html: markAt(t, fm, i, i + q.length), w: wordStart(fm.f, i) ? 0 : 1 }); return; }
      const m = verb && verb.exec(fm.f);
      if (m) { const a = m.index + m[1].length; exact.push({ x, t, lvl: x.lvl || 1, html: markAt(t, fm, a, a + m[2].length), w: 0 }); }
    });
    exact.sort((a, b) => a.w - b.w || a.lvl - b.lvl || a.t.localeCompare(b.t, 'fr'));
    // Les familles touchées par ce qu’on tape (un mot de 3 lettres ou plus, ou une expression)
    const toks = q.split(/[\s']+/).filter((w) => w.length >= 3);
    // Une racine courte (3 lettres) ne vaut que pour un mot entier : « cou » ne donne pas « coude »
    const short = (st) => !st.includes(' ') && st.length <= 3;
    const hit = (stem) => (stem.includes(' ') ? q.includes(stem) || (q.length >= 4 && stem.startsWith(q)) : toks.some((w) => (short(stem) ? w === stem : w.startsWith(stem)) || (w.length >= 4 && stem.startsWith(w))));
    const stems = [];
    FAMILLES.forEach((g) => { if (g.some(hit)) g.forEach((st) => { if (!stems.includes(st)) stems.push(st); }); });
    if (stems.length) {
      const inExact = new Set(exact.map((e) => e.x));
      pool.forEach((x) => {
        if (inExact.has(x)) return;
        const t = itemLabel(r, x); if (!t) return;
        const fm = folded(t);
        for (const st of stems) {
          let i = fm.f.indexOf(st);
          while (i >= 0 && !wordStart(fm.f, i)) i = fm.f.indexOf(st, i + 1);
          if (i < 0) continue;
          let j = i + st.length;
          if (short(st) && /[a-z0-9]/.test(fm.f[j] || '')) continue;
          if (!st.includes(' ')) while (j < fm.f.length && /[a-z0-9]/.test(fm.f[j])) j++;
          near.push({ x, t, lvl: x.lvl || 1, own: hit(st) ? 0 : 1, k: stems.indexOf(st), html: markAt(t, fm, i, j) });
          break;
        }
      });
      near.sort((a, b) => a.own - b.own || a.k - b.k || a.lvl - b.lvl || a.t.localeCompare(b.t, 'fr'));
    }
    return { exact: exact.slice(0, 40), near: near.slice(0, 25) };
  }
  let found = { exact: [], near: [] };
  function renderResults() {
    const q = loupeQ.value.replace(/\s+/g, ' ').trim();
    const box = $('#loupe-results');
    const on = !!q;
    box.hidden = !on;
    drumEl.hidden = on;
    $('#loupe-pick').hidden = on;
    if (!on) return;
    found = searchWords(q);
    const CH = '<svg class="chili is-on" viewBox="0 0 24 24" aria-hidden="true"><use href="#chili"/></svg>';
    const row = (it, k) => '<button class="loupe-hit" type="button" role="option" data-hit="' + k + '"><span class="loupe-hit-txt">' + it.html + '</span>' +
      (it.lvl > 1 ? '<span class="reel-chilis reel-chilis--' + it.lvl + '">' + CH.repeat(it.lvl) + '</span>' : '') + '</button>';
    box.innerHTML = found.exact.map((it, k) => row(it, 'e' + k)).join('') +
      (found.near.length ? '<p class="loupe-sub">' + TH('loupe.peut-etre') + '</p>' + found.near.map((it, k) => row(it, 'n' + k)).join('') : '') +
      (found.exact.length || found.near.length ? '' : '<p class="loupe-none">' + TH('loupe.vide') + '</p>');
    box.scrollTop = 0;
  }
  $('#loupe-results').addEventListener('click', (e) => {
    const b = e.target.closest('[data-hit]'); if (!b) return;
    const k = b.dataset.hit, it = k[0] === 'e' ? found.exact[+k.slice(1)] : found.near[+k.slice(1)];
    if (it) chooseWord(it.x);
  });
  /* Un tapis qui défile : plat au milieu, il s’enroule en haut et en bas sur six mots,
     comme une bande qui passe sur deux rouleaux. Le reste de la bande est derrière. */
  const BELT_CURVE = 6;
  function beltShape() {
    const H = drumEl.clientHeight || 400, h = drum.h;
    drum.theta = (Math.PI / 2) / BELT_CURVE;
    drum.R = h / drum.theta;
    drum.flat = Math.max(0, (H / 2 - drum.R) / h - 0.5);
  }
  function beltAt(d) {
    const { h, R, theta, flat } = drum, sg = d < 0 ? -1 : 1, e = Math.abs(d) - flat;
    if (e <= 0) return { y: d * h, z: 0, a: 0, vis: true };
    const a = e * theta;
    if (a >= Math.PI / 2 - 0.03) return { vis: false };
    return { y: sg * (flat * h + Math.sin(a) * R), z: (Math.cos(a) - 1) * R, a: sg * a, vis: true };
  }
  // Où tombe le doigt sur le tapis : l’inverse de beltAt
  function beltIndex(y) {
    const { h, R, theta, flat } = drum, sg = y < 0 ? -1 : 1, e = Math.abs(y) - flat * h;
    if (e <= 0) return y / h;
    return sg * (flat + Math.asin(Math.min(0.99, e / R)) / theta);
  }
  function buildDrum(keepI) {
    drum.items = loupeItems();
    const n = drum.items.length;
    drum.h = parseFloat(getComputedStyle(drumEl).getPropertyValue('--item-h')) || 38;
    drum.nf = Math.max(n, 1);
    beltShape();
    drumStrip.style.perspective = Math.round(Math.max(700, drum.R * 3.2)) + 'px';
    drumStrip.textContent = '';
    drum.nodes = drum.items.map((it) => {
      const d = document.createElement('div');
      d.className = 'reel-item';
      const len = it.t.length + (it.lvl > 1 ? it.lvl + 1 : 0);
      d.classList.toggle('is-long', len > 22 && len <= 28);
      d.classList.toggle('is-xlong', len > 28);
      d.classList.toggle('is-xxlong', len > 36);
      d.innerHTML = '<span class="reel-txt">' + esc(it.t) + '</span>' +
        (it.m ? '<span class="reel-perso"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-ecrire"/></svg></span>' : '') +
        (it.lvl > 1 ? '<span class="reel-chilis reel-chilis--' + it.lvl + '">' + '<svg class="chili is-on" viewBox="0 0 24 24" aria-hidden="true"><use href="#chili"/></svg>'.repeat(it.lvl) + '</span>' : '');
      drumStrip.appendChild(d);
      return d;
    });
    const k = drum.items.findIndex((it) => it.x === keepI);
    drum.p = k >= 0 ? k : 0;
    drum.lastTick = Math.round(drum.p);
    $('#loupe-empty').hidden = true;
    $('#loupe-pick').disabled = !n;
    renderDrum();
  }
  function renderDrum() {
    const n = drum.items.length;
    drum.nodes.forEach((node, k) => {
      let d = k - drum.p;
      d -= n * Math.round(d / n); // le tapis boucle : le mot le plus proche du centre
      const b = beltAt(d);
      // Avec peu de mots, celui qui passe de l’autre côté de la bande s’efface au lieu de sauter
      const edge = Math.max(0, Math.min(1, n / 2 - Math.abs(d)));
      node.style.visibility = b.vis && edge > 0 ? '' : 'hidden';
      if (!b.vis || edge <= 0) return;
      node.style.opacity = (Math.pow(Math.cos(b.a), 1.4) * edge).toFixed(3);
      node.style.transform = 'translateY(' + b.y.toFixed(2) + 'px) translateZ(' + b.z.toFixed(2) + 'px) rotateX(' + (-b.a * 57.2958).toFixed(2) + 'deg)';
      node.classList.toggle('is-center', Math.abs(d) < 0.5);
    });
    if (!n) return;
    const cur = drum.items[drumMod(Math.round(drum.p), drum.nf) % n] || drum.items[0];
    drumEl.setAttribute('aria-valuetext', cur.t + (cur.lvl > 1 ? (cur.lvl === 3 ? ', brûlant' : ', pimenté') : '') + (cur.m ? ', vos mots' : ''));
    const t = Math.round(drum.p);
    if (t !== drum.lastTick) { drum.lastTick = t; tick(); }
  }
  // Une facette nue (moins de dix mots) n’est jamais choisie : on glisse au mot le plus proche
  function drumTarget(t) {
    const n = drum.items.length, nf = drum.nf;
    if (!n || n === nf) return t;
    let best = t, bd = Infinity;
    for (let d = -nf; d <= nf; d++) { const k = drumMod(t + d, nf); if (k < n && Math.abs(d) < bd) { bd = Math.abs(d); best = t + d; } }
    return best;
  }
  function drumStop() { cancelAnimationFrame(drum.raf); drum.raf = 0; }
  function drumTo(target, dur, then) {
    drumStop();
    drum.target = target;
    const from = drum.p, t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      drum.p = from + (target - from) * ease.outCubic(k);
      renderDrum();
      if (k < 1) { drum.raf = requestAnimationFrame(step); return; }
      drum.raf = 0;
      drum.target = null;
      if (then) then();
    };
    drum.raf = requestAnimationFrame(step);
  }
  const drumSnap = () => drumTo(drumTarget(Math.round(drum.p)), 220);
  // L’élan du doigt : la roue file, ralentit, puis se cale sur une facette
  function drumFling(v) {
    drumStop();
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(40, now - last); last = now;
      drum.p += v * dt;
      v *= Math.pow(0.994, dt);
      renderDrum();
      if (Math.abs(v) > 0.0015) { drum.raf = requestAnimationFrame(step); return; }
      drum.raf = 0;
      drumSnap();
    };
    drum.raf = requestAnimationFrame(step);
  }
  drumEl.addEventListener('pointerdown', (e) => {
    if (!drum.items.length) return;
    drumStop();
    drum.drag = { y: e.clientY, p: drum.p, moved: false, hist: [{ t: performance.now(), p: drum.p }] };
    drumEl.setPointerCapture(e.pointerId);
  });
  drumEl.addEventListener('pointermove', (e) => {
    const d = drum.drag;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 5) d.moved = true;
    drum.p = d.p - dy / drum.h;
    d.hist.push({ t: performance.now(), p: drum.p });
    if (d.hist.length > 6) d.hist.shift();
    renderDrum();
  });
  const drumUp = (e) => {
    const d = drum.drag;
    if (!d) return;
    drum.drag = null;
    if (!d.moved) {
      // Toucher une facette : elle vient au centre ; toucher celle du centre : on la choisit
      const box = drumEl.getBoundingClientRect();
      const k = Math.round(drum.p + beltIndex(e.clientY - (box.top + box.height / 2)));
      if (k === Math.round(drum.p)) { pickDrum(); return; }
      sClick(); haptic(6);
      drumTo(drumTarget(k), 260);
      return;
    }
    const h = d.hist, a = h[0], b = h[h.length - 1];
    const v = b.t > a.t ? (b.p - a.p) / (b.t - a.t) : 0;
    if (Math.abs(v) > 0.004) drumFling(Math.max(-0.06, Math.min(0.06, v)));
    else drumSnap();
  };
  drumEl.addEventListener('pointerup', drumUp);
  drumEl.addEventListener('pointercancel', () => { drum.drag = null; drumSnap(); });
  let wheelT = 0;
  drumEl.addEventListener('wheel', (e) => {
    if (!drum.items.length) return;
    e.preventDefault();
    drumStop();
    drum.p += e.deltaY / drum.h / 2;
    renderDrum();
    clearTimeout(wheelT); wheelT = setTimeout(drumSnap, 120);
  }, { passive: false });
  drumEl.addEventListener('keydown', (e) => {
    // Les touches s’additionnent : chaque appui avance d’une facette, même pendant l’animation
    const base = drum.raf && drum.target != null ? drum.target : Math.round(drum.p);
    if (e.key === 'ArrowDown') { e.preventDefault(); drumTo(drumTarget(base + 1), 170); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); drumTo(drumTarget(base - 1), 170); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickDrum(); }
  });
  function openLoupe(r) {
    audio(); sClick(); haptic(8);
    loupeR = r;
    loupeFrom = reels[r].el;
    $('#loupe-title').textContent = REEL_NAMES[r].charAt(0).toUpperCase() + REEL_NAMES[r].slice(1);
    loupeQ.value = '';
    loupeQ.placeholder = isComplet() ? LOUPE_PH[r] : T('complet.chercher', { total: SOURCE.reduce((n, l) => n + l.length, 0) });
    loupeQ.readOnly = !isComplet();
    loupeQ.classList.toggle('is-pack', !isComplet());
    // Le tambour prend l’allure de la roue touchée
    drumEl.className = 'reel loupe-drum ' + [...reels[r].el.classList].filter((c) => /^strip/.test(c)).join(' ');
    $('#loupe-write').hidden = true;
    renderResults();
    show(ovLoupe);
    buildDrum(LISTS[r][reels[r].index]);
    requestAnimationFrame(() => buildDrum(LISTS[r][reels[r].index])); // une fois la feuille posée, à la bonne taille
    drumEl.focus({ preventScroll: true });
  }
  function renderWrite() {
    if (!isComplet()) { $('#loupe-write').hidden = true; return; }
    const typed = loupeQ.value.replace(/\s+/g, ' ').trim();
    const show_ = !!typed && !found.exact.some((it) => plain(it.t) === plain(typed));
    $('#loupe-write').hidden = !show_;
    $('#loupe-write-text').textContent = T('loupe.ecrire', { mot: typed });
  }
  function closeLoupe(focus = true) {
    drumStop();
    hide(ovLoupe);
    loupeQ.blur();
    if (focus && loupeFrom) loupeFrom.focus({ preventScroll: true });
    loupeR = -1;
  }
  function pickDrum() {
    const n = drum.items.length;
    if (!n || loupeR < 0) return;
    chooseWord(drum.items[drumMod(Math.round(drum.p), drum.nf) % n].x);
  }
  function chooseWord(x) {
    if (loupeR < 0) return;
    const r = loupeR, rl = reels[r];
    audio(); sClick(); haptic(10);
    closeLoupe();
    let i = LISTS[r].indexOf(x);
    if (i < 0) {
      // Un mot de la réserve, hors du tirage : il rejoint la roue pour toute la partie
      S.kept[r] = S.kept[r].filter((k) => k !== dkey(x)).concat(dkey(x)).slice(-30);
      relist(); renderReels();
      i = LISTS[r].indexOf(x);
      if (i < 0) return;
    }
    if (i === rl.index) { rl.settle(); return; }
    rl.spinTo(i, 0, 520);
  }
  function loupeWrite(text) {
    const r = loupeR, rl = reels[r];
    const fi = LISTS[r].findIndex((x) => x.free);
    closeLoupe(false);
    if (fi < 0) return;
    rl.p = Math.round(rl.p) + shortest(rl.index, fi, rl.n); rl.lastTick = rl.p;
    S.custom[r] = text.slice(0, 35);
    renderReels();
    openEditor(r); // l’aperçu de la phrase, et la bonne forme du verbe
  }
  loupeQ.addEventListener('input', () => { renderResults(); renderWrite(); });
  // Version gratuite : la recherche fait partie du jeu complet
  ['pointerdown', 'focus'].forEach((ev) => loupeQ.addEventListener(ev, (e) => { if (!isComplet()) { e.preventDefault(); loupeQ.blur(); openComplet('recherche'); } }));
  loupeQ.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!loupeQ.value.trim()) { pickDrum(); return; }
    const first = found.exact[0] || found.near[0];
    if (first && plain(first.t) === plain(loupeQ.value.trim())) { chooseWord(first.x); return; }
    if (!$('#loupe-write').hidden) { $('#loupe-write').click(); return; }
    if (first) chooseWord(first.x);
  });
  $('#loupe-write').addEventListener('click', () => { audio(); loupeWrite(loupeQ.value.replace(/\s+/g, ' ').trim()); });
  $('#loupe-pick').addEventListener('click', pickDrum);
  $('#loupe-close').addEventListener('click', () => { audio(); closeLoupe(); });
  ovLoupe.addEventListener('click', (e) => { if (e.target === ovLoupe) closeLoupe(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ovLoupe.hidden) closeLoupe(); });
  $('#edit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = editInput.value.replace(/\s+/g, ' ').trim().slice(0, 35);
    S.custom[editing] = v;
    hide(el.ovEdit);
    editInput.blur();
    renderReels();
    reels[editing].settle();
    if (v) { sClick(); haptic(8); }
    editing = -1;
  });
  $('#edit-cancel').addEventListener('click', () => { hide(el.ovEdit); editInput.blur(); editing = -1; });

  /* Célébration */
  /* Kiff kiff à distance : chaque téléphone doit voir sa célébration, même s’il revient
     après que l’autre est déjà passé au tour suivant. L’état partagé garde le dernier kiff
     trouvé ; chaque téléphone retient le dernier qu’il a fêté. */
  // L’historique : gardé dans l’état partagé à deux téléphones, en mémoire sur un seul
  function pushKiff() {
    // s : qui l’a proposée (sa place) ; lv : le piment accepté à ce moment-là (pour débloquer le suivant)
    // v : 0 à vivre, 1 vécue (sans v : une envie d’avant, vécue)
    S.kiffs = (S.kiffs || []).concat({ t: sentence(), w: nameOf(S.proposer), d: Date.now(), s: S.proposer, lv: Math.max(...(S.lvOk || S.levels)), v: 0 }).slice(-60);
    if (S.kiffs.length === 1) {
      const min = S.t0 ? (Date.now() - S.t0) / 60000 : -1;
      report('premier', null, min < 0 ? 'inconnu' : min < 5 ? 'moins-5' : min < 15 ? '5-15' : min < 60 ? '15-60' : min < 1440 ? '1h-1j' : 'plus-1j');
    }
    renderKiffs();
    savePair();
  }
  const toLive = () => (S.kiffs || []).filter((k) => k.v === 0);
  const kiffCount = () => Math.max((S.kiffs || []).length, S.kiff ? S.kiff.n : 0);
  const ordinal = (n) => (n === 1 ? T('fete.premier') : n + 'ᵉ');
  function renderKiffs() {
    const n = kiffCount();
    const B = duo ? nameOf(other(duo.seat)) : '';
    const btn = $('#kiffs-open');
    btn.hidden = !n;
    $('#kiffs-n').textContent = n || '';
    btn.setAttribute('aria-label', n + ' kiff kiff trouvé' + (n > 1 ? 's' : '') + (B ? ' avec ' + B : ' ensemble') + '. Voir l’historique');
    const wk = $('#wait-kiffs');
    wk.hidden = !n;
    $('#wait-kiffs-label').textContent = n || '';
    wk.setAttribute('aria-label', 'Vos kiff kiff (' + n + ')');
    // Les envies gardées pour plus tard : un badge sur le compteur
    const a = toLive().length;
    [['#kiffs-live', btn], ['#wait-live', wk]].forEach(([sel, host]) => {
      let b = $(sel);
      if (!b) { b = document.createElement('span'); b.className = 'badge badge--live'; b.id = sel.slice(1); b.setAttribute('aria-hidden', 'true'); host.appendChild(b); }
      b.hidden = !a; b.textContent = a || '';
    });
    if (a) btn.setAttribute('aria-label', btn.getAttribute('aria-label') + ' (' + a + ' à vivre)');
    renderChatBadges();
    // La partie ouverte : les cartes du fil suivent
    if (!$('#ov-wait').hidden) renderChat();
  }
  // Le pied de la célébration : une seule demande à la fois
  function partyFoot() {
    const n = kiffCount();
    const askInstall = false; // l’installation se propose après la célébration, dans sa petite fenêtre
    $('#party-install').hidden = !askInstall;
    $('#party-deal').hidden = askInstall || n < 2;
    document.querySelector('#ov-party .party-foot').hidden = $('#party-install').hidden && $('#party-deal').hidden;
  }
  function partyCount() {
    partyFoot();
    const lk = lastKiff();
    const pw = $('#party-write');
    pw.hidden = !(canChat() && lk);
    if (!pw.hidden) $('#party-write-text').textContent = T('fete.ecrire', { prénom: nameOf(other(duo.seat)) });
    const n = kiffCount();
    $('#party-count').hidden = !n;
    $('#party-count-text').textContent = T('fete.compte', { rang: ordinal(n) });
    $('#party-history').setAttribute('aria-label', 'Votre ' + ordinal(n) + ' kiff kiff ensemble. Revoir vos kiff kiff');
  }
  const ovKiffs = $('#ov-kiffs');
  let kiffsFrom = null;
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const dayOf = (ms) => { const d = new Date(ms); return d.getDate() + ' ' + MOIS[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''); };
  function openKiffs(e) {
    audio(); sClick(); haptic(8);
    kiffsFrom = e && e.currentTarget;
    reportOnce('historique');
    const B = duo ? nameOf(other(duo.seat)) : '';
    kiffsFilter = 'tous';
    // Sur un seul téléphone, le catalogue est la page de la partie : qui joue, l’action, puis les kiff kiff
    const seul = !duo;
    $('#kiffs-title').textContent = seul ? T('partie.seul-titre', { prénom: nameOf(0), autre: nameOf(1) }) : (B ? T('kiffs.titre-avec', { prénom: B }) : T('kiffs.titre'));
    const act = seul && S.phase === 'compose' && el.ovStart.hidden;
    $('#kiffs-action').hidden = !act;
    if (act) $('#kiffs-action-text').textContent = T('partie.tour-de', { prénom: nameOf(S.proposer) });
    renderKiffList();
    show(ovKiffs);
    $('#kiffs-list').scrollTop = 0;
    $('#kiffs-close').focus({ preventScroll: true });
  }
  const OK_SVG = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // Vos kiff kiff, comme une messagerie : le plus récent en haut (dernier message, ou date du kiff kiff)
  let kiffsFilter = 'tous';
  const shortWhen = (ms) => { const l = dayLabel(ms); return l === T('chat.aujourdhui') ? hhmm(ms) : l.toLowerCase(); };
  function kiffLast(k, cb) {
    const kid = kidOf(k);
    const msgs = cb ? cb.m.filter((m) => m.k === kid && !m.x) : [];
    const m = msgs[msgs.length - 1];
    return { d: Math.max(m ? m.d : 0, k.d || 0), m, nu: cb ? unread(kid, cb) : 0 };
  }
  const lastLineHtml = (l) => {
    if (!l.m) return '';
    const who = l.m.s === duo.seat ? T('chat.toi') : nameOf(other(duo.seat));
    return '<b>' + esc(who) + '&nbsp;:</b> ' + esc(l.m.t);
  };
  const ACT_SVG = { citer: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-citer"/></svg>', partager: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-partager"/></svg>', vecue: OK_SVG };
  function renderKiffList() {
    const cb = canChat() ? chatBox() : null;
    const all = (S.kiffs || []).map((k) => ({ k, l: kiffLast(k, cb) })).sort((a, b) => b.l.d - a.l.d);
    const live = all.filter(({ k }) => k.v === 0);
    const shown = kiffsFilter === 'vivre' ? live : kiffsFilter === 'vecues' ? all.filter(({ k }) => k.v !== 0) : all;
    const btn = (act, kid, label) => '<button class="env-act" type="button" data-act="' + act + '" data-kid="' + esc(kid) + '">' + ACT_SVG[act] + '<span>' + esc(label) + '</span></button>';
    $('#kiffs-list').innerHTML = shown.map(({ k, l }) => {
      const kid = kidOf(k), done = k.v !== 0;
      const mine = duo ? k.s === duo.seat : false;
      const who = duo && mine ? T('kiff.ton-envie') : T('kiffs.envie-de', { prénom: k.w || '…' });
      const kr = cb ? reactsHtml(cb.kr[kid] || {}) : '';
      const acts = cb ? btn('citer', kid, T('envie.citer')) + btn('partager', kid, T('envie.partager'))
        : (done ? '' : btn('vecue', kid, T('kiffs.vecue'))) + btn('partager', kid, T('envie.partager'));
      return '<li class="env-item' + (done ? ' is-done' : '') + (l.nu ? ' is-new' : '') + '"><div class="party-sentence env-card">' +
        '<button class="env-open" type="button" data-open="' + esc(kid) + '"><span class="env-text">' + esc(k.t || '') + '</span>' +
        '<span class="env-meta">' + esc(who + (k.d ? ' · ' + dayLabel(k.d).toLowerCase() : '') + ' · ' + (done ? T('kiff.vecue') : T('kiff.a-vivre'))) + (kr ? ' <span class="env-reacts">' + kr + '</span>' : '') + '</span></button>' +
        '<div class="env-acts">' + acts + '</div>' +
        (l.nu ? '<span class="badge badge--row env-badge">' + l.nu + '<span class="sr-only"> ' + (l.nu > 1 ? 'nouveaux messages' : 'nouveau message') + '</span></span>' : '') +
        '</div></li>';
    }).join('') || '<li class="kiffs-empty">' + TH('kiffs.vide') + '</li>';
    // Sous le titre, une ligne : trouvés · à vivre · mots découverts (sur un seul téléphone : ce téléphone · le piment)
    const n = kiffCount(), f = foundCount();
    $('#kiffs-count').textContent = !duo ? T('partie.seul') + ' · ' + levelNames()
      : [T(n > 1 ? 'kiffs.trouves' : 'kiffs.trouve-1', { nombre: n })]
        .concat(live.length ? [T('kiffs.vivre-n', { nombre: live.length })] : [])
        .concat(f.n ? [T('kiffs.mots', { nombre: f.n })] : []).join(' · ');
    const sub = $('#kiffs-sub');
    sub.hidden = !!duo;
    sub.textContent = T('kiffs.titre') + ' · ' + n;
    const tv = $('#kiffs-tabs [data-f="vivre"]');
    tv.textContent = T('kiffs.a-vivre') + (live.length ? ' · ' + live.length : '');
    $('#kiffs-tabs').querySelectorAll('[role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.f === kiffsFilter)));
  }
  $('#kiffs-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]'); if (!b || b.dataset.f === kiffsFilter) return;
    audio(); sClick(); haptic(6);
    kiffsFilter = b.dataset.f;
    renderKiffList();
  });
  const closeKiffs = () => { hide(ovKiffs); if (kiffsFrom) kiffsFrom.focus({ preventScroll: true }); };
  // Le compteur du jeu : à deux téléphones, la partie (la conversation) ; sur un seul, le catalogue
  $('#kiffs-open').addEventListener('click', (e) => { if (duo && duo.stage === 'game') { audio(); sClick(); haptic(8); openPartie(); } else openKiffs(e); });
  $('#wait-kiffs').addEventListener('click', openKiffs);
  $('#party-history').addEventListener('click', openKiffs);
  $('#kiffs-action-go').addEventListener('click', () => { audio(); sClick(); closeKiffs(); });
  // La fête : écrire tout de suite, en citant le kiff kiff ; la fête attend dessous
  $('#party-write').addEventListener('click', () => { const k = lastKiff(); if (!k) return; audio(); sClick(); haptic(8); report('discussion', null, 'fete'); openPartie({ front: true, cite: kidOf(k), kid: kidOf(k) }); });
  $('#kiffs-close').addEventListener('click', () => { audio(); closeKiffs(); });
  ovKiffs.addEventListener('click', (e) => { if (e.target === ovKiffs) closeKiffs(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ovKiffs.hidden && ovKiff.hidden) closeKiffs(); });

  /* ---------- Un kiff kiff rouvert, et sa discussion ----------
     Depuis « Vos kiff kiff », chaque kiff kiff se rouvre : sa carte (à envoyer en image), « Vécue », les réactions.
     À deux téléphones, chaque kiff kiff a sa discussion. Les messages restent sur les deux téléphones ;
     ils passent chiffrés par le relais, ou attendent chiffrés dans la boîte aux lettres de la feuille. */
  const EMOJIS = ['🔥', '😏', '🤭', '👀', '🥵', '😈', '🫦', '💦', '🍑', '🍆', '🍒', '🌶️', '🍾', '🥂', '😘', '🤤', '😳', '🙈', '😇', '✨', '👅', '💋', '🫣', '🕯️'];
  const QUICK = EMOJIS.slice(0, 5);
  const CHAT_MAX = 400; // messages gardés par partie, sur le téléphone
  const THREAD = '*'; // les messages du fil de la partie (sinon : l’envie citée)
  const kidOf = (k) => String((k && k.d) || '');
  const kiffById = (kid) => (S.kiffs || []).find((k) => kidOf(k) === kid) || null;
  const roomNow = () => (duo && duo.info ? duo.info.room : '');
  const canChat = () => !!duo && duo.stage === 'game' && !!duo.conn;
  function chatBox(room) {
    const all = load('chats', {}) || {};
    const b = all[room || roomNow()] || {};
    b.m = Array.isArray(b.m) ? b.m : []; b.lu = b.lu || {}; b.vu = b.vu || {}; b.kr = b.kr || {}; b.ev = Array.isArray(b.ev) ? b.ev : [];
    return b;
  }
  function chatSave(b, room) {
    const all = load('chats', {}) || {};
    b.m = b.m.slice(-CHAT_MAX); b.ev = b.ev.slice(-600); b.t = Date.now();
    all[room || roomNow()] = b;
    // 30 parties au plus, les plus récentes
    const keep = Object.keys(all).sort((x, y) => (all[y].t || 0) - (all[x].t || 0)).slice(0, 30);
    save('chats', Object.fromEntries(keep.map((k) => [k, all[k]])));
  }
  // Les messages de l’autre que je n’ai pas encore lus, pour un kiff kiff ou pour toute la partie
  function unread(kid, b) {
    if (!duo) return 0;
    b = b || chatBox();
    return b.m.filter((m) => m.s !== duo.seat && !m.x && (!kid || m.k === kid) && m.d > Math.max(b.lu[THREAD] || 0, b.lu[m.k] || 0)).length;
  }
  // Appliquer un événement (le mien ou celui de l’autre) : une fois seulement, quel que soit le chemin
  function applyChat(ev, b) {
    if (!ev || typeof ev !== 'object' || !ev.ev || b.ev.includes(ev.ev)) return false;
    b.ev.push(ev.ev);
    const s = ev.s === 0 || ev.s === 1 ? ev.s : -1;
    const k = String(ev.k || '').slice(0, 20);
    const find = () => b.m.find((m) => m.id === ev.id);
    if (ev.ty === 'm' && typeof ev.t === 'string' && ev.id && !find()) {
      b.m.push({ id: String(ev.id).slice(0, 24), k, s, t: ev.t.slice(0, 1000), d: +ev.d || Date.now(), q: ev.q ? String(ev.q).slice(0, 24) : '' });
      b.m.sort((x, y) => x.d - y.d);
    } else if (ev.ty === 'e') {
      const m = find(); if (m && m.s === s && !m.x && typeof ev.t === 'string') { m.t = ev.t.slice(0, 1000); m.e = +ev.d || Date.now(); }
    } else if (ev.ty === 'x') {
      const m = find(); if (m && m.s === s) { m.x = 1; m.t = ''; m.r = {}; }
    } else if (ev.ty === 'r') {
      const emo = typeof ev.emo === 'string' ? ev.emo.slice(0, 8) : '';
      let target;
      if (ev.id === '_') target = (b.kr[k] = b.kr[k] || {});
      else { const m = find(); if (!m) return true; target = (m.r = m.r || {}); }
      if (emo) target[s] = emo; else delete target[s];
    } else if (ev.ty === 'v') {
      b.vu[k] = Math.max(b.vu[k] || 0, +ev.d || 0);
    }
    return true;
  }
  function sendChat(ev) {
    if (!canChat()) return;
    ev.ev = window.KiffDuo.newId();
    ev.s = duo.seat;
    ev.d = ev.d || Date.now();
    const b = chatBox();
    applyChat(ev, b);
    chatSave(b);
    duo.conn.chat(ev).catch(() => {});
    if (ev.ty === 'm') {
      // L’autre téléphone est averti à chaque message (il se tait s’il a déjà Kiff Kiff à l’écran)
      const sub = Array.isArray(duo.push) ? duo.push[other(duo.seat)] : null;
      if (KP && sub) KP.send(sub, { k: 'message', r: duo.info.room, n: String(nameOf(duo.seat) || '').trim().slice(0, 30), kf: ev.k });
    }
  }
  // Ce qui arrive de l’autre téléphone, en direct ou par la boîte aux lettres
  let ackT = 0, ackIds = [];
  function receiveChat(list, viaBox) {
    if (!duo || !duo.info) return;
    const b = chatBox();
    let fresh = 0;
    list.forEach((ev) => {
      if (!ev) return;
      if (ev.s === duo.seat) return; // un écho de mes propres messages
      if (applyChat(ev, b) && ev.ty === 'm') fresh++;
      if (!viaBox) ackIds.push(ev.ev);
    });
    chatSave(b);
    if (ackIds.length) { clearTimeout(ackT); ackT = setTimeout(() => { if (duo && duo.info) window.KiffDuo.boxAck(duo.info, duo.seat, ackIds.splice(0)); }, 1500); }
    if (fresh && partieOn() && document.visibilityState === 'visible') { sClick(); haptic(8); }
    renderChat(); renderChatBadges();
  }
  // La boîte aux lettres : en ouvrant la partie, en revenant dans l’appli, en rouvrant un kiff kiff
  let boxT = 0;
  async function pullBox(force) {
    if (!duo || !duo.info || duo.stage !== 'game' || !window.KiffDuo.boxLoad) return;
    if (!force && Date.now() - boxT < 15000) return;
    boxT = Date.now();
    const room = duo.info.room, seat = duo.seat;
    const got = await window.KiffDuo.boxLoad(duo.info, seat);
    if (!got.length || !duo || !duo.info || duo.info.room !== room) return;
    receiveChat(got.map((x) => x.obj).filter(Boolean).sort((x, y) => (x.d || 0) - (y.d || 0)), true);
    window.KiffDuo.boxAck(duo.info, seat, got.map((x) => x.id));
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pullBox(); });
  // « écrit… »
  let typingKid = '', typingT = 0, myTypingT = 0, myTypingAt = 0;
  function onTyping(kid) {
    typingKid = kid;
    clearTimeout(typingT);
    if (kid) typingT = setTimeout(() => { typingKid = ''; renderKiffStatus(); }, 6000);
    renderKiffStatus();
  }

  /* ---------- La partie, c’est la conversation (26 octobre 2026) ----------
     À deux téléphones, la page de la partie est un seul fil : les messages, et chaque kiff kiff posé là où il a été trouvé.
     En tête, l’action du moment. Une envie s’ouvre en plein écran : citer, partager, vécue, supprimer.
     La page de la partie garde l’identifiant de l’ancien écran d’attente (#ov-wait) : elle s’ouvre toute seule quand l’autre a la main. */
  const ovPartie = $('#ov-wait');
  const ovKiff = $('#ov-kiff');
  const chatInput = $('#chat-input');
  let kiffOpen = '', replyTo = null, editing2 = null, citeKid = '';
  let partieWanted = false, partieFront = false, boxPoll = 0;
  const partieOn = () => !ovPartie.hidden && canChat();
  // Ouvrir la partie : depuis le jeu, la fête (par-dessus), un avertissement ; citer une envie ; aller à sa carte
  function openPartie(opt) {
    opt = opt || {};
    if (!duo || duo.stage !== 'game') return;
    partieWanted = true;
    partieFront = !!opt.front;
    ovPartie.classList.toggle('is-front', partieFront);
    renderWait();
    if (opt.cite) startCite(opt.cite);
    if (opt.kid) setTimeout(() => scrollToKiff(opt.kid), 80);
  }
  function closePartie() {
    partieWanted = false;
    if (!ovPartie.hidden) { hide(ovPartie); partieHidden(); }
    renderChatBadges();
  }
  function partieShown() {
    replyTo = null; editing2 = null; citeKid = '';
    renderReplyBar();
    $('#chat-emojis').hidden = true; $('#chat-emo-btn').setAttribute('aria-expanded', 'false');
    chatInput.placeholder = duo ? T('chat.placeholder', { prénom: nameOf(other(duo.seat)) }) : '';
    $('#chat-bar').hidden = !canChat();
    renderChat(true);
    // Tant que la partie est à l’écran : la boîte aux lettres, de temps en temps, au cas où le relais aurait manqué un message
    clearInterval(boxPoll); if (canChat()) boxPoll = setInterval(() => { if (document.visibilityState === 'visible') pullBox(); }, 20000);
    report('discussion', null, 'ouverte');
    if (canChat()) pullBox(true);
  }
  function partieHidden() {
    clearInterval(boxPoll);
    if (myTypingAt && duo && duo.conn) duo.conn.typing('');
    myTypingAt = 0; replyTo = null; editing2 = null; citeKid = '';
    partieWanted = false; partieFront = false; ovPartie.classList.remove('is-front');
  }
  function scrollToKiff(kid) {
    const li = $('#chat-list').querySelector('[data-kid="' + CSS.escape(kid) + '"]');
    if (!li) return;
    li.scrollIntoView({ block: 'center' });
    li.classList.remove('is-flash'); void li.offsetWidth; li.classList.add('is-flash');
  }
  function startCite(kid) {
    if (!canChat() || !kiffById(kid)) return;
    citeKid = kid; replyTo = '_'; editing2 = null;
    renderReplyBar();
    chatInput.focus({ preventScroll: true });
  }
  // « écrit… » : en haut de la partie, et une bulle au bout du fil
  function renderKiffStatus() {
    if (ovPartie.hidden) return;
    renderDuoStatus();
    renderChat();
  }
  const reactsHtml = (r) => {
    const seats = Object.keys(r || {});
    if (!seats.length) return '';
    return seats.map((s) => '<span class="chat-react" title="' + esc(+s === (duo ? duo.seat : -1) ? 'toi' : nameOf(+s)) + '">' + esc(r[s]) + '</span>').join('');
  };
  const hhmm = (ms) => { const d = new Date(ms); return d.getHours() + ' h ' + String(d.getMinutes()).padStart(2, '0'); };
  function dayLabel(ms) {
    const d = new Date(ms), t = new Date();
    const same = (a, c) => a.getFullYear() === c.getFullYear() && a.getMonth() === c.getMonth() && a.getDate() === c.getDate();
    if (same(d, t)) return T('chat.aujourdhui');
    const y = new Date(t); y.setDate(t.getDate() - 1);
    if (same(d, y)) return T('chat.hier');
    return dayOf(ms);
  }
  // Le texte d’un message : échappé, les liens restent du texte
  const msgHtml = (t) => esc(t).replace(/\n/g, '<br>');
  const cutSentence = (t, n) => { const x = (t || '').replace(/^J’ai envie\s+/, '…'); return x.length > n ? x.slice(0, n - 1) + '…' : x; };
  // Un kiff kiff dans le fil : sa carte, touchée elle s’ouvre en plein écran
  function threadKiffHtml(k, b) {
    const kid = kidOf(k), kr = b ? (b.kr[kid] || {}) : {};
    const r = reactsHtml(kr);
    return '<li class="thread-kiff' + (k.v !== 0 ? ' is-done' : '') + '" data-kid="' + esc(kid) + '"><button class="thread-kiff-btn" type="button" data-envie="' + esc(kid) + '">' +
      '<span class="thread-kiff-kicker">' + esc(T('partie.kiff-kicker', { etat: k.v === 0 ? T('kiff.a-vivre') : T('kiff.vecue') })) + '</span>' +
      '<span class="party-sentence thread-kiff-card"><span class="thread-kiff-text">' + esc(k.t || '') + '</span>' +
      (r ? '<span class="thread-kiff-reacts">' + r + '</span>' : '') + '</span></button></li>';
  }
  /* L’envie en cours (proposée, pas encore un kiff kiff) : une carte dans le fil, à l’heure où elle est arrivée sur ce téléphone */
  function pendingEnvie() {
    if (!duo || !duo.info || !S.original || !['review', 'adjust', 'reconfirm'].includes(S.phase)) return null;
    const adj = S.phase === 'reconfirm';
    const text = adj ? sentence() : sentenceFrom(S.original);
    const all = load('envieVue', {}) || {};
    const room = duo.info.room;
    if (!all[room] || all[room].sig !== text) {
      all[room] = { sig: text, d: Date.now() };
      const keep = Object.keys(all).sort((a, c) => (all[c].d || 0) - (all[a].d || 0)).slice(0, 20);
      save('envieVue', Object.fromEntries(keep.map((k) => [k, all[k]])));
    }
    const mine = S.proposer === duo.seat;
    return { d: all[room].d, text, adj, mine };
  }
  function threadEnvieHtml(e, B) {
    const kick = e.adj ? (e.mine ? T('partie.envie-ajustee-par', { prénom: B }) : T('partie.envie-ajustee-toi'))
      : e.mine ? T('partie.envie-toi') : T('partie.envie-de', { prénom: B });
    const go = myTurn() && !$('#wait-go').hidden;
    return '<li class="thread-kiff thread-envie"><button class="thread-kiff-btn" type="button"' + (go ? ' data-envie-go="1"' : ' disabled') + '>' +
      '<span class="thread-kiff-kicker">' + esc(kick) + '</span>' +
      '<span class="party-sentence thread-kiff-card"><span class="thread-kiff-text">' + esc(e.text) + '</span></span></button></li>';
  }
  function renderChat(toEnd) {
    if (ovPartie.hidden) return;
    if (duo && duo.stage === 'invite' && duo.info) { $('#chat-list').innerHTML = inviteThreadHtml(); $('#chat-down').hidden = true; return; }
    const b = duo && duo.info ? chatBox() : null;
    const B = duo ? nameOf(other(duo.seat)) : '';
    const items = (S.kiffs || []).map((k) => ({ d: k.d || 0, k }));
    if (b) b.m.forEach((m) => items.push({ d: m.d, m }));
    const pe = pendingEnvie();
    if (pe) items.push({ d: pe.d, e: pe });
    items.sort((x, y) => x.d - y.d);
    const lastMine = b ? b.m.filter((m) => m.s === duo.seat && !m.x).slice(-1)[0] : null;
    let day = '', html = '';
    if (!items.length) html = '<li class="chat-empty">' + esc(T('chat.vide', { prénom: B })) + '</li>';
    // Les messages qui se suivent (même personne, moins de 3 minutes, même jour) forment une suite : l’heure sur le dernier
    const GAP = 3 * 60000;
    const sameRun = (a, c) => !!a && !!c && !!a.m && !!c.m && !a.m.x && !c.m.x && a.m.s === c.m.s && Math.abs(c.d - a.d) < GAP && dayLabel(a.d) === dayLabel(c.d);
    items.forEach((it, i) => {
      const dl = dayLabel(it.d || Date.now());
      if (dl !== day) { day = dl; html += '<li class="chat-day"><span>' + esc(dl) + '</span></li>'; }
      if (it.k) { html += threadKiffHtml(it.k, b); return; }
      if (it.e) { html += threadEnvieHtml(it.e, B); return; }
      const m = it.m, mine = m.s === duo.seat;
      if (m.x) { html += '<li class="chat-msg chat-msg--gone' + (mine ? ' is-mine' : '') + '">' + esc(T('chat.supprime')) + '</li>'; return; }
      // Une citation : une envie (« Kiff kiff · …le bas du dos… ») ou un message
      let quote = '';
      if (m.q === '_') { const k = kiffById(m.k); quote = '<span class="chat-quote" data-goto="' + esc(m.k) + '">' + esc(T('chat.cite-kiff')) + ' · ' + esc(k ? cutSentence(k.t, 60) : '…') + '</span>'; }
      else if (m.q) { const q = b.m.find((x) => x.id === m.q); if (q) quote = '<span class="chat-quote">' + esc(q.x ? T('chat.supprime') : (q.t || '').slice(0, 80)) + '</span>'; }
      const vu = Math.max(b.vu[THREAD] || 0, b.vu[m.k] || 0);
      const meta = hhmm(m.d) + (m.e ? ' · ' + T('chat.modifie') : '') + (mine && lastMine && lastMine.id === m.id && vu >= m.d ? ' · ' + T('chat.lu') : '');
      const cont = sameRun(items[i - 1], it), more = sameRun(it, items[i + 1]);
      const showMeta = !more || m.e || (mine && lastMine && lastMine.id === m.id);
      html += '<li class="chat-msg' + (mine ? ' is-mine' : '') + (cont ? ' is-cont' : '') + (more ? ' is-more' : '') + '" data-mid="' + esc(m.id) + '" tabindex="0" aria-label="' + esc((mine ? T('chat.toi') : B) + ' : ' + m.t + ', ' + hhmm(m.d)) + '">' +
        quote + '<span class="chat-text">' + msgHtml(m.t) + '</span>' + (showMeta ? '<span class="chat-meta">' + esc(meta) + '</span>' : '') +
        (m.r && Object.keys(m.r).length ? '<span class="chat-reacts">' + reactsHtml(m.r) + '</span>' : '') + '</li>';
    });
    if (typingKid) html += '<li class="chat-typing" aria-label="' + esc(B + ' ' + T('chat.ecrit')) + '"><span></span><span></span><span></span></li>';
    const sc = $('#kiff-scroll');
    const atEnd = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80;
    $('#chat-list').innerHTML = html;
    const othersN = b ? b.m.filter((m) => m.s !== duo.seat && !m.x).length : 0;
    if (toEnd || atEnd) { sc.scrollTop = sc.scrollHeight; newBelow = 0; }
    else if (othersN > lastOthersN && lastOthersN >= 0) newBelow += othersN - lastOthersN;
    lastOthersN = othersN;
    renderDown();
    markRead();
  }
  // Le bouton « ↓ » : revenir au bas du fil, avec le nombre de nouveaux messages arrivés plus bas
  let newBelow = 0, lastOthersN = -1;
  function renderDown() {
    const sc = $('#kiff-scroll'), dn = $('#chat-down');
    const far = sc.scrollHeight - sc.scrollTop - sc.clientHeight > 240;
    if (!far && newBelow) { newBelow = 0; markRead(); }
    dn.hidden = !(far || newBelow);
    $('#chat-down-n').textContent = newBelow ? T(newBelow > 1 ? 'chat.nouveaux' : 'chat.nouveau', { nombre: newBelow }) : '';
    dn.classList.toggle('has-n', !!newBelow);
    dn.setAttribute('aria-label', newBelow ? T(newBelow > 1 ? 'chat.nouveaux' : 'chat.nouveau', { nombre: newBelow }) : T('chat.bas'));
  }
  $('#kiff-scroll').addEventListener('scroll', () => { if (!ovPartie.hidden) renderDown(); }, { passive: true });
  $('#chat-down').addEventListener('click', () => { audio(); const sc = $('#kiff-scroll'); sc.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' }); newBelow = 0; renderDown(); });
  // Lu : je préviens l’autre jusqu’où j’ai lu (une fois, quand ça avance)
  function markRead() {
    if (!partieOn() || document.visibilityState !== 'visible' || newBelow) return;
    const b = chatBox();
    const last = b.m.filter((m) => m.s !== duo.seat).reduce((x, m) => Math.max(x, m.d), 0);
    if (last > (b.lu[THREAD] || 0)) {
      b.lu[THREAD] = last;
      chatSave(b);
      sendChat({ ty: 'v', k: THREAD, d: last });
      renderChatBadges();
    }
  }
  // Les pastilles des messages non lus : sur le compteur de kiff kiff du jeu
  function renderChatBadges() {
    const n = duo ? unread('') : 0;
    [['#kiffs-chat', '#kiffs-open']].forEach(([sel, hostSel]) => {
      const host = $(hostSel); if (!host) return;
      let b = $(sel);
      if (!b) { b = document.createElement('span'); b.className = 'badge badge--chat'; b.id = sel.slice(1); b.setAttribute('aria-hidden', 'true'); host.appendChild(b); }
      b.hidden = !n; b.textContent = n || '';
    });
  }
  function renderReplyBar() {
    const bar = $('#chat-reply');
    if (!replyTo && !editing2) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.classList.toggle('is-cite', replyTo === '_');
    if (editing2) { $('#chat-reply-who').textContent = T('chat.modification'); $('#chat-reply-what').textContent = editing2.t; return; }
    const B = nameOf(other(duo.seat));
    if (replyTo === '_') { const k = kiffById(citeKid); $('#chat-reply-who').textContent = T('chat.citer'); $('#chat-reply-what').textContent = k ? cutSentence(k.t, 90) : ''; return; }
    const m = chatBox().m.find((x) => x.id === replyTo);
    $('#chat-reply-who').textContent = m && m.s === duo.seat ? T('chat.reponse-toi') : T('chat.reponse-a', { prénom: B });
    $('#chat-reply-what').textContent = m ? m.t : '';
  }
  $('#chat-reply-x').addEventListener('click', () => { audio(); if (editing2) chatInput.value = ''; replyTo = null; editing2 = null; citeKid = ''; renderReplyBar(); chatInput.focus(); });
  // Écrire
  const growInput = () => { chatInput.style.height = 'auto'; chatInput.style.height = Math.min(120, chatInput.scrollHeight) + 'px'; };
  chatInput.addEventListener('input', () => {
    growInput();
    if (!canChat()) return;
    const now = Date.now();
    if (now - myTypingAt > 2500 && chatInput.value.trim()) { myTypingAt = now; duo.conn.typing(THREAD); }
    clearTimeout(myTypingT);
    myTypingT = setTimeout(() => { if (myTypingAt && duo && duo.conn) { duo.conn.typing(''); myTypingAt = 0; } }, 4000);
  });
  chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#chat-form').requestSubmit(); } });
  $('#chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = chatInput.value.replace(/\s+$/, '').replace(/^\s+/, '');
    if (!t || !canChat()) return;
    audio(); sSwitchOn(); haptic(10);
    if (editing2) {
      sendChat({ ty: 'e', id: editing2.id, k: THREAD, t });
      report('discussion', null, 'modifie');
    } else {
      // Citer une envie : le message lui est rattaché ; sinon il va au fil de la partie
      sendChat({ ty: 'm', id: window.KiffDuo.newId(), k: replyTo === '_' && citeKid ? citeKid : THREAD, t, q: replyTo || '' });
      report('discussion', null, replyTo === '_' ? 'citation' : replyTo ? 'reponse' : 'envoye');
    }
    chatInput.value = ''; growInput();
    replyTo = null; editing2 = null; citeKid = ''; renderReplyBar();
    if (myTypingAt) { duo.conn.typing(''); myTypingAt = 0; }
    renderChat(true);
  });
  // Les émojis du jeu
  $('#chat-emojis').innerHTML = EMOJIS.map((x) => '<button type="button" class="chat-emo" data-emo="' + x + '">' + x + '</button>').join('');
  $('#chat-emo-btn').addEventListener('click', () => {
    audio();
    const p = $('#chat-emojis'), on = p.hidden;
    p.hidden = !on;
    $('#chat-emo-btn').setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) report('discussion', null, 'emojis');
  });
  $('#chat-emojis').addEventListener('click', (e) => {
    const b = e.target.closest('[data-emo]'); if (!b) return;
    audio(); sClick();
    const s0 = chatInput.selectionStart ?? chatInput.value.length, s1 = chatInput.selectionEnd ?? s0;
    chatInput.value = chatInput.value.slice(0, s0) + b.dataset.emo + chatInput.value.slice(s1);
    const p = s0 + b.dataset.emo.length;
    chatInput.setSelectionRange(p, p);
    growInput();
  });
  // L’appui long sur un message : le menu
  const ovMenu = $('#ov-chat-menu');
  let menuFor = null;
  const QUICK_HTML = () => QUICK.map((x) => '<button type="button" class="chat-emo" data-react="' + x + '" aria-label="Réagir : ' + x + '">' + x + '</button>').join('') +
    '<button type="button" class="chat-emo chat-emo--plus" data-react="+" aria-label="Plus d’émojis"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>';
  $('#chat-quick').innerHTML = QUICK_HTML();
  function openMenu(mid) {
    if (!canChat()) return;
    const m = chatBox().m.find((x) => x.id === mid);
    if (!m || m.x) return;
    menuFor = m;
    haptic(12);
    const mine = m.s === duo.seat;
    $('#cm-edit').hidden = !mine; $('#cm-del').hidden = !mine; $('#cm-copy').hidden = false;
    const r = m.r || {};
    $('#chat-quick').querySelectorAll('[data-react]').forEach((b) => b.classList.toggle('is-on', r[duo.seat] === b.dataset.react));
    show(ovMenu);
    ($('#chat-quick [data-react]')).focus({ preventScroll: true });
  }
  const closeMenu = () => { hide(ovMenu); menuFor = null; };
  ovMenu.addEventListener('click', (e) => { if (e.target === ovMenu) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ovMenu.hidden) closeMenu(); });
  $('#chat-quick').addEventListener('click', (e) => {
    const b = e.target.closest('[data-react]'); if (!b || !menuFor) return;
    audio();
    if (b.dataset.react === '+') {
      // tous les émojis du jeu, dans la même rangée
      $('#chat-quick').innerHTML = EMOJIS.map((x) => '<button type="button" class="chat-emo" data-react="' + x + '" aria-label="Réagir : ' + x + '">' + x + '</button>').join('');
      $('#chat-quick').classList.add('is-all');
      return;
    }
    const r = menuFor.r || {};
    const emo = r[duo.seat] === b.dataset.react ? '' : b.dataset.react;
    sendChat({ ty: 'r', id: menuFor.id, k: menuFor.k || THREAD, emo });
    report('discussion', null, 'reaction');
    sSwitchOn(); haptic(10);
    resetQuick(); closeMenu(); renderChat();
  });
  function resetQuick() {
    const q = $('#chat-quick');
    if (!q.classList.contains('is-all')) return;
    q.classList.remove('is-all');
    q.innerHTML = QUICK_HTML();
  }
  $('#cm-reply').addEventListener('click', () => { audio(); if (!menuFor) return; replyTo = menuFor.id; editing2 = null; citeKid = ''; resetQuick(); closeMenu(); renderReplyBar(); chatInput.focus(); });
  $('#cm-copy').addEventListener('click', async () => {
    audio(); if (!menuFor) return;
    try { await navigator.clipboard.writeText(menuFor.t); } catch (e) { /* rien */ }
    resetQuick(); closeMenu();
    flashPresence(T('chat.copie'));
  });
  $('#cm-edit').addEventListener('click', () => {
    audio(); if (!menuFor) return;
    editing2 = menuFor; replyTo = null; citeKid = '';
    chatInput.value = menuFor.t; growInput();
    resetQuick(); closeMenu(); renderReplyBar(); chatInput.focus();
  });
  $('#cm-del').addEventListener('click', () => {
    audio(); if (!menuFor) return;
    sendChat({ ty: 'x', id: menuFor.id, k: THREAD });
    report('discussion', null, 'supprime');
    haptic(15);
    resetQuick(); closeMenu(); renderChat();
  });
  let pressT = 0;
  const pressStart = (e) => {
    const el2 = e.target.closest('[data-mid]');
    if (!el2) return;
    clearTimeout(pressT);
    pressT = setTimeout(() => openMenu(el2.dataset.mid), 450);
  };
  const pressEnd = () => clearTimeout(pressT);
  const cl = $('#chat-list');
  // Glisser un message vers la droite (comme dans les messageries) : y répondre
  let swipe = null;
  cl.addEventListener('pointerdown', (e) => {
    const li = e.target.closest('[data-mid]');
    swipe = li && canChat() ? { li, x: e.clientX, y: e.clientY, dx: 0, on: false } : null;
  });
  cl.addEventListener('pointermove', (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    if (!swipe.on) {
      if (Math.abs(dy) > 12) { swipe = null; return; }
      if (dx > 12) { swipe.on = true; pressEnd(); swipe.li.classList.add('is-swiping'); }
      else return;
    }
    swipe.dx = Math.max(0, Math.min(80, dx));
    swipe.li.style.transform = 'translateX(' + swipe.dx + 'px)';
    swipe.li.classList.toggle('is-ready', swipe.dx > 56);
  });
  const swipeEnd = () => {
    if (!swipe) return;
    const sw = swipe; swipe = null;
    if (!sw.on) return;
    sw.li.style.transform = ''; sw.li.classList.remove('is-swiping', 'is-ready');
    if (sw.dx > 56) {
      replyTo = sw.li.dataset.mid; editing2 = null; citeKid = '';
      haptic(10); renderReplyBar(); chatInput.focus({ preventScroll: true });
      report('discussion', null, 'glisser');
    }
  };
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => cl.addEventListener(ev, swipeEnd));
  cl.addEventListener('pointerdown', pressStart);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => cl.addEventListener(ev, pressEnd));
  cl.addEventListener('contextmenu', (e) => { const x = e.target.closest('[data-mid]'); if (x) { e.preventDefault(); pressEnd(); openMenu(x.dataset.mid); } });
  cl.addEventListener('keydown', (e) => { const x = e.target.closest('[data-mid]'); if (x && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openMenu(x.dataset.mid); } });
  // Toucher une carte du fil l’ouvre en plein écran ; toucher une citation retrouve sa carte
  cl.addEventListener('click', (e) => {
    const c = e.target.closest('[data-envie]');
    if (c) { audio(); sClick(); haptic(8); openEnvie(c.dataset.envie); return; }
    // L’envie en cours, quand c’est à moi : la lire (ou la relire)
    if (e.target.closest('[data-envie-go]')) { $('#wait-go').click(); return; }
    // L’invitation : envoyer le lien, le copier, annuler la partie
    const iv = e.target.closest('[data-inv]');
    if (iv && duo && duo.info) {
      audio(); sClick(); haptic(8);
      if (iv.dataset.inv === 'send') {
        navigator.share({ title: 'Kiff Kiff', text: inviteText(), url: window.KiffDuo.link(duo.info) }).then(() => { report('partage', null, 'invitation'); afterInvite(); }).catch(() => {});
      } else if (iv.dataset.inv === 'copy') {
        navigator.clipboard.writeText(inviteText() + ' ' + window.KiffDuo.link(duo.info))
          .then(() => { report('partage', null, 'invitation-copie'); afterInvite(); flashPresence(T('duo.copiee')); })
          .catch(() => flashPresence(T('duo.copie-impossible')));
      } else if (iv.dataset.inv === 'cancel') leaveDuo(true);
      return;
    }
    const g = e.target.closest('[data-goto]');
    if (g) { audio(); scrollToKiff(g.dataset.goto); }
  });
  $('#kiff-scroll').addEventListener('scroll', pressEnd, { passive: true });

  /* Une envie en plein écran : la carte, réagir, et ses actions (citer, partager, vécue, supprimer) */
  let dropArmed = false, dropT = 0;
  function openEnvie(kid) {
    const k = kiffById(kid);
    if (!k) return;
    kiffOpen = kid; dropArmed = false;
    $('#kiff-msg').hidden = true;
    const all = S.kiffs || [];
    $('#kiff-title').textContent = T('envie.titre', { rang: all.indexOf(k) + 1, nombre: all.length });
    $('#kiff-sentence').textContent = k.t || '';
    renderKiffCard();
    show(ovKiff);
    report('discussion', null, 'carte');
    $('#kiff-back').focus({ preventScroll: true });
  }
  function closeEnvie() {
    kiffOpen = '';
    hide(ovKiff);
    if (!ovKiffs.hidden) renderKiffList();
    renderChat();
  }
  function renderKiffCard() {
    const k = kiffById(kiffOpen);
    if (!k) return;
    const mine = duo ? k.s === duo.seat : false;
    const who = duo && mine ? T('kiff.ton-envie') : TH('kiffs.envie-de', { prénom: k.w || '…' });
    $('#kiff-meta').innerHTML = who + (k.d ? ' · ' + esc(dayOf(k.d)) : '') + ' · ' + esc(k.v === 0 ? T('kiff.a-vivre') : T('kiff.vecue'));
    $('#kiff-done').hidden = k.v !== 0;
    $('#kiff-drop').classList.toggle('is-armed', dropArmed);
    $('#kiff-cite').hidden = !canChat();
    const b = chatBox();
    const kr = b.kr[kiffOpen] || {};
    $('#kiff-reacts').innerHTML = reactsHtml(kr);
    // Réagir à l’envie : les émojis rapides, sous la carte (à deux téléphones)
    const qb = $('#chat-quickbar');
    qb.hidden = !canChat();
    if (!qb.firstChild) qb.innerHTML = QUICK.map((x) => '<button type="button" class="chat-emo" data-react="' + x + '" aria-label="Réagir : ' + x + '">' + x + '</button>').join('');
    const myReact = duo ? kr[duo.seat] : '';
    qb.querySelectorAll('[data-react]').forEach((x) => { const on = x.dataset.react === myReact; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); });
    // Les messages sur cette envie : on les retrouve dans la conversation
    const n = canChat() ? b.m.filter((m) => m.k === kiffOpen && !m.x).length : 0;
    const ml = $('#kiff-msgs');
    ml.hidden = !n;
    if (n) ml.textContent = T(n > 1 ? 'envie.messages' : 'envie.messages-1', { nombre: n });
  }
  $('#chat-quickbar').addEventListener('click', (e) => {
    const x = e.target.closest('[data-react]'); if (!x || !canChat()) return;
    audio();
    const r = chatBox().kr[kiffOpen] || {};
    const emo = r[duo.seat] === x.dataset.react ? '' : x.dataset.react;
    sendChat({ ty: 'r', id: '_', k: kiffOpen, emo });
    report('discussion', null, 'reaction-kiff');
    sSwitchOn(); haptic(10);
    renderKiffCard();
  });
  function flashKiffMsg(t) {
    const m = $('#kiff-msg');
    m.textContent = t; m.hidden = false;
    clearTimeout(m._t); m._t = setTimeout(() => { m.hidden = true; }, 3000);
  }
  // Citer, ou retrouver ses messages : la conversation, à cette envie
  const toPartie = (kid, cite) => {
    hide(ovKiff); kiffOpen = '';
    hide(ovKiffs);
    openPartie({ kid, cite: cite ? kid : '', front: partieFront || !el.ovParty.hidden });
  };
  $('#kiff-cite').addEventListener('click', () => { const kid = kiffOpen; if (!kid) return; audio(); sClick(); report('discussion', null, 'citer'); toPartie(kid, true); });
  $('#kiff-msgs').addEventListener('click', () => { const kid = kiffOpen; if (!kid) return; audio(); toPartie(kid, false); });
  $('#kiff-done').addEventListener('click', () => {
    const k = kiffById(kiffOpen); if (!k) return;
    audio(); sSwitchOn(); haptic(15);
    k.v = 1;
    renderKiffs(); savePair();
    if (duo && duo.stage === 'game') sync();
    renderKiffCard();
    flashKiffMsg(T('kiff.vecue-ok'));
  });
  $('#kiff-drop').addEventListener('click', () => {
    const k = kiffById(kiffOpen); if (!k) return;
    audio();
    if (!dropArmed) {
      dropArmed = true; sClick(); haptic(8);
      renderKiffCard();
      flashKiffMsg(T('kiff.passer-confirmer'));
      clearTimeout(dropT); dropT = setTimeout(() => { dropArmed = false; if (kiffOpen) renderKiffCard(); }, 3000);
      return;
    }
    dropArmed = false;
    const i = S.kiffs.indexOf(k);
    if (i >= 0) S.kiffs.splice(i, 1);
    sClick(); haptic(8);
    renderKiffs(); savePair();
    if (duo && duo.stage === 'game') sync();
    closeEnvie();
  });
  $('#kiff-image').addEventListener('click', async () => {
    audio(); sClick(); haptic(8);
    const k = kiffById(kiffOpen); if (!k) return;
    const r = await shareImage(k.t || '', 'kiff');
    if (r === 'saved') flashKiffMsg(T('fete.image-ok'));
  });
  $('#kiff-back').addEventListener('click', () => { audio(); closeEnvie(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ovKiff.hidden && ovMenu.hidden) closeEnvie(); });
  // Le catalogue : toucher une envie l’ouvre ; ses petits boutons citent, partagent, ou la marquent vécue
  $('#kiffs-list').addEventListener('click', async (e) => {
    const a = e.target.closest('[data-act]');
    if (a) {
      const kid = a.dataset.kid, k = kiffById(kid); if (!k) return;
      audio(); sClick(); haptic(8);
      if (a.dataset.act === 'citer') { report('discussion', null, 'citer'); toPartie(kid, true); }
      else if (a.dataset.act === 'partager') { await shareImage(k.t || '', 'kiff'); }
      else if (a.dataset.act === 'vecue') { k.v = 1; sSwitchOn(); renderKiffs(); savePair(); if (duo && duo.stage === 'game') sync(); renderKiffList(); }
      return;
    }
    const o = e.target.closest('[data-open]');
    if (!o) return;
    audio(); sClick(); haptic(8);
    openEnvie(o.dataset.open);
  });
  // Un avertissement de message touché : la partie, à la bonne envie
  let pendingKiff = '';
  function openPendingKiff() {
    if (pendingPartie && duo && duo.stage === 'game') { pendingPartie = false; if (!pendingKiff) { openPartie(); return; } }
    if (!pendingKiff || !duo || duo.stage !== 'game') return;
    const k = pendingKiff; pendingKiff = '';
    hide(el.ovStart);
    openPartie({ kid: kiffById(k) ? k : '' });
  }

  function noteKiff() {
    S.kiff = { n: (S.kiff ? S.kiff.n : 0) + 1, text: sentence(), by: duo.seat };
    markKiffSeen();
  }
  const kiffSeen = (room) => (load('kiffSeen', {}) || {})[room] || 0;
  function markKiffSeen() {
    if (!duo || !duo.info || !S.kiff) return;
    const m = load('kiffSeen', {}) || {};
    if ((m[duo.info.room] || 0) >= S.kiff.n) return;
    m[duo.info.room] = S.kiff.n;
    save('kiffSeen', m);
  }
  let lateKiff = false;
  /* La célébration : vivre l’envie maintenant, ou la garder pour plus tard (en premier à distance).
     Ses modes : 'fete' (le choix), 'vivre' (« À vous. », le téléphone posé), 'suite' (l’autre a déjà choisi). */
  function partyMode(mode, info) {
    const ov = el.ovParty, next = $('#party-next'), later = $('#party-later');
    ov.dataset.mode = mode;
    const B = nameOf(other(S.proposer));
    later.hidden = mode !== 'fete';
    next.classList.toggle('btn--line', mode === 'vivre');
    $('#party-pass').hidden = mode === 'suite';
    $('#party-done').hidden = true;
    $('#party-image').hidden = mode === 'vivre';
    if (mode === 'fete') {
      // À distance, on est rarement ensemble : garder l’envie passe en premier
      const far = !!duo;
      next.dataset.act = far ? 'later' : 'now';
      later.dataset.act = far ? 'now' : 'later';
      next.textContent = far ? T('fete.garder') : T('fete.vivre');
      later.textContent = far ? T('fete.vivre') : T('fete.garder');
      $('.party-text').textContent = T('fete.texte');
    } else if (mode === 'vivre') {
      next.dataset.act = 'done';
      next.textContent = T('fete.fait', { prénom: B });
      setInk(T('fete.a-vous'));
      $('.party-text').textContent = T('fete.posez');
      $('#party-count').hidden = true; $('#party-unlock').hidden = true;
      document.querySelector('#ov-party .party-foot').hidden = true;
      stopConfetti();
    } else {
      next.dataset.act = 'next';
      next.textContent = T('fete.suite');
      if (info) $('.party-text').textContent = info;
    }
  }
  function partyNormal() {
    lateKiff = false;
    partyMode('fete');
  }
  // La célébration manquée : d’abord le kiff kiff, ensuite la suite de la partie
  // Ce kiff kiff vient de débloquer un piment : on le dit sur la célébration
  function partyUnlock() {
    const box = $('#party-unlock');
    const k = S.kiffs || [];
    const now = unlocked(), before = unlockedIn(k.slice(0, -1));
    const up = !!duo && S.prog && k.length > 0 && now > before;
    box.hidden = !up;
    if (!up) return;
    $('#party-unlock-chili').innerHTML = '<span class="pgroup pgroup--' + now + ' is-on">' + CHILI.repeat(now) + '</span>';
    $('#party-unlock-text').textContent = T('fete.debloque', { niveau: D.niveaux[now - 1].nom });
    box.querySelector('.pill').setAttribute('aria-label', D.niveaux[now - 1].nom + ' débloqué : le piment peut monter, si vous en avez envie tous les deux.');
  }
  function celebrateLate() {
    lateKiff = true;
    cheer();
    const by = S.kiff.by === 0 || S.kiff.by === 1 ? S.kiff.by : other(duo.seat);
    $('#party-sentence').textContent = S.kiff.text;
    const kept = S.kiff.c === 'later';
    partyMode('suite', kept ? (S.kiff.cb === duo.seat ? T('fete.gardee') : T('fete.gardee-par', { prénom: nameOf(S.kiff.cb) })) :
      by === duo.seat ? T('fete.texte') : T('fete.absence', { prénom: nameOf(by) }));
    partyCount();
    partyUnlock();
    show(el.ovParty);
    pulse();
    sParty(); haptic(40);
    confetti();
    markKiffSeen();
  }
  /* Le titre de la célébration change à chaque kiff kiff (les exclamations de Marc), jamais deux fois de suite le même */
  function cheer() {
    const last = load('cheer', '');
    const all = TL('fete.cris');
    const pool = all.length > 1 ? all.filter((c) => c !== last) : all.concat(['Kiff Kiff !']);
    const c = pool[Math.floor(Math.random() * pool.length)];
    save('cheer', c);
    setInk(c);
  }
  function setInk(c) {
    const h = $('#party-title'), ink = h.querySelector('.ink');
    // l’émoji garde ses couleurs, même sur un titre en feuille d’or
    ink.innerHTML = esc(c).replace(/(\p{Extended_Pictographic}\uFE0F?)/gu, '<span class="emo">$1</span>');
    ink.setAttribute('data-ink', c);
    h.classList.toggle('is-long', c.length > 11 && c.length <= 16);
    h.classList.toggle('is-xlong', c.length > 16);
  }
  function celebrate() {
    partyNormal();
    cheer();
    S.phase = 'celebrate';
    document.body.dataset.phase = 'celebrate';
    $('#party-sentence').textContent = sentence();
    partyCount();
    partyUnlock();
    markKiffSeen();
    show(el.ovParty);
    pulse();
    sParty(); haptic(40);
    confetti();
    save('names', S.names);
  }
  /* « Tu kiffes ? » : partager le jeu, offrir un café, lire l’histoire du jeu */
  const APP_URL = 'https://kiff-kiff.fr/';
  const dealText = () => T('tukiffes.message');
  const ovDeal = $('#ov-deal');
  // Depuis la célébration, ou depuis le lien discret de l’accueil
  let dealFrom = null;
  // Trois portes, une feuille : « Fais tourner » (le partage), « Qui est là ? » (l’histoire, le café, un retour),
  // et « Vous kiffez ? » de la célébration (le partage et le café)
  const openDeal = (e) => {
    audio(); sClick(); haptic(8);
    dealFrom = e.currentTarget;
    const mode = dealFrom.id === 'home-deal' ? 'tourner' : dealFrom.id === 'home-who' ? 'qui' : 'fete';
    if (mode !== 'qui') report('partage', null, mode === 'tourner' ? 'fenetre-accueil' : 'fenetre-fete');
    $('#deal-title').textContent = T(mode === 'tourner' ? 'tourner.titre' : mode === 'qui' ? 'quiestla.titre' : 'tukiffes.titre');
    const mail = T('retour.adresse').trim();
    ovDeal.querySelectorAll('[data-in]').forEach((el) => { el.hidden = !el.dataset.in.split(' ').includes(mode) || (el.id === 'deal-mail' && !mail.includes('@')); });
    if (mail.includes('@')) $('#mail-go').href = 'mailto:' + mail + '?subject=' + encodeURIComponent(T('retour.sujet'));
    $('#deal-story').open = false;
    $('#deal-done').hidden = true;
    show(ovDeal);
    ovDeal.querySelector('.sheet').scrollTop = 0;
    (mode === 'qui' ? $('#deal-close') : $('#deal-share')).focus({ preventScroll: true });
    // Le QR code du jeu : on le montre, l’autre le scanne, rien à recopier
    const qr = $('#deal-qr');
    if (!qr.firstChild) loadScript('vendor/qrcode.js?v=1.4.4').then(() => { if (window.KiffDuo && window.KiffDuo.qrSvg) qr.innerHTML = window.KiffDuo.qrSvg(APP_URL); }).catch(() => {});
  };
  $('#party-deal').addEventListener('click', openDeal);
  $('#home-deal').addEventListener('click', openDeal);
  $('#home-who').addEventListener('click', openDeal);
  const closeDeal = () => { hide(ovDeal); if (dealFrom) dealFrom.focus({ preventScroll: true }); };
  $('#deal-close').addEventListener('click', () => { audio(); closeDeal(); });
  ovDeal.addEventListener('click', (e) => { if (e.target === ovDeal) closeDeal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ovDeal.hidden) closeDeal(); });
  $('#deal-share').addEventListener('click', async () => {
    audio();
    const done = $('#deal-done');
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Kiff Kiff', text: dealText(), url: APP_URL });
        report('partage', null, 'envoye');
        sSwitchOn(); haptic(15);
        done.textContent = T('tukiffes.envoye');
        done.hidden = false;
      } catch (e) { /* partage annulé */ }
      return;
    }
    // Sans partage natif : on copie le message avec le lien
    try {
      await navigator.clipboard.writeText(dealText() + ' ' + APP_URL);
      report('partage', null, 'copie');
      done.textContent = T('tukiffes.copie');
    } catch (e) {
      done.textContent = dealText() + ' ' + APP_URL;
    }
    done.hidden = false;
    sClick(); haptic(8);
  });
  if (window.KIFF_DON) $('#coffee-go').href = window.KIFF_DON;
  $('#coffee-go').addEventListener('click', () => { report('cafe'); sParty(); haptic(20); });
  $('#party-pass').addEventListener('click', () => {
    const k = lastKiff();
    if (k && k.v === 0) { S.kiffs.pop(); renderKiffs(); savePair(); }
    hide(el.ovParty);
    stopConfetti();
    el.pass.click();
  });
  // Le tour suivant, après une envie vécue ou gardée
  function partyContinue() {
    hide(el.ovParty);
    stopConfetti();
    startComposition(other(S.proposer));
    if (duo) { sync(); renderWait(); }
    if (!duo && kiffCount() === 1) setTimeout(() => inviteInstall('kiff'), 900);
    if (!duo || myTurn()) setTimeout(() => { if (S.phase === 'compose' && myTurn()) shuffle(false, false, true); }, 500);
  }
  const lastKiff = () => (S.kiffs || [])[(S.kiffs || []).length - 1];
  function partyAct(act) {
    audio();
    if (act === 'next') { hide(el.ovParty); stopConfetti(); partyNormal(); render(); showTurnModal(); renderWait(); return; }
    if (act === 'now') {
      sClick(); haptic(12);
      partyMode('vivre');
      if (duo && S.kiff) { S.kiff.c = 'now'; S.kiff.cb = duo.seat; sync(); }
      $('#party-next').focus({ preventScroll: true });
      return;
    }
    const k = lastKiff();
    if (act === 'done') { if (k) k.v = 1; if (duo && S.kiff) S.kiff.c = 'done'; renderKiffs(); savePair(); partyContinue(); return; }
    if (act === 'later') {
      if (duo && S.kiff) { S.kiff.c = 'later'; S.kiff.cb = duo.seat; }
      sSwitchOn(); haptic(15);
      const done = $('#party-done');
      done.textContent = T('fete.gardee');
      done.hidden = false;
      $('#party-next').disabled = true; $('#party-later').disabled = true;
      setTimeout(() => { $('#party-next').disabled = false; $('#party-later').disabled = false; renderKiffs(); partyContinue(); }, 900);
    }
  }
  $('#party-next').addEventListener('click', (e) => partyAct(e.currentTarget.dataset.act));
  $('#party-later').addEventListener('click', (e) => partyAct(e.currentTarget.dataset.act));

  /* La phrase en image, sans prénom, prête à poster */
  function wrapLines(ctx, text, maxW) {
    const words = text.split(' '), lines = [];
    let line = '';
    words.forEach((w) => {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    return lines;
  }
  /* L’image partagée d’une envie : même mise en page pour toutes les ambiances (emblème, KIFF KIFF,
     la carte de l’envie, un QR code vers le jeu), aux couleurs et aux polices de l’ambiance où l’on joue. */
  // La formule sous la carte : une sur dix, une autre à chaque envoi (textes de l’atelier, une par ligne)
  let formule = '';
  const tagline = () => formule || nextFormule();
  function nextFormule() {
    const l = TL('image.formules').filter((x) => x.trim());
    if (!l.length) return (formule = 'kiff-kiff.fr');
    const i = ((load('formule', -1) | 0) + 1) % l.length;
    save('formule', i);
    return (formule = l[i]);
  }
  const Tx = T; // dans le dessin de l’image, « T » désigne le thème
  const roundRect = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  const IMG = {
    redcorner: {
      fonts: ['64px "Great Vibes"', '60px "Baskervville"', '60px "Cinzel"', '30px "Jost"'],
      bg(c, W, H) {
        const g = c.createLinearGradient(0, 0, W * 0.4, H);
        g.addColorStop(0, '#7A0F24'); g.addColorStop(0.6, '#3A0510'); g.addColorStop(1, '#23030A');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        c.strokeStyle = '#C9A04E'; c.lineWidth = 4; c.strokeRect(36, 36, W - 72, H - 72);
        c.lineWidth = 1.5; c.strokeRect(52, 52, W - 104, H - 104);
      },
      emblem: { line: '#FFE3EC', lens: 'rgba(255, 61, 127, .6)', glow: '#FF3D7F' },
      title: { font: '600 66px "Cinzel", Georgia, serif', color: '#F6DDA0' },
      card: { bg: '#FBF3E6', inner: '#C9A04E' },
      lead: { font: '78px "Great Vibes", cursive', color: '#9C1A33' },
      body: { font: '{s}px "Baskervville", Georgia, serif', color: '#2A0710', size: 58 },
      rule: 'rgba(201, 160, 78, .6)', qr: ['#FBF3E6', '#2A0710'],
      t1: ['600 {s}px "Jost", sans-serif', '#F6DDA0'], t2: ['{s}px "Great Vibes", cursive', '#F7C7CF', 44], t3: ['{s}px "Jost", sans-serif', '#F6DDA0']
    },
    minuit: {
      fonts: ['800 60px "Syne"', '700 40px "Syne"', '700 40px "Manrope"', '500 30px "Manrope"'],
      bg(c, W, H) {
        c.fillStyle = '#0E0C16'; c.fillRect(0, 0, W, H);
        const g = c.createRadialGradient(W / 2, 180, 10, W / 2, 180, 760);
        g.addColorStop(0, 'rgba(126, 106, 214, .45)'); g.addColorStop(1, 'rgba(14, 12, 22, 0)');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        c.strokeStyle = '#2E2940'; c.lineWidth = 2; roundRect(c, 40, 40, W - 80, H - 80, 44); c.stroke();
      },
      emblem: { line: '#D9CEFF', lens: 'rgba(185, 166, 255, .85)', glow: '#B9A6FF' },
      title: { font: '800 74px "Syne", sans-serif', color: '#F2EFFA' },
      card: { bg: '#F2EFFA', radius: 40 },
      lead: { font: '700 54px "Syne", sans-serif', color: '#7E6AD6' },
      body: { font: '700 {s}px "Manrope", sans-serif', color: '#17141F', size: 54 },
      rule: '#2E2940', qr: ['#F2EFFA', '#0E0C16'],
      t1: ['800 {s}px "Manrope", sans-serif', '#F2EFFA'], t2: ['700 {s}px "Syne", sans-serif', '#B9A6FF', 36], t3: ['500 {s}px "Manrope", sans-serif', '#A49DB8']
    },
    classex: {
      fonts: ['80px "Anton"', '700 40px "Courier Prime"', '40px "Courier Prime"'],
      bg(c, W, H) {
        const g = c.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#D6BE8F'); g.addColorStop(1, '#B8995F');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        c.strokeStyle = 'rgba(80, 55, 20, .08)'; c.lineWidth = 2;
        for (let y = 20; y < H; y += 9) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y + ((y * 7) % 13) - 6); c.stroke(); }
        // le tampon, en haut à droite
        c.save(); c.translate(W - 190, 112); c.rotate(-0.16);
        c.strokeStyle = '#C8102E'; c.fillStyle = '#C8102E'; c.lineWidth = 6; c.globalAlpha = .85;
        c.strokeRect(-128, -40, 256, 80); c.font = '54px "Anton", sans-serif'; c.textAlign = 'center'; c.fillText('CLASSÉ X', 0, 24);
        c.restore();
      },
      emblem: { line: '#141414', lens: 'rgba(200, 16, 46, .9)', glow: null },
      title: { font: '96px "Anton", Impact, sans-serif', color: '#141414' },
      card: { bg: '#F6F5F0', tilt: -0.02, shadow: 'rgba(60, 40, 10, .35)', stamp: 'DÉCLASSIFIÉ' },
      lead: { font: '700 50px "Courier Prime", monospace', color: '#C8102E' },
      body: { font: '{s}px "Courier Prime", monospace', color: '#141414', size: 50 },
      rule: '#141414', qr: ['#F6F5F0', '#141414'],
      t1: ['{s}px "Anton", sans-serif', '#141414'], t2: ['italic 700 {s}px "Courier Prime", monospace', '#3D3B36', 34], t3: ['{s}px "Courier Prime", monospace', '#141414']
    },
    arty: {
      fonts: ['80px "Bagel Fat One"', '800 40px "Archivo"', '600 30px "Archivo"'],
      bg(c, W, H) {
        c.fillStyle = '#2E4FA3'; c.fillRect(0, 0, W, H);
        c.fillStyle = 'rgba(255, 72, 176, .55)';
        for (let y = 0; y < 420; y += 14) for (let x = W - 420 + (y % 28 ? 7 : 0); x < W; x += 14) {
          const r = Math.max(0, 4.2 - Math.hypot(W - x, y) / 110);
          if (r > .3) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
        }
      },
      emblem: { line: '#FFE45C', lens: 'rgba(255, 72, 176, .95)', glow: null },
      title: { font: '104px "Bagel Fat One", sans-serif', color: '#FFE45C', offset: '#FF48B0' },
      card: { bg: '#FFE45C', tilt: -0.015, block: '#FF48B0' },
      lead: { font: '64px "Bagel Fat One", sans-serif', color: '#FF48B0' },
      body: { font: '800 {s}px "Archivo", sans-serif', color: '#2E1670', size: 54 },
      rule: 'rgba(255, 228, 92, .6)', qr: ['#FFE45C', '#2E1670'],
      t1: ['{s}px "Bagel Fat One", sans-serif', '#FFE45C'], t2: ['700 {s}px "Archivo", sans-serif', '#FF9ACF', 36], t3: ['600 {s}px "Archivo", sans-serif', '#FFF08F']
    },
    pomme: {
      fonts: ['80px "Abril Fatface"', '700 40px "Merriweather"', 'italic 400 40px "Merriweather"', '400 30px "Merriweather"'],
      bg(c, W, H) {
        c.fillStyle = '#1D2A55'; c.fillRect(0, 0, W, H);
        c.fillStyle = 'rgba(230, 179, 58, .22)';
        for (let y = 12; y < H; y += 24) for (let x = 12; x < W; x += 24) { c.beginPath(); c.arc(x, y, 1.8, 0, Math.PI * 2); c.fill(); }
        // un cadre d’ampoules de fête foraine
        c.strokeStyle = '#E6B33A'; c.lineWidth = 5; roundRect(c, 40, 40, W - 80, H - 80, 30); c.stroke();
        c.fillStyle = '#FFE9A8';
        const bulb = (x, y) => { c.save(); c.shadowColor = '#FFD36B'; c.shadowBlur = 16; c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill(); c.restore(); };
        for (let x = 90; x <= W - 90; x += 60) { bulb(x, 40); bulb(x, H - 40); }
        for (let y = 100; y <= H - 100; y += 60) { bulb(40, y); bulb(W - 40, y); }
      },
      emblem: { line: '#FFF6DE', lens: 'rgba(215, 38, 47, .95)', glow: null },
      title: { font: '96px "Abril Fatface", Georgia, serif', color: '#D7262F', offset: '#FFF6DE' },
      card: { bg: '#FFF6DE', notch: '#1D2A55' },
      lead: { font: '64px "Abril Fatface", Georgia, serif', color: '#D7262F' },
      body: { font: '700 {s}px "Merriweather", Georgia, serif', color: '#1D2A55', size: 50 },
      rule: 'rgba(230, 179, 58, .7)', qr: ['#FFF6DE', '#1D2A55'],
      t1: ['{s}px "Abril Fatface", Georgia, serif', '#FFF6DE'], t2: ['italic 400 {s}px "Merriweather", Georgia, serif', '#E6B33A', 36], t3: ['400 {s}px "Merriweather", Georgia, serif', '#FFF6DE']
    }
  };
  async function phraseImage(text, skin) {
    const T = IMG[skin] || IMG[currentSkin()] || IMG.redcorner;
    try { await Promise.all(T.fonts.map((f) => document.fonts.load(f))); } catch (e) { /* polices de secours */ }
    const W = 1080, H = 1350, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    T.bg(c, W, H);
    c.textAlign = 'center';
    // l’emblème : deux cercles qui se rejoignent, leur intersection allumée
    c.save();
    if (T.emblem.glow) { c.shadowColor = T.emblem.glow; c.shadowBlur = 34; }
    c.beginPath(); c.arc(W / 2 - 34, 178, 76, -1.11, 1.11); c.arc(W / 2 + 34, 178, 76, Math.PI - 1.11, Math.PI + 1.11); c.closePath();
    c.fillStyle = T.emblem.lens; c.fill();
    c.strokeStyle = T.emblem.line; c.lineWidth = 7;
    [W / 2 - 34, W / 2 + 34].forEach((x) => { c.beginPath(); c.arc(x, 178, 76, 0, Math.PI * 2); c.stroke(); });
    c.restore();
    c.font = T.title.font;
    if (T.title.offset) { c.fillStyle = T.title.offset; c.fillText('KIFF KIFF', W / 2 + 6, 346); }
    c.fillStyle = T.title.color; c.fillText('KIFF KIFF', W / 2, 340);
    // la carte, entre le titre et le bandeau du bas
    const cx = 110, cw = W - 220;
    const body = text.replace(/^J’ai envie\s+/, '');
    let fs = T.body.size, lines;
    do { c.font = T.body.font.replace('{s}', fs); lines = wrapLines(c, body, cw - 120); fs -= 4; } while (lines.length * (fs + 22) + 200 > 600 && fs > 30);
    const lh = fs + 22, ch = 200 + lines.length * lh, cy = 390 + (600 - ch) / 2;
    const K = T.card;
    c.save();
    c.translate(W / 2, cy + ch / 2); c.rotate(K.tilt || 0); c.translate(-W / 2, -(cy + ch / 2));
    if (K.block) { c.fillStyle = K.block; c.fillRect(cx + 16, cy + 16, cw, ch); }
    if (K.shadow) { c.shadowColor = K.shadow; c.shadowBlur = 30; c.shadowOffsetY = 12; }
    c.fillStyle = K.bg;
    if (K.radius) { roundRect(c, cx, cy, cw, ch, K.radius); c.fill(); } else c.fillRect(cx, cy, cw, ch);
    c.shadowColor = 'transparent';
    if (K.inner) { c.strokeStyle = K.inner; c.lineWidth = 3; c.strokeRect(cx + 14, cy + 14, cw - 28, ch - 28); }
    if (K.notch) { c.fillStyle = K.notch; [cx, cx + cw].forEach((x) => { c.beginPath(); c.arc(x, cy + ch / 2, 26, 0, Math.PI * 2); c.fill(); }); }
    c.fillStyle = T.lead.color; c.font = T.lead.font;
    c.fillText(Tx('image.lead'), W / 2, cy + 110);
    c.fillStyle = T.body.color; c.font = T.body.font.replace('{s}', fs + 4);
    lines.forEach((l, i) => c.fillText(l, W / 2, cy + 190 + i * lh));
    if (K.stamp) {
      c.save(); c.translate(cx + cw - 150, cy + ch - 40); c.rotate(-0.12);
      c.strokeStyle = '#C8102E'; c.fillStyle = '#C8102E'; c.globalAlpha = .8; c.lineWidth = 5;
      c.font = '44px "Anton", sans-serif'; const sw = c.measureText(K.stamp).width + 40;
      c.strokeRect(-sw / 2, -34, sw, 64); c.fillText(K.stamp, 0, 16);
      c.restore();
    }
    c.restore();
    // en bas, une formule (plus de code ni de publicité) : elle change à chaque envoi
    c.strokeStyle = T.rule; c.lineWidth = 2;
    c.beginPath(); c.moveTo(W / 2 - 160, 1060); c.lineTo(W / 2 + 160, 1060); c.stroke();
    const f = nextFormule();
    c.textAlign = 'center';
    // La police de l’interface, bien lisible même en petit dans une messagerie
    let ts = 40, fl;
    do { ts -= 2; c.font = T.t3[0].replace('{s}', ts); fl = wrapLines(c, f, W - 260); } while (ts > 24 && fl.length > 2);
    c.fillStyle = T.t3[1];
    const lh2 = Math.round(ts * 1.25), y0 = 1170 - ((fl.length - 1) * lh2) / 2;
    fl.forEach((l, i) => c.fillText(l, W / 2, y0 + i * lh2));
    return new Promise((res) => cv.toBlob(res, 'image/png'));
  }
  // L’envie en image : partagée (WhatsApp, Messages…) ou enregistrée ; une autre formule à chaque fois
  async function shareImage(text, from) {
    const blob = await phraseImage(text);
    if (!blob) return '';
    const file = new File([blob], 'kiff-kiff.png', { type: 'image/png' });
    report('partage', null, 'image');
    report('carte', null, from || 'fete');
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      // Un seul lien : la formule dit déjà kiff-kiff.fr (sinon on ajoute l’adresse)
      const msg = /kiff-kiff\.fr/i.test(tagline()) ? tagline() : tagline() + ' ' + APP_URL;
      try { await navigator.share({ files: [file], title: 'Kiff Kiff', text: msg }); return 'shared'; } catch (e) { return ''; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'kiff-kiff.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return 'saved';
  }
  $('#party-image').addEventListener('click', async () => {
    audio(); sClick(); haptic(8);
    const btn = $('#party-image');
    const r = await shareImage($('#party-sentence').textContent, 'fete');
    if (r !== 'saved') return;
    const done = $('#party-done');
    done.textContent = T('fete.image-ok');
    done.hidden = false;
    btn.focus({ preventScroll: true });
  });

  /* Confettis */
  let confRaf = 0;
  function stopConfetti() { cancelAnimationFrame(confRaf); confRaf = 0; }
  function confetti() {
    const cv = $('#confetti');
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const css = getComputedStyle(document.documentElement);
    const cols = (css.getPropertyValue('--confetti') || '#ffffff').split(',').map((v) => v.trim()).filter(Boolean);
    const shapes = (css.getPropertyValue('--confetti-shapes') || 'rect, dot').split(',').map((v) => v.trim()).filter(Boolean);
    const N = reduce ? 40 : 170;
    const P = [];
    for (let i = 0; i < N; i++) {
      const fromLeft = i % 2 === 0;
      P.push({
        x: fromLeft ? -10 : W + 10,
        y: H * (0.55 + Math.random() * 0.35),
        vx: (fromLeft ? 1 : -1) * (3 + Math.random() * 6),
        vy: -(8 + Math.random() * 9),
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        s: 6 + Math.random() * 7,
        c: cols[i % cols.length],
        shape: shapes[i % shapes.length]
      });
    }
    const star = (s) => {
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? s * 0.45 : s;
        const a = (k * Math.PI) / 5 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
    };
    const sparkle = (s) => {
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s);
      ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s); ctx.fill();
    };
    const heart = (s) => {
      ctx.beginPath();
      ctx.moveTo(0, s * 0.35);
      ctx.bezierCurveTo(-s, -s * 0.3, -s * 0.35, -s, 0, -s * 0.4);
      ctx.bezierCurveTo(s * 0.35, -s, s, -s * 0.3, 0, s * 0.35);
      ctx.fill();
    };
    const t0 = performance.now();
    const frame = (now) => {
      const el2 = now - t0;
      ctx.clearRect(0, 0, W, H);
      P.forEach((q) => {
        q.vy += 0.28; q.vx *= 0.99; q.vy *= 0.99;
        q.x += q.vx; q.y += q.vy; q.r += q.vr;
        ctx.save();
        ctx.translate(q.x, q.y); ctx.rotate(q.r);
        ctx.fillStyle = q.c;
        if (q.shape === 'heart') heart(q.s * 1.1);
        else if (q.shape === 'dot') { ctx.beginPath(); ctx.arc(0, 0, q.s / 2.4, 0, 6.283); ctx.fill(); }
        else if (q.shape === 'petal') { ctx.beginPath(); ctx.ellipse(0, 0, q.s * 0.75, q.s * 0.42, 0, 0, 6.283); ctx.fill(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(q.s * 0.15, 0, q.s * 0.45, q.s * 0.18, 0, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; }
        else if (q.shape === 'star') { star(q.s * 0.8); }
        else if (q.shape === 'sparkle') { sparkle(q.s * 0.9); }
        else if (q.shape === 'ticket') { ctx.fillRect(-q.s * 0.8, -q.s * 0.45, q.s * 1.6, q.s * 0.9); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(-q.s * 0.8, 0, q.s * 0.22, 0, 6.283); ctx.arc(q.s * 0.8, 0, q.s * 0.22, 0, 6.283); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
        else ctx.fillRect(-q.s / 2, -q.s / 4, q.s, q.s / 2 * Math.abs(Math.cos(q.r * 2)) + 1);
        ctx.restore();
      });
      if (el2 < 4200) confRaf = requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
    };
    stopConfetti();
    confRaf = requestAnimationFrame(frame);
  }

  /* ---------- Piment ---------- */
  const CHILI = '<svg class="chili is-on" viewBox="0 0 24 24" aria-hidden="true"><use href="#chili"/></svg>';
  const levelGroups = () => [1, 2, 3].map((n) =>
    '<span class="pgroup pgroup--' + n + (S.levels.includes(n) ? ' is-on' : '') + '">' + CHILI.repeat(n) + '</span>').join('');
  const levelNames = (lv = S.levels) => lv.map((n) => D.niveaux[n - 1].nom).join(' + ');
  /* Piment progressif (parties à distance) : on commence en Tendre ; Pimenté se débloque après un tour
     de kiff kiff (une envie de chacun·e acceptée par l’autre), Brûlant après un tour en Pimenté.
     Débloquer rend la montée possible : il faut toujours que l’autre l’accepte. */
  function unlockedIn(kiffs) {
    if (!duo || !S.prog) return 3;
    const k = kiffs || [];
    const round = (min) => [0, 1].every((seat) => k.some((x) => x && x.s === seat && (x.lv || 1) >= min));
    return round(1) ? (round(2) ? 3 : 2) : 1;
  }
  const unlocked = () => unlockedIn(S.kiffs);
  function setLevels(levels, opts = {}) {
    levels = parseLevels(levels);
    if (!isComplet() && levels.includes(3)) { levels = levels.filter((n) => n < 3); if (!levels.length) levels = [1, 2]; }
    if (duo && S.prog) {
      const u = unlocked();
      levels = levels.filter((n) => n <= u);
      if (!levels.length) levels = [1];
    }
    const prev = LISTS.map((l, r) => l[S.idx[r]]);
    S.levels = levels;
    if (!duo && !opts.nosave) save('levels', levels);
    newDraw();
    buildLists(levels);
    reels.forEach((rl, r) => {
      let i = LISTS[r].indexOf(prev[r]);
      if (i < 0) i = Math.floor(Math.random() * (LISTS[r].length - 1));
      rl.stop();
      rl.p = i;
      rl.lastTick = i;
      S.idx[r] = i;
    });
    // Pendant une réponse, changer les listes fausserait la proposition : il faudra une nouvelle partie
    if (S.started && S.phase !== 'compose' && !duo) S.mustRestart = true;
    renderReels();
    renderLevel();
    renderPimentDuo();
    if (reels.length && !opts.silent) render();
    if (!opts.remote) sync();
  }
  // À deux téléphones : prévenir que l’autre devra accepter un piment plus chaud
  function renderPimentDuo() {
    const p = $('#piment-duo');
    if (!p) return;
    const up = hotter();
    p.hidden = !up;
    if (up) p.textContent = T('roues.monter-distance', { prénom: nameOf(other(duo.seat)) });
  }
  function renderLevel() {
    const b = $('#piment-open');
    if (b) {
      b.innerHTML = '<svg class="roues-chili" viewBox="0 0 24 24" aria-hidden="true"><use href="#chili"/></svg><svg class="ic roues-barjot" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-barjot"/></svg>';
      b.setAttribute('aria-label', 'Dans les roues : ' + dot(levelNames() + ', ' + (TON_TXT[S.ton] || TON_TXT.m)) + ' Changer');
    }
    const u = unlocked();
    document.querySelectorAll('.piment-list input[type="checkbox"]').forEach((c) => {
      c.checked = S.levels.includes(+c.value);
      const lock = +c.value > u;
      c.disabled = lock;
      const lab = c.closest('.piment-toggle');
      lab.classList.toggle('is-locked', lock);
      // Brûlant fait partie du jeu complet : la case reste touchable, elle ouvre « Tout Kiff Kiff »
      lab.classList.toggle('is-pack', !lock && +c.value === 3 && !isComplet());
      const d = lab.querySelector('.piment-tdesc');
      if (!d.dataset.desc) d.dataset.desc = d.textContent;
      d.textContent = lock ? T('roues.verrou-' + c.value) : d.dataset.desc;
    });
    document.documentElement.dataset.piment = S.levels.join('');
  }

  /* ---------- Le ton des roues : premier degré, un peu de tout, barjot ----------
     Dans la feuille « Dans les roues », à côté du piment : c’est le même genre de choix (ce que les roues tirent).
     Celui ou celle qui compose le change sans demander ; un exemple d’envie montre tout de suite l’effet. */
  const TONS = ['b', 'm', 'e'];
  // Le nom du ton, en minuscules dans les phrases (« Roues : Tendre, wtf !? »)
  const TON_TXT = { get b() { return T('roues.ton-b').toLowerCase(); }, get m() { return T('roues.ton-m').toLowerCase(); }, get e() { return T('roues.ton-e').toLowerCase(); } };
  // Sous les trois boutons : ce que le ton met dans les roues (rien à dire pour « un peu de tout »)
  const TON_DESC = { get b() { return T('roues.ton-b-desc'); }, get m() { return T('roues.ton-m-desc'); }, get e() { return T('roues.ton-e-desc'); } };
  const dot = (t) => (/[!?….]$/.test(t) ? t : t + '.');
  const tonBox = $('#ton');
  const tonOf = (st) => (TONS.includes(st && st.ton) ? st.ton : st && st.decale === false ? 'e' : 'm');
  function renderTon() {
    if (!TONS.includes(S.ton) || !isComplet()) S.ton = 'm';
    if (tonBox) tonBox.querySelectorAll('[data-ton]').forEach((b) => b.classList.toggle('is-pack', !isComplet() && b.dataset.ton !== 'm'));
    if (tonBox) tonBox.querySelectorAll('[data-ton]').forEach((b) => b.setAttribute('aria-checked', b.dataset.ton === S.ton ? 'true' : 'false'));
    if (typeof renderLevel === 'function' && reels.length) renderLevel();
  }
  // Sous le ton : sa description, puis comment les roues tirent leurs mots
  function renderRouesEx() {
    const box = $('#roues-ex');
    if (!box || !LISTS[0].length) return;
    const d = TON_DESC[S.ton] || '';
    box.innerHTML = (d ? '<span class="roues-desc">' + esc(d) + '</span>' : '') + '<span class="roues-n">' + TH(isComplet() ? 'roues.tirage' : 'roues.tirage-gratuit') + '</span>';
  }
  function setTon(t) {
    if (!isComplet() && t !== 'm') { openComplet('ton'); return; }
    if (!myTurn() || S.phase !== 'compose' || reels.some((rl) => rl.busy)) { sNope(); haptic(20); return; }
    if (t === S.ton) return;
    audio();
    S.ton = t;
    renderTon();
    newDraw();
    relist();
    renderReels();
    sClick(); haptic(8);
    renderRouesEx();
    savePair();
    if (duo) sync();
    render();
  }
  if (tonBox) {
    tonBox.addEventListener('click', (e) => { const b = e.target.closest('[data-ton]'); if (b) setTon(b.dataset.ton); });
    tonBox.addEventListener('keydown', (e) => {
      const k = TONS.indexOf(S.ton), order = ['e', 'm', 'b'], j = order.indexOf(S.ton);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); if (j < 2) { setTon(order[j + 1]); tonBox.querySelector('[data-ton="' + order[j + 1] + '"]').focus(); } }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); if (j > 0) { setTon(order[j - 1]); tonBox.querySelector('[data-ton="' + order[j - 1] + '"]').focus(); } }
      void k;
    });
  }
  // La petite loupe au coin de chaque roue : elle ouvre la roue en grand (comme toucher le mot du centre)
  document.querySelectorAll('.reel[data-reel] .reel-loupe').forEach((b) => {
    const r = +b.closest('.reel').dataset.reel;
    b.addEventListener('pointerdown', (e) => e.stopPropagation()); // ce n’est pas un coup de roue
    b.addEventListener('pointerup', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (reels[r].canMove()) openLoupe(r); else reels[r].nope();
    });
  });

  /* ---------- Ambiances ---------- */
  const SKINS = ['arty', 'pomme', 'redcorner', 'minuit', 'classex'];
  const SKIN_NAMES = { arty: 'Arty', pomme: 'Pomme d’Amour', redcorner: 'Red Corner', minuit: 'Minuit', classex: 'Classé X' };
  function currentSkin() {
    const s = document.documentElement.getAttribute('data-skin');
    return SKINS.includes(s) ? s : 'redcorner';
  }
  function applySkin(s) {
    if (!SKINS.includes(s)) s = 'redcorner';
    const cur = $('#skin-current');
    if (cur) cur.textContent = SKIN_NAMES[s];
    document.documentElement.setAttribute('data-skin', s);
    document.querySelectorAll('[data-skin-sheet]').forEach((n) => { n.disabled = n.getAttribute('data-skin-sheet') !== s; });
    save('skin', s);
    const theme = () => {
      const c = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim();
      const m = document.querySelector('meta[name="theme-color"]');
      if (c && m) m.setAttribute('content', c);
      if (reels.length) renderReels();
    };
    requestAnimationFrame(theme);
    // une feuille d’ambiance pas encore chargée : on relit ses couleurs quand elle arrive
    const sheet = document.querySelector('[data-skin-sheet="' + s + '"]');
    if (sheet) sheet.addEventListener('load', theme, { once: true });
  }

  /* ---------- Deux téléphones ---------- */
  // Empreinte des listes : les deux téléphones doivent avoir les mêmes roues
  function dataVersion() {
    const s = JSON.stringify([D.actions, D.objets, D.manieres]);
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  let DATA_V = dataVersion();
  // Une case voyage avec son contenu (et non sa place) : les mots de l’atelier peuvent changer
  // entre deux coups d’une partie jouée à distance, la partie garde les siens.
  const FIELDS = ['s', 'i', 't', 'p'];
  const sameItem = (a, b) => FIELDS.every((f) => (a[f] || '') === (b[f] || ''));
  function keyOf(r, i) {
    const x = LISTS[r][i];
    if (!x || x.free) return 'f';
    const o = {};
    FIELDS.concat('lvl', 'm', 'd').forEach((f) => { if (x[f] != null) o[f] = x[f]; });
    return o;
  }
  function idxOf(r, k) {
    if (k === 'f') return LISTS[r].length - 1;
    if (typeof k === 'number') { const i = LISTS[r].indexOf(SOURCE[r][k]); return i < 0 ? 0 : i; } // ancien format
    if (!k || typeof k !== 'object') return 0;
    let i = LISTS[r].findIndex((x) => !x.free && sameItem(x, k));
    if (i < 0 && k.m) {
      // Un mot écrit à la main par l’autre : il rejoint vos mots à vous deux
      const x = cleanMine([k])[0];
      if (!x) return 0;
      S.mine[r] = S.mine[r].concat(x).slice(-MINE_MAX);
      LISTS[r].splice(LISTS[r].length - 1, 0, x);
      return LISTS[r].length - 2;
    }
    if (i < 0) {
      // Mot retiré depuis (ou hors des piments choisis) : on le garde, le temps de cette partie
      const x = {};
      FIELDS.concat('lvl').forEach((f) => { if (k[f] != null) x[f] = String(k[f]); });
      if (x.lvl) x.lvl = +x.lvl;
      if (!SOURCE[r].some((y) => sameItem(y, x))) SOURCE[r].push(x);
      LISTS[r].splice(LISTS[r].length - 1, 0, x);
      i = LISTS[r].length - 2;
    }
    return i;
  }

  let duo = null; // { conn, info, seat, id, seq, lastBy, stage, partnerOn, online, passN, push, nk }

  /* Avertissements (« À toi de jouer », même l’appli fermée) : voir push.js.
     pushMine : mon adresse d’avertissement ; duo.push : celles des deux places, rangées dans la partie chiffrée */
  const KP = window.KiffPush || null;
  let pushMine = null;
  let pushStatus = 'none'; // 'off' | 'on' | 'blocked' | 'install' | 'none'
  let presenceFlash = '', flashT = 0; // un mot bref à la place de la présence, sur l’écran d’attente
  const notifKey = (st) => [st.phase, st.proposer, st.kiff ? st.kiff.n : 0, st.pass ? st.pass.n : 0].join('|');
  function pushPair() {
    const pair = duo && Array.isArray(duo.push) ? duo.push.slice(0, 2) : [null, null];
    if (duo) pair[duo.seat] = pushMine;
    return pair;
  }
  async function refreshPush() {
    if (!KP) return;
    pushStatus = await KP.status();
    pushMine = pushStatus === 'on' ? await KP.current() : null;
    if (pushStatus === 'on' && !pushMine) pushStatus = 'off';
    renderDuoStatus();
    pushRefresh();
  }
  // La partie n’a pas encore ma dernière adresse : on la lui donne (sans rien changer d’autre)
  function pushRefresh() {
    if (!duo || duo.stage !== 'game' || !KP) return;
    if (!KP.sameSub(duo.pushSeen || null, pushMine)) sync();
  }
  // Après mon coup : si c’est à l’autre et que l’appli n’est pas à son écran, son téléphone l’avertit
  function notifyOther(st) {
    if (!KP || !duo || !duo.info || duo.stage !== 'game') return;
    const k = notifKey(st);
    if (k === duo.nk) return;
    duo.nk = k;
    const o = other(duo.seat);
    const sub = Array.isArray(duo.push) ? duo.push[o] : null;
    // On avertit toujours : la présence de l’autre peut être en retard (appli en arrière-plan) ;
    // c’est son téléphone qui se tait s’il a déjà Kiff Kiff sous les yeux
    if (!sub) return;
    let kind = '';
    if (duo.lastPhase === 'lobby' && st.phase !== 'lobby') kind = 'arrivee'; // l’invitation est acceptée
    else if (st.phase === 'celebrate') kind = 'kiff';
    else if (turnFor(st, o) === 'me') kind = 'tour';
    if (!kind) return;
    const k2 = Array.isArray(st.kiffs) ? st.kiffs : [];
    const up = kind === 'kiff' && st.prog && unlockedIn(k2) > unlockedIn(k2.slice(0, -1)) ? 1 : 0;
    // Mon prénom voyage chiffré pour le téléphone de l’autre seul : le serveur ne le lit pas.
    // Son téléphone ne l’affiche que là où l’écran verrouillé cache le contenu des avertissements (iPhone)
    const n = String(nameOf(duo.seat) || '').trim().slice(0, 30);
    KP.send(sub, { k: kind, r: duo.info.room, ph: st.phase, u: up, n });
    // Si le tour ou le kiff kiff attend encore dans deux jours, un seul rappel (il remplace l’avertissement de la partie)
    if ((kind === 'tour' || kind === 'kiff') && KP.remind && st.seq) KP.remind(sub, { k: 'rappel', r: duo.info.room, ph: st.phase, n }, duo.info.room, st.seq);
  }

  /* Mes parties à deux : chaque téléphone se souvient des siennes, pour jouer chacun·e à son rythme.
     { room, key, broker, seat, id, names: [a, b], turn: 'me' | 'other' | 'party' | 'lobby', t } */
  function games() {
    const g = load('parties', null);
    if (Array.isArray(g)) return g;
    const old = load('duo', null); // avant la liste : une seule partie retenue
    return old && old.room ? [{ room: old.room, key: old.key, broker: old.broker, seat: old.seat, id: old.id, names: ['', ''], turn: 'other', t: Date.now() }] : [];
  }
  const findGame = (room) => games().find((g) => g.room === room) || null;
  function turnFor(st, seat) {
    if (st.phase === 'lobby') return 'lobby';
    if (st.phase === 'celebrate') return 'party';
    if (st.phase === 'compose' || st.phase === 'reconfirm') return st.proposer === seat ? 'me' : 'other';
    return st.proposer !== seat ? 'me' : 'other';
  }
  function rememberGame(st) {
    if (!duo || !duo.info || !st) return;
    // Une partie ne remonte dans la liste que si elle a bougé (nouvelle étape) : l’ouvrir ne la déplace pas
    const all = games();
    const was = all.find((g) => g.room === duo.info.room);
    const snap = snapOf(duo.info.room);
    const moved = !was || (!!snap && (st.seq || 0) > (snap.seq || 0)); // sans photo, on ne sait pas : elle reste à sa place
    const entry = {
      room: duo.info.room, key: duo.info.key, broker: duo.info.broker, seat: duo.seat, id: duo.id,
      names: (st.names || ['', '']).slice(0, 2), turn: turnFor(st, duo.seat), kiff: st.kiff ? st.kiff.n : 0,
      nk: Math.max(Array.isArray(st.kiffs) ? st.kiffs.length : 0, st.kiff ? st.kiff.n : 0), t: moved ? Date.now() : (was.t || Date.now())
    };
    const list = was ? all.map((g) => (g.room === entry.room ? entry : g)) : [entry].concat(all);
    save('parties', list.slice(0, 40));
    saveSnap(duo.info.room, st);
  }
  /* La dernière photo de chaque partie, sur ce téléphone seulement : la partie s’ouvre tout de suite avec,
     puis se met à jour quand le relais et la feuille répondent. */
  function saveSnap(room, st) {
    if (!room || !st || st.v !== 1 || typeof st.seq !== 'number') return;
    const all = load('etats', {}) || {};
    all[room] = { st, t: Date.now() };
    const keep = Object.keys(all).sort((a, b) => (all[b].t || 0) - (all[a].t || 0)).slice(0, 12);
    try { save('etats', Object.fromEntries(keep.map((k) => [k, all[k]]))); } catch (e) { /* place pleine : tant pis */ }
  }
  const snapOf = (room) => { const x = (load('etats', {}) || {})[room]; return x && x.st && x.st.v === 1 ? x.st : null; };
  const forgetGame = (room) => save('parties', games().filter((g) => g.room !== room));
  function myTurn() {
    if (!duo) return true;
    if (S.phase === 'compose' || S.phase === 'reconfirm') return S.proposer === duo.seat;
    if (S.phase === 'review' || S.phase === 'adjust') return S.proposer !== duo.seat;
    return true;
  }

  const loaded = {};
  function loadScript(src) {
    if (!loaded[src]) {
      loaded[src] = new Promise((res, rej) => {
        const sc = document.createElement('script');
        sc.src = src;
        sc.onload = res;
        sc.onerror = () => { delete loaded[src]; rej(new Error(src)); };
        document.head.appendChild(sc);
      });
    }
    return loaded[src];
  }
  const loadDuoLibs = () => Promise.all([loadScript('vendor/mqtt.min.js?v=5.10.1'), loadScript('vendor/qrcode.js?v=1.4.4')]);

  function snapshot() {
    const keys = (idx) => idx.map((i, r) => keyOf(r, i));
    const inGame = !!duo && duo.stage === 'game';
    return {
      v: 1, dv: DATA_V,
      names: S.names.slice(), levels: S.levels.slice(),
      proposer: S.proposer, phase: S.phase, dir: S.dir,
      keys: keys(S.idx), custom: S.custom.slice(),
      original: S.original ? { keys: keys(S.original.idx), custom: S.original.custom.slice(), dir: S.original.dir } : null,
      bottom: !!S.bottom, pass: S.pass || null,
      lvOk: (S.lvOk || S.levels).slice(),
      kiff: S.kiff || null,
      kiffs: (S.kiffs || []).slice(-60),
      t0: S.t0 || null,
      rencontre: !!S.rencontre,
      prog: !!S.prog,
      cp: isComplet() && OFFRE !== 'tout' ? 1 : 0, // le jeu complet : un seul des deux téléphones suffit
      gift: S.gift || null,
      skin: currentSkin(), // l’ambiance de qui envoie : la personne invitée découvre le jeu dedans
      push: pushPair(), // adresses d’avertissement des deux téléphones (l’état est chiffré)
      // avant d’entrer dans la partie (invitation, arrivée), rien de ce téléphone ne s’y mêle
      cont: !!S.cont, // une partie commencée sur un téléphone, qui continue à distance
      ton: S.ton,
      decale: S.ton !== 'e', // pour un téléphone pas encore à jour
      wheels: inGame ? wheelsOf() : null, // les roues de ce tour, pour que l’autre téléphone ait exactement les mêmes
      mine: inGame || S.cont ? S.mine.map((l) => l.slice(-MINE_MAX)) : [[], [], []],
      seen: inGame || S.cont ? S.seen.map((l) => l.slice(-SEEN_MAX)) : [[], [], []]
    };
  }
  function pushState(extra) {
    if (!duo) return;
    // Pas encore reconnecté (la partie vient de s’ouvrir depuis le téléphone) : l’envoi partira à la connexion
    if (!duo.conn) { if (duo.stage === 'game') duo.pending = Object.assign(duo.pending || {}, extra || {}); return; }
    const st = Object.assign(snapshot(), extra || {});
    if (st.wheels) S.shared = st.wheels;
    duo.seq += 1;
    st.seq = duo.seq;
    st.by = duo.id;
    duo.lastBy = duo.id;
    duo.conn.publishState(st);
    duo.pushSeen = pushMine;
    rememberGame(st);
    notifyOther(st);
    duo.lastPhase = st.phase;
  }
  let syncT = 0;
  function sync() {
    if (!duo || duo.stage !== 'game') return;
    clearTimeout(syncT);
    syncT = setTimeout(() => pushState(), 80);
  }

  function sentenceFrom(o) {
    const keep = S.custom;
    S.custom = o.custom;
    const p = parts(o.idx, o.dir);
    S.custom = keep;
    const s = ('J’ai envie ' + glue(p.dir, p.act) + ' ' + p.obj + ' ' + p.man).replace(/\s+/g, ' ').replace(/ ,/g, ',').trim();
    return /[.!?…]$/.test(s) ? s : s + '.';
  }

  /* L’autre téléphone a changé l’état de la partie */
  function onRemoteState(st) {
    if (!duo || !st || st.v !== 1) return;
    if (st.seq < duo.seq || (st.seq === duo.seq && String(st.by) <= String(duo.lastBy))) return;
    duo.seq = st.seq;
    duo.lastBy = st.by;
    clearTimeout(duo.findT);
    if (Array.isArray(st.push)) {
      duo.push = duo.push || [null, null];
      duo.push[other(duo.seat)] = st.push[other(duo.seat)] || null;
      duo.pushSeen = st.push[duo.seat] || null;
    }
    duo.nk = notifKey(st);
    duo.lastPhase = st.phase;
    if (st.phase === 'ended') {
      if (duo.stage === 'game') note(T('nouvelles.fin'), T('nouvelles.fin-texte', { prénom: nameOf(st.endBy === 0 ? 0 : 1) }), () => leaveDuo(false));
      else duoError('ended');
      return;
    }
    if (duo.stage === 'game') { applyGame(st, {}); pushRefresh(); openPendingKiff(); if (kiffOpen) renderKiffCard(); return; }
    duo.remote = st;
    if (st.phase === 'lobby') {
      if (duo.seat === 0) { S.gift = st.gift || null; S.prog = !!st.prog; showInvite(); }
      else showJoin(st);
    } else if (duo.resume || duo.stage === 'invite') {
      const wasInvite = duo.stage === 'invite';
      enterGame(st, wasInvite);
      if (wasInvite) { sSwitchOn(); haptic(30); report('partie', null, 'deux'); }
      if (wasInvite && st.pass && st.pass.why === 'cadeau') note(T('nouvelles.commence', { prénom: nameOf(1) }), T('nouvelles.commence-texte', { prénom: nameOf(1) }));
      pushRefresh();
    } else {
      showJoin(st);
    }
  }

  function enterGame(st, spin) {
    duo.stage = 'game';
    S.cont = false;
    S.kept = [[], [], []]; newDraw();
    hide($('#ov-duo')); hide($('#ov-invited'));
    hide(el.ovStart);
    $('#steps').classList.remove('is-duo');
    S.started = true;
    S.mustRestart = false;
    applyGame(st, { first: true, spin: !!spin });
    // La discussion : les messages arrivés pendant l’absence, puis le kiff kiff d’un avertissement touché
    pullBox(true).then(openPendingKiff);
    renderChatBadges();
  }

  function applyGame(st, opts) {
    const prev = { phase: S.phase, proposer: S.proposer };
    S.names = (st.names || ['', '']).slice();
    const lv = parseLevels(st.levels);
    // Vos mots à vous deux et les mots déjà proposés : ceux de la partie, rejoints par ceux de ce téléphone
    if (opts.first) { S.mine = [[], [], []]; S.seen = [[], [], []]; }
    [0, 1, 2].forEach((r) => {
      cleanMine(st.mine && st.mine[r]).forEach((x) => { if (!S.mine[r].some((y) => sameItem(y, x))) S.mine[r].push(x); });
      S.mine[r] = S.mine[r].slice(-MINE_MAX);
      const remote = cleanSeen(st.seen && st.seen[r]);
      S.seen[r] = remote.concat(S.seen[r].filter((k) => !remote.includes(k))).slice(-SEEN_MAX);
    });
    S.prog = !!st.prog;
    S.cpOther = !!st.cp;
    S.ton = tonOf(st);
    renderTon();
    if (lv.join() !== S.levels.join()) { S.levels = lv; renderLevel(); }
    S.proposer = st.proposer;
    S.phase = st.phase;
    S.shared = Array.isArray(st.wheels) && st.wheels.length === 3 && st.wheels.every(Array.isArray) ? st.wheels : null;
    buildLists(lv);
    S.dir = st.dir === 'te' ? 'te' : 'me';
    S.custom = (st.custom || ['', '', '']).slice();
    S.bottom = !!st.bottom;
    // Deux passes : un mot ajouté pour la partie ne décale pas les autres cases
    [st.keys, st.original && st.original.keys].forEach((ks) => { if (ks) ks.forEach((k, r) => idxOf(r, k)); });
    const idx = st.keys.map((k, r) => idxOf(r, k));
    S.original = st.original ? { idx: st.original.keys.map((k, r) => idxOf(r, k)), custom: st.original.custom.slice(), dir: st.original.dir } : null;
    const arrived = !opts.first && myTurn() && (S.phase !== prev.phase || S.proposer !== prev.proposer);
    const spin = !!opts.spin;
    S.idx = idx.slice();
    reels.forEach((rl, r) => {
      if (spin) { rl._remote = true; rl.spinTo(idx[r], 1, 700 + r * 260); return; }
      if (rl.index === idx[r] && !rl.busy) return;
      rl.stop(); rl.drag = null;
      const t = Math.round(rl.p) + shortest(rl.index, idx[r], rl.n);
      rl.p = t; rl.lastTick = t;
    });

    // « On passe » venu de l’autre téléphone
    const pn = st.pass ? st.pass.n : 0;
    if (opts.first || duo.passN == null) duo.passN = pn;
    else if (pn > duo.passN) {
      duo.passN = pn;
      if (st.pass.by !== duo.seat && st.pass.why === 'piment') {
        hide(el.ovPass);
        note(T('nouvelles.piment'), T('nouvelles.piment-texte', { prénom: nameOf(st.pass.by), piment: levelNames(parseLevels(st.lvOk || st.levels)) }));
      } else if (st.pass.by !== duo.seat) {
        hide(el.ovPass);
        note(T('nouvelles.passe'), T(S.proposer === duo.seat ? 'nouvelles.passe-toi' : 'nouvelles.passe-autre', { prénom: nameOf(st.pass.by), autre: nameOf(S.proposer) }));
      }
    }
    S.pass = st.pass || null;
    S.lvOk = parseLevels(st.lvOk || st.levels);
    S.kiff = st.kiff || null;
    S.kiffs = Array.isArray(st.kiffs) ? st.kiffs.slice(-60) : [];
    S.t0 = st.t0 || S.t0 || null;
    S.rencontre = !!st.rencontre;
    renderKiffs();
    rememberGame(st);

    const missed = !!S.kiff && S.phase !== 'celebrate' && S.kiff.n > kiffSeen(duo.info.room);
    if (S.phase === 'celebrate' && prev.phase !== 'celebrate') celebrate();
    // L’autre a lancé le tour suivant et c’est à moi de composer : nouvelles roues
    if (!opts.first && S.phase === 'compose' && myTurn() && (prev.phase !== 'compose' || prev.proposer !== S.proposer)) setTimeout(() => { if (S.phase === 'compose' && myTurn()) shuffle(false, false, true); }, 700);
    else if (missed && !lateKiff) celebrateLate();
    if (S.phase !== 'celebrate' && !lateKiff && !el.ovParty.hidden) {
      // L’autre a gardé l’envie pour plus tard : la célébration reste, avec ce qu’il ou elle a choisi
      if (S.kiff && S.kiff.c === 'later' && S.kiff.cb !== duo.seat) { lateKiff = true; partyMode('suite', T('fete.gardee-par', { prénom: nameOf(S.kiff.cb) })); markKiffSeen(); }
      else { hide(el.ovParty); stopConfetti(); }
    }
    if (S.phase === 'celebrate' && !el.ovParty.hidden && S.kiff && S.kiff.c === 'now' && el.ovParty.dataset.mode === 'fete') partyMode('vivre');
    if (!myTurn() && !el.ovEdit.hidden) { hide(el.ovEdit); editing = -1; }
    if (arrived && S.phase !== 'celebrate') { sSwitchOn(); haptic(30); }
    renderReels();
    render();
    // La proposition (ou l’envie ajustée) arrive dans une modale ; un piment plus chaud s’accepte avant
    if (!lateKiff) showTurnModal();
    renderWait();
  }

  /* Écran d’attente : pendant que l’autre téléphone a la main */
  const PHASES_TOUR = ['compose', 'review', 'adjust', 'reconfirm'];
  function renderWait() {
    const ov = ovPartie;
    if (duo && duo.stage === 'invite') { renderInvitePage(); return; }
    ov.classList.remove('is-invite');
    const inGame = !!duo && duo.stage === 'game' && el.ovStart.hidden;
    const waiting = inGame && PHASES_TOUR.includes(S.phase) && !myTurn();
    // La partie s’ouvre toute seule quand l’autre a la main ; à mon tour, elle reste ouverte si je l’ai ouverte
    if (!waiting && !(partieWanted && inGame)) { if (!ov.hidden) { hide(ov); partieHidden(); } renderDuoStatus(); return; }
    ov.classList.toggle('is-back', partieFront);
    renderAction(waiting);
    const was = ov.hidden;
    show(ov);
    if (was) partieShown();
    renderDuoStatus();
  }
  // L’action du moment, en tête de la partie
  let actionGo = '';
  function renderAction(waiting) {
    const A = nameOf(S.proposer), B = nameOf(other(S.proposer)), O = nameOf(other(duo.seat));
    let label = '', line = '', go = '';
    actionGo = '';
    if (waiting) {
      // Une seule ligne : ce qui se passe, sans titre au-dessus
      if (S.phase === 'compose') line = T('attente.compose', { prénom: A });
      else if (S.phase === 'review') line = T('attente.envoyee') + ' · ' + (hotter() ? T('attente.piment', { prénom: B }) : T('attente.lit', { prénom: B }));
      else if (S.phase === 'adjust') line = T('attente.ajuste', { prénom: B }) + '.';
      else { const ch = changes(); line = T('attente.relit', { chose: CHANGE_NAMES[ch.length ? ch[0] : 0], prénom: A }); }
    } else if (PHASES_TOUR.includes(S.phase)) {
      if (S.phase === 'compose') { line = T('partie.proposer'); go = T('partie.tourner'); }
      else if (S.phase === 'review') { line = T('partie.envie-recue', { prénom: O }); go = T('partie.lire'); actionGo = 'offre'; }
      else if (S.phase === 'reconfirm') { line = T('partie.ajustee', { prénom: O }); go = T('partie.relire'); actionGo = 'offre'; }
      else { line = T('partie.ajuster', { prénom: O }); go = T('partie.reprendre'); }
    }
    $('#partie-action').hidden = !line;
    $('#partie-action').classList.toggle('is-turn', !waiting);
    $('#wait-title').textContent = label;
    $('#wait-kicker').textContent = line;
    $('#wait-pass').hidden = !waiting;
    const g = $('#wait-go');
    g.hidden = !go; g.textContent = go;
    // Après une envie envoyée, tant que l’appli n’est pas installée : l’installer, pour être averti·e de la réponse
    $('#wait-install').hidden = !(waiting && S.phase !== 'compose' && installer.can() && !load('installAsked', false));
  }

  /* Connexion : la mienne et celle de l’autre */
  function renderDuoStatus() {
    // La cloche de l’invitation : tant qu’on attend que l’autre rejoigne
    const dn = $('#duo-notif');
    const inv = !!duo && duo.stage === 'invite';
    dn.hidden = !(inv && (pushStatus === 'on' || pushStatus === 'off' || pushStatus === 'install' || pushStatus === 'blocked'));
    dn.setAttribute('aria-pressed', pushStatus === 'on' ? 'true' : 'false');
    $('#duo-notif-state').textContent = pushStatus === 'on' ? 'activé' : 'désactivé';
    // La cloche dit clairement son état : allumée et « Averti·e » quand c’est activé
    document.querySelectorAll('.notif-word').forEach((w) => { w.textContent = pushStatus === 'on' ? T('attente.averti') : T('attente.avertir'); });
    if (inv) $('#duo-wait-text').textContent = presenceFlash || (duo.partnerOn ? T('duo.attente-la') : (pushStatus === 'on' ? T('duo.attente-averti') : T('duo.attente')));
    // L’invitation, en page de partie : la présence de l’autre téléphone (ou le mot bref d’une copie)
    if (inv && !ovPartie.hidden) {
      $('#wait-presence-text').textContent = presenceFlash || (duo.partnerOn ? T('partie.invite-la') : T('partie.invite-absent'));
      $('#wait-who').classList.toggle('is-off', duo.partnerOn !== true);
      const nb = $('#wait-notif'); nb.setAttribute('aria-pressed', pushStatus === 'on' ? 'true' : 'false');
      nb.hidden = !(pushStatus === 'on' || pushStatus === 'off' || pushStatus === 'install' || pushStatus === 'blocked');
    }
    const line = $('#duo-status');
    // En haut : « Avec Lou » et sa présence, à la place du nom du jeu
    const inGame = !!duo && duo.stage === 'game';
    $('#top-who').hidden = !inGame;
    document.querySelector('.top > .logo').hidden = inGame;
    if (!inGame) { line.hidden = true; return; }
    const B = nameOf(other(duo.seat));
    $('#top-name').textContent = T('jeu.avec', { prénom: B });
    $('#top-pres').textContent = duo.online === false ? '' : (duo.updating ? T('partie.maj') : T(duo.partnerOn ? 'jeu.present' : 'jeu.absent'));
    $('#top-who').classList.toggle('is-off', duo.partnerOn !== true);
    let msg = '';
    if (duo.online === false) msg = T('attente.perdue');
    else if (duo.partnerOn === false) msg = T('attente.pas-connecte', { prénom: B });
    // L’absence de l’autre se lit en haut ; cette ligne ne dit plus que la connexion perdue
    line.textContent = msg;
    line.hidden = duo.online !== false;
    // Une ligne de présence ; les actions sont des icônes (Prévenir, M’avertir, kiff kiff, Accueil)
    const away = duo.partnerOn !== true;
    const on = pushStatus === 'on';
    // En haut de l’attente, comme en haut du jeu : « Avec Lou », puis sa présence en quelques mots
    let pres = T('jeu.present');
    if (duo.online === false) pres = msg;
    else if (presenceFlash) pres = presenceFlash;
    else if (duo.updating) pres = T('partie.maj');
    else if (typingKid) pres = T('chat.ecrit');
    else if (away) pres = T('jeu.absent');
    // … et le piment de la partie
    if (duo.online !== false && !duo.updating && !presenceFlash && S.levels && S.levels.length) pres += ' · ' + D.niveaux[Math.max(...S.levels) - 1].nom;
    $('#wait-presence').classList.toggle('is-typing', !!typingKid);
    $('#wait-name').textContent = T('jeu.avec', { prénom: B });
    $('#wait-presence-text').textContent = pres;
    $('#wait-who').classList.toggle('is-off', away || duo.online === false);
    const nudge = $('#wait-nudge');
    // Prévenir et M’avertir : seulement quand l’autre a la main
    const waitingNow = ['compose', 'review', 'adjust', 'reconfirm'].includes(S.phase) && !myTurn();
    nudge.hidden = !away || !waitingNow;
    nudge.setAttribute('aria-label', 'Prévenir ' + B + ' que c’est son tour');
    const nb = $('#wait-notif');
    nb.hidden = !waitingNow || !(on || pushStatus === 'off' || pushStatus === 'install' || pushStatus === 'blocked');
    nb.setAttribute('aria-label', T(on ? 'attente.averti' : 'attente.avertir'));
    nb.setAttribute('aria-pressed', on ? 'true' : 'false');
    $('#wait-notif-state').textContent = on ? 'activé' : 'désactivé';
    const ht = $('#duo-home-text');
    const nk = kiffCount();
    if (ht) ht.textContent = T(msg ? 'accueil.en-cours-msg' : 'accueil.en-cours', { prénom: B, etat: msg }) + (nk ? ' ' + T('accueil.en-cours-kiffs', { nombre: nk }) : '');
  }

  const duoHandlers = {
    state: (st) => onRemoteState(st),
    presence: (seat, on) => {
      if (!duo) return;
      duo.partnerOn = on;
      renderDuoStatus();
    },
    status: (ok) => { if (duo) { duo.online = ok; renderDuoStatus(); } },
    chat: (obj) => receiveChat([obj]),
    typing: (kid) => onTyping(kid)
  };

  /* ---------- Feuille « deux téléphones » : créer, inviter, rejoindre ---------- */
  const ovDuo = $('#ov-duo');
  const duoName = $('#duo-name');
  function duoSheet(o) {
    $('#duo-title').textContent = o.title;
    $('#duo-text').textContent = o.text || '';
    $('#duo-text').hidden = !o.text;
    $('#duo-qr').hidden = !o.qr;
    $('#duo-share').hidden = !o.qr;
    $('#duo-name-label').hidden = !o.name;
    duoName.hidden = !o.name;
    $('#duo-name-label').textContent = T('duo.ton-prenom');
    $('#duo-wait').hidden = !o.wait;
    $('#duo-notif').hidden = o.stage !== 'invite';
    $('#duo-wait-text').textContent = o.wait || '';
    $('#duo-error').hidden = !o.error;
    $('#duo-error').textContent = o.error || '';
    $('#duo-go').hidden = !o.go;
    $('#duo-go').textContent = o.go || '';
    $('#duo-go').disabled = false;
    $('#duo-cancel').textContent = o.cancel || T('duo.annuler');
    ovDuo.dataset.stage = o.stage;
    ovDuo.dataset.retry = '';
    if (!ovInv.hidden) hide(ovInv);
    show(ovDuo);
  }
  function openDuoSetup() {
    duoName.value = S.names[0] || $('#name0').value.trim() || '';
    duoName.placeholder = T('joueurs.exemple-1');
    duoSheet({
      stage: 'setup',
      title: T('duo.titre'),
      text: T('duo.creer-texte'),
      name: true, go: T('duo.creer')
    });
    if (!KiffDuoOk()) duoError('support');
  }
  $('#home-cont').addEventListener('click', () => { audio(); sClick(); haptic(8); askContinue(); });
  const KiffDuoOk = () => !!(window.KiffDuo && window.KiffDuo.supported());

  /* Continuer à distance : la partie commencée sur ce téléphone passe sur deux, avec ses prénoms, son piment,
     vos mots et vos kiff kiff. Ce téléphone garde la place de qui l’a lancée (le premier prénom). */
  function askContinue() {
    const B = nameOf(1);
    duoSheet({
      stage: 'cont',
      title: T('duo.continuer'),
      text: T('duo.continuer-texte', { prénom: B }),
      go: T('duo.inviter', { prénom: B }), cancel: T('duo.annuler')
    });
    if (!KiffDuoOk()) duoError('support');
  }
  async function continueDuo() {
    applyPendingMots();
    const keep = { names: S.names.slice(), levels: S.levels.slice(), kiffs: (S.kiffs || []).slice(-60), mine: S.mine, seen: S.seen, proposer: S.proposer, t0: S.t0 };
    duoSheet({ stage: 'creating', title: T('duo.continuer'), wait: T('duo.ouvre'), cancel: T('duo.annuler') });
    try { await loadDuoLibs(); } catch (e) { duoError('net'); return; }
    const id = window.KiffDuo.newId();
    duo = { seat: 0, id, seq: 0, lastBy: '', stage: 'creating', partnerOn: null, online: true, passN: null };
    let conn;
    try { conn = await window.KiffDuo.create(id, duoHandlers); } catch (e) { duo = null; duoError('relay'); return; }
    if (!duo || duo.id !== id) { conn.close(true); return; }
    duo.conn = conn;
    duo.info = conn.info;
    try { history.replaceState(null, '', window.KiffDuo.link(conn.info)); } catch (e) { /* rien */ }
    S.names = keep.names;
    S.proposer = keep.proposer;
    S.phase = 'lobby';
    S.original = null; S.bottom = false; S.pass = null;
    S.custom = ['', '', ''];
    S.prog = false; S.gift = null; S.gifting = false; S.rencontre = false;
    S.kiff = null; S.kiffs = keep.kiffs;
    setLevels(keep.levels, { silent: true, remote: true });
    S.lvOk = keep.levels.slice();
    S.mine = keep.mine; S.seen = keep.seen;
    S.cont = true;
    S.t0 = keep.t0 || Date.now();
    S.started = false;
    pushState();
    rememberGame({ phase: 'lobby', names: S.names });
    report('invitation', null, 'continuer');
    showInvite();
  }
  async function createDuo(given, other) {
    applyPendingMots();
    const name = (given != null ? given : duoName.value).replace(/\s+/g, ' ').trim().slice(0, 20);
    const prov = String(other || '').replace(/\s+/g, ' ').trim().slice(0, 20); // l’autre pourra le changer
    duoSheet({ stage: 'creating', title: T('duo.titre'), wait: T('duo.ouvre'), cancel: T('duo.annuler') });
    try { await loadDuoLibs(); } catch (e) { duoError('net'); return; }
    const id = window.KiffDuo.newId();
    duo = { seat: 0, id, seq: 0, lastBy: '', stage: 'creating', partnerOn: null, online: true, passN: null };
    let conn;
    try { conn = await window.KiffDuo.create(id, duoHandlers); } catch (e) { duo = null; duoError('relay'); return; }
    if (!duo || duo.id !== id) { conn.close(true); return; } // annulé entre-temps
    duo.conn = conn;
    duo.info = conn.info;
    save('duo', { room: conn.info.room, key: conn.info.key, broker: conn.info.broker, seat: 0, id });
    try { history.replaceState(null, '', window.KiffDuo.link(conn.info)); } catch (e) { /* rien */ }
    S.names = [name, prov];
    save('names', [name, load('names', ['', ''])[1] || '']);
    addKnown(name);
    S.proposer = 0;
    S.phase = 'lobby';
    S.original = null; S.bottom = false; S.pass = null;
    S.custom = ['', '', ''];
    // À distance, on commence toujours en Tendre : le piment se débloque en jouant
    S.prog = true; S.gift = null; S.gifting = false;
    S.ton = 'm'; renderTon(); // une nouvelle rencontre commence avec un peu de tout
    S.kiff = null; S.kiffs = [];
    setLevels([1], { silent: true, remote: true });
    S.lvOk = [1];
    S.t0 = Date.now();
    pushState();
    rememberGame({ phase: 'lobby', names: [name, prov] });
    report('invitation', null, 'progressif');
    askGift();
  }
  /* Une envie dans l’invitation : l’autre la découvrira après le principe du jeu, s’il ou elle le veut */
  function askGift() {
    duoSheet({
      stage: 'gift-ask',
      title: T('duo.cadeau'),
      text: T('duo.cadeau-texte'),
      go: T('duo.composer'), cancel: T('jeu.sans-envie')
    });
  }
  function startGift() {
    duo.stage = 'gift';
    S.gifting = true;
    hide(ovDuo); hide(el.ovStart);
    $('#steps').classList.remove('is-duo');
    S.started = true;
    startComposition(0);
    shuffle(true);
  }
  function endGift(keep) {
    if (keep) {
      adoptFree();
      markSeen();
      S.gift = { keys: S.idx.map((i, r) => keyOf(r, i)), custom: S.custom.slice(), dir: S.dir };
      report('invitation', null, 'envie');
      sSwitchOn(); haptic(15);
    }
    S.gifting = false;
    S.phase = 'lobby';
    pushState();
    showInvite();
  }
  /* L’invitation envoyée : la page de la partie, comme pour une partie commencée (27 octobre 2026).
     En haut « Invitation à Jade » ; dans le fil, l’envie glissée, puis le code à scanner et le lien à envoyer. */
  function showInvite() {
    duo.stage = 'invite';
    hide(ovDuo); hide(el.ovStart); hide($('#ov-invited'));
    renderWait();
    renderDuoStatus();
  }
  function renderInvitePage() {
    const ov = ovPartie;
    ov.classList.add('is-invite');
    const B = (S.names[1] || '').trim();
    $('#wait-name').textContent = B ? T('parties.invitation-a', { prénom: B }) : T('parties.invitation');
    $('#wait-presence-text').textContent = presenceFlash || (duo.partnerOn ? T('partie.invite-la') : T('partie.invite-absent'));
    $('#wait-presence').classList.remove('is-typing');
    $('#wait-who').classList.toggle('is-off', duo.partnerOn !== true);
    $('#wait-kiffs').hidden = true;
    $('#partie-action').hidden = false;
    $('#partie-action').classList.remove('is-turn');
    $('#wait-title').textContent = '';
    $('#wait-kicker').textContent = T('parties.personne') + '.';
    ['#wait-pass', '#wait-go', '#wait-install', '#wait-nudge'].forEach((q) => { $(q).hidden = true; });
    const nb = $('#wait-notif');
    nb.hidden = !(pushStatus === 'on' || pushStatus === 'off' || pushStatus === 'install' || pushStatus === 'blocked');
    nb.setAttribute('aria-pressed', pushStatus === 'on' ? 'true' : 'false');
    const was = ov.hidden;
    show(ov);
    if (was) partieShown(); else renderChat();
  }
  // Le fil d’une invitation : l’envie glissée (s’il y en a une), puis l’invitation elle-même
  function inviteThreadHtml() {
    let html = '<li class="chat-day"><span>' + esc(dayLabel(S.t0 || Date.now())) + '</span></li>';
    if (S.gift && Array.isArray(S.gift.keys)) {
      let text = '';
      try { text = sentenceFrom({ idx: S.gift.keys.map((k, r) => idxOf(r, k)), custom: (S.gift.custom || ['', '', '']).slice(), dir: S.gift.dir || 'me' }); } catch (e) { text = ''; }
      if (text) html += '<li class="thread-kiff thread-envie"><button class="thread-kiff-btn" type="button" disabled><span class="thread-kiff-kicker">' + esc(T('partie.envie-glissee')) + '</span>' +
        '<span class="party-sentence thread-kiff-card"><span class="thread-kiff-text">' + esc(text) + '</span></span></button></li>';
    }
    const url = window.KiffDuo.link(duo.info);
    html += '<li class="thread-invite"><div class="invite-card">' +
      '<span class="thread-kiff-kicker">' + esc(T('partie.invite-kicker')) + '</span>' +
      '<p class="invite-text">' + esc(T('partie.invite-texte')) + '</p>' +
      '<div class="duo-qr invite-qr">' + window.KiffDuo.qrSvg(url) + '</div>' +
      '<div class="duo-share invite-share">' + (typeof navigator.share === 'function' ? '<button class="btn" type="button" data-inv="send">' + esc(T('duo.envoyer')) + '</button>' : '') +
      '<button class="btn btn--line" type="button" data-inv="copy">' + esc(T('duo.copier')) + '</button></div>' +
      '<button class="link-btn invite-cancel" type="button" data-inv="cancel">' + esc(T('duo.annuler-partie')) + '</button>' +
      '</div></li>';
    return html;
  }
  /* La personne invitée ne connaît peut-être pas le jeu : trois écrans avant de rejoindre */
  const ovInv = $('#ov-invited');
  let invSteps = null;
  function showInvited(st) {
    const A = (st.names && st.names[0] || '').trim() || 'Cerise';
    const bA = { html: '<b class="inv-a">' + esc(A) + '</b>' };
    $('#ov-invited .inv-from').innerHTML = st.rencontre ? '<b class="inv-a"></b> te propose un jeu avant de vous voir, chacun·e sur son téléphone. Vous commencez en Tendre.' : TH('invite.de', { prénom: bA });
    $('#inv-name-help').textContent = T('invite.prenom-aide', { prénom: A });
    const lv = parseLevels(st.levels);
    const chip = (n) => '<span class="inv-piment"><span class="pgroup pgroup--' + n + ' is-on">' + CHILI.repeat(n) + '</span> ' + esc(D.niveaux[n - 1].nom) + '</span>';
    $('#inv-piments').innerHTML = st.prog
      ? TH('invite.piment-monte', { piment: { html: chip(1) } })
      : TH('invite.piments', { prénom: A, piments: { html: lv.map(chip).join(' ') } });
    const r1 = $('#inv-rule-1'), r2 = $('#inv-rule-2');
    if (!r1.dataset.html) { r1.dataset.html = r1.innerHTML; r2.dataset.html = r2.innerHTML; }
    if (st.gift) {
      r1.innerHTML = TH('invite.regle-1-envie', { prénom: bA });
      r2.innerHTML = TH('invite.regle-2-envie');
    } else { r1.innerHTML = TH('invite.regle-1'); r2.innerHTML = TH('invite.regle-2', { prénom: bA }); }
    document.querySelectorAll('#ov-invited .inv-a').forEach((b) => { b.textContent = A; });
    // Première visite : on découvre le jeu dans l’ambiance de qui invite (chacun·e peut ensuite choisir la sienne)
    if (st.skin && SKINS.includes(st.skin) && !window.KIFF_SKIN_SET) { applySkin(st.skin); window.KIFF_SKIN_SET = true; }
    if (!ovInv.hidden) return; // déjà là : on garde l’écran en cours de lecture
    if (!invSteps) invSteps = makeSteps($('#inv-steps'), $('#inv-dots'), ovInv);
    hide(ovDuo);
    const prov = (st.names && st.names[1] || '').trim();
    $('#inv-name').value = prov || load('duoName', '') || '';
    $('#inv-name-help').textContent = prov ? T('invite.prenom-propose', { prénom: A }) : T('invite.prenom-aide', { prénom: A });
    invSteps.go(0, true);
    show(ovInv);
  }
  $('#inv-go').addEventListener('click', () => { audio(); sClick(); haptic(8); invSteps.go(1); });
  $('#inv-ok').addEventListener('click', () => { audio(); sClick(); haptic(8); invSteps.go(2); });
  $('#inv-form').addEventListener('submit', (e) => {
    e.preventDefault();
    audio();
    if (!duo || !duo.remote) return;
    if (needName($('#inv-name'))) return;
    document.activeElement && document.activeElement.blur();
    hide(ovInv);
    joinGame($('#inv-name').value);
  });
  $('#inv-solo').addEventListener('click', () => { audio(); hide(ovInv); leaveDuo(false); });

  function showJoin(st) {
    duo.stage = 'join';
    duo.remote = st;
    if (st.phase === 'lobby' && st.cont) {
      const A0 = (st.names && st.names[0] || '').trim() || 'Cerise';
      duoName.value = (st.names && st.names[1]) || load('duoName', '') || '';
      duoName.placeholder = T('invite.exemple');
      duoSheet({
        stage: 'join',
        title: T('duo.suite'),
        text: T('duo.suite-texte', { prénom: A0 }),
        name: true, go: T('duo.suite-ok'), cancel: T('invite.solo')
      });
      return;
    }
    if (st.phase === 'lobby') { showInvited(st); return; }
    duoName.value = load('duoName', '') || '';
    duoName.placeholder = T('invite.exemple');
    const A = (st.names && st.names[0] || '').trim() || 'Cerise';
    duoSheet({
      stage: 'join',
      title: T('duo.rejoindre-titre', { prénom: A }),
      text: T(st.phase === 'lobby' ? 'duo.rejoindre-texte' : 'duo.rejoindre-commencee', { prénom: A }),
      name: true, go: T('duo.rejoindre'), cancel: T('invite.solo')
    });
    setTimeout(() => duoName.focus(), 80);
  }
  function joinGame(given) {
    const st = duo.remote;
    const name = (given != null ? given : duoName.value).replace(/\s+/g, ' ').trim().slice(0, 20);
    save('duoName', name);
    addKnown(name);
    const next = Object.assign({}, st);
    next.names = [(st.names && st.names[0]) || '', name];
    if (st.phase === 'lobby' && st.cont) {
      // La partie continue où elle en était : même piment, même tour
      const lv = parseLevels(st.levels);
      buildLists(lv);
      next.phase = 'compose';
      next.proposer = st.proposer === 0 || st.proposer === 1 ? st.proposer : 1;
      next.lvOk = parseLevels(st.lvOk || st.levels);
      next.keys = [0, 1, 2].map((r) => keyOf(r, pickIndex(r, true)));
      next.original = null; next.bottom = false; next.cont = false;
      save('rulesSeen', true);
      report('rejoint');
      beginJoined(next);
      return;
    }
    if (st.phase === 'lobby') {
      // La partie commence : rouleaux au hasard, la personne invitée propose en premier
      const lv = parseLevels(st.levels);
      buildLists(lv);
      next.phase = 'compose';
      next.proposer = 1;
      next.lvOk = lv.slice();
      next.t0 = Date.now();
      report('rejoint');
      next.keys = [0, 1, 2].map((r) => keyOf(r, pickIndex(r, true)));
      save('rulesSeen', true);
      next.original = null; next.bottom = false;
      // Une envie glissée dans l’invitation : on choisit d’abord de la découvrir, ou pas
      if (st.gift && st.gift.keys) { showGift(next, st.gift); return; }
    }
    beginJoined(next);
  }
  function beginJoined(next) {
    next.gift = null;
    duo.resume = true;
    save('duo', { room: duo.info.room, key: duo.info.key, broker: duo.info.broker, seat: duo.seat, id: duo.id });
    enterGame(next, next.proposer === duo.seat);
    pushState();
  }
  const ovGift = $('#ov-gift');
  let giftNext = null;
  function showGift(next, gift) {
    giftNext = { next, gift };
    const A = ((next.names && next.names[0]) || '').trim();
    $('#gift-title').textContent = A ? T('cadeau.titre', { prénom: A }) : T('cadeau.titre-anonyme');
    show(ovGift);
    sSwitchOn(); haptic(30);
    $('#gift-open').focus({ preventScroll: true });
  }
  $('#gift-open').addEventListener('click', () => {
    if (!giftNext) return;
    audio(); sClick(); haptic(12);
    const { next, gift } = giftNext;
    giftNext = null;
    hide(ovGift);
    report('invitation', null, 'envie-ouverte');
    // L’envie de qui invite arrive comme une envie reçue : « J’ai envie aussi », « Oui, mais… » ou « On passe »
    next.phase = 'review';
    next.proposer = 0;
    next.keys = gift.keys.slice(0, 3);
    next.custom = (gift.custom || ['', '', '']).slice(0, 3);
    next.dir = gift.dir === 'te' ? 'te' : 'me';
    next.original = { keys: next.keys.slice(), custom: next.custom.slice(), dir: next.dir };
    beginJoined(next);
  });
  $('#gift-later').addEventListener('click', () => {
    if (!giftNext) return;
    audio(); haptic(12);
    const { next } = giftNext;
    giftNext = null;
    hide(ovGift);
    report('invitation', null, 'envie-plus-tard');
    // Pas besoin d’expliquer pourquoi : c’est la personne invitée qui propose
    next.pass = { by: 1, n: 1, why: 'cadeau' };
    beginJoined(next);
  });

  async function startJoin(info) {
    const stored = findGame(info.room);
    const same = !!stored && stored.key === info.key;
    const seat = same ? stored.seat : 1;
    const id = same && stored.id ? stored.id : (KiffDuoOk() ? window.KiffDuo.newId() : 'x');
    hide(el.ovStart);
    try { history.replaceState(null, '', window.KiffDuo.link(info)); } catch (e) { /* rien */ }
    if (!KiffDuoOk()) { duoSheet({ stage: 'connecting', title: T('duo.connexion-titre'), wait: '', cancel: T('duo.accueil') }); duoError('support'); return; }
    const snap = same ? snapOf(info.room) : null;
    if (snap && snap.phase !== 'ended' && snap.phase !== 'lobby') {
      // La partie s’ouvre tout de suite, telle que ce téléphone l’a laissée ; la mise à jour suit
      applyPendingMots();
      duo = { info, seat, id, seq: 0, lastBy: '', stage: 'connecting', resume: true, partnerOn: null, online: true, passN: null, updating: true };
      onRemoteState(snap);
      report('partie', null, 'photo');
    } else {
      duoSheet({ stage: 'connecting', title: T('duo.connexion-titre'), wait: same ? T('duo.retrouve') : T('duo.connexion'), cancel: same ? T('duo.accueil') : T('invite.solo') });
      // Les deux téléphones doivent avoir les mêmes mots : on attend un instant ceux de l’atelier
      await Promise.race([motsReady, new Promise((r) => setTimeout(r, 4000))]);
      applyPendingMots();
      duo = { info, seat, id, seq: 0, lastBy: '', stage: 'connecting', resume: !!same, partnerOn: null, online: true, passN: null };
    }
    const d = duo;
    // La dernière étape gardée dans la feuille : pour quand l’autre a joué pendant notre absence
    const fromStore = window.KiffDuo.storeLoad([info]);
    try { await loadDuoLibs(); } catch (e) {
      if (duo === d && duo.updating) { duo.online = false; renderDuoStatus(); return; }
      duoError('net'); return;
    }
    const connect = async () => {
      try {
        const conn = await window.KiffDuo.join(info, seat, id, duoHandlers);
        if (duo !== d) { conn.close(false); return false; }
        duo.conn = conn; duo.online = true;
        return true;
      } catch (e) { return false; }
    };
    // Reconnecté : la feuille dit si l’autre a joué entre-temps, puis ce qui attendait part
    let settled = false;
    const settle = () => {
      if (duo !== d || settled || !duo.conn) return;
      settled = true;
      duo.updating = false;
      if (duo.pending) { const x = duo.pending; duo.pending = null; pushState(x); }
      renderDuoStatus();
      if (duo.stage !== 'game') return;
      render(); renderWait();
      if (!ovPartie.hidden) { $('#chat-bar').hidden = !canChat(); renderChat(); pullBox(true); }
    };
    const afterConnect = (store) => {
      store.then((m) => { if (duo === d && m[info.room]) onRemoteState(m[info.room]); }).catch(() => {}).then(settle);
      setTimeout(settle, 6000);
    };
    if (!(await connect())) {
      if (duo === d && duo.updating) {
        // Hors connexion : la partie reste ouverte telle quelle ; on réessaie sans bruit
        duo.online = false; renderDuoStatus();
        const retry = async () => { if (duo !== d || duo.conn) return; if (await connect()) afterConnect(window.KiffDuo.storeLoad([info])); else setTimeout(retry, 8000); };
        setTimeout(retry, 8000);
        return;
      }
      if (duo === d) duoError('relay');
      return;
    }
    afterConnect(fromStore);
    duo.findT = setTimeout(() => { if (duo === d && duo.stage === 'connecting') duoError('notfound'); }, 12000);
  }

  function duoError(kind) {
    const msgs = { get support() { return T('duo.erreur-support'); }, get net() { return T('duo.erreur-net'); }, get relay() { return T('duo.erreur-relais'); },
      get notfound() { return T('duo.erreur-introuvable'); }, get ended() { return T('duo.erreur-finie'); }, get version() { return T('duo.erreur-version'); } };
    const retry = kind === 'net' || kind === 'relay' || kind === 'notfound' || kind === 'version';
    if (kind === 'ended' && duo && duo.info) forgetGame(duo.info.room);
    duoSheet({
      stage: 'error', title: T('duo.titre'), error: msgs[kind] || msgs.relay,
      go: retry ? T('duo.reessayer') : '', cancel: duo && duo.resume && kind !== 'ended' ? T('duo.accueil') : T('invite.solo')
    });
    ovDuo.dataset.retry = kind;
  }

  // announce : prévenir l’autre que la partie s’arrête ; keep : la garder pour plus tard (accueil)
  async function leaveDuo(announce, keep) {
    const d = duo;
    duo = null;
    clearTimeout(syncT);
    save('duo', null);
    if (d && d.info && !keep) forgetGame(d.info.room);
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* rien */ }
    hide(ovDuo); hide($('#ov-wait')); hide($('#ov-note')); hide($('#ov-invited')); hide(ovHot);
    S.lvOk = null; S.kiff = null; S.kiffs = []; S.rencontre = false; S.prog = false; S.gift = null; S.gifting = false; renderKiffs(); partyNormal();
    setLevels(load('levels', [1, 2]), { silent: true, remote: true }); // le piment choisi pour jouer sur un téléphone
    setMemory(null);
    if (d && d.conn) {
      if (announce && (d.stage === 'game' || d.stage === 'invite')) {
        const st = Object.assign(snapshot(), { phase: 'ended', endBy: d.seat, seq: d.seq + 1, by: d.id });
        d.conn.publishState(st);
      }
      d.conn.close(false).catch(() => {});
    }
    renderDuoStatus();
    // Retour à l’accueil, pour une partie sur un seul téléphone
    S.started = false;
    S.phase = 'start';
    S.names = load('names', ['', '']);
    hide(el.ovParty); stopConfetti();
    openHome();
  }

  /* Petit message de l’autre téléphone */
  let noteThen = null;
  function note(title, text, then) {
    $('#note-title').textContent = title;
    $('#note-text').textContent = text;
    noteThen = then || null;
    show($('#ov-note'));
    sSwitchOff(); haptic(20);
  }
  $('#note-ok').addEventListener('click', () => {
    hide($('#ov-note'));
    const t = noteThen; noteThen = null;
    if (t) t();
  });

  $('#duo-form').addEventListener('submit', (e) => {
    e.preventDefault();
    audio();
    const stage = ovDuo.dataset.stage;
    if ((stage === 'setup' || stage === 'join') && needName(duoName)) return;
    if (stage === 'setup') createDuo();
    else if (stage === 'cont') continueDuo();
    else if (stage === 'gift-ask') startGift();
    else if (stage === 'invite') leaveDuo(false, true);
    else if (stage === 'join' && duo && duo.remote) joinGame();
    else if (stage === 'error') {
      const kind = ovDuo.dataset.retry;
      const info = duo && duo.info;
      if (duo && duo.conn) duo.conn.close(false).catch(() => {});
      duo = null;
      if (info) startJoin(info); else if (kind === 'version') location.reload(); else openDuoSetup();
    }
  });
  $('#duo-cancel').addEventListener('click', () => {
    audio();
    const stage = ovDuo.dataset.stage;
    if (stage === 'setup' || stage === 'cont') { hide(ovDuo); return; }
    if (stage === 'gift-ask') { showInvite(); return; }
    if (stage === 'invite') { leaveDuo(true); return; }
    leaveDuo(false, !!(duo && duo.resume) && ovDuo.dataset.retry !== 'ended');
  });
  function inviteText() {
    const me = (S.names[0] || '').trim();
    if (S.gift) return me ? T('duo.message-envie', { prénom: me }) : T('duo.message-envie-anonyme');
    if (!S.rencontre) return me ? T('duo.message', { prénom: me }) : T('duo.message-anonyme');
    const lead = S.rencontre ? (me ? me + ' te propose un jeu avant de vous voir : ' : 'On joue avant de se voir ? ') : (me ? me + ' t’invite à jouer à Kiff Kiff : ' : 'On joue à Kiff Kiff ? ');
    return lead + (/\? $/.test(lead) ? 'Quand' : 'quand') + ' vos envies se rejoignent, c’est kiff kiff. Ouvre ce lien sur ton téléphone.';
  }
  $('#duo-copy').addEventListener('click', async () => {
    const url = duo && duo.info ? window.KiffDuo.link(duo.info) : '';
    let ok = false;
    try { await navigator.clipboard.writeText(inviteText() + ' ' + url); ok = true; } catch (e) { ok = false; }
    if (ok) { report('partage', null, 'invitation-copie'); afterInvite(); }
    $('#duo-copy').textContent = ok ? T('duo.copiee') : T('duo.copie-impossible');
    setTimeout(() => { $('#duo-copy').textContent = T('duo.copier'); }, 1800);
  });
  $('#duo-send').addEventListener('click', () => {
    if (!duo || !duo.info) return;
    navigator.share({ title: 'Kiff Kiff', text: inviteText(), url: window.KiffDuo.link(duo.info) })
      .then(() => { report('partage', null, 'invitation'); afterInvite(); }).catch(() => {});
  });
  // Une envie glissée dans l’invitation vient de partir : l’appli installée avertira de la suite
  const afterInvite = () => { if (S.gift) setTimeout(() => inviteInstall('invitation'), 2000); };
  $('#wait-pass').addEventListener('click', () => el.pass.click());
  // Prévenir l’autre que c’est son tour : par le partage du téléphone (WhatsApp, SMS…)
  $('#wait-nudge').addEventListener('click', async () => {
    if (!duo || !duo.info) return;
    audio(); sClick(); haptic(8);
    const url = window.KiffDuo.link(duo.info);
    const text = T('attente.message');
    report('partage', null, 'prevenir');
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: 'Kiff Kiff', text, url }); } catch (e) { /* annulé */ }
      return;
    }
    let ok = false;
    try { await navigator.clipboard.writeText(text + ' ' + url); ok = true; } catch (e) { ok = false; }
    flashPresence(ok ? T('attente.copie') : T('attente.copie-impossible'));
  });
  // L’attente : revenir à l’accueil en attendant, ou d’abord installer l’appli pour être averti·e
  // L’action du moment : les roues, ou l’envie à lire
  $('#wait-go').addEventListener('click', () => { audio(); sClick(); haptic(8); report('attente', null, 'action'); const offre = actionGo === 'offre'; closePartie(); if (offre) showTurnModal(); });
  // En haut à gauche : l’accueil ; depuis la fête, le retour à la fête
  $('#wait-home').addEventListener('click', () => {
    audio(); sClick(); haptic(8);
    if (partieFront) { closePartie(); return; }
    if (duo && duo.stage === 'invite') { report('attente', null, 'accueil'); leaveDuo(false, true); return; }
    report('attente', null, 'accueil'); closePartie(); el.home.click();
  });
  $('#wait-install').addEventListener('click', () => { audio(); sClick(); haptic(8); save('installAsked', true); report('attente', null, 'installer'); installer.run(); renderWait(); });
  // Un mot bref à la place de la ligne de présence (copie, avertissements), puis elle revient
  function flashPresence(t) {
    presenceFlash = t;
    clearTimeout(flashT);
    flashT = setTimeout(() => { presenceFlash = ''; renderDuoStatus(); }, 3200);
    renderDuoStatus();
  }
  // M’avertir : un seul bouton à cloche qui s’allume ou s’éteint (comme le son)
  // M’avertir : la même cloche sur l’écran d’attente et sur l’invitation (savoir quand l’autre a rejoint)
  const pushChanged = () => { if (duo && duo.stage === 'invite') pushState(); else sync(); };
  async function toggleNotif(btn) {
    if (!KP) return;
    audio(); sClick(); haptic(8);
    if (pushStatus === 'install') {
      note(T('avertir.iphone'), T('avertir.iphone-texte'));
      return;
    }
    // L’autorisation a pu changer dans les réglages entre-temps : on relit avant de conclure
    if (pushStatus === 'blocked') pushStatus = await KP.status();
    if (pushStatus === 'blocked') {
      renderDuoStatus();
      note(T('avertir.bloques'), blockedHelp());
      return;
    }
    if (pushStatus === 'on') {
      await KP.disable();
      pushMine = null;
      pushStatus = 'off';
      pushChanged();
      flashPresence(T('avertir.coupes'));
      return;
    }
    btn.disabled = true;
    const res = await KP.enable();
    btn.disabled = false;
    const sub = res && res.sub;
    if (res && res.erreur && res.erreur !== 'refus') {
      report('notif', null, 'erreur-' + res.erreur);
      if (res.erreur === 'attente') {
        // La demande du téléphone n’a pas abouti (sur Android, un filtre d’écran ou une bulle par-dessus bloque souvent le bouton)
        note(T('avertir.autoriser'), T('avertir.autoriser-texte'));
        renderDuoStatus();
        return;
      }
      note(T('avertir.indisponibles'), res.erreur === 'cle' ? T('avertir.service') : T('avertir.navigateur'));
      renderDuoStatus();
      return;
    }
    if (sub) {
      pushMine = sub;
      pushStatus = 'on';
      report('notif', null, 'activee');
      pushChanged();
      flashPresence(T('avertir.ok'));
      return;
    }
    pushStatus = await KP.status();
    if (pushStatus === 'blocked') note(T('avertir.bloques'), blockedHelp());
    renderDuoStatus();
  }
  // Où débloquer, selon le téléphone : sur Android, c’est Chrome qui garde l’autorisation du site
  function blockedHelp() {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return T('avertir.bloques-android');
    if (KP.ios) return T('avertir.bloques-iphone');
    return T('avertir.bloques-autre');
  }
  $('#wait-notif').addEventListener('click', (e) => toggleNotif(e.currentTarget));
  $('#duo-notif').addEventListener('click', (e) => toggleNotif(e.currentTarget));
  document.addEventListener('visibilitychange', () => {
    const vis = document.visibilityState === 'visible';
    if (duo && duo.conn) { duo.conn.here(vis); if (vis) duo.conn.wake(); }
    if (vis) { refreshPush(); checkVersion(); }
  });
  // Une nouvelle version du jeu est en ligne : on la charge en revenant dans l’appli,
  // quand rien ne se perd (accueil, ou partie à deux, qui se retrouve telle quelle)
  const myV = (/app\.js\?v=(\d+)/.exec((Array.from(document.scripts).find((x) => /app\.js/.test(x.src)) || {}).src || '') || [])[1] || '';
  let verT = 0;
  function checkVersion() {
    if (!myV || Date.now() - verT < 60000 || navigator.onLine === false) return;
    verT = Date.now();
    fetch('./', { cache: 'no-store' }).then((r) => (r.ok ? r.text() : '')).then((html) => {
      const v = (/app\.js\?v=(\d+)/.exec(html) || [])[1];
      if (!v || v === myV || document.visibilityState !== 'visible') return;
      if ((duo && duo.stage === 'game') || (!duo && !S.started)) location.reload();
    }).catch(() => {});
  }
  // Toucher un avertissement alors que l’appli est déjà ouverte : on va à la partie
  const goToGame = (room, kf) => {
    if (!room || !findGame(room)) return;
    report('notif', null, kf ? 'ouverte-message' : 'ouverte');
    pendingKiff = kf || '';
    if (duo && duo.info && duo.info.room === room && duo.stage === 'game') { hide(ovGames); hide(el.ovStart); showTurnModal(); renderWait(); pullBox(true).then(openPendingKiff); return; }
    hide(ovGames);
    openGame(room);
  };
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.kk === 'jouer') goToGame(e.data.r, e.data.kf); });
  window.addEventListener('online', () => { if (duo && duo.conn) duo.conn.wake(); });

  /* ---------- Atelier en ligne : comptes anonymes et mots modifiés ---------- */
  const API = window.KIFF_API || '';
  // Ce qui est envoyé : le type d’événement et, pour une envie ou un kiff kiff, le mot de chaque roue.
  // Jamais de prénom ni de texte écrit à la main.
  // detail : une variante courte (« un », « deux », « 123 »…), jamais une donnée de personne
  // Les comptes partent groupés : une seule requête par moment de jeu (moins d’appels au script)
  let queue = [], queueT = 0;
  /* Les robots (moteurs de recherche, aperçus de liens, tests automatiques) ne comptent pas.
     On les reconnaît à leur nom, aux marques des navigateurs pilotés par programme ;
     et rien ne part avant un signe de vie humain (un toucher, une touche, un défilement) ou 8 secondes à l’écran. */
  const BOT_UA = /[a-z]bot\/|\bbot\b|\+https?:\/\/|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|facebookexternalhit|embedly|preview|yandex|baidu|semrush|ahrefs|python|curl|wget|httpclient|axios|node-fetch|go-http|java\/|phantomjs|selenium|puppeteer|playwright/i;
  const isBot = (() => {
    try {
      const ua = navigator.userAgent || '';
      // Le téléphone de Marc (réglé dans l’atelier, ou ?compte=non) ne compte pas
      const q = new URLSearchParams(location.search).get('compte');
      if (q === 'non') localStorage.setItem('roue:sanscompte', '1');
      if (q === 'oui') localStorage.removeItem('roue:sanscompte');
      if (localStorage.getItem('roue:sanscompte') === '1') return true;
      return !ua || BOT_UA.test(ua) || navigator.webdriver === true || (navigator.languages && navigator.languages.length === 0) || document.visibilityState === 'prerender';
    } catch (e) { return false; }
  })();
  let human = false, humanT = 0;
  const isHuman = () => {
    if (human) return;
    human = true; clearTimeout(humanT);
    ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'].forEach((ev) => window.removeEventListener(ev, isHuman, true));
    if (queue.length && !queueT) queueT = setTimeout(flushReports, 600);
  };
  ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'].forEach((ev) => window.addEventListener(ev, isHuman, { capture: true, passive: true }));
  const humanTimer = () => { if (!human && document.visibilityState === 'visible') humanT = setTimeout(isHuman, 8000); };
  humanTimer();
  document.addEventListener('visibilitychange', () => { clearTimeout(humanT); humanTimer(); });
  function flushReports() {
    clearTimeout(queueT); queueT = 0;
    if (!API || !queue.length || isBot || !human) return;
    const liste = queue.splice(0, 30);
    try {
      fetch(API, { method: 'POST', mode: 'no-cors', keepalive: true, body: JSON.stringify({ action: 'events', liste }) }).catch(() => {});
    } catch (e) { /* rien */ }
    if (queue.length) flushReports();
  }
  function report(type, choix, detail) {
    if (!API || isBot) return;
    queue.push({ type, choix: choix || null, detail: detail || null });
    if (!queueT) queueT = setTimeout(flushReports, 2500);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushReports(); });
  window.addEventListener('pagehide', flushReports);
  const once = new Set(); // certains événements une seule fois par ouverture
  const reportOnce = (type, detail) => { const k = type + ':' + (detail || ''); if (once.has(k)) return; once.add(k); report(type, null, detail); };
  function choiceLabels() {
    return [0, 1, 2].map((r) => {
      const x = LISTS[r][S.idx[r]];
      if (!x || x.free || x.m) return '(texte libre)';
      return x.s || x.t || '';
    });
  }
  function validMots(m) {
    const ok = (l, act) => Array.isArray(l) && l.length > 2 && l.every((x) => x && (act ? typeof x.s === 'string' && typeof x.i === 'string' : typeof (x.t || x.s) === 'string'));
    return !!m && ok(m.actions, true) && ok(m.objets) && ok(m.manieres);
  }
  let pendingMots = null;
  // Les mots et les textes de l’atelier : demandés à l’ouverture, puis en revenant dans l’appli (toutes les 2 minutes au plus)
  function fetchSheet(ms) {
    const ctl = window.AbortController ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), ms) : 0;
    return fetch(API + '?action=mots', ctl ? { signal: ctl.signal } : {})
      .then((r) => r.json())
      .then((res) => {
        clearTimeout(t);
        if (res && res.meilleurs && typeof res.meilleurs === 'object') { save('meilleurs', res.meilleurs); }
        if (res && res.ok && validMots(res.mots) && res.version !== window.KIFF_MOTS_VERSION) {
          save('mots', { api: API, version: res.version, mots: res.mots });
          pendingMots = res;
          if (!S.started && !duo && reels.length) applyPendingMots();
        }
        if (res && res.textes && typeof res.textes === 'object') receiveTexts(res.textes, res.versionTextes || '');
      })
      .catch(() => { clearTimeout(t); });
  }
  let sheetT = Date.now();
  const motsReady = new Promise((resolve) => {
    if (!API) { resolve(); return; }
    setTimeout(resolve, 6000);
    fetchSheet(6000).then(resolve);
  });
  document.addEventListener('visibilitychange', () => {
    if (!API || document.visibilityState !== 'visible' || Date.now() - sheetT < 120000) return;
    sheetT = Date.now();
    fetchSheet(10000);
  });
  /* Les textes changés dans l’atelier : gardés pour la prochaine ouverture du jeu (config.js les pose avant tout) */
  function receiveTexts(tx, version) {
    if (version && version === window.KIFF_TEXTES_VERSION) return;
    const base = window.KIFF_TX_BASE || {};
    const clean = {};
    Object.keys(tx).forEach((k) => { if (Object.prototype.hasOwnProperty.call(base, k) && typeof tx[k] === 'string') clean[k] = tx[k].slice(0, 3000); });
    save('textes', { api: API, version, textes: clean });
    const notif = {};
    Object.keys(base).filter((k) => k.startsWith('notifs.')).forEach((k) => { notif[k] = typo(k in clean ? clean[k] : base[k]); });
    shareNotifTexts(notif);
    // Personne ne joue encore (l’accueil, rien d’écrit) : on recharge pour montrer les nouveaux textes tout de suite.
    // Sinon, ils arrivent à la prochaine ouverture du jeu.
    const ae = document.activeElement;
    const calm = version && !S.started && !duo && el.ovStart && !el.ovStart.hidden && ($('#steps').dataset.step || '0') === '0' && !(ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName));
    if (calm && document.visibilityState === 'visible') location.reload();
  }
  // Les avertissements sont écrits par le service worker : il lit leurs textes dans une petite réserve
  function shareNotifTexts(notif) {
    if (!window.caches) return;
    if (!notif) { notif = {}; Object.keys(TX).filter((k) => k.startsWith('notifs.')).forEach((k) => { notif[k] = T(k); }); }
    caches.open('kiffkiff-textes').then((c) => c.put('./textes-notifs.json', new Response(JSON.stringify(notif), { headers: { 'Content-Type': 'application/json' } }))).catch(() => {});
  }
  function applyPendingMots() {
    if (!pendingMots) return;
    const res = pendingMots;
    pendingMots = null;
    D.actions = res.mots.actions; D.objets = res.mots.objets; D.manieres = res.mots.manieres;
    window.KIFF_MOTS_VERSION = res.version;
    const norm = (l) => l.map((x) => (typeof x === 'string' ? { t: x } : x));
    SOURCE[0] = norm(D.actions); SOURCE[1] = norm(D.objets); SOURCE[2] = norm(D.manieres);
    buildLists(S.levels);
    S.idx = LISTS.map((l) => Math.floor(Math.random() * (l.length - 1)));
    S.custom = ['', '', ''];
    reels.forEach((rl, r) => { rl.stop(); rl.p = S.idx[r]; rl.lastTick = S.idx[r]; });
    DATA_V = dataVersion();
    renderReels();
    render();
  }

  /* ---------- Démarrage ---------- */
  function init() {
    applyTexts();
    // Version gratuite : pas de Brûlant gardé d’une partie d’avant
    if (!isComplet() && S.levels.includes(3)) { S.levels = S.levels.filter((n) => n < 3); if (!S.levels.length) S.levels = [1, 2]; buildLists(S.levels); }
    shareNotifTexts();
    S.idx = LISTS.map((l) => Math.floor(Math.random() * (l.length - 1)));
    reels = [0, 1, 2].map((r) => new Reel(r));
    renderReels();
    render();

    applySkin(currentSkin());
    /* Piment : niveaux à cocher, depuis l’accueil ou le jeu */
    const ovPiment = $('#ov-piment');
    // Les mêmes trois niveaux à cocher : sur l’écran d’accueil et dans la fenêtre du jeu
    let brulantOk = false; // remis à zéro à chaque nouvelle partie sur un téléphone
    const pimentList = (list, err) => {
      list.innerHTML = D.niveaux.map((lv) =>
        '<label class="piment-toggle"><input type="checkbox" value="' + lv.n + '">' +
        '<span class="piment-toggle-body"><span class="pgroup pgroup--' + lv.n + ' is-on">' + CHILI.repeat(lv.n) + '</span>' +
        '<span class="piment-toggle-text"><span class="piment-name">' + lv.nom + '</span><span class="piment-tdesc">' + lv.desc + '</span></span>' +
        '<span class="piment-check" aria-hidden="true"></span></span></label>'
      ).join('');
      list.querySelectorAll('input').forEach((c) => c.addEventListener('change', () => {
        audio();
        const next = [...list.querySelectorAll('input:checked')].map((x) => +x.value);
        if (!next.length) {
          c.checked = true;
          sNope(); haptic(20);
          err.hidden = false;
          clearTimeout(err._t);
          err._t = setTimeout(() => { err.hidden = true; }, 2400);
          return;
        }
        const apply = () => {
          sClick(); haptic(8);
          setLevels(next, { silent: S.phase === 'start' || !el.ovStart.hidden });
          if (!ovPiment.hidden) renderRouesEx();
        };
        if (+c.value === 3 && c.checked && !isComplet()) { c.checked = false; openComplet('brulant'); return; }
        // Sur un téléphone, Brûlant se coche à deux : on demande si tout le monde est d’accord
        if (+c.value === 3 && c.checked && !duo && !brulantOk) {
          c.checked = false;
          askBrulant(() => { c.checked = true; apply(); });
          return;
        }
        apply();
      }));
    };
    /* Brûlant sur un téléphone : une fois par partie, les deux disent qu’ils sont d’accord */
    const ovBrulant = $('#ov-brulant');
    let brulantYes = null, brulantNo = null, brulantFocus = null;
    const askBrulant = (yes, no) => {
      brulantYes = yes; brulantNo = no || null;
      brulantFocus = document.activeElement;
      show(ovBrulant);
      sSwitchOn(); haptic(20);
      $('#brulant-yes').focus({ preventScroll: true });
    };
    const closeBrulant = (ok) => {
      hide(ovBrulant);
      if (brulantFocus && brulantFocus.focus) brulantFocus.focus({ preventScroll: true });
      const go = ok ? brulantYes : brulantNo; brulantYes = brulantNo = null;
      if (ok) brulantOk = true;
      report('brulant', null, ok ? 'oui' : 'non');
      if (go) go();
    };
    $('#brulant-yes').addEventListener('click', () => { audio(); closeBrulant(true); });
    /* « Tout Kiff Kiff » : ce que le jeu complet ouvre ; pour l’instant, tout est gratuit, d’un geste */
    const ovComplet = $('#ov-complet');
    let completFrom = null;
    openComplet = (why) => {
      if (isComplet() || !ovComplet.hidden) return;
      audio(); sClick(); haptic(10);
      completFrom = document.activeElement;
      const total = SOURCE.reduce((n, l) => n + l.length, 0);
      const free = [0, 1, 2].reduce((n, r) => n + freePick(r, [1, 2]).length, 0);
      $('#complet-texte').textContent = T('complet.texte', { gratuit: free, total });
      $('#complet-liste').innerHTML = TL('complet.liste').map((x) => '<li><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>' + esc(x) + '</span></li>').join('');
      // La petite démonstration : une roue qui tourne sur des mots brûlants, une recherche qui se tape
      const hot = SOURCE[1].filter((x) => (x.lvl || 1) === 3).slice(0, 6).map((x) => x.t || x.s || '');
      $('#complet-roue').innerHTML = hot.concat(hot.slice(0, 2)).map((t) => '<span>' + esc(t) + '</span>').join('');
      show(ovComplet);
      report('complet', null, 'vue-' + why);
      $('#complet-oui').focus({ preventScroll: true });
    };
    const closeComplet = () => { hide(ovComplet); if (completFrom && completFrom.focus) completFrom.focus({ preventScroll: true }); };
    $('#complet-oui').addEventListener('click', () => {
      audio(); sSwitchOn(); haptic(20);
      save('complet', true);
      report('complet', null, 'debloque');
      hide(ovComplet);
      // Tout s’ouvre tout de suite : un nouveau tirage dans toute la réserve
      newDraw(); relist(); renderReels(); renderLevel(); renderTon(); render();
      if (duo && duo.stage === 'game') sync();
      flashHint(T('complet.merci'), 3000);
    });
    $('#complet-non').addEventListener('click', () => { audio(); report('complet', null, 'plus-tard'); closeComplet(); });
    ovComplet.addEventListener('click', (e) => { if (e.target === ovComplet) closeComplet(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ovComplet.hidden) closeComplet(); });
    $('#brulant-no').addEventListener('click', () => { audio(); haptic(10); closeBrulant(false); });
    ovBrulant.addEventListener('click', (e) => { if (e.target === ovBrulant) closeBrulant(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ovBrulant.hidden) closeBrulant(false); });
    pimentList($('#piment-list'), $('#piment-error'));
    pimentList($('#piment-home-list'), $('#piment-home-error'));
    $('#piment-go').addEventListener('click', () => {
      audio(); sSwitchOn(); haptic(12);
      if (where === 'duo') createDuo(S.names[0] || '', invName);
      // Brûlant gardé de la dernière fois : on le confirme à deux avant de commencer
      else if (S.levels.includes(3) && !brulantOk) askBrulant(launchGame, () => setLevels(S.levels.filter((n) => n !== 3).length ? S.levels.filter((n) => n !== 3) : [2], { silent: true }));
      else launchGame();
    });
    renderLevel();
    let pimentFrom = null;
    let rouesAvant = '';
    const rouesSig = () => S.levels.join('') + S.ton;
    const openPiment = (from) => {
      pimentFrom = from;
      rouesAvant = rouesSig();
      renderLevel();
      renderTon();
      renderRouesEx();
      $('#piment-error').hidden = true;
      renderPimentDuo();
      show(ovPiment);
      const c = ovPiment.querySelector('input');
      if (c) c.focus({ preventScroll: true });
    };
    $('#piment-open').addEventListener('click', () => {
      audio();
      if (S.phase !== 'compose' || !myTurn()) {
        sNope(); haptic(20);
        flashHint(T('roues.refus'));
        return;
      }
      openPiment($('#piment-open'));
    });
    const closePiment = () => {
      hide(ovPiment);
      // Le réglage a changé : les roues tournent sur leur nouveau tirage, et on dit ce qu’elles tirent
      if (rouesAvant && rouesSig() !== rouesAvant && S.phase === 'compose' && myTurn()) {
        setTimeout(() => shuffle(false), 120);
        flashHint(T('roues.apres', { piment: levelNames(), ton: TON_TXT[S.ton] }));
      }
      rouesAvant = '';
      if (S.mustRestart) { $('#resume').hidden = true; $('#welcome-go').textContent = T('accueil.nouvelle'); }
      if (pimentFrom) pimentFrom.focus({ preventScroll: true });
    };
    $('#piment-done').addEventListener('click', closePiment);
    ovPiment.addEventListener('click', (e) => { if (e.target === ovPiment) closePiment(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ovPiment.hidden) closePiment(); });
    document.querySelectorAll('input[name="skin"]').forEach((r) => {
      r.checked = r.value === currentSkin();
      r.addEventListener('change', () => { if (r.checked) { audio(); applySkin(r.value); sClick(); haptic(8); } });
    });
    const ovSkins = $('#ov-skins');
    $('#skin-open').addEventListener('click', () => {
      audio();
      document.querySelectorAll('input[name="skin"]').forEach((r) => { r.checked = r.value === currentSkin(); });
      show(ovSkins);
      const checked = ovSkins.querySelector('input:checked');
      if (checked) checked.focus({ preventScroll: true });
    });
    const closeSkins = () => { hide(ovSkins); $('#skin-open').focus({ preventScroll: true }); };
    $('#skins-done').addEventListener('click', closeSkins);
    ovSkins.addEventListener('click', (e) => { if (e.target === ovSkins) closeSkins(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ovSkins.hidden) closeSkins(); });
    $('#name0').value = S.names[0] || '';
    $('#name1').value = S.names[1] || '';
    const readNames = () => {
      S.names = [$('#name0').value.trim(), $('#name1').value.trim()];
      save('names', S.names);
      document.activeElement && document.activeElement.blur();
    };
    /* Accueil en quatre écrans : accueil → joueurs → principe → piment → la partie commence */
    // Une nouvelle partie ne touche pas aux autres : celle qui était ouverte attend dans la liste
    $('#welcome-go').addEventListener('click', () => { audio(); sClick(); haptic(8); if (duo) parkDuo(); brulantOk = false; goStep(1); });
    // L’autre joue sur ce téléphone (on écrit son prénom) ou sur le sien (on l’invitera)
    const setWhere = (w) => {
      where = w;
      document.querySelectorAll('.where-btn').forEach((b) => b.setAttribute('aria-pressed', b.dataset.where === w ? 'true' : 'false'));
      // À distance aussi, un prénom pour l’autre : on retrouve l’invitation, et l’autre pourra le changer
      $('#name1-label').textContent = T(w === 'here' ? 'joueurs.son-prenom' : 'joueurs.son-prenom-distance');
      renderFirst();
    };
    // Qui découvre le jeu sur ce téléphone : une ligne le dit, et le principe lui sera montré
    function newcomers() {
      const n0 = $('#name0').value.trim(), n1 = $('#name1').value.trim();
      const out = [];
      if (n0 && !(isKnown(n0) || (load('rulesSeen', false) && !knownList().length))) out.push(n0);
      if (where === 'here' && n1 && !isKnown(n1)) out.push(n1);
      return out;
    }
    function renderFirst() {
      const nw = newcomers();
      const show = nw.length > 0 && (where === 'here' || !load('rulesSeen', false));
      $('#first-note').hidden = !show;
      const me = nw[0] === $('#name0').value.trim();
      if (show) $('#first-note-text').textContent = nw.length > 1 ? T('joueurs.premiere-deux') : me ? T('joueurs.premiere-toi') : T('joueurs.premiere', { prénom: nw[0] });
    }
    $('#name0').addEventListener('input', renderFirst);
    $('#name1').addEventListener('input', renderFirst);
    setWhere(load('where', 'here') === 'duo' ? 'duo' : 'here');
    const toRules = () => {
      if (needName($('#name0'))) return;
      if (where === 'here' && needName($('#name1'))) return;
      const nw = newcomers();
      readNames();
      invName = where === 'duo' ? S.names[1] : '';
      if (where === 'duo') S.names[1] = '';
      // La deuxième personne propose en premier
      $('#rule-a').textContent = where === 'duo' ? T('principe.autre') : nameOf(1);
      $('#rule-b').textContent = nameOf(0);
      $('#piment-go').textContent = where === 'duo' ? T('depart.go-distance') : T('depart.go');
      // À distance, le piment se débloque en jouant : on le montre au lieu de le choisir
      const prog = where === 'duo';
      $('#pick-title').textContent = prog ? T('depart.titre-distance') : T('depart.titre');
      $('#pick-text').textContent = prog ? T('depart.texte-distance') : T('depart.texte');
      $('#piment-home-list').hidden = prog;
      $('#piment-prog').hidden = !prog;
      if (prog) {
        const when = [T('depart.tendre-distance'), T('roues.verrou-2'), T('roues.verrou-3')];
        $('#piment-prog').innerHTML = D.niveaux.map((lv, i) => '<div class="piment-toggle' + (i ? ' is-locked' : '') + '"><span class="piment-toggle-body">' +
          '<span class="pgroup pgroup--' + lv.n + ' is-on">' + CHILI.repeat(lv.n) + '</span><span class="piment-toggle-text"><span class="piment-name">' + lv.nom + '</span>' +
          '<span class="piment-tdesc">' + when[i] + '</span></span></span></div>').join('');
      } else if (S.levels.join() !== parseLevels(load('levels', [1, 2])).join()) setLevels(load('levels', [1, 2]), { silent: true, remote: true });
      $('#rencontre-box').hidden = true;
      save('where', where);
      sClick(); haptic(8);
      // Qui a déjà joué connaît le principe : on va droit aux piments (« Retour » le remontre).
      // Quelqu’un découvre le jeu sur ce téléphone : le principe d’abord.
      const first = nw.length > 0 && (where === 'here' || !load('rulesSeen', false));
      $('#principe-kicker').hidden = !(first && where === 'here');
      $('#principe-kicker').textContent = T('principe.kicker', { prénom: nameOf(0), autre: nameOf(1) });
      goStep(!load('rulesSeen', false) || first ? 2 : 3);
    };
    document.querySelectorAll('.where-btn').forEach((b) => b.addEventListener('click', () => {
      audio();
      setWhere(b.dataset.where);
      // Dans les deux cas, on écrit ensuite le prénom de l’autre (à distance : pour retrouver l’invitation)
      sClick(); haptic(8);
      setTimeout(() => $('#name1').focus(), 60);
    }));
    $('#name0').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); $('#name1').focus(); }
    });
    $('#start-form').addEventListener('submit', (e) => { e.preventDefault(); audio(); toRules(); });
    $('#rules-ok').addEventListener('click', () => { audio(); sClick(); haptic(8); save('rulesSeen', true); goStep(3); });
    // Mode rencontre : on commence en Tendre, l’invitation le dit
    $('#rencontre').addEventListener('change', (e) => {
      audio();
      S.rencontre = e.target.checked;
      if (S.rencontre) setLevels([1], { silent: true });
    });
    homeSteps = makeSteps($('#steps'), $('#step-dots'), el.ovStart);
    renderLevel();
    // Reprendre la partie : garde le tour en cours, applique les prénoms éventuellement changés
    $('#resume').addEventListener('click', () => {
      audio();
      readNames();
      hide(el.ovStart);
      render();
    });
    // Retour à l’accueil depuis le jeu
    el.home.addEventListener('click', () => { audio(); openHome(); });
    // Deux téléphones
    $('#duo-resume').addEventListener('click', () => {
      audio();
      hide(el.ovStart);
      showTurnModal();
      renderWait();
    });
    $('#duo-quit').addEventListener('click', () => {
      audio();
      if (!quitT) { quitArmed(true); sClick(); haptic(8); return; }
      quitArmed(false);
      leaveDuo(true);
    });
    goStep(0, true);
    renderHome();
    setTimeout(() => { refreshGames(); peekBoxes(); }, 300);
    const inv = window.KiffDuo && window.KiffDuo.parse(location.hash);
    const installed = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    reportOnce('visite', inv ? (findGame(inv.room) ? 'reprise' : 'invitation') : (installed ? 'installee' : 'web'));
    let fromNotif = '';
    let fromKiff = '';
    try { fromNotif = new URLSearchParams(location.search).get('jouer') || ''; fromKiff = new URLSearchParams(location.search).get('kiff') || ''; } catch (e) { /* rien */ }
    if (fromNotif) { try { const u = new URL(location.href); u.searchParams.delete('jouer'); u.searchParams.delete('kiff'); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (e) { /* rien */ } }
    if (inv) startJoin(inv);
    else if (fromNotif && findGame(fromNotif)) { report('notif', null, fromKiff ? 'ouverte-message' : 'ouverte'); pendingKiff = /^\d{6,16}$/.test(fromKiff) ? fromKiff : ''; openGame(fromNotif); }
    else { renderGames(); refreshGames(); }
    refreshPush();
  }

  /* ---------- Accueil : écrans successifs ---------- */
  let where = 'here';
  let invName = ''; // le prénom donné à la personne invitée (l’autre pourra le changer)
  /* Les prénoms qui ont déjà joué sur ce téléphone (en minuscules) : les autres découvrent le jeu */
  function knownList() {
    let k = load('connus', null);
    if (!Array.isArray(k)) {
      // Avant le 27 octobre 2026 : les paires de prénoms déjà jouées, et soi-même
      k = [];
      Object.keys(load('paires', {}) || {}).forEach((key) => key.split('|').forEach((n) => { if (n) k.push(n); }));
      if (load('rulesSeen', false)) { const n = (load('names', ['', ''])[0] || '').trim().toLowerCase(); if (n) k.push(n); }
      const d = (load('duoName', '') || '').trim().toLowerCase(); if (d) k.push(d);
      k = [...new Set(k)];
    }
    return k;
  }
  const isKnown = (n) => knownList().includes(String(n || '').trim().toLowerCase());
  function addKnown(...names) {
    const k = knownList();
    names.forEach((n) => { n = String(n || '').trim().toLowerCase(); if (n && !k.includes(n)) k.push(n); });
    save('connus', k.slice(-60));
  }
  /* Écrans qui glissent : un « paquet » d’écrans (#steps, #inv-steps), ses points et son fond */
  function makeSteps(box, dots, ov) {
    const track = box.querySelector('.steps-track');
    const st = { cur: 0, go };
    function go(n, instant) {
      st.cur = n;
      if (instant) box.classList.add('is-instant');
      box.style.setProperty('--step', n);
      box.dataset.step = n;
      box.querySelectorAll('.step').forEach((sec) => {
        const on = +sec.dataset.step === n;
        sec.inert = !on;
        sec.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      dots.querySelectorAll('i').forEach((d, k) => d.classList.toggle('is-on', k === n));
      dots.dataset.step = n; // l’accueil (écran 0) n’a pas de points : ils commencent avec la nouvelle partie
      ov.scrollTop = 0;
      box.querySelectorAll('.step').forEach((x) => { if (+x.dataset.step === n) x.scrollTop = 0; });
      if (instant) { void box.offsetWidth; box.classList.remove('is-instant'); }
    }
    // Glisser le doigt vers la droite ramène à l’écran précédent (le doigt entraîne l’écran)
    let sx = 0, sy = 0, dx = 0, on = false, decided = false, horiz = false;
    box.addEventListener('touchstart', (e) => {
      // Le premier écran ne glisse pas (l’accueil : glisser une partie vers la gauche la supprime)
      if (e.touches.length !== 1 || st.cur === 0) { on = false; return; }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
      dx = 0; on = true; decided = false; horiz = false;
    }, { passive: true });
    box.addEventListener('touchmove', (e) => {
      if (!on) return;
      const ddx = e.touches[0].clientX - sx, ddy = e.touches[0].clientY - sy;
      if (!decided) {
        if (Math.abs(ddx) < 10 && Math.abs(ddy) < 10) return;
        decided = true;
        horiz = Math.abs(ddx) > Math.abs(ddy) * 1.3;
        if (horiz) box.classList.add('is-dragging');
      }
      if (!horiz) return;
      // vers la droite : on suit le doigt (avec résistance au premier écran) ; vers la gauche : on résiste
      dx = ddx > 0 ? (st.cur === 0 ? ddx / 4 : ddx) : ddx / 5;
      track.style.transform = 'translateX(calc(' + (-st.cur * 100) + '% + ' + dx.toFixed(1) + 'px))';
    }, { passive: true });
    const end = () => {
      if (!on) return;
      on = false;
      if (!horiz) return;
      box.classList.remove('is-dragging');
      track.style.transform = '';
      if (dx > Math.min(90, box.clientWidth * 0.22) && st.cur > 0) { audio(); sClick(); haptic(8); go(st.cur - 1); }
    };
    box.addEventListener('touchend', end);
    box.addEventListener('touchcancel', end);
    box.querySelectorAll('.step-back').forEach((b) => b.addEventListener('click', () => { audio(); go(Math.max(0, st.cur - 1)); }));
    return st;
  }
  let homeSteps = null;
  const goStep = (n, instant) => homeSteps.go(n, instant);
  function launchGame() {
    applyPendingMots();
    report('partie', null, 'un');
    report('piment', null, S.levels.join(''));
    S.t0 = Date.now();
    save('iciT', Date.now());
    hide(el.ovStart);
    S.kiff = null;
    S.kept = [[], [], []]; newDraw();
    const mem = (load('paires', {}) || {})[pairKey()];
    S.ton = tonOf(mem); // le ton comme vous l’avez laissé
    renderTon();
    setMemory(mem); // vos mots et ce que vous vous êtes déjà proposé
    // vos kiff kiff, dont les envies gardées pour plus tard
    S.kiffs = mem && Array.isArray(mem.kiffs) ? mem.kiffs.filter((k) => k && typeof k.t === 'string').slice(-60) : [];
    renderKiffs();
    S.started = true;
    S.mustRestart = false;
    // La deuxième personne propose en premier : on lui passe le téléphone
    S.proposer = 1;
    S.phase = 'compose';
    render();
    save('rulesSeen', true);
    addKnown(S.names[0], S.names[1]);
    savePair(); // la partie rejoint la liste de l’accueil
    handoffNewTurn(1, T('passage.premier'), () => setTimeout(() => shuffle(false, true), 250));
  }
  /* Les parties sur ce téléphone : chaque paire de prénoms garde sa partie (paires), on la retrouve à l’accueil */
  const capName = (n) => n.replace(/(^|[\s-])(\S)/g, (m, a, b) => a + b.toUpperCase());
  function icis() {
    const all = load('paires', {}) || {};
    const month = Date.now() - 30 * 864e5;
    return Object.keys(all).map((key) => {
      const m = all[key];
      if (!m || typeof m !== 'object') return null;
      // Avant le 26 octobre 2026, les prénoms n’étaient pas gardés : on les reprend de la clé
      const legacy = !Array.isArray(m.names);
      if (legacy && !((m.kiffs || []).length && (m.t || 0) > month)) return null;
      if (!legacy && !m.live) return null;
      const names = legacy ? key.split('|').map(capName) : m.names.slice(0, 2).map((n) => String(n || '').slice(0, 20));
      return { key, names, p: m.p === 0 ? 0 : 1, t: m.t || 1, nk: (m.kiffs || []).length, mem: m };
    }).filter(Boolean);
  }
  // Rouvrir une partie sur ce téléphone : mêmes prénoms, même piment, au tour de qui devait proposer
  function openIci(key) {
    const it = icis().find((x) => x.key === key);
    if (!it) return;
    if (duo) parkDuo();
    if (!duo && S.started && !S.mustRestart && pairKey() === key) { $('#resume').click(); return; }
    S.started = false;
    S.names = it.names.slice();
    save('names', S.names);
    $('#name0').value = S.names[0]; $('#name1').value = S.names[1];
    if (Array.isArray(it.mem.lv) && it.mem.lv.length) setLevels(parseLevels(it.mem.lv), { silent: true });
    applyPendingMots();
    S.t0 = Date.now();
    hide(el.ovStart);
    S.kiff = null;
    S.kept = [[], [], []]; newDraw();
    S.ton = tonOf(it.mem); renderTon();
    setMemory(it.mem);
    S.kiffs = Array.isArray(it.mem.kiffs) ? it.mem.kiffs.filter((k) => k && typeof k.t === 'string').slice(-60) : [];
    renderKiffs();
    S.started = true;
    S.mustRestart = false;
    S.proposer = it.p;
    S.phase = 'compose';
    render();
    handoffNewTurn(it.p, T('passage.texte'), () => setTimeout(() => shuffle(false, true), 250));
  }
  function forgetIci(key) {
    const all = load('paires', {}) || {};
    delete all[key];
    save('paires', all);
    if (!duo && S.started && pairKey() === key) { S.started = false; S.phase = 'start'; $('#resume').hidden = true; }
  }

  /* Accueil : les parties à deux en cours, avec à qui c’est le tour */
  function renderGames() {
    const box = $('#games');
    const cur = duo && duo.stage === 'game' && duo.info ? duo.info.room : '';
    const rank = { kiff: -1, me: 0, party: 1, other: 2, lobby: 3 };
    const fresh = (g) => (g.kiff || 0) > kiffSeen(g.room);
    const key = (g) => rank[fresh(g) ? 'kiff' : g.turn] ?? 2;
    const list = games().filter((g) => g.room !== cur)
      .sort((a, b) => (key(a) - key(b)) || ((b.t || 0) - (a.t || 0)));
    box.hidden = !list.length;
    // Dès la première partie, elles passent derrière « Parties à distance » (discret si on joue avec quelqu’un à côté)
    const many = list.length > 0;
    const hot = list.filter((g) => fresh(g) || g.turn === 'me').length;
    $('#games-title').hidden = many;
    $('#games-list').hidden = many;
    $('#games-open').hidden = !many;
    $('#games-open-n').textContent = T('parties.nombre', { nombre: list.length });
    $('#games-badge').hidden = !hot;
    $('#games-badge').textContent = hot;
    $('#games-open').setAttribute('aria-label', 'Parties à distance : ' + list.length + ' partie' + (list.length > 1 ? 's' : '') + (hot ? ', ' + hot + ' où c’est à toi' : ''));
    if (!many && !$('#ov-games').hidden) hide($('#ov-games'));
    const html = list.map((g) => {
      const B = ((g.names || [])[1 - g.seat] || '').trim();
      const who = B ? T('parties.avec', { prénom: B }) : (g.seat === 0 ? T('parties.invitation') : T('parties.a-deux'));
      const armed = stopArmed === g.room;
      const Bo = B || T('parties.l-autre');
      const turn = armed ? T('parties.confirmer', { prénom: Bo })
        : fresh(g) ? T('parties.kiff-neuf')
        : g.turn === 'me' ? T('parties.a-toi')
        : g.turn === 'party' ? T('parties.kiff')
        : g.turn === 'lobby' ? (g.seat === 0 ? T('parties.personne') : T('parties.a-rejoindre'))
        : T('parties.tour', { prénom: Bo });
      return '<li class="game' + (g.turn === 'me' || fresh(g) ? ' is-mine' : '') + (fresh(g) ? ' is-kiff' : '') + '"><button class="game-btn" type="button" data-room="' + esc(g.room) + '">' +
        '<span class="game-who">' + esc(who) + (g.nk ? '<span class="game-count"> · ' + TH('parties.kiffs', { nombre: g.nk }) + '</span>' : '') + '</span><span class="game-turn">' + esc(turn) + '</span></button>' +
        '<button class="game-x' + (armed ? ' is-armed' : '') + '" type="button" data-forget="' + esc(g.room) + '" aria-label="' + (armed ? 'Confirmer : arrêter cette partie' : 'Arrêter cette partie') + '">×</button></li>';
    }).join('');
    $('#games-list').innerHTML = many ? '' : html;
    $('#games-sheet-list').innerHTML = many ? html : '';
  }
  // Les nouvelles des parties : la feuille garde la dernière étape de chacune
  let gamesT = 0;
  async function refreshGames() {
    const list = games();
    if (!list.length || !window.KiffDuo || Date.now() - gamesT < 4000) return;
    gamesT = Date.now();
    const found = await window.KiffDuo.storeLoad(list.map((g) => ({ room: g.room, key: g.key, broker: g.broker })));
    const next = games().map((g) => {
      const st = found[g.room];
      if (!st) return g;
      if (st.phase === 'ended') return null;
      // La photo de la partie suit la feuille : l’accueil et l’ouverture instantanée sont à jour
      const old = snapOf(g.room);
      const newer = !old || (st.seq || 0) > (old.seq || 0);
      if (newer) saveSnap(g.room, st);
      return Object.assign({}, g, newer && old ? { t: Date.now() } : {}, { names: (st.names || g.names || ['', '']).slice(0, 2), turn: turnFor(st, g.seat), kiff: st.kiff ? st.kiff.n : 0,
        nk: Math.max(Array.isArray(st.kiffs) ? st.kiffs.length : 0, st.kiff ? st.kiff.n : 0) });
    }).filter(Boolean);
    save('parties', next);
    if (!el.ovStart.hidden) { renderGames(); renderHome(); }
  }
  // La partie ouverte passe dans la liste : on se déconnecte sans rien annoncer
  function parkDuo() {
    if (!duo) return;
    const d = duo;
    duo = null;
    clearTimeout(syncT);
    if (d.conn) d.conn.close(false).catch(() => {});
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* rien */ }
    hide($('#ov-wait')); hide($('#ov-note')); hide(el.ovParty); stopConfetti();
    hideOffer(); hide(ovHot);
    S.lvOk = null; S.kiff = null; S.kiffs = []; S.rencontre = false; S.prog = false; S.gift = null; S.gifting = false; renderKiffs(); partyNormal();
    setLevels(load('levels', [1, 2]), { silent: true, remote: true }); // le piment choisi pour jouer sur un téléphone
    setMemory(null);
    S.started = false;
    S.phase = 'start';
    S.names = load('names', ['', '']);
    $('#name0').value = S.names[0] || '';
    $('#name1').value = S.names[1] || '';
    $('#steps').classList.remove('is-duo');
    $('#duo-home').hidden = true;
    $('#welcome-go').classList.remove('btn--line');
    // L’accueil redevient l’accueil normal : « Commencer », et la partie quittée rejoint la liste
    renderIntro();
    $('#welcome-go').textContent = T('accueil.commencer');
    $('#resume').hidden = true;
    renderDuoStatus();
    renderGames();
  }
  function openGame(room) {
    const g = findGame(room);
    if (!g) return;
    parkDuo();
    startJoin({ broker: g.broker, room: g.room, key: g.key });
  }
  const ovGames = $('#ov-games');
  let stopArmed = '', stopT = 0;
  // Arrêter une partie depuis la liste : on range l’étape « terminée » (relais et feuille), puis on l’oublie ici
  async function stopGame(room) {
    const g = findGame(room);
    forgetGame(room);
    renderGames();
    if (!g || !window.KiffDuo) return;
    const info = { broker: g.broker, room: g.room, key: g.key };
    try {
      const found = await window.KiffDuo.storeLoad([info]);
      const st = found[room];
      if (!st || st.phase === 'ended') return;
      const end = Object.assign({}, st, { phase: 'ended', endBy: g.seat, seq: (st.seq || 0) + 1, by: g.id || 'x' });
      await loadDuoLibs();
      const conn = await window.KiffDuo.join(info, g.seat, g.id || 'x', {});
      await conn.publishState(end);
      await conn.close(false);
    } catch (e) { /* hors ligne : la partie est au moins retirée d’ici */ }
  }
  const onGames = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    audio();
    // × : arrêter la partie (deux touchers) ; l’autre est prévenu·e et elle quitte les deux listes
    if (b.dataset.forget) {
      const room = b.dataset.forget;
      clearTimeout(stopT);
      if (stopArmed !== room) {
        stopArmed = room; sClick(); haptic(8); renderGames();
        stopT = setTimeout(() => { stopArmed = ''; renderGames(); }, 4000);
        return;
      }
      stopArmed = ''; haptic(20);
      stopGame(room);
      return;
    }
    sClick(); haptic(8);
    hide(ovGames);
    openGame(b.dataset.room);
  };
  $('#games-list').addEventListener('click', onGames);
  $('#games-sheet-list').addEventListener('click', onGames);
  $('#games-open').addEventListener('click', () => { audio(); sClick(); haptic(8); refreshGames(); show(ovGames); $('#games-close').focus({ preventScroll: true }); });
  /* ---------- L’accueil (26 octobre 2026) : la une, puis vos parties ----------
     La une : la partie qui a du nouveau (envie à lire, messages, kiff kiff), sinon la dernière jouée.
     Dessous, les autres parties : une ligne chacune, avec où elle en est ou son dernier message.
     Sans partie : le grand emblème, « Commencer », le principe en trois lignes. Le reste est dans le menu. */
  const peek = {}; // les messages qui attendent dans la boîte aux lettres, par partie (vus de l’accueil, pas encore lus)
  const initial = (n) => ((n || '').trim()[0] || '·').toUpperCase();
  function agoText(ms) {
    if (!ms) return '';
    const m = Math.round((Date.now() - ms) / 60000);
    if (m < 1) return T('accueil.a-l-instant');
    if (m < 60) return T('accueil.il-y-a-min', { nombre: m });
    const d = new Date(ms), t = new Date();
    if (d.toDateString() === t.toDateString()) return T('accueil.il-y-a-h', { nombre: Math.round(m / 60) });
    return dayLabel(ms).toLowerCase();
  }
  // Où en est une partie, vu de ce téléphone (seat) : ce qu’il faut faire, ou ce que fait l’autre
  function gameState(st, seat, B) {
    if (!st) return { me: false, line: '', go: 'ouvrir' };
    const ph = st.phase, mine = turnFor(st, seat) === 'me';
    if (ph === 'lobby') return { me: false, line: seat === 0 ? T('parties.personne') : T('parties.a-rejoindre'), go: 'ouvrir' };
    if (ph === 'celebrate') return { me: true, line: T('parties.kiff'), go: 'ouvrir' };
    if (mine) {
      if (ph === 'compose') return { me: true, line: T('partie.proposer'), go: 'tourner' };
      if (ph === 'review') return { me: true, line: T('partie.envie-recue', { prénom: B }), go: 'lire' };
      if (ph === 'reconfirm') return { me: true, line: T('partie.ajustee', { prénom: B }), go: 'relire' };
      return { me: true, line: T('partie.ajuster', { prénom: B }), go: 'reprendre' };
    }
    if (ph === 'compose') return { me: false, line: T('accueil.compose', { prénom: B }), go: 'ouvrir' };
    if (ph === 'review') return { me: false, line: T('accueil.lit', { prénom: B }), go: 'ouvrir' };
    if (ph === 'adjust') return { me: false, line: T('accueil.ajuste', { prénom: B }), go: 'ouvrir' };
    return { me: false, line: T('accueil.relit', { prénom: B }), go: 'ouvrir' };
  }
  function homeItems() {
    const cur = duo && duo.stage === 'game' && duo.info ? duo.info.room : '';
    const items = games().filter((g) => g.room !== cur).map((g) => {
      const Bn = ((g.names || [])[1 - g.seat] || '').trim();
      const B = Bn || T('parties.l-autre');
      const st = snapOf(g.room);
      const cb = chatBox(g.room);
      const msgs = cb.m.filter((m) => !m.x);
      const last = msgs[msgs.length - 1];
      const lu = (m) => Math.max(cb.lu['*'] || 0, cb.lu[m.k] || 0);
      const pk = peek[g.room] || { n: 0, last: null };
      const nu = msgs.filter((m) => m.s !== g.seat && m.d > lu(m)).length + pk.n;
      const lastMsg = pk.last && (!last || pk.last.d > last.d) ? pk.last : last;
      const state = st ? gameState(st, g.seat, B) : { me: g.turn === 'me', line: g.turn === 'me' ? T('parties.a-toi') : T('parties.tour', { prénom: B }), go: 'ouvrir' };
      const freshKiff = (g.kiff || 0) > kiffSeen(g.room);
      const news = state.me || nu > 0 || freshKiff;
      const t = Math.max(g.t || 0, lastMsg ? lastMsg.d : 0);
      const msgLine = lastMsg ? (lastMsg.s === g.seat ? T('chat.toi') : B) + ' : ' + lastMsg.t : '';
      return { kind: 'duo', g, B, state, nu, news, t, freshKiff, msgLine, lastMsg, nk: g.nk || 0, lobby: g.turn === 'lobby' && g.seat === 0,
        title: g.turn === 'lobby' && g.seat === 0 ? (Bn ? T('parties.invitation-a', { prénom: Bn }) : T('parties.invitation')) : B };
    });
    // Les parties sur ce téléphone (celle en cours comprise), retrouvées même après avoir fermé l’appli
    const here = !duo && S.started && !S.mustRestart ? pairKey() : '';
    icis().forEach((x) => {
      const p = x.key === here ? S.proposer : x.p;
      items.push({ kind: 'ici', key: x.key, title: T('partie.seul-titre', { prénom: x.names[0], autre: x.names[1] }), B: x.names[1],
        state: { me: false, line: T('accueil.ici', { prénom: x.names[p] }) }, nu: 0, news: false, t: x.t, msgLine: '', nk: x.nk });
    });
    return items;
  }
  function renderHome() {
    const items = homeItems();
    const has = items.length > 0;
    $('#welcome').classList.toggle('has-games', has);
    $('#home-brand').hidden = !has;
    $('#home-tag').hidden = !T('accueil.intro').trim();
    if (!has) $('#welcome').classList.remove('is-editing');
    $('#home-hero').hidden = has;
    $('#home-rules').hidden = has;
    $('#welcome-go').textContent = has ? T('accueil.nouvelle') : T('accueil.commencer');
    $('#welcome-go').classList.remove('btn--line');
    const une = $('#home-une'), list = $('#home-list');
    if (!has) { une.hidden = true; list.hidden = true; $('#home-sec').hidden = true; return; }
    // La une : du nouveau d’abord (le plus récent), sinon la dernière partie jouée
    const sorted = items.slice().sort((a, b) => (b.news - a.news) || (b.t - a.t));
    const top = sorted[0];
    const rest = sorted.slice(1);
    const isDuo = top.kind === 'duo';
    const B = top.B || '';
    const homeId = (it) => (it.kind === 'duo' ? it.g.room : 'ici:' + it.key);
    const kick = (top.news ? T('accueil.du-nouveau') : T('accueil.derniere')) + (top.t > 1 ? ' · ' + agoText(top.t) : '');
    const goLabel = !isDuo ? T('accueil.ouvrir') : top.state.go === 'lire' ? T('partie.lire') : top.state.go === 'relire' ? T('partie.relire')
      : top.state.go === 'tourner' ? T('partie.tourner') : top.state.go === 'reprendre' ? T('partie.reprendre')
      : top.nu ? T('accueil.lire-messages') : T('accueil.ouvrir');
    const line = top.freshKiff ? T('parties.kiff-neuf') : top.state.line || '';
    une.innerHTML = '<div class="une-head"><span class="avatar' + (top.news ? ' is-new' : '') + '" aria-hidden="true">' + esc(initial(B || top.title)) + '</span>' +
      '<span class="une-head-text"><span class="une-kicker">' + esc(kick) + '</span><span class="une-name">' + esc(isDuo && !top.lobby ? T('jeu.avec', { prénom: B }) : top.title) + '</span></span>' +
      '<button class="home-del une-del" type="button" data-del="' + esc(homeId(top)) + '" aria-label="' + esc(T('accueil.supprimer') + ' : ' + top.title) + '"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-supprimer"/></svg><span>' + esc(T('accueil.supprimer')) + '</span></button>' +
      (top.nu ? '<span class="badge badge--row" aria-label="' + top.nu + ' message' + (top.nu > 1 ? 's' : '') + ' non lu' + (top.nu > 1 ? 's' : '') + '">' + top.nu + '</span>' : '') + '</div>' +
      (line ? '<p class="une-line">' + esc(line) + '</p>' : '') +
      (top.msgLine ? '<p class="une-msg">' + esc(top.msgLine) + '</p>' : '') +
      '<button class="btn une-go" type="button" data-home="' + esc(homeId(top)) + '"' + (isDuo && !top.state.me && top.nu ? ' data-partie="1"' : '') + '>' + esc(goLabel) + '</button>';
    une.classList.toggle('is-new', !!top.news);
    une.hidden = false;
    // Le titre de la liste porte la corbeille : il reste là, même avec une seule partie
    $('#home-sec').hidden = false;
    $('#home-sec-n').textContent = ' ' + items.length;
    $('#home-edit').setAttribute('aria-pressed', $('#welcome').classList.contains('is-editing') ? 'true' : 'false');
    list.hidden = !rest.length;
    list.innerHTML = rest.map((it) => {
      const isD = it.kind === 'duo';
      const id = homeId(it);
      const st = it.state.me ? it.state.line : (it.msgLine || it.state.line);
      // Glisser la ligne vers la gauche (ou toucher la corbeille au-dessus de la liste) montre « Supprimer »
      return '<li class="home-game' + (it.news ? ' is-new' : '') + (homeOpen === id ? ' is-open' : '') + '" data-id="' + esc(id) + '">' +
        '<button class="home-del" type="button" data-del="' + esc(id) + '" tabindex="-1"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-supprimer"/></svg><span>' + esc(T('accueil.supprimer')) + '</span></button>' +
        '<button class="home-game-btn" type="button" data-home="' + esc(id) + '"' + (isD && !it.state.me && it.nu ? ' data-partie="1"' : '') + '>' +
        '<span class="avatar' + (it.news ? ' is-new' : '') + '" aria-hidden="true">' + esc(initial(it.B || it.title)) + '</span>' +
        '<span class="home-game-text"><span class="home-game-name">' + esc(it.title) + '</span><span class="home-game-line' + (it.state.me ? ' is-me' : '') + '">' + esc(st) + '</span></span>' +
        '<span class="home-game-side"><span class="home-game-time">' + esc(it.t > 1 ? agoText(it.t) : '') + '</span>' +
        (it.nu ? '<span class="badge badge--row">' + it.nu + '<span class="sr-only"> non lus</span></span>' : '') + '</span></button></li>';
    }).join('');
  }
  // Toucher une partie : elle s’ouvre (tout de suite) ; avec des messages non lus, à la conversation
  let pendingPartie = false;
  function openFromHome(b) {
    const room = b.dataset.home;
    if (!room) return;
    audio(); sClick(); haptic(8);
    if (homeOpen || $('#welcome').classList.contains('is-editing')) { homeOpen = ''; $('#welcome').classList.remove('is-editing'); renderHome(); return; } // un toucher referme « Supprimer »
    if (room.startsWith('ici:')) { report('accueil', null, 'ici'); openIci(room.slice(4)); return; }
    pendingPartie = !!b.dataset.partie;
    report('accueil', null, b.classList.contains('une-go') ? 'une' : 'liste');
    openGame(room);
  }
  $('#home-une').addEventListener('click', (e) => { const b = e.target.closest('[data-home]'); if (b) openFromHome(b); });
  $('#home-list').addEventListener('click', (e) => { const b = e.target.closest('[data-home]'); if (b) openFromHome(b); });
  /* Supprimer une partie : glisser sa ligne vers la gauche, ou la corbeille au-dessus de la liste (toutes les lignes, la une comprise).
     Une partie à distance est arrêtée pour les deux : l’autre est prévenu·e. Un mot bref confirme. */
  let homeOpen = '';
  function deleteGame(id) {
    homeOpen = '';
    if (id.startsWith('ici:')) forgetIci(id.slice(4));
    else stopGame(id);
    haptic(20); sClick();
    const left = homeItems().length;
    if (!left) $('#welcome').classList.remove('is-editing');
    renderHome();
    homeToast(T('accueil.supprimee'));
  }
  let toastT = 0;
  function homeToast(text) {
    const t = $('#home-toast');
    t.textContent = text; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3000);
  }
  $('#welcome').addEventListener('click', (e) => {
    const d = e.target.closest('[data-del]');
    if (d) { e.stopPropagation(); audio(); deleteGame(d.dataset.del); }
  }, true);
  $('#home-edit').addEventListener('click', () => {
    audio(); sClick(); haptic(8);
    homeOpen = '';
    const on = $('#welcome').classList.toggle('is-editing');
    $('#home-edit').setAttribute('aria-pressed', on ? 'true' : 'false');
    renderHome();
  });
  // Glisser vers la gauche
  (() => {
    const list = $('#home-list');
    let row = null, sx = 0, sy = 0, dx = 0, horiz = null;
    list.addEventListener('pointerdown', (e) => {
      const li = e.target.closest('.home-game'); if (!li || e.target.closest('[data-del]')) return;
      row = li; sx = e.clientX; sy = e.clientY; dx = 0; horiz = null;
    });
    list.addEventListener('pointermove', (e) => {
      if (!row) return;
      const ddx = e.clientX - sx, ddy = e.clientY - sy;
      if (horiz === null) { if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return; horiz = Math.abs(ddx) > Math.abs(ddy) * 1.3; }
      if (!horiz) { row = null; return; }
      const base = row.classList.contains('is-open') ? -104 : 0;
      dx = Math.max(-140, Math.min(0, base + ddx));
      row.classList.add('is-dragging');
      row.querySelector('.home-game-btn').style.transform = 'translateX(' + dx + 'px)';
    });
    const end = () => {
      if (!row) return;
      const r = row; row = null;
      r.classList.remove('is-dragging');
      r.querySelector('.home-game-btn').style.transform = '';
      if (!horiz) return;
      const open = dx < -52;
      homeOpen = open ? r.dataset.id : '';
      list.querySelectorAll('.home-game').forEach((x) => x.classList.toggle('is-open', x.dataset.id === homeOpen));
      if (open) haptic(8);
      // le toucher qui suit le glisser n’ouvre pas la partie
      r.dataset.swiped = '1'; setTimeout(() => { delete r.dataset.swiped; }, 350);
    };
    list.addEventListener('pointerup', end);
    list.addEventListener('pointercancel', end);
    list.addEventListener('click', (e) => { const li = e.target.closest('.home-game'); if (li && li.dataset.swiped) { e.stopPropagation(); e.preventDefault(); } }, true);
  })();
  // Les messages qui attendent dans la boîte aux lettres : comptés à l’accueil, sans les marquer lus
  async function peekBoxes() {
    if (!window.KiffDuo || !window.KiffDuo.boxLoad) return;
    const list = games().slice(0, 6);
    await Promise.all(list.map(async (g) => {
      try {
        const got = await window.KiffDuo.boxLoad({ room: g.room, key: g.key, broker: g.broker }, g.seat);
        const known = new Set(chatBox(g.room).ev);
        const ms = got.map((x) => x.obj).filter((o) => o && o.ty === 'm' && o.s !== g.seat && !known.has(o.ev) && typeof o.t === 'string');
        ms.sort((a, b) => (a.d || 0) - (b.d || 0));
        peek[g.room] = { n: ms.length, last: ms.length ? { s: ms[ms.length - 1].s, t: ms[ms.length - 1].t.slice(0, 120), d: +ms[ms.length - 1].d || Date.now() } : null };
      } catch (e) { /* hors connexion : tant pis */ }
    }));
    if (!el.ovStart.hidden) renderHome();
  }
  // L’accueil reste à jour : en revenant dans l’appli, puis toutes les 30 secondes tant qu’il est à l’écran
  const homeFresh = () => { if (!el.ovStart.hidden && document.visibilityState === 'visible' && ($('#steps').dataset.step || '0') === '0') { gamesT = 0; refreshGames(); peekBoxes(); } };
  document.addEventListener('visibilitychange', homeFresh);
  /* La pastille sur l’icône de l’appli (27 octobre 2026) : en ouvrant l’appli, les avertissements reçus partent
     du centre de notifications et la pastille s’efface (sur iPhone, ils la laissaient alors que tout était lu).
     L’accueil montre ensuite ce qui est vraiment nouveau. */
  async function clearBadge() {
    if (document.visibilityState !== 'visible') return;
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.getNotifications) (await reg.getNotifications()).forEach((n) => n.close());
      }
      if (navigator.clearAppBadge) await navigator.clearAppBadge();
    } catch (e) { /* pas de pastille ici : tant pis */ }
  }
  document.addEventListener('visibilitychange', clearBadge);
  setTimeout(clearBadge, 1500);
  setInterval(homeFresh, 30000);
  // Le menu
  const ovMenu2 = $('#ov-menu');
  $('#home-menu').addEventListener('click', () => { audio(); sClick(); haptic(8); show(ovMenu2); $('#menu-close').focus({ preventScroll: true }); });
  $('#menu-close').addEventListener('click', () => { audio(); hide(ovMenu2); });
  ovMenu2.addEventListener('click', (e) => { if (e.target === ovMenu2) hide(ovMenu2); });
  // Un choix du menu le referme ; la fenêtre choisie s’ouvre à sa place
  $('#ov-menu .menu-list').addEventListener('click', (e) => { if (e.target.closest('button')) hide(ovMenu2); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ovMenu2.hidden) hide(ovMenu2); });
  $('#menu-complet').addEventListener('click', () => { audio(); openComplet('menu'); });

  const closeGames = () => { hide(ovGames); $('#games-open').focus({ preventScroll: true }); };
  $('#games-close').addEventListener('click', () => { audio(); closeGames(); });
  ovGames.addEventListener('click', (e) => { if (e.target === ovGames) closeGames(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ovGames.hidden) closeGames(); });

  // « Arrêter cette partie » prévient l’autre et l’efface : un second toucher confirme
  let quitT = 0;
  function quitArmed(on) {
    clearTimeout(quitT);
    quitT = 0;
    const b = $('#duo-quit');
    if (!b) return;
    const B = duo && duo.stage === 'game' ? nameOf(other(duo.seat)) : T('parties.l-autre');
    b.textContent = on ? T('accueil.arreter-confirmer', { prénom: B }) : T('accueil.arreter');
    b.classList.toggle('is-armed', on);
    if (on) quitT = setTimeout(() => quitArmed(false), 4000);
  }

  function openHome() {
    // Revenir à l’accueil depuis une partie à deux : l’accueil normal ; la partie attend dans « Parties à distance »
    if (duo && (duo.stage === 'game' || duo.stage === 'gift')) parkDuo();
    const inDuo = !!duo && duo.stage === 'game';
    $('#steps').classList.toggle('is-duo', inDuo);
    $('#duo-home').hidden = !inDuo;
    renderIntro();
    const own = inDuo ? load('names', ['', '']) : S.names; // pendant une partie à deux, S.names est celle de la partie
    $('#name0').value = own[0] || '';
    $('#name1').value = own[1] || '';
    $('#resume').hidden = inDuo || !S.started || !!S.mustRestart;
    $('#home-cont').hidden = !!duo || !S.started || !!S.mustRestart;
    $('#welcome-go').textContent = S.started ? T('accueil.nouvelle') : T('accueil.commencer');
    $('#welcome-go').classList.toggle('btn--line', inDuo);
    quitArmed(false);
    if (inDuo && offerKind) hideOffer(); // elle reviendra avec « Reprendre la partie »
    hide(ovHot);
    goStep(0, true);
    show(el.ovStart);
    el.ovStart.scrollTop = 0;
    const s0 = document.querySelector('#steps .step[data-step="0"]'); if (s0) s0.scrollTop = 0;
    renderGames();
    renderHome();
    refreshGames();
    peekBoxes();
    renderWait();
    renderDuoStatus();
    homeShown();
  }

  /* ---------- Accueil : la phrase sous le titre, toujours là (elle se change dans l’Atelier ; vide, elle disparaît) ---------- */
  function renderIntro() {
    const inDuo = $('#steps').classList.contains('is-duo');
    $('#welcome-intro').hidden = inDuo || !T('accueil.intro').trim();
  }

  /* ---------- Appli sur l’écran d’accueil ---------- */
  const installer = { can: () => false, run: () => {} };
  // L’invitation à installer : une fois, au bon moment (la 2ᵉ fois à l’accueil après une première envie,
  // ou après le premier kiff kiff sur un téléphone)
  const ovInstall = $('#ov-install');
  function inviteInstall(why) {
    const seen = load('installInvites', {}) || {};
    if (!installer.can() || load('installAsked', false) || seen[why]) return false;
    if (!ovInstall.hidden || !$('#ov-brulant').hidden) return false;
    seen[why] = 1; save('installInvites', seen);
    $('#install-text').textContent = T(why === 'invitation' ? 'installer.invite-envie' : 'installer.invite');
    report('installer', null, 'vue-' + why);
    show(ovInstall);
    $('#install-yes').focus({ preventScroll: true });
    return true;
  }
  function homeShown() {
    if (!load('envieFaite', false)) return;
    const n = (load('accueilApres', 0) || 0) + 1;
    save('accueilApres', n);
    // L’installation se propose quelques instants après : le temps que le navigateur dise si c’est possible
    if (n >= 2) setTimeout(() => { if (!el.ovStart.hidden && ($('#steps').dataset.step || '0') === '0') inviteInstall('accueil'); }, 1500);
  }
  $('#install-yes').addEventListener('click', () => { audio(); sClick(); haptic(8); save('installAsked', true); report('installer', null, 'oui'); hide(ovInstall); installer.run(); });
  $('#install-no').addEventListener('click', () => { audio(); report('installer', null, 'plus-tard'); hide(ovInstall); });
  ovInstall.addEventListener('click', (e) => { if (e.target === ovInstall) hide(ovInstall); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ovInstall.hidden) hide(ovInstall); });
  function setupInstall() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    const btn = $('#install');
    const standalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    $('#party-install').addEventListener('click', () => { audio(); save('installAsked', true); installer.run(); partyFoot(); });
    if (standalone()) return;
    let deferred = null;
    // Android (Chrome, Edge, Samsung) : le navigateur propose l’installation, on la garde pour le bouton
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e;
      btn.hidden = false;
    });
    window.addEventListener('appinstalled', () => { deferred = null; btn.hidden = true; report('installe'); });
    // iPhone : pas d’installation automatique, on explique le geste
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios) btn.hidden = false;
    installer.can = () => !!deferred || (ios && !standalone());
    installer.run = async () => {
      if (deferred) {
        deferred.prompt();
        try { await deferred.userChoice; } catch (e) { /* rien */ }
        deferred = null;
        btn.hidden = true;
      } else if (ios) {
        note(T('installer.titre'), T('installer.iphone'));
      }
    };
    btn.addEventListener('click', () => { audio(); installer.run(); });
  }

  window.addEventListener('resize', renderReels);
  init();
  setupInstall();
  renderIntro();
  if (!el.ovStart.hidden && !location.hash) homeShown();
})();
