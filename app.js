/* Kiff Kiff — logique du jeu.
 *
 * Déroulé d’un tour (A propose, B répond) :
 *   compose   : A règle la direction et les trois rouleaux, puis active « J’ai envie ».
 *   review    : B peut changer UN rouleau (les deux autres se verrouillent dès qu’un change).
 *               B active « J’ai envie aussi ».
 *                 - rien n’a changé  → célébration
 *                 - un rouleau a changé → reconfirm
 *   reconfirm : le « J’ai envie » de A est grisé ; A le réactive → célébration.
 *   celebrate : puis les rôles s’inversent.
 * « On passe » est disponible à tout moment.
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
    started: false
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
  function objetForm(j, prep) {
    const o = LISTS[1][j];
    const base = o.free ? S.custom[1].trim() : o.t;
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
      obj: objetForm(idx[1], actionPrep(idx[0])),
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
          node.textContent = txt;
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
        }
        node.classList.toggle('is-placeholder', isPlaceholder(this.r, idx));
        node.classList.toggle('is-center', Math.abs(d) < 0.5);
        const vis = Math.abs(a) < Math.PI / 2;
        node.style.opacity = vis ? Math.pow(Math.cos(a), 2).toFixed(3) : '0';
        node.style.transform = 'translateY(' + (Math.sin(a) * R).toFixed(2) + 'px) rotateX(' + (-a * 57.2958).toFixed(2) + 'deg)';
      }
      const cur = LISTS[this.r][this.index];
      this.el.setAttribute('aria-valuetext', labelFor(this.r, this.index) + ((cur.lvl || 1) > 1 ? (cur.lvl === 3 ? ', brûlant' : ', pimenté') : ''));
      const t = Math.round(this.p);
      if (t !== this.lastTick) {
        this.lastTick = t;
        tick();
        if (this.r === 0) { reels[1].render(); renderDir(); }
      }
    }

    canMove() {
      if (S.phase === 'compose') return true;
      if (S.phase === 'review') return !this.locked && !reels.some((o) => o !== this && o.busy);
      return false;
    }
    nope() {
      this.el.classList.remove('is-nope');
      void this.el.offsetWidth;
      this.el.classList.add('is-nope', 'show-lock');
      sNope(); haptic(20);
      clearTimeout(this._nopeT);
      this._nopeT = setTimeout(() => this.el.classList.remove('show-lock'), 1400);
      if (S.phase === 'review' && this.locked) flashHint('Une seule roue par tour. Remets l’autre en place pour changer celle-ci.');
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
      S.idx[this.r] = this.index;
      onReelSettled(this.r);
    }
    setLocked(on) {
      this.locked = on;
      this.el.classList.toggle('is-locked', on);
      this.el.setAttribute('aria-disabled', on ? 'true' : 'false');
    }

    bind() {
      const el = this.el;
      el.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
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
    swTop: $('#sw-top'), swBottom: $('#sw-bottom'),
    ownerTop: $('#owner-top'), ownerBottom: $('#owner-bottom'),
    bottomLabel: $('#bottom-label'),
    dir: $('#dir'), dice: $('#dice'), cabinet: $('#cabinet'),
    mute: $('#mute'), pass: $('#pass'), home: $('#home'),
    ovStart: $('#ov-start'), ovHandoff: $('#ov-handoff'), ovPass: $('#ov-pass'),
    ovEdit: $('#ov-edit'), ovParty: $('#ov-party')
  };

  /* ---------- Comparaison avec la proposition d’origine ---------- */
  const reelValue = (r, idx = S.idx, custom = S.custom) => (isFree(r, idx[r]) ? 'free:' + custom[r].trim() : String(idx[r]));
  function changedReels() {
    if (!S.original) return [];
    return [0, 1, 2].filter((r) => reelValue(r) !== reelValue(r, S.original.idx, S.original.custom));
  }

  /* ---------- Rendu ---------- */
  function renderDir() {
    const a0 = reels[0] ? reels[0].index : S.idx[0];
    el.dir.dataset.dir = S.dir;
    el.dir.querySelectorAll('button').forEach((b) => {
      const d = b.dataset.dir;
      b.textContent = dirForm(d, actionForm(a0, d));
      b.setAttribute('aria-pressed', d === S.dir ? 'true' : 'false');
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
    const ch = changedReels();
    let h = '';
    if (S.phase === 'compose') h = '<b>' + A + '</b>, fais glisser les roues pour composer ton envie, puis active « J’ai envie ».';
    else if (S.phase === 'review' && !ch.length) h = '<b>' + B + '</b>, tu peux changer une roue. Si la phrase te va, active « J’ai envie aussi ».';
    else if (S.phase === 'review') h = 'Tu as changé ' + REEL_NAMES[ch[0]] + ' : ' + A + ' devra redire « J’ai envie ». <button class="undo" type="button" id="undo">Annuler mon changement</button>';
    else if (S.phase === 'reconfirm') h = '<b>' + A + '</b>, ' + B + ' a changé ' + REEL_NAMES[changedReels()[0]] + '. Toujours envie ? Sinon, « On passe ».';
    el.hint.innerHTML = h;
    const u = $('#undo');
    if (u) u.addEventListener('click', undoChange);
  }

  function setBottomLabel() {
    /* Le libellé reste « J’ai envie aussi » : grisé tant que l’autre n’a pas dit oui */
    el.bottomLabel.textContent = 'J’ai envie aussi';
    el.bottomLabel.dataset.ink = 'J’ai envie aussi';
  }
  function pulse() {
    document.body.classList.remove('is-pulse');
    void document.body.offsetWidth;
    document.body.classList.add('is-pulse');
    clearTimeout(pulse.t);
    pulse.t = setTimeout(() => document.body.classList.remove('is-pulse'), 950);
  }

  function setSwitch(sw, on) { sw.setAttribute('aria-checked', on ? 'true' : 'false'); }

  function render() {
    const ph = S.phase;
    const A = nameOf(S.proposer);
    const B = nameOf(other(S.proposer));
    const ch = changedReels();
    document.body.dataset.phase = ph;

    // Switch du haut : l’envie de A
    el.ownerTop.textContent = A;
    el.swTop.classList.remove('is-waiting', 'is-calling', 'is-idle');
    if (ph === 'compose') {
      setSwitch(el.swTop, false); el.swTop.disabled = false;
      if (!el.swTop.disabled) el.swTop.classList.add('is-calling');
    } else if (ph === 'review') {
      setSwitch(el.swTop, !ch.length);
      el.swTop.disabled = true;
      if (ch.length) { el.swTop.classList.add('is-waiting'); el.ownerTop.textContent = A + ' devra le redire'; }
    } else if (ph === 'reconfirm') {
      el.swTop.disabled = false;
      if (el.swTop.getAttribute('aria-checked') !== 'true') el.swTop.classList.add('is-calling');
    }

    // Switch du bas : la réponse de B
    el.ownerBottom.textContent = B;
    el.swBottom.classList.remove('is-idle', 'is-calling');
    if (ph === 'compose') { setSwitch(el.swBottom, false); el.swBottom.disabled = true; el.swBottom.classList.add('is-idle'); }
    else if (ph === 'review') {
      el.swBottom.disabled = el.swBottom.getAttribute('aria-checked') === 'true';
      if (!el.swBottom.disabled) el.swBottom.classList.add('is-calling');
    } else { el.swBottom.disabled = true; }
    setBottomLabel();

    // Direction et hasard : seulement pour A pendant la composition
    el.dir.classList.toggle('is-locked', ph !== 'compose');
    el.dice.hidden = ph !== 'compose';

    // Verrous des rouleaux
    reels.forEach((rl) => {
      let lock = ph !== 'compose';
      if (ph === 'review') lock = ch.length > 0 && !ch.includes(rl.r);
      rl.setLocked(lock);
      rl.el.classList.toggle('is-changed', (ph === 'review' || ph === 'reconfirm') && ch.includes(rl.r));
    });

    renderDir();
    renderHint();
    el.mute.setAttribute('aria-pressed', S.muted ? 'true' : 'false');
    $('#mute-state').textContent = S.muted ? 'coupé' : 'activé';
  }
  const renderReels = () => reels.forEach((r) => r.render());

  function onReelSettled(r) {
    if (r === 0) { reels[1].render(); renderDir(); }
    render();
  }

  /* ---------- Overlays ---------- */
  function show(ov) { ov.hidden = false; }
  function hide(ov) { ov.hidden = true; }

  function handoff(to, kind, then, back) {
    $('#handoff-title').textContent = 'Au tour de ' + nameOf(to);
    $('#handoff-kicker').textContent = 'Passe-lui le téléphone.';
    $('#handoff-text').textContent = kind === 'review'
      ? nameOf(other(to)) + ' te propose une envie. Tu peux changer une roue avant de répondre.'
      : nameOf(other(to)) + ' a changé ' + REEL_NAMES[changedReels()[0]] + '. Toujours envie ?';
    const go = $('#handoff-go');
    go.textContent = 'C’est moi, ' + nameOf(to);
    go.onclick = () => { hide(el.ovHandoff); then(); };
    const bk = $('#handoff-back');
    bk.hidden = !back;
    bk.textContent = 'Oups, ' + nameOf(other(to)) + ' n’avait pas fini';
    bk.onclick = back ? () => { hide(el.ovHandoff); back(); } : null;
    show(el.ovHandoff);
    go.focus({ preventScroll: true });
  }

  /* ---------- Actions ---------- */
  function startComposition(proposer) {
    S.proposer = proposer;
    S.phase = 'compose';
    S.original = null;
    setSwitch(el.swTop, false);
    setSwitch(el.swBottom, false);
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

  el.swTop.addEventListener('click', () => {
    audio();
    if (S.phase === 'compose') {
      if (reels.some((r) => r.busy)) return;
      const m = missingFree();
      if (m !== undefined) { reels[m].nope(); flashHint('Écris ' + REEL_NAMES[m] + ' ou choisis une autre case.'); return; }
      S.original = { idx: S.idx.slice(), custom: S.custom.slice(), dir: S.dir };
      setSwitch(el.swTop, true); sSwitchOn(); haptic(15);
      el.swTop.disabled = true;
      el.swTop.classList.remove('is-calling');
      setTimeout(() => handoff(other(S.proposer), 'review', () => { S.phase = 'review'; render(); }, () => {
        // « Oups, je n’avais pas fini » : retour à la composition
        S.original = null;
        setSwitch(el.swTop, false);
        render();
      }), 650);
    } else if (S.phase === 'reconfirm') {
      setSwitch(el.swTop, true); sSwitchOn(); haptic(15);
      el.swTop.classList.remove('is-calling');
      el.swTop.disabled = true;
      setTimeout(celebrate, 600);
    }
  });

  el.swBottom.addEventListener('click', () => {
    audio();
    if (S.phase !== 'review' || reels.some((r) => r.busy)) return;
    const m = missingFree();
    if (m !== undefined) { reels[m].nope(); flashHint('Écris ' + REEL_NAMES[m] + ' ou choisis une autre case.'); return; }
    setSwitch(el.swBottom, true); sSwitchOn(); haptic(15);
    el.swBottom.disabled = true;
    el.swBottom.classList.remove('is-calling');
    if (changedReels().length) {
      setTimeout(() => handoff(S.proposer, 'reconfirm', () => {
        S.phase = 'reconfirm';
        setSwitch(el.swTop, false);
        render();
      }, () => {
        // retour à l’ajustement
        setSwitch(el.swBottom, false);
        render();
      }), 650);
    } else {
      setTimeout(celebrate, 600);
    }
  });

  function undoChange() {
    const ch = changedReels();
    if (!ch.length) return;
    const r = ch[0];
    S.custom[r] = S.original.custom[r];
    reels[r].animateTo(Math.round(reels[r].p) + shortest(reels[r].index, S.original.idx[r], reels[r].n), 380, ease.outBack);
    sSwitchOff();
  }
  function shortest(from, to, n) {
    let d = mod(to - from, n);
    if (d > n / 2) d -= n;
    return d;
  }

  el.dir.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    audio();
    if (S.phase !== 'compose') { sNope(); haptic(20); flashHint(S.phase === 'review' ? 'Le début de la phrase appartient à ' + nameOf(S.proposer) + '.' : ''); return; }
    if (S.dir === b.dataset.dir) return;
    S.dir = b.dataset.dir;
    sClick(); haptic(8);
    renderReels();
    render();
  });

  el.dice.addEventListener('click', () => {
    audio();
    if (S.phase !== 'compose' || reels.some((r) => r.busy)) return;
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
  $('#pass-same').addEventListener('click', () => { hide(el.ovPass); startComposition(S.proposer); });
  $('#pass-other').addEventListener('click', () => {
    hide(el.ovPass);
    const to = other(S.proposer);
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
    $('#party-sentence').textContent = sentence();
    $('#party-next').textContent = 'C’est fait ! À ' + nameOf(other(S.proposer)) + ' de proposer';
    show(el.ovParty);
    pulse();
    sParty(); haptic(40);
    confetti();
    save('names', S.names);
  }
  $('#party-pass').addEventListener('click', () => {
    hide(el.ovParty);
    stopConfetti();
    el.pass.click();
  });
  $('#party-next').addEventListener('click', () => {
    hide(el.ovParty);
    stopConfetti();
    startComposition(other(S.proposer));
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
    if (S.started && S.phase !== 'compose') S.mustRestart = true;
    renderReels();
    renderLevel();
    if (reels.length && !opts.silent) render();
  }
  function renderLevel() {
    const b = $('#piment-open');
    if (b) {
      b.innerHTML = '<span class="pgroups">' + levelGroups() + '</span>';
      b.setAttribute('aria-label', 'Piment : ' + levelNames() + '. Changer');
    }
    const h = $('#piment-home');
    if (h) {
      $('#piment-summary').innerHTML = levelGroups();
      h.setAttribute('aria-label', 'Piment : ' + levelNames() + '. Choisir les niveaux');
    }
    document.querySelectorAll('#ov-piment input[type="checkbox"]').forEach((c) => { c.checked = S.levels.includes(+c.value); });
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

  /* ---------- Démarrage ---------- */
  function init() {
    S.idx = LISTS.map((l) => Math.floor(Math.random() * (l.length - 1)));
    reels = [0, 1, 2].map((r) => new Reel(r));
    renderReels();
    render();

    applySkin(currentSkin());
    /* Piment : niveaux à cocher, depuis l’accueil ou le jeu */
    const ovPiment = $('#ov-piment');
    const list = $('#piment-list');
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
        const err = $('#piment-error');
        err.hidden = false;
        clearTimeout(err._t);
        err._t = setTimeout(() => { err.hidden = true; }, 2400);
        return;
      }
      sClick(); haptic(8);
      setLevels(next, { silent: S.phase === 'start' });
    }));
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
      if (S.phase !== 'compose') {
        sNope(); haptic(20);
        flashHint('Le piment se règle pendant la composition, avant de proposer.');
        return;
      }
      openPiment($('#piment-open'));
    });
    $('#piment-home').addEventListener('click', () => { audio(); openPiment($('#piment-home')); });
    const closePiment = () => {
      hide(ovPiment);
      if (S.mustRestart) { $('#resume').hidden = true; $('#start-go').textContent = 'Nouvelle partie'; }
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
      hide(el.ovStart);
    };
    $('#start-form').addEventListener('submit', (e) => {
      e.preventDefault();
      audio();
      readNames();
      S.started = true;
      S.mustRestart = false;
      startComposition(0);
      setTimeout(() => shuffle(false), 250);
    });
    // Reprendre la partie : garde le tour en cours, applique les prénoms éventuellement changés
    $('#resume').addEventListener('click', () => {
      audio();
      readNames();
      render();
    });
    // Retour à l’accueil depuis le jeu
    el.home.addEventListener('click', () => {
      audio();
      $('#name0').value = S.names[0] || '';
      $('#name1').value = S.names[1] || '';
      $('#resume').hidden = !S.started || !!S.mustRestart;
      $('#start-go').textContent = S.started ? 'Nouvelle partie' : 'C’est parti';
      show(el.ovStart);
      el.ovStart.scrollTop = 0;
    });
  }

  window.addEventListener('resize', renderReels);
  init();
})();
