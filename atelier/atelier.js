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

  // Ce que dit le script quand il refuse un enregistrement
  const refus = (e) => (e === 'absent' ? 'Le mot de passe n’est pas encore réglé dans le script : ajoute la propriété « motdepasse » (Réglages, Mise en place).'
    : e === 'patiente' ? 'Trop d’essais ratés : l’enregistrement est bloqué dix minutes.'
    : 'Mot de passe refusé. Vérifie-le dans Réglages.');

  /* ---------- Onglets ---------- */
  function showTab(name) {
    ['stats', 'mots', 'textes', 'reglages'].forEach((t) => {
      $('#tab-' + t).setAttribute('aria-selected', t === name ? 'true' : 'false');
      $('#panel-' + t).hidden = t !== name;
    });
    store.set('tab', name);
    if (name === 'stats') loadStats();
    if (name === 'textes') renderTexts();
    if (name === 'mots' && !stats && api) loadStats().then(() => { if (!$('#panel-mots').hidden && !$('#savebar').classList.contains('is-dirty')) renderWords(); });
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
  /* ---------- Tableau de bord : arrivée, jeu, distance, bouche-à-oreille ---------- */
  const pct = (a, b) => (b ? Math.round(100 * a / b) + ' %' : '–');
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const jourCourt = (iso) => Number(iso.slice(8)) + ' ' + MOIS.at(Number(iso.slice(5, 7)) - 1);
  function kpi(value, label, sub) {
    return '<div class="kpi"><span class="kv">' + value + '</span><span class="kl">' + esc(label) + '</span>' + (sub ? '<span class="ks">' + esc(sub) + '</span>' : '') + '</div>';
  }
  function split(c, type, names) {
    const keys = Object.keys(c).filter((k) => k.startsWith(type + ':'));
    const tot = keys.reduce((a, k) => a + c[k], 0);
    if (!tot) return '<p class="note">Pas encore de données.</p>';
    const rows = keys.map((k) => ({ k: k.slice(type.length + 1), n: c[k] })).sort((a, b) => b.n - a.n);
    return '<ul class="split">' + rows.map((r) => '<li><span class="sl">' + esc(names[r.k] || r.k) + '</span><span class="sb"><i style="width:' + Math.max(3, Math.round(100 * r.n / tot)) + '%"></i></span><span class="sv">' + fmt(r.n) + ' · ' + pct(r.n, tot) + '</span></li>').join('') + '</ul>';
  }
  // Une série jour par jour : barres fines, axe discret, valeur au survol
  function daily(type, title) {
    const map = {};
    ((stats && stats.jours) || []).filter((d) => d.type === type).forEach((d) => { map[d.jour] = (map[d.jour] || 0) + d.n; });
    const days = [];
    const now = new Date();
    for (let i = 55; i >= 0; i--) { const d = new Date(now.getTime() - i * 864e5); days.push(d.toISOString().slice(0, 10)); }
    const vals = days.map((d) => map[d] || 0);
    const max = Math.max(1, ...vals), total = vals.reduce((a, b) => a + b, 0);
    const W = 440, H = 120, L = 30, B = 22, bw = (W - L) / days.length;
    const bars = days.map((d, i) => {
      const h = Math.round((H - B - 8) * vals.at(i) / max), x = L + i * bw;
      return '<g class="bar" data-tip="' + esc(jourCourt(d) + ' : ' + vals.at(i)) + '"><rect class="hit" x="' + x.toFixed(1) + '" y="0" width="' + bw.toFixed(1) + '" height="' + (H - B) + '"/>' +
        (h ? '<rect class="mark" x="' + (x + 1).toFixed(1) + '" y="' + (H - B - h) + '" width="' + Math.max(1, bw - 2).toFixed(1) + '" height="' + h + '" rx="1.5"/>' : '') + '</g>';
    }).join('');
    const ticks = days.map((d, i) => (i % 14 === 0 ? '<text x="' + (L + i * bw).toFixed(1) + '" y="' + (H - 6) + '" class="tick">' + jourCourt(d) + '</text>' : '')).join('');
    return '<div class="chart"><p class="ct">' + esc(title) + ' <span>' + fmt(total) + ' sur 8 semaines</span></p>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(title + ', ' + total + ' sur 8 semaines') + '">' +
      '<line class="axis" x1="' + L + '" x2="' + W + '" y1="' + (H - B) + '" y2="' + (H - B) + '"/>' +
      '<text x="' + (L - 6) + '" y="12" class="tick" text-anchor="end">' + max + '</text><text x="' + (L - 6) + '" y="' + (H - B) + '" class="tick" text-anchor="end">0</text>' +
      bars + ticks + '</svg></div>';
  }
  function renderDash() {
    const box = $('#dash');
    if (!stats) { box.innerHTML = ''; return; }
    const c = stats.compteurs || {}, d = stats.distance || { total: 0, actives7: 0, coups: 0, retour: { j1: [0, 0], j7: [0, 0], j30: [0, 0] } };
    const v = c.visite || 0, p = c.partie || 0, pk = c.premier || 0;
    const step = (n, label, of) => '<li><span class="fl">' + esc(label) + '</span><span class="fb"><i style="width:' + (v ? Math.max(2, Math.round(100 * n / Math.max(v, p, 1))) : 0) + '%"></i></span><span class="fv">' + fmt(n) + (of != null ? ' · ' + pct(n, of) : '') + '</span></li>';
    const ret = (k, label) => kpi(pct(d.retour[k][0], d.retour[k][1]), label, d.retour[k][1] ? 'sur ' + d.retour[k][1] + ' parties assez anciennes' : 'pas encore assez de recul');
    const partages = (c['partage:envoye'] || 0) + (c['partage:copie'] || 0);
    box.innerHTML =
      '<h2 class="sec">De l’ouverture au kiff kiff</h2>' +
      '<ul class="funnel">' + step(v, 'Ouvertures du jeu') + step(p, 'Parties lancées', v) + step(pk, 'Parties avec un kiff kiff', p) + '</ul>' +
      '<p class="note">Les ouvertures et les premiers kiff kiff sont comptés depuis le 18 octobre 2026 ; les parties, depuis le début.</p>' +
      '<div class="charts">' + daily('kiff', 'Kiff kiff par jour') + daily('visite', 'Ouvertures par jour') + '</div>' +
      '<h2 class="sec">À deux téléphones</h2><div class="kpis">' +
        kpi(fmt(c.invitation || 0), 'invitations créées') + kpi(pct(c.rejoint || 0, c.invitation || 0), 'invitations rejointes', fmt(c.rejoint || 0) + ' personnes') +
        kpi(fmt(d.actives7), 'parties actives', 'un coup ces 7 derniers jours, sur ' + fmt(d.total)) +
        kpi(d.total ? (d.coups / d.total).toFixed(1).replace('.', ',') : '–', 'coups par partie', 'en moyenne') +
        ret('j1', 'encore jouées à J+1') + ret('j7', 'encore jouées à J+7') + ret('j30', 'encore jouées à J+30') +
        kpi(fmt(c['notif:activee'] || 0), 'avertissements activés', 'sur des téléphones de parties à distance') +
        kpi(fmt(c['notif:envoyee'] || 0), 'avertissements envoyés', fmt(c['notif:expiree'] || 0) + ' adresses expirées, ' + fmt(c['notif:refusee'] || 0) + ' refusés') +
        kpi(fmt(c['notif:rappel'] || 0), 'rappels envoyés', 'deux jours après un tour resté sans réponse (compris dans les avertissements)') +
        kpi(pct(c['notif:ouverte'] || 0, c['notif:envoyee'] || 0), 'des avertissements touchés') + '</div>' +
      '<h2 class="sec">Le jeu</h2><div class="kpis">' +
        kpi(pct(c.kiff || 0, c.envie || 0), 'des envies deviennent kiff kiff') + kpi(pct(c.mais || 0, c.envie || 0), 'des envies passent par « Oui, mais… »') +
        kpi(pct(c.passe || 0, c.envie || 0), 'de passes par envie') + kpi(pct(c['monte:oui'] || 0, c.monte || 0), 'des montées de piment acceptées', fmt(c.monte || 0) + ' demandées') + '</div>' +
      '<div class="splits"><div><h3 class="sh">Sur quel téléphone</h3>' + split(c, 'partie', { un: 'Un seul téléphone', deux: 'Deux téléphones' }) + '</div>' +
        '<div><h3 class="sh">Piments choisis au départ</h3>' + split(c, 'piment', { 1: 'Tendre', 2: 'Pimenté', 3: 'Brûlant', 12: 'Tendre + Pimenté', 13: 'Tendre + Brûlant', 23: 'Pimenté + Brûlant', 123: 'Les trois' }) + '</div>' +
        '<div><h3 class="sh">Temps jusqu’au premier kiff kiff</h3>' + split(c, 'premier', { 'moins-5': 'Moins de 5 min', '5-15': '5 à 15 min', '15-60': '15 min à 1 h', '1h-1j': '1 h à 1 jour', 'plus-1j': 'Plus d’un jour', inconnu: 'Inconnu' }) + '</div>' +
        '<div><h3 class="sh">D’où l’on ouvre le jeu</h3>' + split(c, 'visite', { web: 'Navigateur', installee: 'Appli installée', invitation: 'Lien d’invitation', reprise: 'Retour dans une partie' }) + '</div></div>' +
      '<h2 class="sec">Bouche-à-oreille et soutien</h2><div class="kpis">' +
        kpi(fmt((c['partage:fenetre-fete'] || 0) + (c['partage:fenetre-accueil'] || 0)), 'ouvertures de « Dealer du kiff »', fmt(c['partage:fenetre-fete'] || 0) + ' après un kiff kiff, ' + fmt(c['partage:fenetre-accueil'] || 0) + ' depuis l’accueil') +
        kpi(fmt(partages), 'liens du jeu envoyés') + kpi(fmt(c['partage:prevenir'] || 0), '« Prévenir » touchés') +
        kpi(p ? ((c.rejoint || 0) / p).toFixed(2).replace('.', ',') : '–', 'invités arrivés par partie', 'premier pas vers le coefficient K') +
        kpi(fmt(c.cafe || 0), 'clics « Payez-moi un café »') + kpi(fmt(c.installe || 0), 'installations sur l’écran d’accueil') + '</div>';
  }
  // Valeur au survol des barres
  const tip = document.createElement('div');
  tip.className = 'tip'; tip.hidden = true; document.body.appendChild(tip);
  document.addEventListener('pointermove', (e) => {
    const g = e.target.closest && e.target.closest('.bar');
    if (!g) { tip.hidden = true; return; }
    tip.textContent = g.dataset.tip; tip.hidden = false;
    tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY - 30) + 'px';
  });

  function renderStats() {
    renderDash();
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
    (d.actions || []).forEach((x) => w.action.push({ id: ++uid, lvl: x.lvl || 1, s: x.s || '', i: x.i || '', a: x.p === 'à', dc: !!x.dc }));
    ['endroit', 'maniere'].forEach((r) => (d[KEY[r]] || []).forEach((x) => {
      if (typeof x === 'string') x = { t: x };
      w[r].push(x.t != null ? { id: ++uid, lvl: x.lvl || 1, s: x.t, i: '', two: false, dc: !!x.dc } : { id: ++uid, lvl: x.lvl || 1, s: x.s || '', i: x.i || '', two: true, dc: !!x.dc });
    }));
    return w;
  }
  function toData() {
    const lv = (x, o) => { if (x.lvl > 1) o.lvl = x.lvl; if (x.dc) o.dc = 1; return o; };
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
    renderCounts();
  }
  /* Combien de mots par piment et par ton : la roue en tire 20, il en faut au moins autant pour chaque réglage.
     Les mots à ajouter cochés comptent déjà, en plus. */
  const NEED = 20;
  function renderCounts() {
    const box = $('#counts');
    if (!box) return;
    let sg = [];
    try { sg = pending().filter((x) => x.on); } catch (e) { /* pas encore prêt */ }
    const cell = (n, dc) => {
      const have = words[roue].filter((x) => x.s.trim() && x.lvl === n && !!x.dc === dc).length;
      const plus = sg.filter((x) => x.lvl === n && !!x.dc === dc).length;
      const tot = have + plus;
      return '<td class="' + (tot >= NEED ? 'is-ok' : 'is-low') + '"><b>' + tot + '</b>' + (plus ? '<span>' + have + ' + ' + plus + '</span>' : '') + '</td>';
    };
    box.innerHTML = '<table><caption>Mots par réglage : il en faut ' + NEED + ' pour remplir la roue' + (sg.length ? ' (dans la roue + à ajouter)' : '') + '</caption>' +
      '<thead><tr><th></th><th scope="col">Premier degré</th><th scope="col">Décalé</th></tr></thead><tbody>' +
      NIV.map((n) => '<tr><th scope="row">' + esc(n.nom) + '</th>' + cell(n.n, false) + cell(n.n, true) + '</tr>').join('') + '</tbody></table>';
  }

  const TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // Ce que les joueurs en font : une formule souvent proposée mais rarement kiffée est à réécrire
  function perfHtml(x) {
    if (!stats || !stats.choix || !x.s) return '';
    const c = stats.choix.find((y) => y.roue === roue && y.mot === x.s.trim());
    if (!c || c.envies < 5) return '';
    const r = c.kiffs / c.envies;
    const txt = fmt(c.kiffs) + ' kiff kiff sur ' + fmt(c.envies) + ' envies';
    if (r < 0.2) return '<p class="perf perf--weak">Peu kiffée : ' + txt + '. À réécrire ?</p>';
    if (r >= 0.6) return '<p class="perf perf--good">Très kiffée : ' + txt + '</p>';
    return '<p class="perf">' + txt + '</p>';
  }
  // Décalé : un mot pour rire (le ton barjot), que les roues enlèvent quand on joue au premier degré
  const dcHtml = (x) => '<label class="dc"><input type="checkbox" data-k="dc"' + (x.dc ? ' checked' : '') + '> décalé (pour rire)</label>';
  function rowHtml(x) {
    const lvl = [1, 2, 3].map((n) => '<button type="button" data-lvl="' + n + '" aria-pressed="' + (x.lvl === n) + '" aria-label="' + NIV[n - 1].nom + '">' + n + '</button>').join('');
    let fields;
    if (roue === 'action') {
      fields = '<div class="field"><span class="pre">que tu me</span><input type="text" data-k="s" value="' + esc(x.s) + '" placeholder="gratouilles, fasses gouzi-gouzi…" maxlength="60"></div>' +
        '<div class="field"><span class="pre">de te</span><input type="text" data-k="i" value="' + esc(x.i) + '" placeholder="' + esc(suggestI(x.s) || 'gratouiller…') + '" maxlength="60"></div>' +
        '<div class="opts"><label><input type="checkbox" data-k="a"' + (x.a ? ' checked' : '') + '> avec « à » (au gros orteil, aux épaules)</label>' + dcHtml(x) + '</div>';
    } else {
      fields = '<div class="field"><span class="pre">' + (x.two ? 'que tu me' : 'texte') + '</span><input type="text" data-k="s" value="' + esc(x.s) + '" placeholder="' + (roue === 'endroit' ? 'le gros orteil…' : 'en chantonnant…') + '" maxlength="60"></div>' +
        (x.two ? '<div class="field"><span class="pre">de te</span><input type="text" data-k="i" value="' + esc(x.i) + '" placeholder="' + esc(swapPoss(x.s)) + '" maxlength="60"></div>' : '') +
        '<div class="opts"><label><input type="checkbox" data-k="two"' + (x.two ? ' checked' : '') + '> change selon le sens (mon / ton…)</label>' + dcHtml(x) + '</div>';
    }
    return '<div class="word' + (x.isNew ? ' is-new' : '') + '" data-id="' + x.id + '"><div class="lvl" role="group" aria-label="Piment">' + lvl + '</div>' +
      '<div class="fields">' + fields + perfHtml(x) + '</div><button class="del" type="button" aria-label="Supprimer">' + TRASH + '</button></div>';
  }
  /* Mots à ajouter : la sélection de Marc (suggestions.js), au-dessus de chaque roue.
     On coche, on corrige si besoin, on ajoute ; un mot déjà dans la roue n’y apparaît plus. */
  const SUG = {};
  ROUES.forEach((r) => {
    SUG[r] = ((window.KIFF_SUGGESTIONS || {})[r] || []).map((x) => ({
      id: ++uid, on: true, lvl: x.lvl || 1, dc: !!x.dc, a: !!x.a,
      s: x.t != null ? x.t : (x.s || ''), i: x.t != null ? '' : (x.i || ''), two: r !== 'action' && x.t == null, lot: x.lot || 1
    }));
  });
  const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const pending = () => SUG[roue].filter((x) => x.s.trim() && !words[roue].some((y) => norm(y.s) === norm(x.s)));
  function renderSugg() {
    const box = $('#sugg');
    const list = pending();
    box.hidden = !list.length;
    if (!list.length) { box.innerHTML = ''; return; }
    const on = list.filter((x) => x.on).length;
    const row = (x) => '<li class="sg' + (x.on ? '' : ' is-off') + '" data-id="' + x.id + '"><input type="checkbox" data-k="on"' + (x.on ? ' checked' : '') + ' aria-label="Ajouter ce mot">' +
      '<span class="sg-tags"><span class="chilis" aria-label="' + esc(NIV[x.lvl - 1].nom) + '">' + CHILI.repeat(x.lvl) + '</span><span class="sg-ton' + (x.dc ? ' is-dc' : '') + '">' + (x.dc ? 'barjot' : 'premier degré') + '</span></span>' +
      '<span class="sg-fields"><input type="text" data-k="s" value="' + esc(x.s) + '" maxlength="60" aria-label="Le mot">' +
      (x.i || x.two ? '<input type="text" data-k="i" value="' + esc(x.i) + '" maxlength="60" aria-label="Forme après « de te »" placeholder="forme « de te »">' : '') +
      (x.a ? '<span class="sg-note">avec « à »</span>' : '') + '</span></li>';
    box.innerHTML = '<summary><b>Mots à ajouter</b> <span class="n">' + list.length + '</span></summary>' +
      '<p class="note">Prêts à entrer dans la roue, rangés par piment et par ton. Décoche ceux que tu ne veux pas, corrige si besoin, puis ajoute. Le tableau au-dessus compte déjà les mots cochés.</p>' +
      [1, 2, 3].map((n) => [false, true].map((dc) => {
        const l = list.filter((x) => x.lvl === n && !!x.dc === dc);
        return l.length ? '<h4 class="sg-head">' + esc(NIV[n - 1].nom) + ' · ' + (dc ? 'décalé' : 'premier degré') + ' <span class="n">' + l.length + '</span></h4><ul class="sg-list">' + l.map(row).join('') + '</ul>' : '';
      }).join('')).join('') +
      '<div class="row-end"><button class="btn" type="button" id="sugg-add"' + (on ? '' : ' disabled') + '>Ajouter ' + on + ' mot' + (on > 1 ? 's' : '') + ' à la roue</button></div>';
  }
  const sgFind = (el) => { const li = el.closest('.sg'); return li ? SUG[roue].find((x) => x.id === +li.dataset.id) : null; };
  $('#sugg').addEventListener('input', (e) => {
    const x = sgFind(e.target); if (!x) return;
    const k = e.target.dataset.k;
    if (k === 's' || k === 'i') x[k] = e.target.value;
  });
  $('#sugg').addEventListener('change', (e) => {
    const x = sgFind(e.target); if (!x || e.target.dataset.k !== 'on') return;
    x.on = e.target.checked;
    e.target.closest('.sg').classList.toggle('is-off', !x.on);
    const on = pending().filter((y) => y.on).length, b = $('#sugg-add');
    b.disabled = !on; b.textContent = 'Ajouter ' + on + ' mot' + (on > 1 ? 's' : '') + ' à la roue';
    renderCounts();
  });
  $('#sugg').addEventListener('click', (e) => {
    if (!e.target.closest('#sugg-add')) return;
    const add = pending().filter((x) => x.on);
    add.forEach((x) => {
      const w = roue === 'action'
        ? { id: ++uid, lvl: x.lvl, s: x.s.trim(), i: x.i.trim(), a: x.a, dc: x.dc, isNew: true }
        : { id: ++uid, lvl: x.lvl, s: x.s.trim(), i: x.two ? x.i.trim() : '', two: x.two, dc: x.dc, isNew: true };
      const last = words[roue].map((y) => y.lvl).lastIndexOf(w.lvl);
      words[roue].splice(last < 0 ? words[roue].length : last + 1, 0, w);
    });
    renderWords();
    banner(add.length + ' mot' + (add.length > 1 ? 's' : '') + ' ajouté' + (add.length > 1 ? 's' : '') + ' à la roue (en doré). Vérifie, puis « Enregistrer dans l’appli ».');
  });

  /* Corrections à appliquer : la relecture des mots (corrections.js), sur les trois roues d’un coup.
     Un mot déjà corrigé (ou introuvable) n’apparaît pas. */
  const FIX = (window.KIFF_CORRECTIONS || []).map((c, k) => ({ ...c, k, on: true }));
  const fnorm = (t) => String(t || '').replace(/[’']/g, "'").replace(/[\u00a0\s]+/g, ' ').trim().toLowerCase();
  const fixTarget = (c) => words[c.roue].find((x) => fnorm(x.s) === fnorm(c.from));
  const fixAfter = (c) => (c.to ? (c.to.t != null ? c.to.t : c.to.s + (c.to.i && c.to.i !== c.to.s ? ' / ' + c.to.i : '')) : '');
  const fixDone = (c, x) => c.to && fnorm(x.s) === fnorm(c.to.t != null ? c.to.t : c.to.s) && (c.to.t != null || fnorm(x.i) === fnorm(c.to.i));
  const fixPending = () => FIX.filter((c) => { const x = fixTarget(c); return x && !fixDone(c, x); });
  function renderFix() {
    const box = $('#fix');
    if (!box) return;
    const list = fixPending();
    box.hidden = !list.length;
    if (!list.length) { box.innerHTML = ''; return; }
    const on = list.filter((c) => c.on).length;
    const R = { action: 'Action', endroit: 'Endroit', maniere: 'Manière' };
    box.innerHTML = '<summary><b>Corrections à appliquer</b> <span class="n">' + list.length + '</span></summary>' +
      '<p class="note">La relecture des trois roues. Décoche celles que tu ne veux pas, puis applique : les mots corrigés passent en doré, puis « Enregistrer dans l’appli ».</p>' +
      '<ul class="sg-list">' + list.map((c) => '<li class="sg fx' + (c.on ? '' : ' is-off') + '" data-k="' + c.k + '"><input type="checkbox" data-k="on"' + (c.on ? ' checked' : '') + ' aria-label="Appliquer cette correction">' +
        '<span class="sg-tags"><span class="sg-ton">' + R[c.roue] + '</span></span>' +
        '<span class="fx-text"><s>' + esc(c.from) + '</s> ' + (c.to ? '→ <b>' + esc(fixAfter(c)) + '</b>' : '<b class="fx-del">à supprimer</b>' + (c.why ? ' <span class="sg-note">(' + esc(c.why) + ')</span>' : '')) + '</span></li>').join('') + '</ul>' +
      '<div class="row-end"><button class="btn" type="button" id="fix-apply"' + (on ? '' : ' disabled') + '>Appliquer ' + on + ' correction' + (on > 1 ? 's' : '') + '</button></div>';
  }
  $('#fix').addEventListener('change', (e) => {
    const li = e.target.closest('.fx'); if (!li) return;
    const c = FIX[+li.dataset.k]; c.on = e.target.checked;
    li.classList.toggle('is-off', !c.on);
    const on = fixPending().filter((y) => y.on).length, b = $('#fix-apply');
    b.disabled = !on; b.textContent = 'Appliquer ' + on + ' correction' + (on > 1 ? 's' : '');
  });
  $('#fix').addEventListener('click', (e) => {
    if (!e.target.closest('#fix-apply')) return;
    const list = fixPending().filter((c) => c.on);
    let n = 0;
    list.forEach((c) => {
      const x = fixTarget(c); if (!x) return;
      if (!c.to) { words[c.roue] = words[c.roue].filter((y) => y !== x); n++; return; }
      if (c.to.t != null) { x.s = c.to.t; x.i = ''; if (c.roue !== 'action') x.two = false; }
      else { x.s = c.to.s; x.i = c.to.i || ''; if (c.roue !== 'action') x.two = true; }
      if (c.to.a) x.a = true;
      x.isNew = true; n++;
    });
    renderWords();
    banner(n + ' correction' + (n > 1 ? 's' : '') + ' appliquée' + (n > 1 ? 's' : '') + ' (les mots corrigés sont en doré, dans leur roue). Vérifie, puis « Enregistrer dans l’appli ».');
  });

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
    renderSugg();
    renderFix();
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
    if (k === 'dc') { x.dc = e.target.checked; markDirty(); }
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
        if (res && res.ok) gotTexts(res);
      } catch (e) { banner('Je n’arrive pas à lire les mots de la feuille. Vérifie l’adresse dans Réglages.', true); }
    }
    if (!d) {
      d = window.ROUE_DATA;
      $('#words-help').dataset.source = 'appli';
      if (api) banner('La feuille est encore vide : voici les mots actuels de l’appli. Touche « Enregistrer dans l’appli » pour les y mettre.');
    }
    words = fromData(d);
    saved = sig();
    // Première fois avec la colonne « décalé » : on propose le classement de l’appli, à vérifier puis enregistrer
    const anyDc = ROUES.some((r) => words[r].some((x) => x.dc));
    if (!anyDc && (window.ROUE_BASE || window.ROUE_DATA)) {
      const R = window.ROUE_BASE || window.ROUE_DATA, src = { action: R.actions, endroit: R.objets, maniere: R.manieres };
      const dcs = (r) => (src[r] || []).filter((x) => x && x.dc).map((x) => (x.s || x.t || '').trim());
      let n = 0;
      ROUES.forEach((r) => { const l = dcs(r); words[r].forEach((x) => { if (l.includes(x.s.trim())) { x.dc = true; n++; } }); });
      if (n) banner('J’ai coché « décalé » sur ' + n + ' mots (le ton barjot des roues). Vérifie, puis « Enregistrer dans l’appli ».');
    }
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
      if (!res || !res.ok) throw new Error(res && ['mot de passe', 'absent', 'patiente'].includes(res.erreur) ? 'mdp:' + res.erreur : 'save');
      saved = sig();
      words = fromData(data); saved = sig();
      renderWords();
      // On relit la feuille : un script pas à jour enregistre les mots mais oublie la colonne « décalé »
      const nDc = ['actions', 'objets', 'manieres'].reduce((n, k) => n + data[k].filter((x) => x.dc).length, 0);
      let lus = -1;
      try { const back = await call('GET', { action: 'mots' }); if (back && back.mots) lus = ['actions', 'objets', 'manieres'].reduce((n, k) => n + (back.mots[k] || []).filter((x) => x && x.dc).length, 0); } catch (e) { /* rien */ }
      const autre = window.KIFF_API && api !== window.KIFF_API;
      if (nDc && lus === 0) {
        banner('Les mots sont enregistrés, mais pas la case « décalé » : le script en ligne n’est pas la dernière version' +
          (autre ? ', et l’atelier n’écrit pas à la même adresse que le jeu (Réglages)' : '') +
          '. Recolle le script, Déployer › Gérer les déploiements › modifier le déploiement › Nouvelle version, puis enregistre à nouveau.', true);
      } else if (autre) {
        banner('Enregistré, mais l’atelier n’écrit pas à la même adresse que le jeu : vérifie l’adresse dans Réglages.', true);
      } else banner('Enregistré' + (nDc ? ', avec ' + nDc + ' mots décalés' : '') + '. Les téléphones auront les nouveaux mots à leur prochaine partie.');
    } catch (e) {
      banner(e.message.startsWith('mdp:') ? refus(e.message.slice(4)) : 'L’enregistrement n’a pas marché. Réessaie dans un instant.', true);
      markDirty();
    }
  });
  window.addEventListener('beforeunload', (e) => { if (sig() !== saved || txSig() !== txSavedSig) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- Les textes de l’appli ----------
     La liste d’origine vient de textes.js ; la feuille ne garde que les textes changés.
     Chaque texte montre une capture de l’écran où il s’affiche (ecrans.js, fait par un tour automatique du jeu). */
  const TXG = window.KIFF_TEXTES || [];
  const ECR = window.KIFF_ECRANS || { shots: [], ou: {} };
  const SHOT = {};
  ECR.shots.forEach((x) => { SHOT[x[0]] = { id: x[0], nom: x[1], groups: x[2], w: x[3], h: x[4] }; });
  const TBASE = {}, TNOTE = {}, TGRP = {};
  TXG.forEach((g) => g.textes.forEach((t) => { TBASE[t[0]] = t[1]; TNOTE[t[0]] = t[2] || ''; TGRP[t[0]] = g.id; }));
  let txSaved = {}; // les textes changés, tels que la feuille les garde
  let txCur = Object.assign({}, TBASE); // les textes à l’écran
  let txScript = null; // le script en ligne sait-il garder les textes ?
  const txOver = () => { const o = {}; Object.keys(TBASE).forEach((k) => { if (txCur[k] !== TBASE[k]) o[k] = txCur[k]; }); return o; };
  const txSig = () => JSON.stringify(txOver());
  let txSavedSig = '{}';
  let txOpen = new Set(store.get('txOpen', []));
  function gotTexts(res) {
    txScript = Object.prototype.hasOwnProperty.call(res, 'textes');
    if (txSig() !== txSavedSig) return; // des changements en cours : on ne les écrase pas
    txSaved = {};
    Object.keys(res.textes || {}).forEach((k) => { if (k in TBASE && typeof res.textes[k] === 'string') txSaved[k] = res.textes[k]; });
    txCur = Object.assign({}, TBASE, txSaved);
    txSavedSig = txSig();
    if (!$('#panel-textes').hidden) renderTexts();
  }
  const vars = (t) => (String(t).match(/\{[^{}]+\}/g) || []);
  function txWarn(k) {
    const want = vars(TBASE[k]), have = vars(txCur[k]);
    const miss = want.filter((v) => !have.includes(v)), extra = have.filter((v) => !want.includes(v));
    const w = [];
    if (miss.length) w.push('Il manque ' + miss.join(', ') + '.');
    if (extra.length) w.push(extra.join(', ') + ' ne sera pas remplacé.');
    if (!txCur[k].trim() && TBASE[k].trim()) w.push('Vide : rien ne s’affichera.');
    return w.join(' ');
  }
  // La capture : un cadrage autour du texte, ou l’écran entier
  function shotOf(k) {
    const o = ECR.ou[k];
    if (o && SHOT[o[0]]) return { s: SHOT[o[0]], r: o.slice(1, 5), alt: !!o[5] };
    const g = ECR.shots.find((x) => x[2].includes(TGRP[k]));
    return g ? { s: SHOT[g[0]], r: null } : null;
  }
  function shotSvg(sh, big) {
    const { s, r } = sh, W = s.w, H = s.h;
    let vb = [0, 0, W, H];
    if (r && !big) {
      const ratio = 2.2, pad = W * 0.05;
      let w = Math.min(W, Math.max(r[2] + pad * 2, W * 0.6)), h = w / ratio;
      if (r[3] + pad * 2 > h) { h = Math.min(H, r[3] + pad * 2); w = Math.min(W, h * ratio); }
      const x = Math.max(0, Math.min(W - w, r[0] + r[2] / 2 - w / 2)), y = Math.max(0, Math.min(H - h, r[1] + r[3] / 2 - h / 2));
      vb = [x, y, w, h];
    }
    const sw = Math.max(2, (big ? W : vb[2]) / 120);
    return '<svg viewBox="' + vb.map((v) => Math.round(v)).join(' ') + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
      '<image href="ecrans/' + s.id + '.webp" width="' + W + '" height="' + H + '"/>' +
      (r ? '<rect x="' + (r[0] - 5) + '" y="' + (r[1] - 5) + '" width="' + (r[2] + 10) + '" height="' + (r[3] + 10) + '" rx="8" fill="none" stroke="#FFD34D" stroke-width="' + sw + '"/>' : '') + '</svg>';
  }
  const isNotif = (k) => k.startsWith('notifs.');
  const isMsg = (k) => /^(tukiffes\.message|duo\.message|attente\.message)/.test(k);
  function visualHtml(k) {
    if (isNotif(k)) return '<div class="tx-mock tx-mock--notif"><b>Kiff Kiff</b><span data-live="' + k + '">' + esc(txCur[k]) + '</span></div>';
    if (isMsg(k)) return '<div class="tx-mock tx-mock--msg"><span data-live="' + k + '">' + esc(txCur[k]) + '</span> <u>https://kiff-kiff.fr/…</u></div>';
    const sh = shotOf(k);
    if (!sh) return '<div class="tx-mock">' + esc(TNOTE[k] || 'Dans certains cas seulement') + '</div>';
    return '<button class="tx-shot' + (sh.r ? '' : ' is-whole') + '" type="button" data-shot="' + k + '" aria-label="Voir l’écran en grand : ' + esc(sh.s.nom) + '">' + shotSvg(sh, false) + '</button>';
  }
  function itemHtml(k) {
    const sh = !isNotif(k) && !isMsg(k) ? shotOf(k) : null;
    const where = TNOTE[k] + (sh && sh.alt ? ' (la capture montre un autre cas, au même endroit)' : sh && !sh.r ? ' (n’apparaît pas sur la capture : seulement dans certains cas)' : '');
    const changed = txCur[k] !== TBASE[k], w = txWarn(k);
    return '<div class="tx' + (changed ? ' is-changed' : '') + '" data-k="' + k + '">' + visualHtml(k) +
      '<p class="tx-where">' + esc(where) + '</p>' +
      '<textarea rows="1" data-k="' + k + '" aria-label="' + esc(TNOTE[k]) + '">' + esc(txCur[k]) + '</textarea>' +
      '<div class="tx-foot"><span class="tx-warn">' + esc(w) + '</span><button class="tx-reset" type="button"' + (changed ? '' : ' hidden') + '>Revenir au texte d’origine</button></div></div>';
  }
  const fit = (ta) => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; };
  const nrm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function renderTexts() {
    const box = $('#tx-groups');
    const q = nrm($('#tx-q').value.trim()), only = $('#tx-only').getAttribute('aria-pressed') === 'true';
    const keep = (k) => (!only || txCur[k] !== TBASE[k]) && (!q || nrm(txCur[k]).includes(q) || nrm(TBASE[k]).includes(q) || nrm(TNOTE[k]).includes(q));
    box.innerHTML = TXG.map((g) => {
      const ks = g.textes.map((t) => t[0]).filter(keep);
      if (!ks.length) return '';
      const nch = g.textes.filter((t) => txCur[t[0]] !== TBASE[t[0]]).length;
      const open = q || only || txOpen.has(g.id);
      return '<details class="tx-group" data-g="' + g.id + '"' + (open ? ' open' : '') + '><summary><b>' + esc(g.nom) + '</b> <span class="n">' + ks.length + '</span>' +
        (nch ? '<span class="tx-badge">' + nch + ' changé' + (nch > 1 ? 's' : '') + '</span>' : '') + '</summary>' +
        '<div class="tx-list">' + (open ? ks.map(itemHtml).join('') : '') + '</div></details>';
    }).join('') || '<p class="empty">Aucun texte ne correspond.</p>';
    $$('#tx-groups textarea').forEach(fit);
    markTx();
  }
  function markTx() {
    const dirty = txSig() !== txSavedSig;
    $('#tx-savebar').classList.toggle('is-dirty', dirty);
    const n = Object.keys(txOver()).length;
    $('#tx-dirty').textContent = dirty ? 'Textes non enregistrés' : n ? n + ' texte' + (n > 1 ? 's' : '') + ' changé' + (n > 1 ? 's' : '') + ' dans l’appli' : 'Aucune modification';
    $('#tx-save').disabled = !dirty;
  }
  $('#tx-groups').addEventListener('toggle', (e) => {
    const d = e.target;
    if (!d.classList || !d.classList.contains('tx-group')) return;
    const id = d.dataset.g;
    if (d.open) {
      txOpen.add(id);
      const list = d.querySelector('.tx-list');
      if (!list.children.length) {
        const g = TXG.find((x) => x.id === id);
        list.innerHTML = g.textes.map((t) => itemHtml(t[0])).join('');
        list.querySelectorAll('textarea').forEach(fit);
      }
    } else txOpen.delete(id);
    store.set('txOpen', [...txOpen]);
  }, true);
  $('#tx-groups').addEventListener('input', (e) => {
    const ta = e.target.closest('textarea[data-k]');
    if (!ta) return;
    const k = ta.dataset.k;
    txCur[k] = ta.value;
    fit(ta);
    const it = ta.closest('.tx');
    it.classList.toggle('is-changed', txCur[k] !== TBASE[k]);
    it.querySelector('.tx-reset').hidden = txCur[k] === TBASE[k];
    it.querySelector('.tx-warn').textContent = txWarn(k);
    const live = it.querySelector('[data-live]');
    if (live) live.textContent = txCur[k];
    markTx();
  });
  $('#tx-groups').addEventListener('click', (e) => {
    const rs = e.target.closest('.tx-reset');
    if (rs) {
      const it = rs.closest('.tx'), k = it.dataset.k;
      txCur[k] = TBASE[k];
      it.outerHTML = itemHtml(k);
      const ta = $('#tx-groups textarea[data-k="' + k + '"]');
      if (ta) fit(ta);
      markTx();
      return;
    }
    const b = e.target.closest('[data-shot]');
    if (b) openShot(b.dataset.shot);
  });
  $('#tx-q').addEventListener('input', renderTexts);
  $('#tx-only').addEventListener('click', (e) => {
    const b = e.currentTarget;
    b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    renderTexts();
  });
  // L’écran en grand, le texte entouré
  function openShot(k) {
    const sh = shotOf(k);
    if (!sh) return;
    let d = $('#tx-box');
    if (!d) {
      d = document.createElement('div');
      d.id = 'tx-box'; d.className = 'tx-box'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
      document.body.appendChild(d);
      d.addEventListener('click', () => { d.hidden = true; });
      document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') d.hidden = true; });
    }
    d.innerHTML = '<figure>' + shotSvg(sh, true) + '<figcaption>' + esc(sh.s.nom) + ' · touche pour fermer</figcaption></figure>';
    d.setAttribute('aria-label', sh.s.nom);
    d.hidden = false;
  }
  $('#tx-save').addEventListener('click', async () => {
    if (!api) { banner('Branche d’abord la feuille Google (onglet Réglages).', true); showTab('reglages'); return; }
    if (!pwd) { banner('Écris le mot de passe de l’atelier dans Réglages.', true); showTab('reglages'); return; }
    const over = txOver();
    $('#tx-save').disabled = true;
    $('#tx-dirty').textContent = 'Enregistrement…';
    try {
      const res = await call('POST', null, { action: 'textes', motDePasse: pwd, textes: over });
      if (!res || !res.ok) throw new Error(res && ['mot de passe', 'absent', 'patiente', 'action'].includes(res.erreur) ? 'e:' + res.erreur : 'save');
      txSaved = over; txSavedSig = txSig();
      renderTexts();
      const n = Object.keys(over).length;
      banner(n ? 'Textes enregistrés : ' + n + ' changé' + (n > 1 ? 's' : '') + '. Les téléphones les auront à la prochaine ouverture du jeu.' : 'Enregistré : l’appli reprend tous ses textes d’origine.');
    } catch (e) {
      const k = e.message.startsWith('e:') ? e.message.slice(2) : '';
      banner(k === 'action' ? 'Le script en ligne ne connaît pas encore les textes : recolle-le, puis Déployer › Gérer les déploiements › Nouvelle version (Réglages).'
        : k ? refus(k) : 'L’enregistrement n’a pas marché. Réessaie dans un instant.', true);
      markTx();
    }
  });

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
      out.innerHTML = '<span class="ok">Feuille joignable</span> · ' + (ck && ck.ok ? '<span class="ok">mot de passe accepté</span>' : '<span class="ko">' + esc(refus(ck && ck.erreur)) + '</span>');
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
  showTab(['stats', 'mots', 'textes', 'reglages'].includes(first) ? first : 'stats');
  loadWords();
})();
