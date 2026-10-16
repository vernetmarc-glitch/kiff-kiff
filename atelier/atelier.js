/* Kiff Kiff · l’atelier — statistiques des parties et édition des mots des roues.
 * Les données vivent dans la feuille Google Sheets de Marc, derrière un petit script
 * Google Apps Script (apps-script.gs). Sans script configuré, la page montre les mots
 * actuels de l’appli (data.js) et explique la mise en place. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem('atelier:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('atelier:' + k, JSON.stringify(v)); } catch (e) { /* rien */ } }
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CHILI = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#chili"/></svg>';
  const ROUES = ['action', 'endroit', 'maniere'];
  const KEY = { action: 'actions', endroit: 'objets', maniere: 'manieres' };
  const NOMS = { action: 'Actions', endroit: 'Endroits', maniere: 'Manières' };
  const NIV = (window.ROUE_DATA && window.ROUE_DATA.niveaux) || [{ n: 1, nom: 'Tendre' }, { n: 2, nom: 'Pimenté' }, { n: 3, nom: 'Brûlant' }];

  let api = store.get('api', '') || window.KIFF_API || '';
  let pwd = store.get('pwd', '');

  /* ---------- Échanges avec le script Google ---------- */
  async function call(method, params, body) {
    if (!api) throw new Error('pas d’adresse');
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 15000);
    try {
      const url = api + (params ? (api.includes('?') ? '&' : '?') + new URLSearchParams(params) : '');
      const r = await fetch(url, method === 'POST' ? { method: 'POST', body: JSON.stringify(body), signal: ctl.signal } : { signal: ctl.signal });
      return await r.json();
    } finally { clearTimeout(t); }
  }
  function banner(text, error) {
    const b = $('#banner');
    b.textContent = text || '';
    b.hidden = !text;
    b.classList.toggle('is-error', !!error);
  }

  /* ---------- Onglets ---------- */
  function showTab(name) {
    ['stats', 'mots', 'reglages'].forEach((t) => {
      $('#tab-' + t).setAttribute('aria-selected', t === name ? 'true' : 'false');
      $('#panel-' + t).hidden = t !== name;
    });
    store.set('tab', name);
    if (name === 'stats') loadStats();
  }
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.id.slice(4))));

  /* ---------- Statistiques ---------- */
  let stats = null;
  let by = 'kiffs';
  const fmt = (n) => (n == null ? '–' : Number(n).toLocaleString('fr-FR'));
  async function loadStats() {
    if (!api) { renderStats(); return; }
    try {
      const res = await call('GET', { action: 'stats' });
      if (!res || !res.ok) throw new Error('réponse');
      stats = res;
      $('#stats-time').textContent = 'Mis à jour à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      banner('Je n’arrive pas à lire les statistiques. Vérifie l’adresse dans Réglages.', true);
    }
    renderStats();
  }
  function renderStats() {
    const c = (stats && stats.compteurs) || {};
    ['kiff', 'partie', 'envie', 'passe'].forEach((k) => { $('#c-' + k).textContent = stats ? fmt(c[k] || 0) : '–'; });
    $('#rate').textContent = stats && c.envie ? Math.round(100 * (c.kiff || 0) / c.envie) + ' % des envies proposées sont devenues un kiff kiff.' : '';
    const tops = $('#tops');
    if (!api) { tops.innerHTML = '<p class="empty">Les statistiques arriveront une fois la feuille Google branchée (voir Réglages).</p>'; return; }
    if (!stats) { tops.innerHTML = '<p class="empty">Chargement…</p>'; return; }
    tops.innerHTML = ROUES.map((r) => {
      const list = (stats.choix || []).filter((x) => x.roue === r && x[by] > 0).sort((a, b) => b[by] - a[by]);
      const max = list.length ? list[0][by] : 1;
      const unit = by === 'kiffs' ? 'kiff kiff' : 'envies';
      if (!list.length) return '<div class="top-card"><h3>' + NOMS[r] + '</h3><p class="top-sub">Rien pour l’instant.</p></div>';
      return '<div class="top-card"><h3>' + NOMS[r] + '</h3>' +
        '<p class="top-word">' + esc(list[0].mot) + '</p>' +
        '<p class="top-sub">' + fmt(list[0][by]) + ' ' + unit + '</p>' +
        '<ol class="top-list">' + list.slice(1, 6).map((x) =>
          '<li><span class="w">' + esc(x.mot) + '</span><span class="v">' + fmt(x[by]) + '</span><span class="bar"><i style="width:' + Math.max(4, Math.round(100 * x[by] / max)) + '%"></i></span></li>'
        ).join('') + '</ol></div>';
    }).join('');
  }
  $$('.by .chip').forEach((b) => b.addEventListener('click', () => {
    by = b.dataset.by;
    $$('.by .chip').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    renderStats();
  }));
  $('#refresh').addEventListener('click', loadStats);

  /* ---------- Les mots ---------- */
  // Suggestion de la forme « de te » à partir de la forme « que tu me »
  const IRR = {
    fasses: 'faire', mettes: 'mettre', intromettes: 'intromettre', mordes: 'mordre', circlues: 'circlure', lises: 'lire', dises: 'dire',
    prennes: 'prendre', rendes: 'rendre', 'écrives': 'écrire', offres: 'offrir', ouvres: 'ouvrir', sentes: 'sentir', boives: 'boire',
    tendes: 'tendre', ailles: 'aller', viennes: 'venir', tiennes: 'tenir', ken: 'ken', fesses: 'fesser', suces: 'sucer'
  };
  const swapTes = (t) => t.replace(/\b(tes|ton|ta)\b/g, (w) => ({ tes: 'mes', ton: 'mon', ta: 'ma' }[w]));
  function suggestI(s) {
    const m = String(s).trim().match(/^(\S+)(.*)$/);
    if (!m) return '';
    const v = m[1];
    let inf = IRR[v.toLowerCase()];
    if (!inf) {
      if (/è([^aeiouyéèê\s]+)es$/i.test(v)) inf = v.replace(/è([^aeiouyéèê\s]+)es$/i, 'e$1er');
      else if (/es$/i.test(v)) inf = v.slice(0, -2) + 'er';
      else inf = v;
    }
    return inf + swapTes(m[2]);
  }
  const SWAP = { mon: 'ton', ton: 'mon', ma: 'ta', ta: 'ma', mes: 'tes', tes: 'mes', me: 'te', te: 'me' };
  const swapPoss = (t) => String(t).replace(/\b(mon|ton|ma|ta|mes|tes|me|te)\b/gi, (w) => SWAP[w.toLowerCase()] || w).replace(/\bm’/g, '§').replace(/\bt’/g, 'm’').replace(/§/g, 't’');
  const hasPoss = (t) => /\b(mon|ton|ma|ta|mes|tes)\b/i.test(t);

  let words = { action: [], endroit: [], maniere: [] };
  let saved = '';
  let roue = store.get('roue', 'action');
  let uid = 0;
  function fromData(d) {
    const w = { action: [], endroit: [], maniere: [] };
    (d.actions || []).forEach((x) => w.action.push({ id: ++uid, lvl: x.lvl || 1, s: x.s || '', i: x.i || '', a: x.p === 'à' }));
    ['endroit', 'maniere'].forEach((r) => (d[KEY[r]] || []).forEach((x) => {
      if (typeof x === 'string') x = { t: x };
      w[r].push(x.t != null ? { id: ++uid, lvl: x.lvl || 1, s: x.t, i: '', two: false } : { id: ++uid, lvl: x.lvl || 1, s: x.s || '', i: x.i || '', two: true });
    }));
    return w;
  }
  function toData() {
    const lv = (x, o) => { if (x.lvl > 1) o.lvl = x.lvl; return o; };
    const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim();
    const out = { actions: [], objets: [], manieres: [] };
    words.action.forEach((x) => {
      const s = clean(x.s); if (!s) return;
      const o = { s, i: clean(x.i) || suggestI(s) };
      if (x.a) o.p = 'à';
      out.actions.push(lv(x, o));
    });
    ['endroit', 'maniere'].forEach((r) => words[r].forEach((x) => {
      const s = clean(x.s); if (!s) return;
      const i = x.two ? (clean(x.i) || swapPoss(s)) : '';
      out[KEY[r]].push(lv(x, i && i !== s ? { s, i } : { t: s }));
    }));
    return out;
  }
  const sig = () => JSON.stringify(toData());
  function markDirty() {
    const dirty = sig() !== saved;
    $('#savebar').classList.toggle('is-dirty', dirty);
    $('#dirty').textContent = dirty ? 'Modifications non enregistrées' : 'Aucune modification';
    $('#save').disabled = !dirty;
    ROUES.forEach((r) => { $('[data-count="' + r + '"]').textContent = words[r].filter((x) => x.s.trim()).length; });
  }

  const TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function rowHtml(x) {
    const lvl = [1, 2, 3].map((n) => '<button type="button" data-lvl="' + n + '" aria-pressed="' + (x.lvl === n) + '" aria-label="' + NIV[n - 1].nom + '">' + n + '</button>').join('');
    let fields;
    if (roue === 'action') {
      fields = '<div class="field"><span class="pre">que tu me</span><input type="text" data-k="s" value="' + esc(x.s) + '" placeholder="gratouilles, fasses gouzi-gouzi…" maxlength="60"></div>' +
        '<div class="field"><span class="pre">de te</span><input type="text" data-k="i" value="' + esc(x.i) + '" placeholder="' + esc(suggestI(x.s) || 'gratouiller…') + '" maxlength="60"></div>' +
        '<div class="opts"><label><input type="checkbox" data-k="a"' + (x.a ? ' checked' : '') + '> avec « à » (au gros orteil, aux épaules)</label></div>';
    } else {
      fields = '<div class="field"><span class="pre">' + (x.two ? 'que tu me' : 'texte') + '</span><input type="text" data-k="s" value="' + esc(x.s) + '" placeholder="' + (roue === 'endroit' ? 'le gros orteil…' : 'en chantonnant…') + '" maxlength="60"></div>' +
        (x.two ? '<div class="field"><span class="pre">de te</span><input type="text" data-k="i" value="' + esc(x.i) + '" placeholder="' + esc(swapPoss(x.s)) + '" maxlength="60"></div>' : '') +
        '<div class="opts"><label><input type="checkbox" data-k="two"' + (x.two ? ' checked' : '') + '> change selon le sens (mon / ton…)</label></div>';
    }
    return '<div class="word' + (x.isNew ? ' is-new' : '') + '" data-id="' + x.id + '"><div class="lvl" role="group" aria-label="Piment">' + lvl + '</div>' +
      '<div class="fields">' + fields + '</div><button class="del" type="button" aria-label="Supprimer">' + TRASH + '</button></div>';
  }
  function renderWords() {
    $$('.wheels button').forEach((b) => b.setAttribute('aria-selected', b.dataset.roue === roue ? 'true' : 'false'));
    $('#words-help').textContent = roue === 'action'
      ? 'Écris le verbe comme après « que tu me » ; la forme « de te » se propose toute seule (corrige-la si besoin). Une action peut finir par « de » (« glisses la langue le long de ») : l’endroit s’accorde tout seul (du bas du dos, des fesses, d’une épaule).'
      : 'Coche « change selon le sens » quand un possessif change : « que tu me … mon petit cœur » / « de te … ton petit cœur ».';
    $('#groups').innerHTML = NIV.map((n) => {
      const list = words[roue].filter((x) => x.lvl === n.n);
      return '<section class="group" data-lvl="' + n.n + '"><div class="group-head"><span class="chilis">' + CHILI.repeat(n.n) + '</span><h3>' + esc(n.nom) + '</h3><span class="n">' + list.length + '</span></div>' +
        '<div class="rows">' + list.map(rowHtml).join('') + '</div>' +
        '<button class="add" type="button" data-add="' + n.n + '">+ Ajouter ' + (roue === 'action' ? 'une action' : roue === 'endroit' ? 'un endroit' : 'une manière') + ' ' + esc(n.nom.toLowerCase()) + (roue === 'action' || roue === 'maniere' ? (n.n === 1 ? '' : 'e') : '') + '</button></section>';
    }).join('');
    markDirty();
  }
  const find = (el) => { const w = el.closest('.word'); return w ? words[roue].find((x) => x.id === +w.dataset.id) : null; };
  $('#groups').addEventListener('input', (e) => {
    const x = find(e.target); if (!x) return;
    const k = e.target.dataset.k;
    if (k === 's' || k === 'i') {
      // La forme « de te » suit la forme principale tant qu’elle n’a pas été écrite à la main
      if (k === 's' && x.i) {
        const auto = roue === 'action' ? suggestI(x.s) : swapPoss(x.s);
        if (x.i === auto) { x.i = ''; const o = e.target.closest('.word').querySelector('[data-k="i"]'); if (o) o.value = ''; }
      }
      x[k] = e.target.value;
      if (k === 's') {
        const other = e.target.closest('.word').querySelector('[data-k="i"]');
        if (other) other.placeholder = roue === 'action' ? (suggestI(x.s) || 'gratouiller…') : swapPoss(x.s);
        if (roue !== 'action' && !x.two && hasPoss(x.s)) e.target.closest('.word').querySelector('.opts').classList.add('is-hint');
      }
      e.target.closest('.word').classList.add('is-changed');
      markDirty();
    }
  });
  $('#groups').addEventListener('change', (e) => {
    const x = find(e.target); if (!x) return;
    const k = e.target.dataset.k;
    if (k === 'a') { x.a = e.target.checked; markDirty(); }
    if (k === 'two') { x.two = e.target.checked; if (x.two && !x.i) x.i = ''; renderWords(); }
  });
  $('#groups').addEventListener('click', (e) => {
    const lb = e.target.closest('[data-lvl]');
    const x = find(e.target);
    if (lb && x && lb.closest('.lvl')) { x.lvl = +lb.dataset.lvl; renderWords(); return; }
    if (e.target.closest('.del') && x) {
      words[roue] = words[roue].filter((y) => y !== x);
      renderWords();
      return;
    }
    const add = e.target.closest('[data-add]');
    if (add) {
      const n = { id: ++uid, lvl: +add.dataset.add, s: '', i: '', a: false, two: false, isNew: true };
      // à la fin de son niveau, pour garder l’ordre des roues
      const last = words[roue].map((y) => y.lvl).lastIndexOf(n.lvl);
      words[roue].splice(last < 0 ? words[roue].length : last + 1, 0, n);
      renderWords();
      const input = $('.word[data-id="' + n.id + '"] input[data-k="s"]');
      if (input) input.focus();
    }
  });
  $$('.wheels button').forEach((b) => b.addEventListener('click', () => { roue = b.dataset.roue; store.set('roue', roue); renderWords(); }));

  async function loadWords() {
    let d = null;
    if (api) {
      try {
        const res = await call('GET', { action: 'mots' });
        if (res && res.ok && res.mots) d = res.mots;
      } catch (e) { banner('Je n’arrive pas à lire les mots de la feuille. Vérifie l’adresse dans Réglages.', true); }
    }
    if (!d) {
      d = window.ROUE_DATA;
      $('#words-help').dataset.source = 'appli';
      if (api) banner('La feuille est encore vide : voici les mots actuels de l’appli. Touche « Enregistrer dans l’appli » pour les y mettre.');
    }
    words = fromData(d);
    saved = sig();
    renderWords();
  }
  $('#save').addEventListener('click', async () => {
    if (!api) { banner('Branche d’abord la feuille Google (onglet Réglages).', true); showTab('reglages'); return; }
    if (!pwd) { banner('Écris le mot de passe de l’atelier dans Réglages.', true); showTab('reglages'); return; }
    const data = toData();
    if (data.actions.length < 3 || data.objets.length < 3 || data.manieres.length < 3) { banner('Garde au moins trois mots par roue.', true); return; }
    $('#save').disabled = true;
    $('#dirty').textContent = 'Enregistrement…';
    try {
      const res = await call('POST', null, { action: 'save', motDePasse: pwd, mots: data });
      if (!res || !res.ok) throw new Error(res && res.erreur === 'mot de passe' ? 'mdp' : 'save');
      saved = sig();
      words = fromData(data); saved = sig();
      renderWords();
      banner('Enregistré. Les téléphones auront les nouveaux mots à leur prochaine partie.');
    } catch (e) {
      banner(e.message === 'mdp' ? 'Mot de passe refusé. Vérifie-le dans Réglages.' : 'L’enregistrement n’a pas marché. Réessaie dans un instant.', true);
      markDirty();
    }
  });
  window.addEventListener('beforeunload', (e) => { if (sig() !== saved) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- Réglages ---------- */
  $('#api').value = api;
  $('#pwd').value = pwd;
  $('#api').addEventListener('change', () => { api = $('#api').value.trim(); store.set('api', api); stats = null; loadWords(); });
  $('#pwd').addEventListener('change', () => { pwd = $('#pwd').value; store.set('pwd', pwd); });
  $('#test').addEventListener('click', async () => {
    api = $('#api').value.trim(); store.set('api', api);
    pwd = $('#pwd').value; store.set('pwd', pwd);
    const out = $('#conn');
    out.innerHTML = 'Vérification…';
    try {
      const st = await call('GET', { action: 'stats' });
      if (!st || !st.ok) throw new Error();
      const ck = await call('POST', null, { action: 'check', motDePasse: pwd });
      out.innerHTML = '<span class="ok">Feuille joignable</span> · ' + (ck && ck.ok ? '<span class="ok">mot de passe accepté</span>' : '<span class="ko">mot de passe refusé</span>');
      banner('');
      loadWords();
    } catch (e) {
      out.innerHTML = '<span class="ko">Je n’arrive pas à joindre cette adresse.</span>';
    }
  });
  $('#copy-code').addEventListener('click', async () => {
    const b = $('#copy-code');
    try {
      const code = await (await fetch('apps-script.gs', { cache: 'no-store' })).text();
      await navigator.clipboard.writeText(code);
      b.textContent = 'Code copié';
    } catch (e) {
      window.open('apps-script.gs', '_blank', 'noopener');
      b.textContent = 'Code ouvert dans un onglet';
    }
    setTimeout(() => { b.textContent = 'Copier le code'; }, 2200);
  });

  /* ---------- Démarrage ---------- */
  if (!api) banner('La feuille Google n’est pas encore branchée : les statistiques et l’enregistrement des mots attendent la mise en place (onglet Réglages).');
  const first = location.hash.slice(1) || store.get('tab', 'stats');
  showTab(['stats', 'mots', 'reglages'].includes(first) ? first : 'stats');
  loadWords();
})();
