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
  function buildLists(levels) {
    for (let r = 0; r < 3; r++) LISTS[r] = SOURCE[r].filter((x) => levels.includes(x.lvl || 1)).concat([FREE[r]]);
  }
  const PLACEHOLDER = ['touche pour écrire ton action', 'touche pour écrire ton endroit', 'touche pour écrire ta manière'];
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
    started: false,
    bottom: false,
    pass: null
  };
  buildLists(S.levels);
  const nameOf = (i) => (S.names[i] || '').trim() || (i === 0 ? 'Cerise' : 'Pistache');
  const other = (i) => 1 - i;

  /* ---------- Grammaire ---------- */
  const VOWEL = /^[aeiouyàâäéèêëîïôöûüùœæh]/i;
  const isFree = (r, i) => !!LISTS[r][i].free;

  function actionForm(i, dir) {
    const a = LISTS[0][i];
    if (a.free) return S.custom[0].trim();
    return dir === 'me' ? a.s : a.i;
  }
  const actionPrep = (i) => (LISTS[0][i].free ? '' : (LISTS[0][i].p || ''));
  function withA(o) {
    if (/^le\s/i.test(o)) return 'au ' + o.slice(3);
    if (/^les\s/i.test(o)) return 'aux ' + o.slice(4);
    return 'à ' + o;
  }
  function objetForm(j, prep, dir = S.dir) {
    const o = LISTS[1][j];
    const base = o.free ? S.custom[1].trim() : (o.t || (dir === 'me' ? o.s : o.i));
    if (!base) return '';
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
        const key = txt + '|' + lvl;
        if (node._t !== key) {
          node.textContent = '';
          const tx = document.createElement('span');
          tx.className = 'reel-txt';
          tx.textContent = txt;
          node.appendChild(tx);
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
      this.el.setAttribute('aria-valuetext', labelFor(this.r, this.index) + ((cur.lvl || 1) > 1 ? (cur.lvl === 3 ? ', brûlant' : ', pimenté') : '') + (orig ? ', choix de ' + nameOf(S.proposer) : ''));
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
    if (ph === 'compose') { el.actMain.textContent = 'Proposer à ' + B; el.actMain.disabled = false; }
    else if (ph === 'adjust') { el.actMain.textContent = ch.length ? 'Modification faite' : 'J’ai envie aussi'; el.actMain.disabled = false; }
    else { el.actMain.disabled = true; }
    el.actMain.classList.toggle('is-done', ph === 'adjust' && ch.length > 0);
    el.pass.hidden = ph === 'adjust';

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
    kick.textContent = duo ? '' : 'Passe le téléphone à ' + to + '.';
    kick.hidden = !!duo;
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

  $('#offer-yes').addEventListener('click', () => {
    audio();
    if (!myTurn() || (offerKind === 'offer' && S.phase !== 'review') || (offerKind === 'reconfirm' && S.phase !== 'reconfirm')) return;
    hideOffer();
    sSwitchOn(); haptic(15);
    report('kiff', choiceLabels());
    if (duo) { S.phase = 'celebrate'; sync(); }
    setTimeout(celebrate, 220);
  });
  $('#offer-but').addEventListener('click', () => {
    audio();
    if (S.phase !== 'review' || !myTurn()) return;
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

  function shuffle(includeDir) {
    if (includeDir) { S.dir = Math.random() < 0.5 ? 'me' : 'te'; }
    pulse();
    let pending = 3;
    reels.forEach((rl, k) => {
      // la case texte libre ne sort pas au hasard
      const target = Math.floor(Math.random() * (rl.n - 1));
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
    if (!changes().length) {
      report('kiff', choiceLabels());
      if (duo) { S.phase = 'celebrate'; sync(); }
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
    const A = nameOf(S.proposer), B = nameOf(other(S.proposer));
    $('#pass-same').textContent = A + ' propose autre chose';
    $('#pass-other').textContent = B + ' propose à son tour';
    show(el.ovPass);
    sSwitchOff();
  });
  function duoPass(to) {
    S.pass = { by: duo.seat, n: (S.pass ? S.pass.n : 0) + 1 };
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

  function handoffNewTurn(to) {
    $('#handoff-title').textContent = 'Au tour de ' + nameOf(to);
    $('#handoff-kicker').textContent = 'Passe-lui le téléphone.';
    $('#handoff-text').textContent = 'C’est toi qui proposes maintenant.';
    const go = $('#handoff-go');
    go.textContent = 'C’est moi, ' + nameOf(to);
    go.onclick = () => { hide(el.ovHandoff); startComposition(to); };
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
  function celebrate() {
    S.phase = 'celebrate';
    document.body.dataset.phase = 'celebrate';
    $('#party-sentence').textContent = sentence();
    $('#party-next').textContent = 'C’est fait ! À ' + nameOf(other(S.proposer)) + ' de proposer';
    show(el.ovParty);
    pulse();
    sParty(); haptic(40);
    confetti();
    save('names', S.names);
  }
  /* « Ça vous a plu ? » : un café pour les roues */
  const ovCoffee = $('#ov-coffee');
  $('#party-coffee').addEventListener('click', () => { audio(); sClick(); haptic(8); show(ovCoffee); $('#coffee-go').focus({ preventScroll: true }); });
  const closeCoffee = () => { hide(ovCoffee); $('#party-coffee').focus({ preventScroll: true }); };
  $('#coffee-no').addEventListener('click', () => { audio(); sSwitchOff(); closeCoffee(); });
  $('#coffee-go').addEventListener('click', () => { sParty(); haptic(20); setTimeout(() => hide(ovCoffee), 400); });
  ovCoffee.addEventListener('click', (e) => { if (e.target === ovCoffee) closeCoffee(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ovCoffee.hidden) closeCoffee(); });
  $('#party-pass').addEventListener('click', () => {
    hide(el.ovParty);
    stopConfetti();
    el.pass.click();
  });
  $('#party-next').addEventListener('click', () => {
    hide(el.ovParty);
    stopConfetti();
    startComposition(other(S.proposer));
    if (duo) { sync(); renderWait(); }
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
    const shapes = (css.getPropertyValue('--confetti-shapes') || 'rect, dot, heart').split(',').map((v) => v.trim()).filter(Boolean);
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
  const levelNames = () => S.levels.map((n) => D.niveaux[n - 1].nom).join(' + ');
  function setLevels(levels, opts = {}) {
    levels = parseLevels(levels);
    const prev = LISTS.map((l, r) => l[S.idx[r]]);
    S.levels = levels;
    save('levels', levels);
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
    if (reels.length && !opts.silent) render();
    if (!opts.remote) sync();
  }
  function renderLevel() {
    const b = $('#piment-open');
    if (b) {
      b.innerHTML = '<span class="pgroups">' + levelGroups() + '</span>';
      b.setAttribute('aria-label', 'Piment : ' + levelNames() + '. Changer');
    }
    document.querySelectorAll('.piment-list input[type="checkbox"]').forEach((c) => { c.checked = S.levels.includes(+c.value); });
    document.documentElement.dataset.piment = S.levels.join('');
  }

  /* ---------- Ambiances ---------- */
  const SKINS = ['arty', 'pomme', 'redcorner'];
  const SKIN_NAMES = { arty: 'Arty', pomme: 'Pomme d’Amour', redcorner: 'Red Corner' };
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
    requestAnimationFrame(() => {
      const c = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim();
      const m = document.querySelector('meta[name="theme-color"]');
      if (c && m) m.setAttribute('content', c);
      if (reels.length) renderReels();
    });
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
  // Une case se désigne par sa place dans la liste complète (stable quel que soit le piment)
  const keyOf = (r, i) => (LISTS[r][i] && LISTS[r][i].free ? 'f' : SOURCE[r].indexOf(LISTS[r][i]));
  function idxOf(r, k) {
    if (k === 'f') return LISTS[r].length - 1;
    const i = LISTS[r].indexOf(SOURCE[r][k]);
    return i < 0 ? 0 : i;
  }

  let duo = null; // { conn, info, seat, id, seq, lastBy, stage, partnerOn, online, passN }
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
    return {
      v: 1, dv: DATA_V,
      names: S.names.slice(), levels: S.levels.slice(),
      proposer: S.proposer, phase: S.phase, dir: S.dir,
      keys: keys(S.idx), custom: S.custom.slice(),
      original: S.original ? { keys: keys(S.original.idx), custom: S.original.custom.slice(), dir: S.original.dir } : null,
      bottom: !!S.bottom, pass: S.pass || null
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
    if (st.phase === 'ended') {
      if (duo.stage === 'game') note('Fin de la partie à deux', nameOf(st.endBy === 0 ? 0 : 1) + ' a quitté la partie.', () => leaveDuo(false));
      else duoError('ended');
      return;
    }
    if (st.dv !== DATA_V) {
      if (duo.stage === 'game') note('Pas la même version', 'Vos deux téléphones n’ont pas les mêmes roues. Rechargez la page sur les deux téléphones.');
      else duoError('version');
      return;
    }
    if (duo.stage === 'game') { applyGame(st, {}); return; }
    duo.remote = st;
    if (st.phase === 'lobby') {
      if (duo.seat === 0) showInvite();
      else showJoin(st);
    } else if (duo.resume || duo.stage === 'invite') {
      const wasInvite = duo.stage === 'invite';
      enterGame(st, wasInvite);
      if (wasInvite) { sSwitchOn(); haptic(30); report('partie'); }
    } else {
      showJoin(st);
    }
  }

  function enterGame(st, spin) {
    duo.stage = 'game';
    hide($('#ov-duo'));
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
    if (lv.join() !== S.levels.join()) { S.levels = lv; save('levels', lv); buildLists(lv); renderLevel(); }
    S.proposer = st.proposer;
    S.phase = st.phase;
    S.dir = st.dir === 'te' ? 'te' : 'me';
    S.custom = (st.custom || ['', '', '']).slice();
    S.bottom = !!st.bottom;
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
      if (st.pass.by !== duo.seat) {
        hide(el.ovPass);
        note('On passe.', nameOf(st.pass.by) + ' a passé. Pas besoin d’expliquer pourquoi. ' +
          (S.proposer === duo.seat ? 'C’est à toi de proposer.' : nameOf(S.proposer) + ' propose autre chose.'));
      }
    }
    S.pass = st.pass || null;

    if (S.phase === 'celebrate' && prev.phase !== 'celebrate') celebrate();
    if (S.phase !== 'celebrate' && !el.ovParty.hidden) { hide(el.ovParty); stopConfetti(); }
    if (!myTurn() && !el.ovEdit.hidden) { hide(el.ovEdit); editing = -1; }
    if (arrived && S.phase !== 'celebrate') { sSwitchOn(); haptic(30); }
    renderReels();
    render();
    // La proposition (ou l’envie ajustée) arrive dans une modale
    const want = myTurn() && S.phase === 'review' ? 'offer' : (myTurn() && S.phase === 'reconfirm' ? 'reconfirm' : '');
    if (want && (offerKind !== want || el.ovOffer.hidden)) showOffer(want);
    else if (!want && offerKind) hideOffer();
    renderWait();
  }

  /* Écran d’attente : pendant que l’autre téléphone a la main */
  function renderWait() {
    const ov = $('#ov-wait');
    const waiting = !!duo && duo.stage === 'game' && el.ovStart.hidden &&
      ['compose', 'review', 'adjust', 'reconfirm'].includes(S.phase) && !myTurn();
    if (!waiting) { hide(ov); renderDuoStatus(); return; }
    const A = nameOf(S.proposer), B = nameOf(other(S.proposer));
    let title, kicker, text, sent = '';
    if (S.phase === 'compose') {
      title = 'Au tour de ' + A;
      kicker = A + ' compose une envie.';
      text = 'Elle arrivera ici dès que ' + A + ' la proposera.';
    } else if (S.phase === 'review') {
      title = 'Envie envoyée';
      kicker = B + ' la lit.';
      sent = S.original ? sentenceFrom(S.original) : sentence();
      text = B + ' peut dire « J’ai envie aussi », ou changer une chose avant de répondre.';
    } else if (S.phase === 'adjust') {
      title = B + ' ajuste ton envie';
      kicker = B + ' change une seule chose.';
      sent = S.original ? sentenceFrom(S.original) : sentence();
      text = 'Tu verras la nouvelle version ici, et tu pourras dire oui ou passer.';
    } else {
      const ch = changes();
      title = 'Au tour de ' + A;
      kicker = 'Tu as changé ' + CHANGE_NAMES[ch.length ? ch[0] : 0] + '.';
      sent = sentence();
      text = A + ' relit l’envie ajustée.';
    }
    $('#wait-title').textContent = title;
    $('#wait-kicker').textContent = kicker;
    $('#wait-text').textContent = text;
    const ws = $('#wait-sentence');
    ws.hidden = !sent;
    ws.textContent = sent;
    show(ov);
    renderDuoStatus();
  }

  /* Connexion : la mienne et celle de l’autre */
  function renderDuoStatus() {
    const line = $('#duo-status');
    if (!duo || duo.stage !== 'game') { line.hidden = true; return; }
    const B = nameOf(other(duo.seat));
    let msg = '';
    if (duo.online === false) msg = 'Connexion perdue. Je réessaie…';
    else if (duo.partnerOn === false) msg = B + ' n’est plus connecté·e. Tout reprendra dès son retour.';
    line.textContent = msg;
    line.hidden = !msg;
    const wp = $('#wait-presence');
    $('#wait-presence-text').textContent = msg || (B + ' est connecté·e.');
    wp.classList.toggle('is-off', !!msg);
    const ht = $('#duo-home-text');
    if (ht) ht.textContent = 'Partie à deux avec ' + B + (msg ? '. ' + msg : ', connecté·e.');
  }

  const duoHandlers = {
    state: (st) => onRemoteState(st),
    presence: (seat, on) => { if (duo) { duo.partnerOn = on; renderDuoStatus(); } },
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
    $('#duo-wait-text').textContent = o.wait || '';
    $('#duo-error').hidden = !o.error;
    $('#duo-error').textContent = o.error || '';
    $('#duo-go').hidden = !o.go;
    $('#duo-go').textContent = o.go || '';
    $('#duo-go').disabled = false;
    $('#duo-cancel').textContent = o.cancel || 'Annuler';
    ovDuo.dataset.stage = o.stage;
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
      text: 'Fais scanner ce code par l’autre téléphone, ou envoie-lui le lien. La partie commence dès que l’autre l’ouvre.',
      qr: true, wait: 'En attente de l’autre téléphone…', cancel: 'Annuler la partie'
    });
  }
  function showJoin(st) {
    duo.stage = 'join';
    duo.remote = st;
    duoName.value = load('duoName', '') || '';
    duoName.placeholder = 'Pistache';
    const A = (st.names && st.names[0] || '').trim() || 'Cerise';
    duoSheet({
      stage: 'join',
      title: A + ' t’invite',
      text: st.phase === 'lobby'
        ? 'Kiff Kiff à deux téléphones : ' + A + ' propose sur son téléphone, tu réponds sur le tien. Écris ton prénom pour rejoindre la partie.'
        : 'La partie de ' + A + ' est déjà commencée. Écris ton prénom pour la rejoindre.',
      name: true, go: 'Rejoindre', cancel: 'Jouer sur ce téléphone seulement'
    });
    setTimeout(() => duoName.focus(), 80);
  }
  function joinGame() {
    const st = duo.remote;
    const name = duoName.value.replace(/\s+/g, ' ').trim().slice(0, 20);
    save('duoName', name);
    const next = Object.assign({}, st);
    next.names = [(st.names && st.names[0]) || '', name];
    if (st.phase === 'lobby') {
      // La partie commence : rouleaux au hasard, la personne qui a invité propose
      const lv = parseLevels(st.levels);
      buildLists(lv);
      next.phase = 'compose';
      next.proposer = 0;
      next.keys = [0, 1, 2].map((r) => keyOf(r, Math.floor(Math.random() * (LISTS[r].length - 1))));
      next.original = null; next.bottom = false;
    }
    duo.resume = true;
    save('duo', { room: duo.info.room, key: duo.info.key, broker: duo.info.broker, seat: duo.seat, id: duo.id });
    enterGame(next);
    pushState();
  }

  async function startJoin(info) {
    const stored = load('duo', null);
    const same = stored && stored.room === info.room && stored.key === info.key;
    const seat = same ? stored.seat : 1;
    const id = same && stored.id ? stored.id : (KiffDuoOk() ? window.KiffDuo.newId() : 'x');
    hide(el.ovStart);
    duoSheet({ stage: 'connecting', title: 'Kiff Kiff à deux', wait: 'Connexion à la partie…', cancel: 'Jouer sur ce téléphone seulement' });
    if (!KiffDuoOk()) { duoError('support'); return; }
    // Les deux téléphones doivent avoir les mêmes mots : on attend un instant ceux de l’atelier
    await Promise.race([motsReady, new Promise((r) => setTimeout(r, 4000))]);
    applyPendingMots();
    duo = { info, seat, id, seq: 0, lastBy: '', stage: 'connecting', resume: !!same, partnerOn: null, online: true, passN: null };
    try { await loadDuoLibs(); } catch (e) { duoError('net'); return; }
    try {
      const conn = await window.KiffDuo.join(info, seat, id, duoHandlers);
      if (!duo || duo.id !== id) { conn.close(false); return; }
      duo.conn = conn;
    } catch (e) { duoError('relay'); return; }
    duo.findT = setTimeout(() => { if (duo && duo.stage === 'connecting') duoError('notfound'); }, 9000);
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
    duoSheet({
      stage: 'error', title: 'Sur deux téléphones', error: msgs[kind] || msgs.relay,
      go: retry ? 'Réessayer' : '', cancel: 'Jouer sur ce téléphone seulement'
    });
    ovDuo.dataset.retry = kind;
  }

  async function leaveDuo(announce) {
    const d = duo;
    duo = null;
    clearTimeout(syncT);
    save('duo', null);
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* rien */ }
    hide(ovDuo); hide($('#ov-wait')); hide($('#ov-note'));
    if (d && d.conn) {
      if (announce && d.stage === 'game') {
        const st = Object.assign(snapshot(), { phase: 'ended', endBy: d.seat, seq: d.seq + 1, by: d.id });
        d.conn.publishState(st);
      }
      d.conn.close(announce && d.stage !== 'game').catch(() => {});
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
    leaveDuo(stage === 'invite');
  });
  $('#duo-copy').addEventListener('click', async () => {
    const url = duo && duo.info ? window.KiffDuo.link(duo.info) : '';
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch (e) { ok = false; }
    $('#duo-copy').textContent = ok ? 'Lien copié' : 'Copie impossible';
    setTimeout(() => { $('#duo-copy').textContent = 'Copier le lien'; }, 1800);
  });
  $('#duo-send').addEventListener('click', () => {
    if (!duo || !duo.info) return;
    navigator.share({ title: 'Kiff Kiff', text: 'On joue à Kiff Kiff ? Ouvre ce lien sur ton téléphone.', url: window.KiffDuo.link(duo.info) }).catch(() => {});
  });
  $('#wait-pass').addEventListener('click', () => el.pass.click());
  $('#wait-home').addEventListener('click', () => el.home.click());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && duo && duo.conn) duo.conn.wake();
  });
  window.addEventListener('online', () => { if (duo && duo.conn) duo.conn.wake(); });

  /* ---------- Atelier en ligne : comptes anonymes et mots modifiés ---------- */
  const API = window.KIFF_API || '';
  // Ce qui est envoyé : le type d’événement et, pour une envie ou un kiff kiff, le mot de chaque roue.
  // Jamais de prénom ni de texte écrit à la main.
  function report(type, choix) {
    if (!API) return;
    try {
      fetch(API, { method: 'POST', mode: 'no-cors', keepalive: true, body: JSON.stringify({ action: 'event', type, choix: choix || null }) }).catch(() => {});
    } catch (e) { /* rien */ }
  }
  function choiceLabels() {
    return [0, 1, 2].map((r) => {
      const x = LISTS[r][S.idx[r]];
      if (!x || x.free) return '(texte libre)';
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
    $('#welcome-go').addEventListener('click', () => { audio(); sClick(); haptic(8); goStep(1); });
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
      $('#rule-a').textContent = nameOf(0);
      $('#rule-b').textContent = where === 'duo' ? 'L’autre' : nameOf(1);
      $('#piment-go').textContent = where === 'duo' ? 'Inviter l’autre téléphone' : 'C’est parti';
      save('where', where);
      sClick(); haptic(8);
      goStep(2);
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
    $('#rules-ok').addEventListener('click', () => { audio(); sClick(); haptic(8); goStep(3); });
    setupSwipe();
    document.querySelectorAll('.step-back').forEach((b) => b.addEventListener('click', () => { audio(); goStep(Math.max(0, step - 1)); }));
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
    $('#duo-resume').addEventListener('click', () => { audio(); hide(el.ovStart); renderWait(); });
    $('#duo-quit').addEventListener('click', () => { audio(); leaveDuo(true); });
    goStep(0, true);
    const inv = window.KiffDuo && window.KiffDuo.parse(location.hash);
    if (inv) startJoin(inv);
  }

  /* ---------- Accueil : écrans successifs ---------- */
  let step = 0;
  let where = 'here';
  // Glisser le doigt vers la droite ramène à l’écran précédent (le doigt entraîne l’écran)
  function setupSwipe() {
    const box = $('#steps');
    const track = box.querySelector('.steps-track');
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
      dx = ddx > 0 ? (step === 0 ? ddx / 4 : ddx) : ddx / 5;
      track.style.transform = 'translateX(calc(' + (-step * 100) + '% + ' + dx.toFixed(1) + 'px))';
    }, { passive: true });
    const end = () => {
      if (!on) return;
      on = false;
      if (!horiz) return;
      box.classList.remove('is-dragging');
      track.style.transform = '';
      if (dx > Math.min(90, box.clientWidth * 0.22) && step > 0) { audio(); sClick(); haptic(8); goStep(step - 1); }
    };
    box.addEventListener('touchend', end);
    box.addEventListener('touchcancel', end);
  }
  function goStep(n, instant) {
    const box = $('#steps');
    step = n;
    if (instant) box.classList.add('is-instant');
    box.style.setProperty('--step', n);
    box.dataset.step = n;
    box.querySelectorAll('.step').forEach((sec) => {
      const on = +sec.dataset.step === n;
      sec.inert = !on;
      sec.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    document.querySelectorAll('#step-dots i').forEach((d, k) => d.classList.toggle('is-on', k === n));
    el.ovStart.scrollTop = 0;
    if (instant) { void box.offsetWidth; box.classList.remove('is-instant'); }
  }
  function launchGame() {
    applyPendingMots();
    report('partie');
    hide(el.ovStart);
    S.started = true;
    S.mustRestart = false;
    startComposition(0);
    setTimeout(() => shuffle(false), 300);
  }

  function openHome() {
    const inDuo = !!duo && duo.stage === 'game';
    $('#steps').classList.toggle('is-duo', inDuo);
    $('#duo-home').hidden = !inDuo;
    $('#welcome-go').hidden = inDuo;
    $('#name0').value = S.names[0] || '';
    $('#name1').value = S.names[1] || '';
    $('#resume').hidden = inDuo || !S.started || !!S.mustRestart;
    $('#welcome-go').textContent = S.started ? 'Nouvelle partie' : 'Commencer';
    goStep(0, true);
    show(el.ovStart);
    el.ovStart.scrollTop = 0;
    renderWait();
    renderDuoStatus();
  }

  /* ---------- Appli sur l’écran d’accueil ---------- */
  function setupInstall() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    const btn = $('#install');
    const standalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    if (standalone()) return;
    let deferred = null;
    // Android (Chrome, Edge, Samsung) : le navigateur propose l’installation, on la garde pour le bouton
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e;
      btn.hidden = false;
    });
    window.addEventListener('appinstalled', () => { deferred = null; btn.hidden = true; });
    // iPhone : pas d’installation automatique, on explique le geste
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios) btn.hidden = false;
    btn.addEventListener('click', async () => {
      audio();
      if (deferred) {
        deferred.prompt();
        try { await deferred.userChoice; } catch (e) { /* rien */ }
        deferred = null;
        btn.hidden = true;
      } else if (ios) {
        note('Installer Kiff Kiff', 'Dans Safari, touche le bouton Partager (le carré avec une flèche), puis « Sur l’écran d’accueil ».');
      }
    });
  }

  window.addEventListener('resize', renderReels);
  init();
  setupInstall();
})();
