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
  // Les mots écrits à la main dans une partie (« vos mots à vous deux ») restent dans ses roues, quel que soit le piment
  function buildLists(levels) {
    for (let r = 0; r < 3; r++) LISTS[r] = SOURCE[r].filter((x) => levels.includes(x.lvl || 1)).concat(S.mine[r] || [], [FREE[r]]);
  }
  const PLACEHOLDER = ['écris ton action', 'écris ton endroit', 'écris ta manière'];
  const REEL_NAMES = ['l’action', 'l’endroit', 'la manière'];

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
    gifting: false // je compose l’envie de l’invitation
  };
  buildLists(S.levels);
  const nameOf = (i) => (S.names[i] || '').trim() || (i === 0 ? 'Cerise' : 'Pistache');
  const other = (i) => 1 - i;

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
    const s = ('J’ai envie ' + glue(p.dir, p.act) + ' ' + p.obj + ' ' + p.man).replace(/\s+/g, ' ').trim();
    return /[!?…]$/.test(s) ? s : s + '.';
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
      for (let k = 0; k < 5; k++) {
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
      const h = this.itemH();
      const theta = 0.42;
      const R = h / theta;
      const base = Math.round(this.p);
      for (let j = 0; j < 5; j++) {
        const node = this.nodes[j];
        const i = base + j - 2;
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
          // Estampille piment : 2 ou 3 piments à côté des cases pimentées et brûlantes
          if (lvl > 1) {
            const tag = document.createElement('span');
            tag.className = 'reel-chilis reel-chilis--' + lvl;
            tag.innerHTML = '<svg class="chili is-on" viewBox="0 0 24 24" aria-hidden="true"><use href="#chili"/></svg>'.repeat(lvl);
            node.appendChild(tag);
          }
          node._t = key;
          const len = txt.length + (lvl > 1 ? lvl + 1 : 0);
          node.classList.toggle('is-long', len > 22 && len <= 28);
          node.classList.toggle('is-xlong', len > 28);
          node.classList.toggle('is-xxlong', len > 36);
        }
        node.classList.toggle('is-placeholder', isPlaceholder(this.r, idx));
        // Pendant l’ajustement, les choix d’origine restent repérables
        node.classList.toggle('is-original', S.phase === 'adjust' && !!S.original && S.original.idx[this.r] === idx);
        node.classList.toggle('is-center', Math.abs(d) < 0.5);
        const vis = Math.abs(a) < Math.PI / 2;
        node.style.opacity = vis ? Math.pow(Math.cos(a), 2).toFixed(3) : '0';
        node.style.transform = 'translateY(' + (Math.sin(a) * R).toFixed(2) + 'px) rotateX(' + (-a * 57.2958).toFixed(2) + 'deg)';
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
      if (S.phase === 'adjust' && this.locked) flashHint('Une seule modification par tour. Reviens à l’envie de ' + nameOf(S.proposer) + ' pour changer celle-ci.');
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
        else if ((e.key === 'Enter' || e.key === ' ') && isFree(this.r, this.index)) {
          e.preventDefault();
          if (this.canMove()) openEditor(this.r); else this.nope();
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
  const CHANGE_NAMES = { 0: 'l’action', 1: 'l’endroit', 2: 'la manière', dir: 'le sens de la phrase' };

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
  function flashHint(text) {
    el.hint.textContent = text;
    clearTimeout(hintFlashT);
    hintFlashT = setTimeout(renderHint, 2600);
  }
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function renderHint() {
    const A = esc(nameOf(S.proposer));
    const B = esc(nameOf(other(S.proposer)));
    const ch = changes();
    let h = '';
    if (S.phase === 'compose') h = '<b>' + A + '</b>, compose ton envie : fais glisser les roues.';
    else if (S.phase === 'adjust' && !ch.length) h = '<b>' + B + '</b>, change une seule chose : une roue, ou « que tu me / de te ». Les choix de ' + A + ' sont surlignés.';
    else if (S.phase === 'adjust') h = 'Tu as changé ' + CHANGE_NAMES[ch[0]] + '. <button class="undo" type="button" id="undo">Revenir à l’envie de ' + A + '</button>';
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
    const ph = S.phase;
    const B = nameOf(other(S.proposer));
    const ch = changes();
    document.body.dataset.phase = ph;
    el.ownerTop.textContent = nameOf(S.proposer);

    // En bas : un seul bouton pour la personne qui a la main (et « On passe » pendant l’ajustement)
    el.actAlt.hidden = ph !== 'adjust';
    if (ph === 'compose') { el.actMain.textContent = S.gifting ? 'Glisser dans l’invitation' : 'Proposer à ' + B; el.actMain.disabled = false; }
    else if (ph === 'adjust') { el.actMain.textContent = ch.length ? 'Modification faite' : 'J’ai envie aussi'; el.actMain.disabled = false; }
    else { el.actMain.disabled = true; }
    el.actMain.classList.toggle('is-done', ph === 'adjust' && ch.length > 0);
    el.pass.hidden = ph === 'adjust';
    el.pass.textContent = S.gifting ? 'Sans envie' : 'On passe';

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
    const s = ('J’ai envie ' + head + ' ' + m(p.obj, marks.includes(1)) + ' ' + m(p.man, marks.includes(2))).replace(/\s+/g, ' ').trim();
    return s + (/[!?…]$/.test(p.man.trim()) ? '' : '.');
  }

  /* ---------- Modales du tour ---------- */
  // offer : l’envie de A présentée à B · reconfirm : l’envie ajustée présentée à A
  let offerKind = '';
  function showOffer(kind) {
    offerKind = kind;
    const A = nameOf(S.proposer), B = nameOf(other(S.proposer));
    const to = kind === 'offer' ? B : A;
    const kick = $('#offer-kicker');
    kick.textContent = duo ? (kind === 'offer' ? lowered : '') : 'Passe le téléphone à ' + to + '.';
    kick.hidden = !kick.textContent;
    lowered = '';
    $('#offer-title').textContent = kind === 'offer' ? 'L’envie de ' + A : B + ' a ajusté ton envie';
    $('#offer-sentence').innerHTML = sentenceHtml(kind === 'reconfirm' ? changes() : []);
    $('#offer-yes').textContent = kind === 'offer' ? 'J’ai envie aussi' : 'J’ai envie';
    $('#offer-but').hidden = kind !== 'offer';
    const back = $('#offer-back');
    back.hidden = !!duo;
    back.textContent = 'Oups, ' + (kind === 'offer' ? A : B) + ' n’avait pas fini';
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
      lowered = nameOf(S.proposer) + ' a baissé le piment : ' + levelNames() + '.';
      S.lvOk = S.levels.slice();
    }
    if (want && (offerKind !== want || el.ovOffer.hidden)) showOffer(want);
    else if (!want && offerKind) hideOffer();
  }
  function showHot() {
    const A = nameOf(S.proposer);
    const added = S.levels.filter((n) => !S.lvOk.includes(n));
    $('#hot-title').textContent = A + ' monte le piment';
    $('#hot-text').textContent = 'Vous jouiez en ' + levelNames(S.lvOk) + '. ' + A + ' propose d’ajouter ' +
      (added.length > 1 ? 'les niveaux ' : 'le niveau ') + added.map((n) => D.niveaux[n - 1].nom).join(' et ') +
      ', et son envie peut en venir.';
    $('#hot-levels').innerHTML = added.map((n) => '<p class="hot-level"><span class="pgroup pgroup--' + n + ' is-on">' + CHILI.repeat(n) + '</span>' +
      '<span><b>' + esc(D.niveaux[n - 1].nom) + '</b> · ' + esc(D.niveaux[n - 1].desc) + '</span></p>').join('');
    $('#hot-no').textContent = 'Non, on reste en ' + levelNames(S.lvOk);
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
    $('#one-text').textContent = 'Tu peux changer une seule chose : une roue, ou « que tu me / de te ». Choisis-la bien.';
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
    S.proposer = proposer;
    S.phase = 'compose';
    S.original = null;
    S.bottom = false;
    hideOffer();
    render();
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
  function savePair() {
    if (duo) return;
    const all = load('paires', {}) || {};
    all[pairKey()] = { mine: S.mine, seen: S.seen, t: Date.now() };
    const keep = Object.keys(all).sort((a, b) => (all[b].t || 0) - (all[a].t || 0)).slice(0, 20);
    save('paires', Object.fromEntries(keep.map((k) => [k, all[k]])));
  }
  function shuffle(includeDir, best) {
    if (includeDir) { S.dir = Math.random() < 0.5 ? 'me' : 'te'; }
    pulse();
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
    flashHint('Écris ' + REEL_NAMES[m] + ' ou choisis une autre case.');
    return true;
  }

  /* A propose son envie */
  function propose() {
    if (S.phase !== 'compose' || !myTurn() || reels.some((r) => r.busy) || blockedByFree()) return;
    if (S.gifting) { endGift(true); return; }
    adoptFree();
    markSeen();
    savePair();
    report('envie', choiceLabels());
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
      if (ch.length && !ch.includes('dir')) { sNope(); haptic(20); flashHint('Une seule modification par tour. Reviens à l’envie de ' + A + ' pour changer le sens.'); return; }
      if (isFree(0, S.idx[0])) { sNope(); haptic(20); flashHint('Avec une action écrite à la main, le sens ne peut pas changer.'); return; }
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
    $('#pass-same').textContent = A + ' propose autre chose';
    $('#pass-other').textContent = B + ' propose à son tour';
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
  }
  $('#pass-same').addEventListener('click', () => {
    hide(el.ovPass);
    report('passe');
    hide(el.ovParty); stopConfetti();
    if (duo) { duoPass(S.proposer); return; }
    const A = S.proposer;
    // Si c’est l’autre qui tient le téléphone, on le rend à A
    if (S.phase === 'review' || S.phase === 'adjust') { hideOffer(); handoffNewTurn(A); return; }
    startComposition(A);
  });
  $('#pass-other').addEventListener('click', () => {
    hide(el.ovPass);
    report('passe');
    hide(el.ovParty); stopConfetti();
    const to = other(S.proposer);
    if (duo) { duoPass(to); return; }
    hideOffer();
    if (S.phase === 'review' || S.phase === 'adjust') { startComposition(to); return; }
    handoffNewTurn(to);
  });
  $('#pass-cancel').addEventListener('click', () => { hide(el.ovPass); if (S.phase === 'celebrate') show(el.ovParty); });

  function handoffNewTurn(to, text, then) {
    $('#handoff-title').textContent = 'Au tour de ' + nameOf(to);
    $('#handoff-kicker').textContent = 'Passe-lui le téléphone.';
    $('#handoff-text').textContent = text || 'C’est toi qui proposes maintenant.';
    const go = $('#handoff-go');
    go.textContent = 'C’est moi, ' + nameOf(to);
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
    $('#edit-preview').innerHTML = 'J’ai envie ' + html.replace(/(’) /g, '$1') + '.';
  }
  function openEditor(r) {
    editing = r;
    S.idx[r] = reels[r].index;
    const titles = ['Ton action', 'Ton endroit', 'Ta manière'];
    const hints = [
      S.dir === 'me'
        ? 'Écris le verbe comme après « que tu me » : chatouilles, mordilles, lis un poème à…'
        : 'Écris le verbe comme après « de te » : chatouiller, mordiller, lire un poème à…',
      'Par exemple : le nombril, les mollets, la paume de la main.',
      'Par exemple : en rougissant, au ralenti, avec un accent belge.'
    ];
    $('#edit-label').textContent = titles[r];
    $('#edit-hint').textContent = hints[r];
    editInput.value = S.custom[r];
    show(el.ovEdit);
    editPreview();
    setTimeout(() => editInput.focus(), 60);
  }
  editInput.addEventListener('input', editPreview);
  $('#edit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = editInput.value.replace(/\s+/g, ' ').trim().slice(0, 40);
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
    S.kiffs = (S.kiffs || []).concat({ t: sentence(), w: nameOf(S.proposer), d: Date.now(), s: S.proposer, lv: Math.max(...(S.lvOk || S.levels)) }).slice(-60);
    if (S.kiffs.length === 1) {
      const min = S.t0 ? (Date.now() - S.t0) / 60000 : -1;
      report('premier', null, min < 0 ? 'inconnu' : min < 5 ? 'moins-5' : min < 15 ? '5-15' : min < 60 ? '15-60' : min < 1440 ? '1h-1j' : 'plus-1j');
    }
    renderKiffs();
  }
  const kiffCount = () => Math.max((S.kiffs || []).length, S.kiff ? S.kiff.n : 0);
  const ordinal = (n) => (n === 1 ? 'premier' : n + 'ᵉ');
  function renderKiffs() {
    const n = kiffCount();
    const B = duo ? nameOf(other(duo.seat)) : '';
    const btn = $('#kiffs-open');
    btn.hidden = !n;
    $('#kiffs-n').textContent = n || '';
    btn.setAttribute('aria-label', n + ' kiff kiff trouvé' + (n > 1 ? 's' : '') + (B ? ' avec ' + B : ' ensemble') + '. Voir l’historique');
    const wk = $('#wait-kiffs');
    wk.hidden = !n;
    $('#wait-kiffs-label').textContent = n + ' kiff kiff';
    wk.setAttribute('aria-label', 'Vos kiff kiff (' + n + ')');
  }
  // Le pied de la célébration : une seule demande à la fois
  function partyFoot() {
    const n = kiffCount();
    const askInstall = n <= 1 && installer.can() && !load('installAsked', false);
    $('#party-install').hidden = !askInstall;
    $('#party-deal').hidden = askInstall || n < 2;
    document.querySelector('#ov-party .party-foot').hidden = $('#party-install').hidden && $('#party-deal').hidden;
  }
  function partyCount() {
    partyFoot();
    const n = kiffCount();
    $('#party-count').hidden = !n;
    $('#party-count-text').textContent = 'Votre ' + ordinal(n) + ' kiff kiff ensemble';
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
    const list = (S.kiffs || []).slice().reverse();
    const n = kiffCount();
    const B = duo ? nameOf(other(duo.seat)) : '';
    $('#kiffs-title').textContent = B ? 'Vos kiff kiff avec ' + B : 'Vos kiff kiff';
    $('#kiffs-count').textContent = n + ' kiff kiff trouvé' + (n > 1 ? 's' : '') + ' ensemble' +
      (n > list.length ? ' (les plus anciens datent d’avant l’historique).' : '.');
    $('#kiffs-list').innerHTML = list.map((k) => '<li class="kiffs-item"><p class="kiffs-text">' + esc(k.t || '') + '</p>' +
      '<p class="kiffs-meta">Envie de ' + esc(k.w || '…') + (k.d ? ' · ' + dayOf(k.d) : '') + '</p></li>').join('');
    show(ovKiffs);
    $('#kiffs-close').focus({ preventScroll: true });
  }
  const closeKiffs = () => { hide(ovKiffs); if (kiffsFrom) kiffsFrom.focus({ preventScroll: true }); };
  $('#kiffs-open').addEventListener('click', openKiffs);
  $('#wait-kiffs').addEventListener('click', openKiffs);
  $('#party-history').addEventListener('click', openKiffs);
  $('#kiffs-close').addEventListener('click', () => { audio(); closeKiffs(); });
  ovKiffs.addEventListener('click', (e) => { if (e.target === ovKiffs) closeKiffs(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ovKiffs.hidden) closeKiffs(); });

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
  function partyNormal() {
    lateKiff = false;
    $('#party-pass').hidden = false;
    $('.party-text').textContent = 'Vous en avez envie tous les deux.';
    $('#party-done').hidden = true;
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
    $('#party-unlock-text').textContent = D.niveaux[now - 1].nom + ' débloqué';
    box.querySelector('.pill').setAttribute('aria-label', D.niveaux[now - 1].nom + ' débloqué : le piment peut monter, si vous en avez envie tous les deux.');
  }
  function celebrateLate() {
    lateKiff = true;
    cheer();
    const by = S.kiff.by === 0 || S.kiff.by === 1 ? S.kiff.by : other(duo.seat);
    $('#party-sentence').textContent = S.kiff.text;
    $('.party-text').textContent = by === duo.seat ? 'Vous en avez envie tous les deux.' : nameOf(by) + ' a dit oui pendant ton absence.';
    $('#party-done').hidden = true;
    $('#party-next').textContent = 'Voir la suite de la partie';
    $('#party-pass').hidden = true;
    partyCount();
    partyUnlock();
    show(el.ovParty);
    pulse();
    sParty(); haptic(40);
    confetti();
    markKiffSeen();
  }
  /* Le titre de la célébration change à chaque kiff kiff (les exclamations de Marc), jamais deux fois de suite le même */
  const CHEERS = ['Bon appétit\u00a0!', 'C’est servi\u00a0!', 'Savourez\u00a0!', 'À la vôtre\u00a0!', 'Santé\u00a0!', 'Samba\u00a0!', 'It’s a match!',
    'Wopopoooo\u00a0!', 'Et… c’est un Kiff-Kiff\u00a0!!', 'Banco\u00a0!', 'C’est parti\u00a0!', 'Enjoy!', 'Get ready 😈!'];
  function cheer() {
    const last = load('cheer', '');
    const pool = CHEERS.filter((c) => c !== last);
    const c = pool[Math.floor(Math.random() * pool.length)];
    save('cheer', c);
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
    $('#party-next').textContent = 'C’est fait ! À ' + nameOf(other(S.proposer)) + ' de proposer';
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
  const DEAL_TEXT = 'Tiens, je crois que ça te fera pas de mal : Kiff Kiff, un petit jeu à deux pour pimenter un peu les choses.';
  const ovDeal = $('#ov-deal');
  // Depuis la célébration, ou depuis le lien discret de l’accueil
  let dealFrom = null;
  const openDeal = (e) => {
    audio(); sClick(); haptic(8);
    dealFrom = e.currentTarget;
    report('partage', null, dealFrom.id === 'home-deal' ? 'fenetre-accueil' : 'fenetre-fete');
    $('#deal-done').hidden = true;
    show(ovDeal);
    $('#deal-share').focus({ preventScroll: true });
    // Le QR code du jeu : on le montre, l’autre le scanne, rien à recopier
    const qr = $('#deal-qr');
    if (!qr.firstChild) loadScript('vendor/qrcode.js?v=1.4.4').then(() => { if (window.KiffDuo && window.KiffDuo.qrSvg) qr.innerHTML = window.KiffDuo.qrSvg(APP_URL); }).catch(() => {});
  };
  $('#party-deal').addEventListener('click', openDeal);
  $('#home-deal').addEventListener('click', openDeal);
  const closeDeal = () => { hide(ovDeal); if (dealFrom) dealFrom.focus({ preventScroll: true }); };
  $('#deal-close').addEventListener('click', () => { audio(); closeDeal(); });
  ovDeal.addEventListener('click', (e) => { if (e.target === ovDeal) closeDeal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ovDeal.hidden) closeDeal(); });
  $('#deal-share').addEventListener('click', async () => {
    audio();
    const done = $('#deal-done');
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Kiff Kiff', text: DEAL_TEXT, url: APP_URL });
        report('partage', null, 'envoye');
        sSwitchOn(); haptic(15);
        done.textContent = 'Kiff dealé. Merci pour elle, ou pour lui.';
        done.hidden = false;
      } catch (e) { /* partage annulé */ }
      return;
    }
    // Sans partage natif : on copie le message avec le lien
    try {
      await navigator.clipboard.writeText(DEAL_TEXT + ' ' + APP_URL);
      report('partage', null, 'copie');
      done.textContent = 'Message copié : colle-le à qui tu veux.';
    } catch (e) {
      done.textContent = DEAL_TEXT + ' ' + APP_URL;
    }
    done.hidden = false;
    sClick(); haptic(8);
  });
  if (window.KIFF_DON) $('#coffee-go').href = window.KIFF_DON;
  $('#coffee-go').addEventListener('click', () => { report('cafe'); sParty(); haptic(20); });
  $('#party-pass').addEventListener('click', () => {
    hide(el.ovParty);
    stopConfetti();
    el.pass.click();
  });
  $('#party-next').addEventListener('click', () => {
    hide(el.ovParty);
    stopConfetti();
    if (lateKiff) { partyNormal(); render(); showTurnModal(); renderWait(); return; }
    startComposition(other(S.proposer));
    if (duo) { sync(); renderWait(); }
    if (!duo || myTurn()) setTimeout(() => { if (S.phase === 'compose' && myTurn()) shuffle(false); }, 500);
  });

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
  const TAGLINE = 'Quand vos envies se rejoignent, c’est kiff kiff.';
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
    c.fillText('J’ai envie…', W / 2, cy + 110);
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
    // le bandeau : un QR code vers le jeu, rien à recopier
    c.strokeStyle = T.rule; c.lineWidth = 2;
    c.beginPath(); c.moveTo(110, 1040); c.lineTo(W - 110, 1040); c.stroke();
    const fit = (str, font, max, size) => { let s = size; do { c.font = font.replace('{s}', s); s -= 2; } while (c.measureText(str).width > max && s > 18); };
    try {
      await loadScript('vendor/qrcode.js?v=1.4.4');
      const qr = window.qrcode(0, 'M'); qr.addData(APP_URL); qr.make();
      const n = qr.getModuleCount(), q = 200, m = q / (n + 4), qx = 120, qy = 1080;
      c.fillStyle = T.qr[0]; c.fillRect(qx, qy, q, q);
      c.fillStyle = T.qr[1];
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) c.fillRect(qx + (k + 2) * m, qy + (r + 2) * m, Math.ceil(m), Math.ceil(m));
      c.textAlign = 'left';
      const tx = 360, tw = W - 120 - tx;
      c.fillStyle = T.t1[1]; fit('Scanne et joue à deux', T.t1[0], tw, 46); c.fillText('Scanne et joue à deux', tx, 1124);
      // la phrase du jeu sur deux lignes, coupée à la virgule
      const tl = TAGLINE.replace(/, /, ',\n').split('\n');
      let ts = T.t2[2] + 2;
      do { ts -= 2; c.font = T.t2[0].replace('{s}', ts); } while (ts > 20 && tl.some((l) => c.measureText(l).width > tw));
      c.fillStyle = T.t2[1];
      tl.forEach((l, i) => c.fillText(l, tx, 1174 + i * Math.round(ts * 1.15)));
      c.fillStyle = T.t3[1]; fit('Kiff Kiff · jeu de séduction pour adultes', T.t3[0], tw, 26); c.fillText('Kiff Kiff · jeu de séduction pour adultes', tx, 1276);
    } catch (e) {
      c.fillStyle = T.t2[1]; c.font = T.t2[0].replace('{s}', T.t2[2]);
      c.fillText(TAGLINE, W / 2, 1160);
    }
    return new Promise((res) => cv.toBlob(res, 'image/png'));
  }
  $('#party-image').addEventListener('click', async () => {
    audio(); sClick(); haptic(8);
    const btn = $('#party-image');
    const text = $('#party-sentence').textContent;
    const blob = await phraseImage(text);
    if (!blob) return;
    const file = new File([blob], 'kiff-kiff.png', { type: 'image/png' });
    report('partage', null, 'image');
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Kiff Kiff', text: TAGLINE + ' ' + APP_URL }); } catch (e) { /* annulé */ }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'kiff-kiff.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    const done = $('#party-done');
    done.textContent = 'Image enregistrée dans tes téléchargements.';
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
    if (duo && S.prog) {
      const u = unlocked();
      levels = levels.filter((n) => n <= u);
      if (!levels.length) levels = [1];
    }
    const prev = LISTS.map((l, r) => l[S.idx[r]]);
    S.levels = levels;
    if (!duo && !opts.nosave) save('levels', levels);
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
    if (up) p.textContent = nameOf(other(duo.seat)) + ' devra d’abord accepter ce piment plus chaud, avant de voir ton envie.';
  }
  function renderLevel() {
    const b = $('#piment-open');
    if (b) {
      b.innerHTML = '<span class="pgroups">' + levelGroups() + '</span>';
      b.setAttribute('aria-label', 'Piment : ' + levelNames() + '. Changer');
    }
    const u = unlocked();
    document.querySelectorAll('.piment-list input[type="checkbox"]').forEach((c) => {
      c.checked = S.levels.includes(+c.value);
      const lock = +c.value > u;
      c.disabled = lock;
      const lab = c.closest('.piment-toggle');
      lab.classList.toggle('is-locked', lock);
      const d = lab.querySelector('.piment-tdesc');
      if (!d.dataset.desc) d.dataset.desc = d.textContent;
      d.textContent = lock ? (+c.value === 2 ? 'Après un tour de kiff kiff : une envie de chacun·e.' : 'Après un tour de kiff kiff en Pimenté.') : d.dataset.desc;
    });
    document.documentElement.dataset.piment = S.levels.join('');
  }

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
    // Pas de prénom dans l’avertissement : l’écran verrouillé ne dit jamais avec qui l’on joue
    KP.send(sub, { k: kind, r: duo.info.room, ph: st.phase, u: up });
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
    const list = games().filter((g) => g.room !== duo.info.room);
    list.unshift({
      room: duo.info.room, key: duo.info.key, broker: duo.info.broker, seat: duo.seat, id: duo.id,
      names: (st.names || ['', '']).slice(0, 2), turn: turnFor(st, duo.seat), kiff: st.kiff ? st.kiff.n : 0,
      nk: Math.max(Array.isArray(st.kiffs) ? st.kiffs.length : 0, st.kiff ? st.kiff.n : 0), t: Date.now()
    });
    save('parties', list.slice(0, 40));
  }
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
      gift: S.gift || null,
      skin: currentSkin(), // l’ambiance de qui envoie : la personne invitée découvre le jeu dedans
      push: pushPair(), // adresses d’avertissement des deux téléphones (l’état est chiffré)
      // avant d’entrer dans la partie (invitation, arrivée), rien de ce téléphone ne s’y mêle
      mine: inGame ? S.mine.map((l) => l.slice(-MINE_MAX)) : [[], [], []],
      seen: inGame ? S.seen.map((l) => l.slice(-SEEN_MAX)) : [[], [], []]
    };
  }
  function pushState(extra) {
    if (!duo || !duo.conn) return;
    const st = Object.assign(snapshot(), extra || {});
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
    const s = ('J’ai envie ' + glue(p.dir, p.act) + ' ' + p.obj + ' ' + p.man).replace(/\s+/g, ' ').trim();
    return /[!?…]$/.test(s) ? s : s + '.';
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
      if (duo.stage === 'game') note('Fin de la partie à deux', nameOf(st.endBy === 0 ? 0 : 1) + ' a arrêté la partie.', () => leaveDuo(false));
      else duoError('ended');
      return;
    }
    if (duo.stage === 'game') { applyGame(st, {}); pushRefresh(); return; }
    duo.remote = st;
    if (st.phase === 'lobby') {
      if (duo.seat === 0) { S.gift = st.gift || null; S.prog = !!st.prog; showInvite(); }
      else showJoin(st);
    } else if (duo.resume || duo.stage === 'invite') {
      const wasInvite = duo.stage === 'invite';
      enterGame(st, wasInvite);
      if (wasInvite) { sSwitchOn(); haptic(30); report('partie', null, 'deux'); }
      if (wasInvite && st.pass && st.pass.why === 'cadeau') note(nameOf(1) + ' commence', nameOf(1) + ' préfère proposer en premier. Pas besoin d’expliquer pourquoi.');
      pushRefresh();
    } else {
      showJoin(st);
    }
  }

  function enterGame(st, spin) {
    duo.stage = 'game';
    hide($('#ov-duo')); hide($('#ov-invited'));
    hide(el.ovStart);
    $('#steps').classList.remove('is-duo');
    S.started = true;
    S.mustRestart = false;
    applyGame(st, { first: true, spin: !!spin });
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
    if (lv.join() !== S.levels.join()) { S.levels = lv; renderLevel(); }
    buildLists(lv);
    S.proposer = st.proposer;
    S.phase = st.phase;
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
        note('On garde le piment d’avant', nameOf(st.pass.by) + ' préfère rester en ' + levelNames(parseLevels(st.lvOk || st.levels)) + '. Pas besoin d’expliquer pourquoi. Propose une autre envie avec ce piment-là.');
      } else if (st.pass.by !== duo.seat) {
        hide(el.ovPass);
        note('On passe.', nameOf(st.pass.by) + ' a passé. Pas besoin d’expliquer pourquoi. ' +
          (S.proposer === duo.seat ? 'C’est à toi de proposer.' : nameOf(S.proposer) + ' propose autre chose.'));
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
    if (!opts.first && prev.phase === 'celebrate' && S.phase === 'compose' && myTurn()) setTimeout(() => { if (S.phase === 'compose' && myTurn()) shuffle(false); }, 700);
    else if (missed && !lateKiff) celebrateLate();
    if (S.phase !== 'celebrate' && !lateKiff && !el.ovParty.hidden) { hide(el.ovParty); stopConfetti(); }
    if (!myTurn() && !el.ovEdit.hidden) { hide(el.ovEdit); editing = -1; }
    if (arrived && S.phase !== 'celebrate') { sSwitchOn(); haptic(30); }
    renderReels();
    render();
    // La proposition (ou l’envie ajustée) arrive dans une modale ; un piment plus chaud s’accepte avant
    if (!lateKiff) showTurnModal();
    renderWait();
  }

  /* Écran d’attente : pendant que l’autre téléphone a la main */
  function renderWait() {
    const ov = $('#ov-wait');
    const waiting = !!duo && duo.stage === 'game' && el.ovStart.hidden &&
      ['compose', 'review', 'adjust', 'reconfirm'].includes(S.phase) && !myTurn();
    if (!waiting) { hide(ov); renderDuoStatus(); return; }
    const A = nameOf(S.proposer), B = nameOf(other(S.proposer));
    let title, kicker, sent = '';
    if (S.phase === 'compose') {
      title = 'Au tour de ' + A;
      kicker = A + ' compose une envie.';
    } else if (S.phase === 'review') {
      title = 'Envie envoyée';
      kicker = hotter() ? B + ' doit d’abord accepter le nouveau piment.' : B + ' la lit.';
      sent = S.original ? sentenceFrom(S.original) : sentence();
    } else if (S.phase === 'adjust') {
      title = B + ' ajuste ton envie';
      kicker = B + ' change une seule chose.';
      sent = S.original ? sentenceFrom(S.original) : sentence();
    } else {
      const ch = changes();
      title = 'Au tour de ' + A;
      kicker = 'Tu as changé ' + CHANGE_NAMES[ch.length ? ch[0] : 0] + '. ' + A + ' relit.';
      sent = sentence();
    }
    $('#wait-title').textContent = title;
    $('#wait-kicker').textContent = kicker;
    const ws = $('#wait-sentence');
    ws.hidden = !sent;
    ws.textContent = sent;
    $('#wait-emblem').style.display = sent ? 'none' : '';
    show(ov);
    renderDuoStatus();
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
    document.querySelectorAll('.notif-word').forEach((w) => { w.textContent = pushStatus === 'on' ? 'Averti·e' : 'M’avertir'; });
    if (inv) $('#duo-wait-text').textContent = presenceFlash || (duo.partnerOn ? 'L’autre téléphone est là : il découvre le jeu…' : (pushStatus === 'on' ? 'En attente de l’autre téléphone. Ton téléphone t’avertira.' : 'En attente de l’autre téléphone…'));
    const line = $('#duo-status');
    if (!duo || duo.stage !== 'game') { line.hidden = true; return; }
    const B = nameOf(other(duo.seat));
    let msg = '';
    if (duo.online === false) msg = 'Connexion perdue. Je réessaie…';
    else if (duo.partnerOn === false) msg = B + ' n’est pas connecté·e : la partie l’attendra.';
    line.textContent = msg;
    line.hidden = !msg;
    // Une ligne de présence ; les actions sont des icônes (Prévenir, M’avertir, kiff kiff, Accueil)
    const away = duo.partnerOn !== true;
    const on = pushStatus === 'on';
    let pres = B + ' est là.';
    if (duo.online === false) pres = msg;
    else if (presenceFlash) pres = presenceFlash;
    else if (away) pres = B + ' n’est pas là' + (on ? '. Ton téléphone t’avertira.' : ' : la partie l’attendra.');
    $('#wait-presence-text').textContent = pres;
    $('#wait-presence').classList.toggle('is-off', away || duo.online === false);
    const nudge = $('#wait-nudge');
    nudge.hidden = !away;
    nudge.setAttribute('aria-label', 'Prévenir ' + B + ' que c’est son tour');
    const nb = $('#wait-notif');
    nb.hidden = !(on || pushStatus === 'off' || pushStatus === 'install' || pushStatus === 'blocked');
    nb.setAttribute('aria-pressed', on ? 'true' : 'false');
    $('#wait-notif-state').textContent = on ? 'activé' : 'désactivé';
    const ht = $('#duo-home-text');
    const nk = kiffCount();
    if (ht) ht.textContent = 'En cours : partie à deux avec ' + B + (msg ? '. ' + msg : ', connecté·e.') + (nk ? ' ' + nk + ' kiff kiff ensemble.' : '');
  }

  const duoHandlers = {
    state: (st) => onRemoteState(st),
    presence: (seat, on) => {
      if (!duo) return;
      duo.partnerOn = on;
      renderDuoStatus();
    },
    status: (ok) => { if (duo) { duo.online = ok; renderDuoStatus(); } }
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
    $('#duo-name-label').textContent = 'Ton prénom';
    $('#duo-wait').hidden = !o.wait;
    $('#duo-notif').hidden = o.stage !== 'invite';
    $('#duo-wait-text').textContent = o.wait || '';
    $('#duo-error').hidden = !o.error;
    $('#duo-error').textContent = o.error || '';
    $('#duo-go').hidden = !o.go;
    $('#duo-go').textContent = o.go || '';
    $('#duo-go').disabled = false;
    $('#duo-cancel').textContent = o.cancel || 'Annuler';
    ovDuo.dataset.stage = o.stage;
    ovDuo.dataset.retry = '';
    if (!ovInv.hidden) hide(ovInv);
    show(ovDuo);
  }
  function openDuoSetup() {
    duoName.value = S.names[0] || $('#name0').value.trim() || '';
    duoName.placeholder = 'Cerise';
    duoSheet({
      stage: 'setup',
      title: 'Sur deux téléphones',
      text: 'Chacun·e joue sur son téléphone : l’un·e propose sur le sien, l’autre répond sur le sien. Tu crées la partie, puis tu invites l’autre.',
      name: true, go: 'Créer la partie'
    });
    if (!KiffDuoOk()) duoError('support');
  }
  const KiffDuoOk = () => !!(window.KiffDuo && window.KiffDuo.supported());

  async function createDuo(given) {
    applyPendingMots();
    const name = (given != null ? given : duoName.value).replace(/\s+/g, ' ').trim().slice(0, 20);
    duoSheet({ stage: 'creating', title: 'Sur deux téléphones', wait: 'J’ouvre la partie…', cancel: 'Annuler' });
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
    S.names = [name, ''];
    save('names', [name, S.names[1] || load('names', ['', ''])[1] || '']);
    S.proposer = 0;
    S.phase = 'lobby';
    S.original = null; S.bottom = false; S.pass = null;
    S.custom = ['', '', ''];
    // À distance, on commence toujours en Tendre : le piment se débloque en jouant
    S.prog = true; S.gift = null; S.gifting = false;
    S.kiff = null; S.kiffs = [];
    setLevels([1], { silent: true, remote: true });
    S.lvOk = [1];
    S.t0 = Date.now();
    pushState();
    rememberGame({ phase: 'lobby', names: [name, ''] });
    report('invitation', null, 'progressif');
    askGift();
  }
  /* Une envie dans l’invitation : l’autre la découvrira après le principe du jeu, s’il ou elle le veut */
  function askGift() {
    duoSheet({
      stage: 'gift-ask',
      title: 'Une envie dans l’invitation\u00a0?',
      text: 'Compose une première envie, en Tendre. L’autre choisira de la découvrir après avoir compris le jeu.',
      go: 'Composer', cancel: 'Sans envie'
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
  function showInvite() {
    duo.stage = 'invite';
    const url = window.KiffDuo.link(duo.info);
    $('#duo-qr').innerHTML = window.KiffDuo.qrSvg(url);
    $('#duo-send').hidden = typeof navigator.share !== 'function';
    duoSheet({
      stage: 'invite',
      title: 'Invite l’autre téléphone',
      text: (S.gift ? 'Ton envie est dans l’invitation. ' : '') + 'Fais scanner ce code par l’autre téléphone, ou envoie-lui le lien. Pas besoin d’attendre ici : la partie t’attendra sur l’accueil.',
      qr: true, wait: duo.partnerOn ? 'L’autre téléphone est là : il découvre le jeu…' : 'En attente de l’autre téléphone…', go: 'Plus tard', cancel: 'Annuler la partie'
    });
    renderDuoStatus();
  }
  /* La personne invitée ne connaît peut-être pas le jeu : trois écrans avant de rejoindre */
  const ovInv = $('#ov-invited');
  let invSteps = null;
  function showInvited(st) {
    const A = (st.names && st.names[0] || '').trim() || 'Cerise';
    $('#ov-invited .inv-from').innerHTML = '<b class="inv-a"></b> ' + (st.rencontre ? 'te propose un jeu avant de vous voir, chacun·e sur son téléphone. Vous commencez en Tendre.' : 't’invite à jouer, chacun·e sur son téléphone.');
    $('#inv-name-help').textContent = A + ' verra ton prénom sur son téléphone.';
    const lv = parseLevels(st.levels);
    const chip = (n) => '<span class="inv-piment"><span class="pgroup pgroup--' + n + ' is-on">' + CHILI.repeat(n) + '</span> ' + esc(D.niveaux[n - 1].nom) + '</span>';
    $('#inv-piments').innerHTML = st.prog
      ? 'Vous commencez en ' + chip(1) + '. Le piment peut monter après un tour de kiff kiff, si vous en avez envie tous les deux.'
      : 'Piments choisis par ' + esc(A) + '&nbsp;: ' + lv.map(chip).join(' ');
    const r1 = $('#inv-rule-1'), r2 = $('#inv-rule-2');
    if (!r1.dataset.html) { r1.dataset.html = r1.innerHTML; r2.dataset.html = r2.innerHTML; }
    if (st.gift) {
      r1.innerHTML = '<b class="inv-a"></b> t’a glissé une première envie&nbsp;: tu choisiras de la découvrir, juste après.';
      r2.innerHTML = 'Tu réponds «&nbsp;J’ai envie aussi&nbsp;», ou «&nbsp;Oui, mais…&nbsp;» en changeant une seule chose. Puis chacun·e son tour&nbsp;: trois roues, «&nbsp;J’ai envie que tu me…&nbsp;», et on propose.';
    } else { r1.innerHTML = r1.dataset.html; r2.innerHTML = r2.dataset.html; }
    document.querySelectorAll('#ov-invited .inv-a').forEach((b) => { b.textContent = A; });
    // Première visite : on découvre le jeu dans l’ambiance de qui invite (chacun·e peut ensuite choisir la sienne)
    if (st.skin && SKINS.includes(st.skin) && !window.KIFF_SKIN_SET) { applySkin(st.skin); window.KIFF_SKIN_SET = true; }
    if (!ovInv.hidden) return; // déjà là : on garde l’écran en cours de lecture
    if (!invSteps) invSteps = makeSteps($('#inv-steps'), $('#inv-dots'), ovInv);
    hide(ovDuo);
    $('#inv-name').value = load('duoName', '') || '';
    invSteps.go(0, true);
    show(ovInv);
  }
  $('#inv-go').addEventListener('click', () => { audio(); sClick(); haptic(8); invSteps.go(1); });
  $('#inv-ok').addEventListener('click', () => { audio(); sClick(); haptic(8); invSteps.go(2); });
  $('#inv-form').addEventListener('submit', (e) => {
    e.preventDefault();
    audio();
    if (!duo || !duo.remote) return;
    document.activeElement && document.activeElement.blur();
    hide(ovInv);
    joinGame($('#inv-name').value);
  });
  $('#inv-solo').addEventListener('click', () => { audio(); hide(ovInv); leaveDuo(false); });

  function showJoin(st) {
    duo.stage = 'join';
    duo.remote = st;
    if (st.phase === 'lobby') { showInvited(st); return; }
    duoName.value = load('duoName', '') || '';
    duoName.placeholder = 'Pistache';
    const A = (st.names && st.names[0] || '').trim() || 'Cerise';
    duoSheet({
      stage: 'join',
      title: A + ' t’invite',
      text: st.phase === 'lobby'
        ? 'Kiff Kiff à deux téléphones : chacun·e joue sur le sien, et c’est toi qui proposes en premier. Écris ton prénom pour rejoindre la partie.'
        : 'La partie de ' + A + ' est déjà commencée. Écris ton prénom pour la rejoindre.',
      name: true, go: 'Rejoindre', cancel: 'Jouer sur ce téléphone seulement'
    });
    setTimeout(() => duoName.focus(), 80);
  }
  function joinGame(given) {
    const st = duo.remote;
    const name = (given != null ? given : duoName.value).replace(/\s+/g, ' ').trim().slice(0, 20);
    save('duoName', name);
    const next = Object.assign({}, st);
    next.names = [(st.names && st.names[0]) || '', name];
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
    $('#gift-title').textContent = A ? A + ' t’a glissé une envie' : 'Une envie t’attend';
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
    duoSheet({ stage: 'connecting', title: 'Kiff Kiff à deux', wait: same ? 'Je retrouve la partie…' : 'Connexion à la partie…', cancel: same ? 'Revenir à l’accueil' : 'Jouer sur ce téléphone seulement' });
    if (!KiffDuoOk()) { duoError('support'); return; }
    // Les deux téléphones doivent avoir les mêmes mots : on attend un instant ceux de l’atelier
    await Promise.race([motsReady, new Promise((r) => setTimeout(r, 4000))]);
    applyPendingMots();
    duo = { info, seat, id, seq: 0, lastBy: '', stage: 'connecting', resume: !!same, partnerOn: null, online: true, passN: null };
    const d = duo;
    // La dernière étape gardée dans la feuille : pour quand l’autre a joué pendant notre absence
    const fromStore = window.KiffDuo.storeLoad([info]);
    try { await loadDuoLibs(); } catch (e) { duoError('net'); return; }
    try {
      const conn = await window.KiffDuo.join(info, seat, id, duoHandlers);
      if (duo !== d) { conn.close(false); return; }
      duo.conn = conn;
    } catch (e) { duoError('relay'); return; }
    fromStore.then((m) => { if (duo === d && m[info.room]) onRemoteState(m[info.room]); });
    duo.findT = setTimeout(() => { if (duo === d && duo.stage === 'connecting') duoError('notfound'); }, 12000);
  }

  function duoError(kind) {
    const msgs = {
      support: 'Ce navigateur ne sait pas jouer à deux téléphones. Essaie avec Safari ou Chrome à jour.',
      net: 'Je n’arrive pas à charger le mode deux téléphones. Vérifie la connexion internet et réessaie.',
      relay: 'Je n’arrive pas à joindre le relais qui relie les deux téléphones. Vérifie la connexion internet et réessaie.',
      notfound: 'Je ne trouve pas cette partie. Le lien est peut-être incomplet, ou la partie a été fermée.',
      ended: 'Cette partie est terminée. Créez-en une nouvelle.',
      version: 'Vos deux téléphones n’ont pas les mêmes roues. Rechargez la page sur les deux téléphones.'
    };
    const retry = kind === 'net' || kind === 'relay' || kind === 'notfound' || kind === 'version';
    if (kind === 'ended' && duo && duo.info) forgetGame(duo.info.room);
    duoSheet({
      stage: 'error', title: 'Sur deux téléphones', error: msgs[kind] || msgs.relay,
      go: retry ? 'Réessayer' : '', cancel: duo && duo.resume && kind !== 'ended' ? 'Revenir à l’accueil' : 'Jouer sur ce téléphone seulement'
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
    if (stage === 'setup') createDuo();
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
    if (stage === 'setup') { hide(ovDuo); return; }
    if (stage === 'gift-ask') { showInvite(); return; }
    if (stage === 'invite') { leaveDuo(true); return; }
    leaveDuo(false, !!(duo && duo.resume) && ovDuo.dataset.retry !== 'ended');
  });
  function inviteText() {
    const me = (S.names[0] || '').trim();
    if (S.gift) return (me ? me + ' t’invite à jouer à Kiff Kiff, et t’a glissé une envie.' : 'On joue à Kiff Kiff ? Une envie t’attend.') + ' Ouvre ce lien sur ton téléphone.';
    const lead = S.rencontre ? (me ? me + ' te propose un jeu avant de vous voir : ' : 'On joue avant de se voir ? ') : (me ? me + ' t’invite à jouer à Kiff Kiff : ' : 'On joue à Kiff Kiff ? ');
    return lead + (/\? $/.test(lead) ? 'Quand' : 'quand') + ' vos envies se rejoignent, c’est kiff kiff. Ouvre ce lien sur ton téléphone.';
  }
  $('#duo-copy').addEventListener('click', async () => {
    const url = duo && duo.info ? window.KiffDuo.link(duo.info) : '';
    let ok = false;
    try { await navigator.clipboard.writeText(inviteText() + ' ' + url); ok = true; } catch (e) { ok = false; }
    if (ok) report('partage', null, 'invitation-copie');
    $('#duo-copy').textContent = ok ? 'Invitation copiée' : 'Copie impossible';
    setTimeout(() => { $('#duo-copy').textContent = 'Copier le lien'; }, 1800);
  });
  $('#duo-send').addEventListener('click', () => {
    if (!duo || !duo.info) return;
    navigator.share({ title: 'Kiff Kiff', text: inviteText(), url: window.KiffDuo.link(duo.info) })
      .then(() => report('partage', null, 'invitation')).catch(() => {});
  });
  $('#wait-pass').addEventListener('click', () => el.pass.click());
  // Prévenir l’autre que c’est son tour : par le partage du téléphone (WhatsApp, SMS…)
  $('#wait-nudge').addEventListener('click', async () => {
    if (!duo || !duo.info) return;
    audio(); sClick(); haptic(8);
    const url = window.KiffDuo.link(duo.info);
    const text = 'À toi de jouer sur Kiff Kiff !';
    report('partage', null, 'prevenir');
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: 'Kiff Kiff', text, url }); } catch (e) { /* annulé */ }
      return;
    }
    let ok = false;
    try { await navigator.clipboard.writeText(text + ' ' + url); ok = true; } catch (e) { ok = false; }
    flashPresence(ok ? 'Message copié : colle-le-lui.' : 'Copie impossible.');
  });
  $('#wait-home').addEventListener('click', () => el.home.click());
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
      note('M’avertir sur iPhone', 'Ajoute d’abord Kiff Kiff à ton écran d’accueil : dans Safari, touche Partager, puis « Sur l’écran d’accueil ». Les parties lancées depuis l’icône t’avertiront.');
      return;
    }
    // L’autorisation a pu changer dans les réglages entre-temps : on relit avant de conclure
    if (pushStatus === 'blocked') pushStatus = await KP.status();
    if (pushStatus === 'blocked') {
      renderDuoStatus();
      note('Avertissements bloqués', blockedHelp());
      return;
    }
    if (pushStatus === 'on') {
      await KP.disable();
      pushMine = null;
      pushStatus = 'off';
      pushChanged();
      flashPresence('Avertissements coupés.');
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
        note('Autoriser les avertissements', 'Le téléphone n’a pas enregistré ta réponse. Autorise-les dans ses réglages : appui long sur l’icône Kiff Kiff › Infos sur l’appli › Notifications. Puis touche à nouveau la cloche.');
        renderDuoStatus();
        return;
      }
      note('Avertissements indisponibles', res.erreur === 'cle'
        ? 'Je n’arrive pas à joindre le service d’avertissements de Kiff Kiff. Vérifie la connexion, puis touche à nouveau la cloche.'
        : 'Ce navigateur n’arrive pas à activer les avertissements. Touche à nouveau la cloche ; sinon, essaie depuis Chrome, ou depuis l’icône de Kiff Kiff sur l’écran d’accueil.');
      renderDuoStatus();
      return;
    }
    if (sub) {
      pushMine = sub;
      pushStatus = 'on';
      report('notif', null, 'activee');
      pushChanged();
      flashPresence('C’est noté : ton téléphone t’avertira.');
      return;
    }
    pushStatus = await KP.status();
    if (pushStatus === 'blocked') note('Avertissements bloqués', blockedHelp());
    renderDuoStatus();
  }
  // Où débloquer, selon le téléphone : sur Android, c’est Chrome qui garde l’autorisation du site
  function blockedHelp() {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'Chrome bloque les avertissements de kiff-kiff.fr, même si l’appli les autorise. Dans Chrome : ⋮ › Paramètres › Paramètres des sites › Notifications › kiff-kiff.fr › Autoriser. Puis reviens ici et touche à nouveau la cloche.';
    if (KP.ios) return 'Ton iPhone bloque les avertissements de Kiff Kiff. Réglages › Notifications › Kiff Kiff › Autoriser les notifications. Puis reviens ici et touche à nouveau la cloche.';
    return 'Ton navigateur refuse les avertissements de Kiff Kiff. Autorise-les pour kiff-kiff.fr dans ses réglages (le cadenas à gauche de l’adresse), puis touche à nouveau la cloche.';
  }
  $('#wait-notif').addEventListener('click', (e) => toggleNotif(e.currentTarget));
  $('#duo-notif').addEventListener('click', (e) => toggleNotif(e.currentTarget));
  document.addEventListener('visibilitychange', () => {
    const vis = document.visibilityState === 'visible';
    if (duo && duo.conn) { duo.conn.here(vis); if (vis) duo.conn.wake(); }
    if (vis) refreshPush();
  });
  // Toucher un avertissement alors que l’appli est déjà ouverte : on va à la partie
  const goToGame = (room) => {
    if (!room || !findGame(room)) return;
    report('notif', null, 'ouverte');
    if (duo && duo.info && duo.info.room === room && duo.stage === 'game') { hide(ovGames); hide(el.ovStart); showTurnModal(); renderWait(); return; }
    hide(ovGames);
    openGame(room);
  };
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.kk === 'jouer') goToGame(e.data.r); });
  window.addEventListener('online', () => { if (duo && duo.conn) duo.conn.wake(); });

  /* ---------- Atelier en ligne : comptes anonymes et mots modifiés ---------- */
  const API = window.KIFF_API || '';
  // Ce qui est envoyé : le type d’événement et, pour une envie ou un kiff kiff, le mot de chaque roue.
  // Jamais de prénom ni de texte écrit à la main.
  // detail : une variante courte (« un », « deux », « 123 »…), jamais une donnée de personne
  // Les comptes partent groupés : une seule requête par moment de jeu (moins d’appels au script)
  let queue = [], queueT = 0;
  function flushReports() {
    clearTimeout(queueT); queueT = 0;
    if (!API || !queue.length) return;
    const liste = queue.splice(0, 30);
    try {
      fetch(API, { method: 'POST', mode: 'no-cors', keepalive: true, body: JSON.stringify({ action: 'events', liste }) }).catch(() => {});
    } catch (e) { /* rien */ }
    if (queue.length) flushReports();
  }
  function report(type, choix, detail) {
    if (!API) return;
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
  const motsReady = new Promise((resolve) => {
    if (!API) { resolve(); return; }
    const ctl = window.AbortController ? new AbortController() : null;
    const t = setTimeout(() => { if (ctl) ctl.abort(); resolve(); }, 6000);
    fetch(API + '?action=mots', ctl ? { signal: ctl.signal } : {})
      .then((r) => r.json())
      .then((res) => {
        clearTimeout(t);
        if (res && res.meilleurs && typeof res.meilleurs === 'object') { save('meilleurs', res.meilleurs); renderWeek(); }
        if (res && res.ok && validMots(res.mots) && res.version !== window.KIFF_MOTS_VERSION) {
          save('mots', { api: API, version: res.version, mots: res.mots });
          pendingMots = res;
          if (!S.started && !duo && reels.length) applyPendingMots();
        }
        resolve();
      })
      .catch(() => { clearTimeout(t); resolve(); });
  });
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
    S.idx = LISTS.map((l) => Math.floor(Math.random() * (l.length - 1)));
    reels = [0, 1, 2].map((r) => new Reel(r));
    renderReels();
    render();

    applySkin(currentSkin());
    /* Piment : niveaux à cocher, depuis l’accueil ou le jeu */
    const ovPiment = $('#ov-piment');
    // Les mêmes trois niveaux à cocher : sur l’écran d’accueil et dans la fenêtre du jeu
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
        sClick(); haptic(8);
        setLevels(next, { silent: S.phase === 'start' || !el.ovStart.hidden });
      }));
    };
    pimentList($('#piment-list'), $('#piment-error'));
    pimentList($('#piment-home-list'), $('#piment-home-error'));
    $('#piment-go').addEventListener('click', () => {
      audio(); sSwitchOn(); haptic(12);
      if (where === 'duo') createDuo(S.names[0] || '');
      else launchGame();
    });
    renderLevel();
    let pimentFrom = null;
    const openPiment = (from) => {
      pimentFrom = from;
      renderLevel();
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
        flashHint('Le piment se règle pendant la composition, avant de proposer.');
        return;
      }
      openPiment($('#piment-open'));
    });
    const closePiment = () => {
      hide(ovPiment);
      if (S.mustRestart) { $('#resume').hidden = true; $('#welcome-go').textContent = 'Nouvelle partie'; }
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
    $('#welcome-go').addEventListener('click', () => { audio(); sClick(); haptic(8); if (duo) parkDuo(); goStep(1); });
    // L’autre joue sur ce téléphone (on écrit son prénom) ou sur le sien (on l’invitera)
    const setWhere = (w) => {
      where = w;
      document.querySelectorAll('.where-btn').forEach((b) => b.setAttribute('aria-pressed', b.dataset.where === w ? 'true' : 'false'));
      $('#name1-box').hidden = w !== 'here';
      $('#start-go').hidden = w !== 'here';
    };
    setWhere(load('where', 'here') === 'duo' ? 'duo' : 'here');
    const toRules = () => {
      readNames();
      if (where === 'duo') S.names[1] = '';
      // La deuxième personne propose en premier
      $('#rule-a').textContent = where === 'duo' ? 'L’autre' : nameOf(1);
      $('#rule-b').textContent = nameOf(0);
      $('#piment-go').textContent = where === 'duo' ? 'Inviter l’autre téléphone' : 'C’est parti';
      // À distance, le piment se débloque en jouant : on le montre au lieu de le choisir
      const prog = where === 'duo';
      $('#pick-title').textContent = prog ? 'Le piment monte en jouant' : 'Quels piments\u00a0?';
      $('#pick-text').textContent = prog ? 'Vous commencez en Tendre. Le piment ne monte que si vous en avez envie tous les deux.' : 'Touche les niveaux que vous voulez dans les roues.';
      $('#piment-home-list').hidden = prog;
      $('#piment-prog').hidden = !prog;
      if (prog) {
        const when = ['Pour commencer', 'Après un tour de kiff kiff : une envie de chacun·e', 'Après un tour de kiff kiff en Pimenté'];
        $('#piment-prog').innerHTML = D.niveaux.map((lv, i) => '<div class="piment-toggle' + (i ? ' is-locked' : '') + '"><span class="piment-toggle-body">' +
          '<span class="pgroup pgroup--' + lv.n + ' is-on">' + CHILI.repeat(lv.n) + '</span><span class="piment-toggle-text"><span class="piment-name">' + lv.nom + '</span>' +
          '<span class="piment-tdesc">' + when[i] + '</span></span></span></div>').join('');
      } else if (S.levels.join() !== parseLevels(load('levels', [1, 2])).join()) setLevels(load('levels', [1, 2]), { silent: true, remote: true });
      $('#rencontre-box').hidden = true;
      save('where', where);
      sClick(); haptic(8);
      // Qui a déjà joué connaît le principe : on va droit aux piments (« Retour » le remontre)
      goStep(load('rulesSeen', false) ? 3 : 2);
    };
    document.querySelectorAll('.where-btn').forEach((b) => b.addEventListener('click', () => {
      audio();
      setWhere(b.dataset.where);
      if (where === 'duo') { toRules(); return; }  // réponse donnée : on glisse tout de suite
      sClick(); haptic(8);
      setTimeout(() => $('#name1').focus(), 60);
    }));
    $('#name0').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); if (where === 'here') $('#name1').focus(); else document.activeElement.blur(); }
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
    const inv = window.KiffDuo && window.KiffDuo.parse(location.hash);
    const installed = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    reportOnce('visite', inv ? (findGame(inv.room) ? 'reprise' : 'invitation') : (installed ? 'installee' : 'web'));
    let fromNotif = '';
    try { fromNotif = new URLSearchParams(location.search).get('jouer') || ''; } catch (e) { /* rien */ }
    if (fromNotif) { try { const u = new URL(location.href); u.searchParams.delete('jouer'); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (e) { /* rien */ } }
    if (inv) startJoin(inv);
    else if (fromNotif && findGame(fromNotif)) { report('notif', null, 'ouverte'); openGame(fromNotif); }
    else { renderGames(); refreshGames(); }
    refreshPush();
  }

  /* ---------- Accueil : écrans successifs ---------- */
  let where = 'here';
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
      ov.scrollTop = 0;
      if (instant) { void box.offsetWidth; box.classList.remove('is-instant'); }
    }
    // Glisser le doigt vers la droite ramène à l’écran précédent (le doigt entraîne l’écran)
    let sx = 0, sy = 0, dx = 0, on = false, decided = false, horiz = false;
    box.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) { on = false; return; }
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
    hide(el.ovStart);
    S.kiff = null; S.kiffs = []; renderKiffs();
    setMemory((load('paires', {}) || {})[pairKey()]); // vos mots et ce que vous vous êtes déjà proposé
    S.started = true;
    S.mustRestart = false;
    // La deuxième personne propose en premier : on lui passe le téléphone
    S.proposer = 1;
    S.phase = 'compose';
    render();
    save('rulesSeen', true);
    handoffNewTurn(1, 'C’est toi qui proposes en premier.', () => setTimeout(() => shuffle(false, true), 250));
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
    $('#games-open-n').textContent = '(' + list.length + ')';
    $('#games-badge').hidden = !hot;
    $('#games-badge').textContent = hot;
    $('#games-open').setAttribute('aria-label', 'Parties à distance : ' + list.length + ' partie' + (list.length > 1 ? 's' : '') + (hot ? ', ' + hot + ' où c’est à toi' : ''));
    if (!many && !$('#ov-games').hidden) hide($('#ov-games'));
    const html = list.map((g) => {
      const B = ((g.names || [])[1 - g.seat] || '').trim();
      const who = B ? 'Avec ' + B : (g.seat === 0 ? 'Invitation envoyée' : 'Partie à deux');
      const turn = fresh(g) ? 'Kiff kiff trouvé ! Viens fêter ça'
        : g.turn === 'me' ? 'À toi de jouer'
        : g.turn === 'party' ? 'Kiff kiff trouvé'
        : g.turn === 'lobby' ? (g.seat === 0 ? 'Personne n’a encore rejoint' : 'À rejoindre')
        : 'Au tour de ' + (B || 'l’autre');
      return '<li class="game' + (g.turn === 'me' || fresh(g) ? ' is-mine' : '') + (fresh(g) ? ' is-kiff' : '') + '"><button class="game-btn" type="button" data-room="' + esc(g.room) + '">' +
        '<span class="game-who">' + esc(who) + (g.nk ? '<span class="game-count"> · ' + g.nk + ' kiff kiff</span>' : '') + '</span><span class="game-turn">' + esc(turn) + '</span></button>' +
        '<button class="game-x" type="button" data-forget="' + esc(g.room) + '" aria-label="Retirer cette partie de la liste">×</button></li>';
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
      return Object.assign({}, g, { names: (st.names || g.names || ['', '']).slice(0, 2), turn: turnFor(st, g.seat), kiff: st.kiff ? st.kiff.n : 0,
        nk: Math.max(Array.isArray(st.kiffs) ? st.kiffs.length : 0, st.kiff ? st.kiff.n : 0) });
    }).filter(Boolean);
    save('parties', next);
    if (!el.ovStart.hidden) renderGames();
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
    // L’accueil redevient l’accueil normal : formule de la semaine, « Commencer », et la partie quittée rejoint la liste
    $('#week').hidden = false;
    $('#welcome-go').textContent = 'Commencer';
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
  const onGames = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    audio();
    if (b.dataset.forget) { forgetGame(b.dataset.forget); renderGames(); return; }
    sClick(); haptic(8);
    hide(ovGames);
    openGame(b.dataset.room);
  };
  $('#games-list').addEventListener('click', onGames);
  $('#games-sheet-list').addEventListener('click', onGames);
  $('#games-open').addEventListener('click', () => { audio(); sClick(); haptic(8); refreshGames(); show(ovGames); $('#games-close').focus({ preventScroll: true }); });
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
    const B = duo && duo.stage === 'game' ? nameOf(other(duo.seat)) : 'l’autre';
    b.textContent = on ? 'Touche encore : ' + B + ' sera prévenu·e' : 'Arrêter cette partie';
    b.classList.toggle('is-armed', on);
    if (on) quitT = setTimeout(() => quitArmed(false), 4000);
  }

  function openHome() {
    const inDuo = !!duo && duo.stage === 'game';
    $('#steps').classList.toggle('is-duo', inDuo);
    $('#duo-home').hidden = !inDuo;
    $('#week').hidden = inDuo; // pendant une partie à deux, seule la reprise compte
    const own = inDuo ? load('names', ['', '']) : S.names; // pendant une partie à deux, S.names est celle de la partie
    $('#name0').value = own[0] || '';
    $('#name1').value = own[1] || '';
    $('#resume').hidden = inDuo || !S.started || !!S.mustRestart;
    $('#welcome-go').textContent = S.started ? 'Nouvelle partie' : 'Commencer';
    $('#welcome-go').classList.toggle('btn--line', inDuo);
    quitArmed(false);
    if (inDuo && offerKind) hideOffer(); // elle reviendra avec « Reprendre la partie »
    hide(ovHot);
    goStep(0, true);
    show(el.ovStart);
    el.ovStart.scrollTop = 0;
    renderGames();
    refreshGames();
    renderWait();
    renderDuoStatus();
  }

  /* ---------- La formule de la semaine (et une démonstration du jeu) ---------- */
  function phraseOf(a, o, m) {
    const raw = a.s || '';
    const tail = PREP_TAIL.exec(raw);
    const prep = a.p || (tail ? (tail[1].toLowerCase() === 'à' ? 'à' : 'de') : '');
    const act = raw.replace(PREP_TAIL, '');
    let obj = o.t || o.s || '';
    if (prep === 'de') obj = withDe(obj);
    else if (prep === 'à' && !/^(à|au|aux)\s/i.test(obj)) obj = withA(obj);
    const s = ('J’ai envie ' + glue(dirForm('me', act), act) + ' ' + obj + ' ' + (m.t || m.s || '')).replace(/\s+/g, ' ').trim();
    return /[!?…]$/.test(s) ? s : s + '.';
  }
  function seeded(seed) { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
  function randomPhrase(rnd, preferBest) {
    const best = preferBest ? (load('meilleurs', null) || {}) : {};
    const pick = (r) => {
      const pool = SOURCE[r].filter((x) => (x.lvl || 1) <= 2);
      const top = (best[ROUE_KEYS[r]] || []).map((w) => pool.find((x) => labelOf(x) === w)).filter(Boolean);
      const from = top.length ? top : pool;
      return from[Math.floor(rnd() * from.length)];
    };
    return phraseOf(pick(0), pick(1), pick(2));
  }
  let weekBusy = false, weekFinal = '', weekLabel = '';
  function rollWeek(final, label) {
    const el = $('#week-text');
    if (!el) return;
    weekFinal = final; weekLabel = label; // la dernière demande gagne, même pendant un tirage
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = final; $('#week-label').textContent = label; return; }
    if (weekBusy) return;
    weekBusy = true;
    let k = 0;
    const tick = () => {
      if (k < 7) { el.textContent = randomPhrase(Math.random); el.classList.add('is-rolling'); k++; setTimeout(tick, 70 + k * 18); return; }
      el.classList.remove('is-rolling');
      el.textContent = weekFinal;
      $('#week-label').textContent = weekLabel;
      weekBusy = false;
    };
    tick();
  }
  function renderWeek() {
    const week = Math.floor((Date.now() / 864e5 + 3) / 7);
    rollWeek(randomPhrase(seeded(week * 7919), true), 'La formule de la semaine');
  }
  $('#week').addEventListener('click', () => { audio(); sClick(); haptic(8); rollWeek(randomPhrase(Math.random), 'Une autre, au hasard'); });

  /* ---------- Appli sur l’écran d’accueil ---------- */
  const installer = { can: () => false, run: () => {} };
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
        note('Installer Kiff Kiff', 'Dans Safari, touche le bouton Partager (le carré avec une flèche), puis « Sur l’écran d’accueil ».');
      }
    };
    btn.addEventListener('click', () => { audio(); installer.run(); });
  }

  window.addEventListener('resize', renderReels);
  init();
  setupInstall();
  renderWeek();
})();
