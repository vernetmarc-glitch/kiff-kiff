/* La Roue du Consentement — logique du jeu.
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

  const LISTS = [
    D.actions.concat([{ free: true }]),
    D.objets.map((t) => ({ t })).concat([{ free: true }]),
    D.manieres.map((t) => ({ t })).concat([{ free: true }])
  ];
  const PLACEHOLDER = ['✎ ton action à toi', '✎ ton endroit à toi', '✎ ta manière à toi'];
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
    muted: load('muted', false)
  };
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
  const maniereForm = (k) => (LISTS[2][k].free ? S.custom[2].trim() : LISTS[2][k].t);
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
      man: maniereForm(idx[2])
    };
  }
  function sentence() {
    const p = parts();
    return ('J’ai envie ' + glue(p.dir, p.act) + ' ' + p.obj + ' ' + p.man).replace(/\s+/g, ' ').trim() + '.';
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
  const sSwitchOn = () => { blip(620, 0, 0.09, 0.05); blip(930, 0.07, 0.12, 0.045); };
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
      this.n = LISTS[r].length;
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
        if (node._t !== txt) {
          node.textContent = txt;
          node._t = txt;
          node.classList.toggle('is-long', txt.length > 22 && txt.length <= 28);
          node.classList.toggle('is-xlong', txt.length > 28);
        }
        node.classList.toggle('is-placeholder', isPlaceholder(this.r, idx));
        node.classList.toggle('is-center', Math.abs(d) < 0.5);
        const vis = Math.abs(a) < Math.PI / 2;
        node.style.opacity = vis ? Math.pow(Math.cos(a), 2).toFixed(3) : '0';
        node.style.transform = 'translateY(' + (Math.sin(a) * R).toFixed(2) + 'px) rotateX(' + (-a * 57.2958).toFixed(2) + 'deg)';
      }
      this.el.setAttribute('aria-valuetext', labelFor(this.r, this.index));
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
    mute: $('#mute'), pass: $('#pass'),
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
    if (S.phase === 'compose') h = '<b>' + A + '</b> propose. Fais tourner les roues, puis active « J’ai envie ».';
    else if (S.phase === 'review' && !ch.length) h = '<b>' + B + '</b>, tu peux changer une roue. Quand la phrase te va, active « J’ai envie aussi ».';
    else if (S.phase === 'review') h = 'Tu as changé ' + REEL_NAMES[ch[0]] + ' : ' + A + ' devra reconfirmer. <button class="undo" type="button" id="undo">Annuler mon changement</button>';
    else if (S.phase === 'reconfirm') h = '<b>' + A + '</b>, ' + B + ' a changé ' + REEL_NAMES[changedReels()[0]] + '. Toujours envie ?';
    el.hint.innerHTML = h;
    const u = $('#undo');
    if (u) u.addEventListener('click', undoChange);
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
    if (ph === 'compose') { setSwitch(el.swTop, false); el.swTop.disabled = false; }
    else if (ph === 'review') {
      setSwitch(el.swTop, !ch.length);
      el.swTop.disabled = true;
      if (ch.length) { el.swTop.classList.add('is-waiting'); el.ownerTop.textContent = A + ' devra reconfirmer'; }
    } else if (ph === 'reconfirm') {
      el.swTop.disabled = false;
      if (el.swTop.getAttribute('aria-checked') !== 'true') el.swTop.classList.add('is-calling');
    }

    // Switch du bas : la réponse de B
    el.ownerBottom.textContent = B;
    el.swBottom.classList.remove('is-idle', 'is-calling');
    if (ph === 'compose') { setSwitch(el.swBottom, false); el.swBottom.disabled = true; el.swBottom.classList.add('is-idle'); }
    else if (ph === 'review') { el.swBottom.disabled = false; }
    else { el.swBottom.disabled = true; }
    el.bottomLabel.textContent = el.swBottom.getAttribute('aria-checked') === 'true' ? 'J’ai envie aussi' : 'Oui mais…';

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
    el.mute.setAttribute('aria-label', S.muted ? 'Remettre le son' : 'Couper le son');
  }
  const renderReels = () => reels.forEach((r) => r.render());

  function onReelSettled(r) {
    if (r === 0) { reels[1].render(); renderDir(); }
    render();
  }

  /* ---------- Overlays ---------- */
  function show(ov) { ov.hidden = false; }
  function hide(ov) { ov.hidden = true; }

  function handoff(to, kind, then) {
    $('#handoff-title').textContent = 'Au tour de ' + nameOf(to);
    $('#handoff-kicker').textContent = 'Passe le téléphone';
    $('#handoff-text').textContent = kind === 'review'
      ? nameOf(other(to)) + ' te fait une proposition. Tu peux changer une roue.'
      : nameOf(other(to)) + ' a changé une roue. La phrase attend ta réponse.';
    const go = $('#handoff-go');
    go.textContent = 'C’est moi, ' + nameOf(to);
    go.onclick = () => { hide(el.ovHandoff); then(); };
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
    el.cabinet.classList.add('is-lit');
    let pending = 3;
    reels.forEach((rl, k) => {
      // la case texte libre ne sort pas au hasard
      const target = Math.floor(Math.random() * (rl.n - 1));
      rl.spinTo(target, 2 + k, 1100 + k * 380);
      const prev = rl.settle.bind(rl);
      rl.settle = () => {
        rl.settle = prev; prev();
        if (--pending === 0) el.cabinet.classList.remove('is-lit');
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
      setTimeout(() => handoff(other(S.proposer), 'review', () => { S.phase = 'review'; render(); }), 650);
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
    el.bottomLabel.textContent = 'J’ai envie aussi';
    if (changedReels().length) {
      setTimeout(() => handoff(S.proposer, 'reconfirm', () => {
        S.phase = 'reconfirm';
        setSwitch(el.swTop, false);
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
  $('#pass-cancel').addEventListener('click', () => hide(el.ovPass));

  function handoffNewTurn(to) {
    $('#handoff-title').textContent = 'Au tour de ' + nameOf(to);
    $('#handoff-kicker').textContent = 'Passe le téléphone';
    $('#handoff-text').textContent = 'C’est toi qui proposes maintenant.';
    const go = $('#handoff-go');
    go.textContent = 'C’est moi, ' + nameOf(to);
    go.onclick = () => { hide(el.ovHandoff); startComposition(to); };
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
    el.cabinet.classList.add('is-lit');
    sParty(); haptic(40);
    confetti();
    save('names', S.names);
  }
  $('#party-next').addEventListener('click', () => {
    hide(el.ovParty);
    stopConfetti();
    el.cabinet.classList.remove('is-lit');
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
    const cols = ['--gold', '--cherry', '--cotton', '--mint', '--butter', '--teal'].map((v) => css.getPropertyValue(v).trim());
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
        shape: i % 5 === 0 ? 'heart' : (i % 3 === 0 ? 'dot' : 'rect')
      });
    }
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
        else ctx.fillRect(-q.s / 2, -q.s / 4, q.s, q.s / 2 * Math.abs(Math.cos(q.r * 2)) + 1);
        ctx.restore();
      });
      if (el2 < 4200) confRaf = requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
    };
    stopConfetti();
    confRaf = requestAnimationFrame(frame);
  }

  /* ---------- Démarrage ---------- */
  function init() {
    S.idx = LISTS.map((l) => Math.floor(Math.random() * (l.length - 1)));
    reels = [0, 1, 2].map((r) => new Reel(r));
    renderReels();
    render();

    $('#name0').value = S.names[0] || '';
    $('#name1').value = S.names[1] || '';
    $('#start-form').addEventListener('submit', (e) => {
      e.preventDefault();
      audio();
      S.names = [$('#name0').value.trim(), $('#name1').value.trim()];
      save('names', S.names);
      document.activeElement && document.activeElement.blur();
      hide(el.ovStart);
      startComposition(0);
      setTimeout(() => shuffle(false), 250);
    });
  }

  window.addEventListener('resize', renderReels);
  init();
})();
