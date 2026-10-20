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
  // Décalé : un mot pour rire, que le brocoli des roues enlève quand on joue au premier degré
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
    if (!anyDc && window.ROUE_DATA) {
      const R = window.ROUE_DATA, src = { action: R.actions, endroit: R.objets, maniere: R.manieres };
      const dcs = (r) => (src[r] || []).filter((x) => x && x.dc).map((x) => (x.s || x.t || '').trim());
      let n = 0;
      ROUES.forEach((r) => { const l = dcs(r); words[r].forEach((x) => { if (l.includes(x.s.trim())) { x.dc = true; n++; } }); });
      if (n) banner('J’ai coché « décalé » sur ' + n + ' mots (le brocoli des roues). Vérifie, puis « Enregistrer dans l’appli ».');
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
