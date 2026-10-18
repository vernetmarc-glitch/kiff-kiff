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
 *
 * Les onglets « mots », « compteurs », « choix » et « parties » se créent tout seuls.
 * Les comptes ne contiennent rien de personnel. L’onglet « parties » garde la dernière étape
 * des parties à deux téléphones, chiffrée par les téléphones : illisible ici, même pour toi.
 */
const MOT_DE_PASSE = 'change-moi';

const ROUES = ['action', 'endroit', 'maniere'];
// Les événements comptés (aucun identifiant, aucune phrase) ; « detail » précise une variante courte
const TYPES = ['partie', 'envie', 'kiff', 'passe', 'visite', 'invitation', 'rejoint', 'mais', 'premier', 'piment', 'monte',
  'partage', 'cafe', 'installe', 'historique'];
const PAR_JOUR = ['visite', 'partie', 'envie', 'kiff', 'rejoint']; // aussi comptés jour par jour
const ENT_JOURS = ['jour', 'type', 'valeur'];
const DETAIL = /^[a-z0-9-]{1,16}$/;
const ENT_MOTS = ['roue', 'niveau', 'que tu me', 'de te', 'avec à', 'ordre'];
const ENT_COMPTEURS = ['compteur', 'valeur'];
const ENT_CHOIX = ['roue', 'mot', 'envies', 'kiffs'];
const ENT_PARTIES = ['partie', 'etat', 'seq', 'maj', 'cree'];
const GARDER_JOURS = 120; // une partie sans nouvelle depuis si longtemps est effacée

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'mots') return sortie(lireMots());
  if (action === 'stats') return sortie(lireStats());
  if (action === 'partie') return sortie(lireParties(e.parameter.p));
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
