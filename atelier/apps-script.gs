/* Kiff Kiff — base de données de l’atelier (Google Apps Script lié à une feuille Google Sheets).
 *
 * Mise en place (une seule fois), depuis un ordinateur :
 *   1. Aller sur script.google.com > Nouveau projet (ou, depuis une feuille Google Sheets,
 *      menu Extensions > Apps Script). Effacer le code présent, coller tout ce fichier.
 *   3. Remplacer le mot de passe ci-dessous, Enregistrer, puis choisir la fonction « preparer »
 *      et cliquer Exécuter (Google demande l’autorisation : Paramètres avancés > Accéder au projet).
 *   4. Déployer > Nouveau déploiement > type « Application Web »
 *        Exécuter en tant que : moi · Qui a accès : Tout le monde > Déployer > Autoriser l’accès.
 *   5. Copier l’adresse de l’application Web (elle finit par /exec).
 *   6. Une fois : choisir la fonction « installerRappels » et cliquer Exécuter (le rappel de deux jours
 *      passe toutes les heures ; Google demande l’autorisation de créer ce déclencheur).
 *
 * Les onglets « mots », « compteurs », « choix » et « parties » se créent tout seuls.
 * Les notifications (« À toi de jouer ») passent aussi par ce script : il crée tout seul sa paire
 * de clés au premier appel et la garde dans les propriétés du script, jamais dans le code.
 * Il ne fait que transmettre un message déjà chiffré par le téléphone pour l’autre téléphone.
 * Les comptes ne contiennent rien de personnel. L’onglet « parties » garde la dernière étape
 * des parties à deux téléphones, chiffrée par les téléphones : illisible ici, même pour toi.
 */
const MOT_DE_PASSE = 'change-moi';

const ROUES = ['action', 'endroit', 'maniere'];
// Les événements comptés (aucun identifiant, aucune phrase) ; « detail » précise une variante courte
const TYPES = ['partie', 'envie', 'kiff', 'passe', 'visite', 'invitation', 'rejoint', 'mais', 'premier', 'piment', 'monte',
  'partage', 'cafe', 'installe', 'historique', 'notif'];
const PAR_JOUR = ['visite', 'partie', 'envie', 'kiff', 'rejoint']; // aussi comptés jour par jour
const ENT_JOURS = ['jour', 'type', 'valeur'];
const DETAIL = /^[a-z0-9-]{1,16}$/;
const ENT_MOTS = ['roue', 'niveau', 'que tu me', 'de te', 'avec à', 'ordre'];
const ENT_COMPTEURS = ['compteur', 'valeur'];
const ENT_CHOIX = ['roue', 'mot', 'envies', 'kiffs'];
const ENT_PARTIES = ['partie', 'etat', 'seq', 'maj', 'cree'];
const GARDER_JOURS = 120; // une partie sans nouvelle depuis si longtemps est effacée
const ENT_RAPPELS = ['partie', 'seq', 'adresse', 'corps', 'quand'];
const RAPPEL_HEURES = 48; // un seul rappel, deux jours après un coup resté sans réponse

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'mots') return sortie(lireMots());
  if (action === 'stats') return sortie(lireStats());
  if (action === 'partie') return sortie(lireParties(e.parameter.p));
  if (action === 'vapid') return sortie(clePublique());
  return sortie({ ok: true, appli: 'kiffkiff' });
}

function doPost(e) {
  let corps = {};
  try { corps = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return sortie({ ok: false, erreur: 'json' }); }
  if (corps.action === 'event') return sortie(noterEvenement(corps));
  if (corps.action === 'events' && Array.isArray(corps.liste)) {
    // Plusieurs comptes d’un coup (un seul appel par écran) : moins de requêtes, quotas tenus
    corps.liste.slice(0, 30).forEach(function (ev) { if (ev && typeof ev === 'object') noterEvenement(ev); });
    return sortie({ ok: true });
  }
  if (corps.action === 'partie') return sortie(ecrirePartie(corps));
  if (corps.action === 'push') return sortie(envoyerNotification(corps));
  if (corps.action === 'rappel') return sortie(enregistrerRappel(corps));
  if (corps.action === 'check') return sortie({ ok: String(corps.motDePasse || '') === MOT_DE_PASSE });
  if (corps.action === 'save') {
    if (String(corps.motDePasse || '') !== MOT_DE_PASSE) return sortie({ ok: false, erreur: 'mot de passe' });
    return sortie(ecrireMots(corps.mots));
  }
  return sortie({ ok: false, erreur: 'action' });
}

function sortie(objet) {
  return ContentService.createTextOutput(JSON.stringify(objet)).setMimeType(ContentService.MimeType.JSON);
}

/* La feuille de données : celle d’où le script a été ouvert (Extensions › Apps Script),
   ou, pour un script créé directement sur script.google.com, une feuille
   « Kiff Kiff — données » créée toute seule dans ton Drive au premier appel. */
function classeurDonnees() {
  const actif = SpreadsheetApp.getActiveSpreadsheet();
  if (actif) return actif;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('feuille');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (err) { /* feuille supprimée : on en recrée une */ } }
  const neuf = SpreadsheetApp.create('Kiff Kiff — données');
  props.setProperty('feuille', neuf.getId());
  return neuf;
}

/* À lancer une fois depuis l’éditeur (bouton Exécuter) pour donner les autorisations
   et créer la feuille. Son adresse s’affiche dans le journal d’exécution. */
function preparer() {
  const c = classeurDonnees();
  feuille('mots', ENT_MOTS); feuille('compteurs', ENT_COMPTEURS); feuille('choix', ENT_CHOIX); feuille('parties', ENT_PARTIES); feuille('jours', ENT_JOURS);
  Logger.log('Feuille de données : ' + c.getUrl());
}

function feuille(nom, entetes) {
  const classeur = classeurDonnees();
  let f = classeur.getSheetByName(nom);
  if (!f) {
    f = classeur.insertSheet(nom);
    f.getRange(1, 1, 1, entetes.length).setValues([entetes]).setFontWeight('bold');
    f.setFrozenRows(1);
  }
  return f;
}

/* ---------- Les mots des roues ---------- */
function lireMots() {
  const lignes = feuille('mots', ENT_MOTS).getDataRange().getValues().slice(1);
  const res = { actions: [], objets: [], manieres: [] };
  lignes
    .filter(function (l) { return l[0] && String(l[2]).trim(); })
    .sort(function (a, b) { return (Number(a[5]) || 0) - (Number(b[5]) || 0); })
    .forEach(function (l) {
      const roue = String(l[0]).trim().toLowerCase().replace('manière', 'maniere');
      const lvl = Math.min(3, Math.max(1, parseInt(l[1], 10) || 1));
      const s = String(l[2]).trim();
      const i = String(l[3] || '').trim();
      const a = l[4] === true || /^(oui|x|vrai|true|1|à)$/i.test(String(l[4]).trim());
      let x;
      if (roue === 'action') { x = { s: s, i: i || s }; if (a) x.p = 'à'; }
      else x = i ? { s: s, i: i } : { t: s };
      if (lvl > 1) x.lvl = lvl;
      if (roue === 'action') res.actions.push(x);
      else if (roue === 'endroit') res.objets.push(x);
      else if (roue === 'maniere') res.manieres.push(x);
    });
  const complet = res.actions.length > 2 && res.objets.length > 2 && res.manieres.length > 2;
  return { ok: true, version: PropertiesService.getScriptProperties().getProperty('version') || '', mots: complet ? res : null, meilleurs: lireMeilleurs() };
}

function ecrireMots(m) {
  if (!m || !Array.isArray(m.actions) || !Array.isArray(m.objets) || !Array.isArray(m.manieres)) return { ok: false, erreur: 'mots' };
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const f = feuille('mots', ENT_MOTS);
    const lignes = [];
    const ajoute = function (roue, x) {
      const s = String(x.s || x.t || '').trim();
      if (!s) return;
      const i = x.t ? '' : String(x.i || '').trim();
      lignes.push([roue, x.lvl || 1, s, i, x.p === 'à' ? 'oui' : '', lignes.length + 1]);
    };
    m.actions.forEach(function (x) { ajoute('action', x); });
    m.objets.forEach(function (x) { ajoute('endroit', x); });
    m.manieres.forEach(function (x) { ajoute('maniere', x); });
    f.clearContents();
    f.getRange(1, 1, 1, ENT_MOTS.length).setValues([ENT_MOTS]).setFontWeight('bold');
    if (lignes.length) f.getRange(2, 1, lignes.length, ENT_MOTS.length).setValues(lignes);
    const version = new Date().toISOString();
    PropertiesService.getScriptProperties().setProperty('version', version);
    return { ok: true, version: version, total: lignes.length };
  } finally {
    verrou.releaseLock();
  }
}

/* ---------- Les comptes envoyés par les téléphones ---------- */
function noterEvenement(corps) {
  const type = String(corps.type || '');
  if (TYPES.indexOf(type) < 0) return { ok: false, erreur: 'type' };
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const fc = feuille('compteurs', ENT_COMPTEURS);
    const vc = fc.getDataRange().getValues();
    const plus = function (cle) {
      let k = -1;
      for (let j = 1; j < vc.length; j++) if (vc[j][0] === cle) { k = j; break; }
      if (k < 0) { fc.appendRow([cle, 1]); vc.push([cle, 1]); }
      else { vc[k][1] = (Number(vc[k][1]) || 0) + 1; fc.getRange(k + 1, 2).setValue(vc[k][1]); }
    };
    plus(type);
    const detail = String(corps.detail || '');
    if (detail && DETAIL.test(detail)) plus(type + ':' + detail);
    if (PAR_JOUR.indexOf(type) >= 0) {
      const fj = feuille('jours', ENT_JOURS);
      const jour = Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd');
      const vj = fj.getDataRange().getValues();
      let n = -1;
      for (let j = vj.length - 1; j >= 1 && j >= vj.length - 80; j--) {
        const d = vj[j][0] instanceof Date ? Utilities.formatDate(vj[j][0], 'Europe/Paris', 'yyyy-MM-dd') : String(vj[j][0]);
        if (d === jour && vj[j][1] === type) { n = j; break; }
      }
      if (n < 0) fj.appendRow(["'" + jour, type, 1]);
      else fj.getRange(n + 1, 3).setValue((Number(vj[n][2]) || 0) + 1);
    }

    if ((type === 'envie' || type === 'kiff') && Array.isArray(corps.choix)) {
      const fx = feuille('choix', ENT_CHOIX);
      const vx = fx.getDataRange().getValues();
      const col = type === 'kiff' ? 4 : 3;
      corps.choix.slice(0, 3).forEach(function (mot, r) {
        mot = String(mot || '').trim().slice(0, 80);
        if (!mot) return;
        const roue = ROUES[r];
        let n = -1;
        for (let j = 1; j < vx.length; j++) if (vx[j][0] === roue && vx[j][1] === mot) { n = j; break; }
        if (n < 0) {
          const ligne = [roue, mot, 0, 0];
          ligne[col - 1] = 1;
          fx.appendRow(ligne);
          vx.push(ligne);
        } else {
          const v = (Number(vx[n][col - 1]) || 0) + 1;
          fx.getRange(n + 1, col).setValue(v);
          vx[n][col - 1] = v;
        }
      });
    }
    return { ok: true };
  } finally {
    verrou.releaseLock();
  }
}

function lireStats() {
  const compteurs = {};
  feuille('compteurs', ENT_COMPTEURS).getDataRange().getValues().slice(1).forEach(function (l) {
    if (l[0]) compteurs[l[0]] = Number(l[1]) || 0;
  });
  const choix = feuille('choix', ENT_CHOIX).getDataRange().getValues().slice(1)
    .filter(function (l) { return l[0] && l[1] !== ''; })
    .map(function (l) { return { roue: l[0], mot: String(l[1]), envies: Number(l[2]) || 0, kiffs: Number(l[3]) || 0 }; });
  // Jour par jour, les 8 dernières semaines
  const depuis = Utilities.formatDate(new Date(Date.now() - 56 * 864e5), 'Europe/Paris', 'yyyy-MM-dd');
  const jours = feuille('jours', ENT_JOURS).getDataRange().getValues().slice(1)
    .map(function (l) { return { jour: l[0] instanceof Date ? Utilities.formatDate(l[0], 'Europe/Paris', 'yyyy-MM-dd') : String(l[0]), type: String(l[1]), n: Number(l[2]) || 0 }; })
    .filter(function (l) { return l.jour >= depuis; });
  return { ok: true, compteurs: compteurs, choix: choix, jours: jours, distance: lireDistance() };
}

/* Les formules qui marchent le mieux, par roue : le premier tirage d’une partie y puise */
function lireMeilleurs() {
  const res = { action: [], endroit: [], maniere: [] };
  const v = feuille('choix', ENT_CHOIX).getDataRange().getValues().slice(1);
  ROUES.forEach(function (r) {
    res[r] = v.filter(function (l) { return l[0] === r && (Number(l[3]) || 0) >= 2 && l[1] !== '(texte libre)'; })
      .map(function (l) { return { mot: String(l[1]), score: ((Number(l[3]) || 0) + 1) / ((Number(l[2]) || 0) + 2) }; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 8).map(function (x) { return x.mot; });
  });
  return res;
}

/* Les parties à deux téléphones, vues de loin : combien, encore jouées, depuis quand (rien n’est déchiffré) */
function lireDistance() {
  const v = feuille('parties', ENT_PARTIES).getDataRange().getValues().slice(1);
  const now = Date.now(), J = 864e5;
  const res = { total: 0, actives7: 0, coups: 0, retour: { j1: [0, 0], j7: [0, 0], j30: [0, 0] } };
  v.forEach(function (l) {
    if (!l[0]) return;
    const maj = l[3] instanceof Date ? l[3].getTime() : 0;
    const cree = l[4] instanceof Date ? l[4].getTime() : 0;
    res.total++;
    res.coups += Number(l[2]) || 0;
    if (maj && now - maj < 7 * J) res.actives7++;
    if (!cree || !maj) return;
    [['j1', 1], ['j7', 7], ['j30', 30]].forEach(function (p) {
      if (now - cree < p[1] * J) return; // trop récente pour juger
      res.retour[p[0]][1]++;
      if (maj - cree >= p[1] * J) res.retour[p[0]][0]++;
    });
  });
  return res;
}

/* ---------- Les parties à deux téléphones (états chiffrés) ---------- */
const ID_PARTIE = /^[a-z2-9]{12}$/;

function lireParties(liste) {
  const ids = String(liste || '').split(',').filter(function (x) { return ID_PARTIE.test(x); }).slice(0, 30);
  const res = {};
  if (!ids.length) return { ok: true, parties: res };
  const v = feuille('parties', ENT_PARTIES).getDataRange().getValues();
  for (let j = 1; j < v.length; j++) {
    if (ids.indexOf(String(v[j][0])) >= 0) res[v[j][0]] = { etat: String(v[j][1]).replace(/^k/, ''), seq: Number(v[j][2]) || 0 };
  }
  return { ok: true, parties: res };
}

function ecrirePartie(c) {
  const id = String(c.partie || '');
  const etat = String(c.etat || '');
  const seq = Number(c.seq) || 0;
  if (!ID_PARTIE.test(id) || !etat || etat.length > 45000 || !/^[A-Za-z0-9_-]+$/.test(etat)) return { ok: false, erreur: 'partie' };
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const f = feuille('parties', ENT_PARTIES);
    if (f.getRange(1, 5).getValue() !== 'cree') f.getRange(1, 5).setValue('cree').setFontWeight('bold');
    const v = f.getDataRange().getValues();
    let k = -1;
    for (let j = 1; j < v.length; j++) if (String(v[j][0]) === id) { k = j; break; }
    // « k » devant : la feuille ne doit jamais prendre l’état pour un nombre ou une formule
    if (k < 0) f.appendRow([id, 'k' + etat, seq, new Date(), new Date()]);
    else if (seq > (Number(v[k][2]) || 0)) f.getRange(k + 1, 2, 1, 3).setValues([['k' + etat, seq, new Date()]]);
    else return { ok: true, ancien: true };
    // De temps en temps, on efface les parties abandonnées depuis longtemps
    if (Math.random() < 0.03) {
      const limite = Date.now() - GARDER_JOURS * 864e5;
      for (let j = v.length - 1; j >= 1; j--) {
        const d = v[j][3] instanceof Date ? v[j][3].getTime() : 0;
        if (d && d < limite && j !== k) f.deleteRow(j + 1);
      }
    }
    return { ok: true };
  } finally {
    verrou.releaseLock();
  }
}


/* ---------- Notifications : « À toi de jouer », même l’appli fermée ----------
 * Le téléphone qui vient de jouer chiffre lui-même le message pour l’autre téléphone
 * (norme Web Push, RFC 8291) : ce script ne peut pas le lire. Il ajoute seulement la signature
 * qui prouve au service de notification (Google, Apple, Mozilla, Microsoft) que l’envoi vient
 * bien de Kiff Kiff (norme VAPID, RFC 8292), puis transmet. Rien n’est gardé.
 * La paire de clés se crée toute seule au premier appel, dans les propriétés du script.
 * Pour vérifier depuis l’éditeur : choisir la fonction « verifierNotifications » et Exécuter. */
const PUSH_HOTES = /^https:\/\/(fcm\.googleapis\.com|[a-z0-9.-]*push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]*\.notify\.windows\.com)\//;
const PUSH_SUJET = 'https://vernetmarc-glitch.github.io/roue-du-consentement/';

function clePublique() {
  if (typeof BigInt === 'undefined') return { ok: false, erreur: 'bigint' };
  return { ok: true, cle: clesVapid().pub };
}

function envoyerNotification(c) {
  // Une erreur (autorisation manquante, service indisponible) revient lisible au lieu d’une page d’erreur Google
  try { return envoyerNotification_(c); } catch (err) {
    try { noterEvenement({ type: 'notif', detail: 'erreur-script' }); } catch (e) { /* rien */ }
    return { ok: false, erreur: String(err && err.message || err).slice(0, 200) };
  }
}
function envoyerNotification_(c) {
  const adresse = String(c.adresse || '');
  const corps = String(c.corps || '');
  if (!PUSH_HOTES.test(adresse) || adresse.length > 1000) return { ok: false, erreur: 'adresse' };
  if (!corps || corps.length > 5000 || !/^[A-Za-z0-9_-]+$/.test(corps)) return { ok: false, erreur: 'corps' };
  // Au plus 30 envois par quart d’heure vers un même téléphone
  const cache = CacheService.getScriptCache();
  const cle = 'px' + hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, adresse, Utilities.Charset.UTF_8));
  const n = Number(cache.get(cle) || 0);
  if (n >= 30) return { ok: false, erreur: 'trop' };
  cache.put(cle, String(n + 1), 900);
  const origine = adresse.split('/').slice(0, 3).join('/');
  const k = clesVapid();
  const reponse = UrlFetchApp.fetch(adresse, {
    method: 'post',
    contentType: 'application/octet-stream',
    payload: Utilities.base64DecodeWebSafe(corps + '==='.slice((corps.length + 3) % 4)),
    headers: {
      Authorization: 'vapid t=' + jetonVapid(origine, k) + ', k=' + k.pub,
      TTL: '86400',
      'Content-Encoding': 'aes128gcm',
      Urgency: c.urgence === 'normal' ? 'normal' : 'high'
    },
    muteHttpExceptions: true
  });
  const code = reponse.getResponseCode();
  noterEvenement({ type: 'notif', detail: code < 300 ? 'envoyee' : (code === 404 || code === 410 ? 'expiree' : 'refusee') });
  return { ok: code < 300, code: code };
}

/* ---------- Un seul rappel, deux jours plus tard ----------
 * Avec « À toi de jouer », le téléphone qui vient de jouer confie aussi un rappel, déjà chiffré
 * pour l’autre téléphone (« C’est toujours à toi de jouer. »). Il attend ici deux jours, dans l’onglet
 * « rappels », puis part si la partie n’a pas bougé entre-temps ; sinon il est effacé. Un rappel par
 * partie et par téléphone : le suivant remplace le précédent. Le service de notification le range
 * à la place du premier avertissement de la partie : jamais deux messages pour la même partie.
 * Une fois, depuis l’éditeur : choisir la fonction « installerRappels » et cliquer Exécuter. */
function enregistrerRappel(c) {
  const id = String(c.partie || '');
  const seq = Number(c.seq) || 0;
  const adresse = String(c.adresse || '');
  const corps = String(c.corps || '');
  if (!ID_PARTIE.test(id) || !seq) return { ok: false, erreur: 'partie' };
  if (!PUSH_HOTES.test(adresse) || adresse.length > 1000) return { ok: false, erreur: 'adresse' };
  if (!corps || corps.length > 5000 || !/^[A-Za-z0-9_-]+$/.test(corps)) return { ok: false, erreur: 'corps' };
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const f = feuille('rappels', ENT_RAPPELS);
    const v = f.getDataRange().getValues();
    const quand = new Date(Date.now() + RAPPEL_HEURES * 3600e3);
    for (let j = v.length - 1; j >= 1; j--) {
      if (String(v[j][0]) === id && String(v[j][2]) === adresse) f.deleteRow(j + 1);
    }
    f.appendRow([id, seq, adresse, 'k' + corps, quand]);
  } finally {
    verrou.releaseLock();
  }
  try { installerRappels(); } catch (e) { /* l’installation se fait aussi à la main, une fois */ }
  return { ok: true };
}
// Toutes les heures : les rappels arrivés à échéance partent, si la partie attend toujours
function envoyerRappels() {
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(20000)) return;
  try {
    const f = feuille('rappels', ENT_RAPPELS);
    const v = f.getDataRange().getValues();
    if (v.length < 2) return;
    const p = feuille('parties', ENT_PARTIES).getDataRange().getValues();
    const seqDe = {};
    for (let j = 1; j < p.length; j++) seqDe[String(p[j][0])] = Number(p[j][2]) || 0;
    const now = Date.now();
    for (let j = v.length - 1; j >= 1; j--) {
      const quand = v[j][4] instanceof Date ? v[j][4].getTime() : 0;
      if (quand > now) continue;
      const id = String(v[j][0]);
      const attend = id in seqDe && seqDe[id] <= (Number(v[j][1]) || 0);
      f.deleteRow(j + 1);
      if (!attend) continue;
      const corps = String(v[j][3]).replace(/^k/, '');
      try {
        const r = envoyerNotification_({ adresse: String(v[j][2]), corps: corps, urgence: 'normal' });
        noterEvenement({ type: 'notif', detail: r && r.ok ? 'rappel' : 'rappel-echec' });
      } catch (e) { /* une adresse expirée : rien à faire */ }
    }
  } finally {
    verrou.releaseLock();
  }
}
function installerRappels() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('rappels_ok') === '1') return;
  const deja = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'envoyerRappels'; });
  if (!deja) ScriptApp.newTrigger('envoyerRappels').timeBased().everyHours(1).create();
  props.setProperty('rappels_ok', '1');
}

/* La paire de clés VAPID : créée une fois, gardée dans les propriétés du script */
function clesVapid() {
  const props = PropertiesService.getScriptProperties();
  let d = props.getProperty('vapid_d'), pub = props.getProperty('vapid_pub');
  if (d && pub) return { d: BigInt('0x' + d), pub: pub };
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    d = props.getProperty('vapid_d'); pub = props.getProperty('vapid_pub');
    if (!(d && pub)) {
      // Hasard : plusieurs identifiants aléatoires de Google, passés au hachage
      let graine = '';
      for (let j = 0; j < 8; j++) graine += Utilities.getUuid() + Date.now() + Math.random();
      const C = ec();
      const x = BigInt('0x' + hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, graine, Utilities.Charset.UTF_8)));
      const dd = x % (C.n - C._1) + C._1;
      const Q = ecVersAffine(ecMul(dd, C.G));
      d = dd.toString(16).padStart(64, '0');
      pub = b64u([4].concat(octets(Q[0]), octets(Q[1])));
      props.setProperty('vapid_d', d);
      props.setProperty('vapid_pub', pub);
    }
  } finally {
    verrou.releaseLock();
  }
  return { d: BigInt('0x' + d), pub: pub };
}

function jetonVapid(origine, k) {
  const cache = CacheService.getScriptCache();
  const memo = 'jwt' + hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, origine + k.pub, Utilities.Charset.UTF_8)).slice(0, 32);
  const vu = cache.get(memo);
  if (vu) return vu;
  const tete = b64u(texteOctets(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const charge = b64u(texteOctets(JSON.stringify({ aud: origine, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: PUSH_SUJET })));
  const signe = tete + '.' + charge;
  const jeton = signe + '.' + b64u(ecdsaSigne(k.d, texteOctets(signe)));
  cache.put(memo, jeton, 6 * 3600);
  return jeton;
}

/* À lancer depuis l’éditeur : crée les clés si besoin, signe un jeton, le vérifie,
   et contacte le service de notification de Google (ce qui fait demander l’autorisation
   « se connecter à un service externe », indispensable pour envoyer les avertissements). */
function verifierNotifications() {
  const essai = UrlFetchApp.fetch('https://fcm.googleapis.com/', { muteHttpExceptions: true });
  Logger.log('Service de notification joignable (code ' + essai.getResponseCode() + ').');
  const k = clesVapid();
  const msg = texteOctets('kiff kiff');
  const sig = ecdsaSigne(k.d, msg);
  const brut = signes(Utilities.base64DecodeWebSafe(k.pub + '='.repeat((4 - k.pub.length % 4) % 4))).map(function (b) { return b & 255; });
  const Q = [enEntier(brut.slice(1, 33)), enEntier(brut.slice(33, 65))];
  const ok = ecdsaVerifie(Q, msg, sig);
  Logger.log((ok ? 'Notifications prêtes. ' : 'Problème de signature. ') + 'Clé publique : ' + k.pub);
  return ok;
}

/* ---------- Courbe P-256 et signature ECDSA (SHA-256), sans bibliothèque ----------
   Les grands nombres (BigInt) ne sont créés qu’à l’usage : le reste du script n’en dépend pas. */
let EC_ = null;
function ec() {
  if (!EC_) {
    const N = BigInt;
    EC_ = {
      p: N('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff'),
      n: N('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551'),
      gx: N('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'),
      gy: N('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5'),
      _0: N(0), _1: N(1), _2: N(2), _3: N(3), _4: N(4), _8: N(8)
    };
    EC_.G = [EC_.gx, EC_.gy, EC_._1];
    EC_.O = [EC_._0, EC_._1, EC_._0];
  }
  return EC_;
}
function md(a, m) { const r = a % m; return r < ec()._0 ? r + m : r; }
function mpow(b, e, m) {
  const C = ec();
  let r = C._1; b = md(b, m);
  e.toString(2).split('').forEach(function (bit) { r = r * r % m; if (bit === '1') r = r * b % m; });
  return r;
}
function minv(a, m) { return mpow(md(a, m), m - ec()._2, m); }
// Points en coordonnées jacobiennes [X, Y, Z] ; Z = 0 : point à l’infini
function ecDouble(P) {
  const C = ec(), p = C.p, X = P[0], Y = P[1], Z = P[2];
  if (Z === C._0 || Y === C._0) return C.O;
  const delta = Z * Z % p, gamma = Y * Y % p, beta = X * gamma % p;
  const alpha = C._3 * md(X - delta, p) % p * ((X + delta) % p) % p;
  const X3 = md(alpha * alpha - C._8 * beta, p);
  const Z3 = md((Y + Z) * (Y + Z) - gamma - delta, p);
  const Y3 = md(alpha * md(C._4 * beta - X3, p) - C._8 * (gamma * gamma % p), p);
  return [X3, Y3, Z3];
}
function ecAdd(P, Q) {
  const C = ec(), p = C.p;
  if (P[2] === C._0) return Q;
  if (Q[2] === C._0) return P;
  const Z1Z1 = P[2] * P[2] % p, Z2Z2 = Q[2] * Q[2] % p;
  const U1 = P[0] * Z2Z2 % p, U2 = Q[0] * Z1Z1 % p;
  const S1 = P[1] * Q[2] % p * Z2Z2 % p, S2 = Q[1] * P[2] % p * Z1Z1 % p;
  const H = md(U2 - U1, p), R = md(S2 - S1, p);
  if (H === C._0) return R === C._0 ? ecDouble(P) : C.O;
  const H2 = H * H % p, H3 = H * H2 % p, U1H2 = U1 * H2 % p;
  const X3 = md(R * R - H3 - C._2 * U1H2, p);
  const Y3 = md(R * md(U1H2 - X3, p) - S1 * H3, p);
  const Z3 = H * P[2] % p * Q[2] % p;
  return [X3, Y3, Z3];
}
function ecMul(k, P) {
  let R = ec().O;
  k.toString(2).split('').forEach(function (bit) { R = ecDouble(R); if (bit === '1') R = ecAdd(R, P); });
  return R;
}
function ecVersAffine(P) {
  const p = ec().p, zi = minv(P[2], p), zi2 = zi * zi % p;
  return [P[0] * zi2 % p, P[1] * zi2 % p * zi % p];
}
function ecdsaSigne(d, msg) {
  const C = ec(), n = C.n;
  const e = md(enEntier(sha256(msg)), n);
  // k déterministe (RFC 6979) : pas besoin d’un bon hasard au moment de signer
  const x = octets(d), h1 = octets(e);
  let V = Array(32).fill(1), K = Array(32).fill(0);
  K = hmac(K, V.concat([0], x, h1)); V = hmac(K, V);
  K = hmac(K, V.concat([1], x, h1)); V = hmac(K, V);
  for (;;) {
    V = hmac(K, V);
    const k = enEntier(V);
    if (k > C._0 && k < n) {
      const r = md(ecVersAffine(ecMul(k, C.G))[0], n);
      const s = minv(k, n) * md(e + r * d, n) % n;
      if (r !== C._0 && s !== C._0) return octets(r).concat(octets(s));
    }
    K = hmac(K, V.concat([0])); V = hmac(K, V);
  }
}
function ecdsaVerifie(Q, msg, sig) {
  const C = ec(), n = C.n;
  const r = enEntier(sig.slice(0, 32)), s = enEntier(sig.slice(32, 64));
  if (r <= C._0 || r >= n || s <= C._0 || s >= n) return false;
  const e = md(enEntier(sha256(msg)), n);
  const w = minv(s, n);
  const P = ecAdd(ecMul(e * w % n, C.G), ecMul(r * w % n, [Q[0], Q[1], C._1]));
  if (P[2] === C._0) return false;
  return md(ecVersAffine(P)[0], n) === r;
}

/* Petits outils d’octets (Apps Script donne des octets signés, de -128 à 127) */
function signes(a) { return a.map(function (b) { return (b << 24) >> 24; }); }
function sha256(octs) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, signes(octs)).map(function (b) { return b & 255; }); }
function hmac(cle, octs) { return Utilities.computeHmacSha256Signature(signes(octs), signes(cle)).map(function (b) { return b & 255; }); }
function enEntier(octs) { return BigInt('0x' + (hex(octs) || '0')); }
function octets(x) { const h = x.toString(16).padStart(64, '0'); const out = []; for (let j = 0; j < 64; j += 2) out.push(parseInt(h.slice(j, j + 2), 16)); return out; }
function texteOctets(t) { return Utilities.newBlob(t).getBytes().map(function (b) { return b & 255; }); }
function b64u(octs) { return Utilities.base64EncodeWebSafe(signes(octs)).replace(/=+$/, ''); }
function hex(octs) { return octs.map(function (b) { return ((b & 255) + 256).toString(16).slice(1); }).join(''); }
