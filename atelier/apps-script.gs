/* Kiff Kiff — base de données de l’atelier (Google Apps Script lié à une feuille Google Sheets).
 *
 * Mise en place (une seule fois), depuis un ordinateur :
 *   1. Aller sur script.google.com > Nouveau projet (ou, depuis une feuille Google Sheets,
 *      menu Extensions > Apps Script). Effacer le code présent, coller tout ce fichier.
 *   3. Enregistrer, puis choisir la fonction « preparer » et cliquer Exécuter
 *      (Google demande l’autorisation : Paramètres avancés > Accéder au projet).
 *      Le mot de passe de l’atelier ne s’écrit pas ici (ce code est public) : roue dentée
 *      « Paramètres du projet » > Propriétés du script > Ajouter : nom « motdepasse », valeur : ton mot de passe.
 *   4. Déployer > Nouveau déploiement > type « Application Web »
 *        Exécuter en tant que : moi · Qui a accès : Tout le monde > Déployer > Autoriser l’accès.
 *   5. Copier l’adresse de l’application Web (elle finit par /exec).
 *   6. Une fois : choisir la fonction « installerRappels » et cliquer Exécuter (le rappel d’un jour
 *      et les idées pour rejouer passent toutes les heures ; Google demande l’autorisation de créer ce déclencheur).
 *   Après chaque changement de ce fichier : Déployer > Gérer les déploiements > crayon > Version : Nouvelle version.
 *
 * Les onglets « mots », « textes », « compteurs », « choix » et « parties » se créent tout seuls.
 * Avant chaque enregistrement depuis l’atelier, la version d’avant est copiée dans « mots (avant) »
 * ou « textes (avant) » : une erreur se rattrape en recopiant cet onglet.
 * Les notifications (« À toi de jouer ») passent aussi par ce script : il crée tout seul sa paire
 * de clés au premier appel et la garde dans les propriétés du script, jamais dans le code.
 * Il ne fait que transmettre un message déjà chiffré par le téléphone pour l’autre téléphone.
 * Les comptes ne contiennent rien de personnel. L’onglet « parties » garde la dernière étape
 * des parties à deux téléphones, chiffrée par les téléphones : illisible ici, même pour toi.
 * L’onglet « boite » est la boîte aux lettres de la discussion : un message chiffré y attend que
 * l’autre téléphone vienne le chercher, puis il est effacé (30 jours au plus). Illisible ici aussi.
 * L’onglet « journal » garde les 3000 derniers comptes (date, type, variante), sans rien de personnel.
 * L’onglet « relances » (3 novembre 2026) garde les idées pour rejouer : un téléphone qui les a acceptées
 * y dépose jusqu’à trois messages chiffrés pour lui-même, avec leur date. Illisibles ici ; chaque passage
 * dans le jeu les remplace, et ils partent à l’heure dite si personne n’est revenu entre-temps.
 */
/* Le mot de passe de l’atelier : dans les propriétés du script (« motdepasse »), jamais dans ce code.
   Dix essais ratés en dix minutes bloquent l’enregistrement pendant dix minutes. */
function motDePasseOk(mdp) {
  const cache = CacheService.getScriptCache();
  const rates = Number(cache.get('mdp_rates') || 0);
  if (rates >= 10) return 'patiente';
  const vrai = PropertiesService.getScriptProperties().getProperty('motdepasse') || '';
  if (!vrai) return 'absent';
  if (String(mdp || '') === vrai) return 'ok';
  cache.put('mdp_rates', String(rates + 1), 600);
  return 'non';
}

const ROUES = ['action', 'endroit', 'maniere'];
// Les événements comptés (aucun identifiant, aucune phrase) ; « detail » précise une variante courte
const TYPES = ['partie', 'envie', 'kiff', 'passe', 'visite', 'invitation', 'rejoint', 'mais', 'premier', 'piment', 'monte',
  'partage', 'cafe', 'installe', 'historique', 'notif',
  'discussion', 'carte', 'installer', 'attente', 'brulant', 'complet', 'loupe', 'recherche', 'histoire',
  // 2 novembre 2026 : un téléphone nouveau (et d’où il vient), l’appli installée (une fois par téléphone),
  // le retour d’un téléphone (jour 1, semaine…), l’achat
  'appareil', 'retour', 'achat',
  // 3 novembre 2026 : les idées pour rejouer (envoi-j3, ouvre-j3…)
  'relance',
  // 3 novembre 2026 : ton lien Kiff Kiff (visite, envoi, recue, rejoint…)
  'moi'];
const PAR_JOUR = TYPES; // tous les comptes le sont aussi jour par jour (depuis le 2 novembre 2026)
const ENT_JOURNAL = ['quand', 'type', 'variante'];
const JOURNAL_MAX = 3000;
const ENT_BOITE = ['partie', 'place', 'id', 'corps', 'quand'];
const BOITE_JOURS = 30; // un message jamais venu chercher est effacé au bout de 30 jours
const BOITE_MAX = 300; // par partie et par téléphone
const ENT_JOURS = ['jour', 'type', 'valeur'];
const DETAIL = /^[a-z0-9-]{1,16}$/;
const ENT_MOTS = ['roue', 'niveau', 'que tu me', 'de te', 'avec à', 'ordre', 'décalé', 'gratuit'];
const ENT_TEXTES = ['clé', 'texte']; // seulement les textes changés dans l’atelier ; les autres restent ceux du jeu
const ENT_COMPTEURS = ['compteur', 'valeur'];
const ENT_CHOIX = ['roue', 'mot', 'envies', 'kiffs'];
const ENT_PARTIES = ['partie', 'etat', 'seq', 'maj', 'cree', 'coup'];
const GARDER_JOURS = 120; // une partie sans nouvelle depuis si longtemps est effacée
const ENT_RAPPELS = ['partie', 'seq', 'adresse', 'corps', 'quand'];
const RAPPEL_HEURES = 24; // un seul rappel, un jour après un coup resté sans réponse (3 novembre 2026 ; avant : deux jours)
const ENT_RELANCES = ['appareil', 'etape', 'adresse', 'corps', 'quand'];
const RELANCES_MAX = 3;
const ID_APPAREIL = /^[a-z0-9]{12,24}$/;

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'mots') return sortie(lireMots());
  if (action === 'stats') return sortie(lireStats());
  if (action === 'partie') return sortie(lireParties(e.parameter.p));
  if (action === 'boite') return sortie(lireBoite(e.parameter.p, e.parameter.s));
  if (action === 'vapid') return sortie(clePublique());
  return sortie({ ok: true, appli: 'kiffkiff' });
}

function doPost(e) {
  let corps = {};
  try { corps = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return sortie({ ok: false, erreur: 'json' }); }
  if (corps.action === 'event') return sortie(noterEvenement(corps));
  // Plusieurs comptes d’un coup (un seul appel par écran) : moins de requêtes, quotas tenus
  if (corps.action === 'events' && Array.isArray(corps.liste)) return sortie(noterEvenements(corps.liste));
  if (corps.action === 'partie') return sortie(ecrirePartie(corps));
  if (corps.action === 'push') return sortie(envoyerNotification(corps));
  if (corps.action === 'rappel') return sortie(enregistrerRappel(corps));
  if (corps.action === 'relances') return sortie(planifierRelances(corps));
  if (corps.action === 'boite') return sortie(poserBoite(corps));
  if (corps.action === 'boite-lu') return sortie(viderBoite(corps));
  // Tout Kiff Kiff, 3 € (2 novembre 2026) : la page de paiement de Stancer, la vérification au retour, le code d’achat
  if (corps.action === 'achat') return sortie(creerAchat(corps));
  if (corps.action === 'achat-verif') return sortie(verifierAchat(corps));
  if (corps.action === 'achat-cle') return sortie(retrouverAchat(corps));
  if (corps.action === 'check' || corps.action === 'save' || corps.action === 'textes') {
    const mdp = motDePasseOk(corps.motDePasse);
    if (mdp !== 'ok') return sortie({ ok: false, erreur: mdp === 'non' ? 'mot de passe' : mdp });
    if (corps.action === 'check') return sortie({ ok: true });
    if (corps.action === 'save') return sortie(ecrireMots(corps.mots));
    return sortie(ecrireTextes(corps.textes));
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
  if (id) { try { return SpreadsheetApp.openById(id); } catch (err) { /* feuille introuvable : on la cherche ci-dessous */ } }
  // Le 29 octobre 2026, le script avait perdu l’adresse de sa feuille et en avait créé une neuve, vide : les statistiques
  // et les mots de l’atelier semblaient effacés. Désormais, il reprend d’abord la plus ancienne feuille « Kiff Kiff — données ».
  const ancienne = plusAncienneFeuille();
  if (ancienne) { props.setProperty('feuille', ancienne.getId()); return ancienne; }
  const neuf = SpreadsheetApp.create('Kiff Kiff — données');
  props.setProperty('feuille', neuf.getId());
  return neuf;
}
function plusAncienneFeuille(sauf) {
  const it = DriveApp.getFilesByName('Kiff Kiff — données');
  let meilleure = null;
  while (it.hasNext()) {
    const f = it.next();
    if (f.isTrashed() || f.getMimeType() !== MimeType.GOOGLE_SHEETS || f.getId() === sauf) continue;
    if (!meilleure || f.getDateCreated() < meilleure.getDateCreated()) meilleure = f;
  }
  return meilleure ? SpreadsheetApp.openById(meilleure.getId()) : null;
}

/* À lancer une fois depuis l’éditeur (2 novembre 2026) : rapatrie dans la plus ancienne feuille « Kiff Kiff — données »
   tout ce que la feuille neuve du 29 octobre a reçu depuis (comptes, jours, mots choisis, journal, parties, messages en attente,
   rappels, textes changés dans l’atelier), puis le script reprend l’ancienne feuille. La feuille neuve reste intacte (copie de sûreté). */
function recupererAncienneFeuille() {
  const props = PropertiesService.getScriptProperties();
  const neuve = SpreadsheetApp.openById(props.getProperty('feuille'));
  const ancienne = plusAncienneFeuille(neuve.getId());
  if (!ancienne) { Logger.log('Pas d’autre feuille « Kiff Kiff — données » : rien à faire.'); return; }
  const lire = function (c, nom) { const f = c.getSheetByName(nom); return f ? f.getDataRange().getValues().slice(1) : []; };
  const cible = function (nom, ent) { let f = ancienne.getSheetByName(nom); if (!f) { f = ancienne.insertSheet(nom); f.getRange(1, 1, 1, ent.length).setValues([ent]); } return f; };
  // Les totaux : additionnés
  const fc = cible('compteurs', ENT_COMPTEURS);
  const vc = fc.getDataRange().getValues();
  const idx = {}; for (let j = 1; j < vc.length; j++) idx[vc[j][0]] = j;
  lire(neuve, 'compteurs').forEach(function (l) {
    if (!l[0]) return;
    if (idx[l[0]] == null) { idx[l[0]] = vc.length; vc.push([l[0], 0]); }
    vc[idx[l[0]]][1] = (Number(vc[idx[l[0]]][1]) || 0) + (Number(l[1]) || 0);
  });
  fc.getRange(1, 1, vc.length, 2).setValues(vc.map(function (l) { return [l[0], l[1]]; }));
  // Jour par jour : additionnés pour un même jour et un même compte
  const fj = cible('jours', ENT_JOURS);
  const vj = fj.getDataRange().getValues();
  const jour = function (v) { return v instanceof Date ? Utilities.formatDate(v, 'Europe/Paris', 'yyyy-MM-dd') : String(v).replace(/^'/, ''); };
  const ij = {}; for (let j = 1; j < vj.length; j++) ij[jour(vj[j][0]) + '|' + vj[j][1]] = j;
  lire(neuve, 'jours').forEach(function (l) {
    const k = jour(l[0]) + '|' + l[1];
    if (ij[k] == null) { ij[k] = vj.length; vj.push(["'" + jour(l[0]), l[1], 0]); }
    vj[ij[k]][2] = (Number(vj[ij[k]][2]) || 0) + (Number(l[2]) || 0);
  });
  fj.getRange(1, 1, vj.length, 3).setValues(vj.map(function (l, i) { return i ? ["'" + jour(l[0]), l[1], l[2]] : l; }));
  // Les mots choisis : additionnés
  const fx = cible('choix', ENT_CHOIX);
  const vx = fx.getDataRange().getValues();
  const ix = {}; for (let j = 1; j < vx.length; j++) ix[vx[j][0] + '|' + vx[j][1]] = j;
  lire(neuve, 'choix').forEach(function (l) {
    const k = l[0] + '|' + l[1];
    if (ix[k] == null) { ix[k] = vx.length; vx.push([l[0], l[1], 0, 0]); }
    vx[ix[k]][2] = (Number(vx[ix[k]][2]) || 0) + (Number(l[2]) || 0);
    vx[ix[k]][3] = (Number(vx[ix[k]][3]) || 0) + (Number(l[3]) || 0);
  });
  fx.getRange(1, 1, vx.length, 4).setValues(vx);
  // Les parties : la version la plus récente de chacune
  const fp = cible('parties', ENT_PARTIES);
  const vp = fp.getDataRange().getValues();
  const ip = {}; for (let j = 1; j < vp.length; j++) ip[vp[j][0]] = j;
  lire(neuve, 'parties').forEach(function (l) {
    if (!l[0]) return;
    if (ip[l[0]] == null) { ip[l[0]] = vp.length; vp.push(l.slice(0, 5)); }
    else if ((Number(l[2]) || 0) >= (Number(vp[ip[l[0]]][2]) || 0)) vp[ip[l[0]]] = l.slice(0, 5);
  });
  fp.getRange(1, 1, vp.length, 5).setValues(vp.map(function (l) { while (l.length < 5) l.push(''); return l.slice(0, 5); }));
  // Le journal, les messages en attente, les rappels : ajoutés à la suite
  [['journal', ENT_JOURNAL], ['boite', ENT_BOITE], ['rappels', ENT_RAPPELS]].forEach(function (x) {
    const rows = lire(neuve, x[0]).filter(function (l) { return l[0] !== ''; });
    if (!rows.length) return;
    const f = cible(x[0], x[1]);
    f.getRange(f.getLastRow() + 1, 1, rows.length, x[1].length).setValues(rows.map(function (l) { return l.slice(0, x[1].length); }));
  });
  // Les textes changés dans l’atelier depuis : ils remplacent ceux d’avant, clé par clé
  const ft = cible('textes', ENT_TEXTES);
  const vt = ft.getDataRange().getValues();
  const it = {}; for (let j = 1; j < vt.length; j++) it[vt[j][0]] = j;
  lire(neuve, 'textes').forEach(function (l) {
    if (!l[0]) return;
    if (it[l[0]] == null) { it[l[0]] = vt.length; vt.push([l[0], l[1]]); } else vt[it[l[0]]][1] = l[1];
  });
  ft.getRange(1, 1, vt.length, 2).setValues(vt);
  props.setProperty('feuille', ancienne.getId());
  Logger.log('C’est fait : le script reprend la feuille ' + ancienne.getUrl() + ' (la feuille neuve reste intacte : ' + neuve.getUrl() + ').');
}

/* À lancer une fois depuis l’éditeur (bouton Exécuter) pour donner les autorisations
   et créer la feuille. Son adresse s’affiche dans le journal d’exécution. */
function preparer() {
  const c = classeurDonnees();
  feuille('mots', ENT_MOTS); feuille('textes', ENT_TEXTES); feuille('compteurs', ENT_COMPTEURS); feuille('choix', ENT_CHOIX); feuille('parties', ENT_PARTIES); feuille('jours', ENT_JOURS); feuille('boite', ENT_BOITE); feuille('journal', ENT_JOURNAL);
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
      // Un mot décalé (pour rire) : le brocoli des roues le montre ou le cache
      if (l[6] === true || /^(oui|x|vrai|true|1)$/i.test(String(l[6] == null ? '' : l[6]).trim())) x.dc = 1;
      // Un mot de la version gratuite (20 par roue, Tendre et Pimenté)
      if (l[7] === true || /^(oui|x|vrai|true|1)$/i.test(String(l[7] == null ? '' : l[7]).trim())) x.g = 1;
      if (roue === 'action') res.actions.push(x);
      else if (roue === 'endroit') res.objets.push(x);
      else if (roue === 'maniere') res.manieres.push(x);
    });
  const complet = res.actions.length > 2 && res.objets.length > 2 && res.manieres.length > 2;
  const props = PropertiesService.getScriptProperties();
  return { ok: true, version: props.getProperty('version') || '', mots: complet ? res : null, meilleurs: lireMeilleurs(),
    textes: lireTextes(), versionTextes: props.getProperty('version_textes') || '' };
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
      lignes.push([roue, x.lvl || 1, s, i, x.p === 'à' ? 'oui' : '', lignes.length + 1, x.dc ? 'oui' : '', x.g ? 'oui' : '']);
    };
    m.actions.forEach(function (x) { ajoute('action', x); });
    m.objets.forEach(function (x) { ajoute('endroit', x); });
    m.manieres.forEach(function (x) { ajoute('maniere', x); });
    sauvegarder(f, 'mots (avant)');
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

// La version d’avant, gardée dans un onglet à part : une erreur se rattrape
function sauvegarder(f, nom) {
  const classeur = classeurDonnees();
  const v = f.getDataRange().getValues();
  let b = classeur.getSheetByName(nom);
  if (!b) b = classeur.insertSheet(nom);
  b.clearContents();
  if (v.length && v[0].length) b.getRange(1, 1, v.length, v[0].length).setValues(v);
}

/* ---------- Les textes de l’appli changés dans l’atelier ---------- */
const CLE_TEXTE = /^[a-z0-9.-]{1,60}$/;
function lireTextes() {
  const res = {};
  feuille('textes', ENT_TEXTES).getDataRange().getValues().slice(1).forEach(function (l) {
    const k = String(l[0] || '').trim();
    if (CLE_TEXTE.test(k)) res[k] = String(l[1] == null ? '' : l[1]);
  });
  return res;
}
function ecrireTextes(t) {
  if (!t || typeof t !== 'object' || Array.isArray(t)) return { ok: false, erreur: 'textes' };
  const lignes = Object.keys(t).filter(function (k) { return CLE_TEXTE.test(k) && typeof t[k] === 'string'; }).slice(0, 1000)
    .map(function (k) { return [k, t[k].slice(0, 3000)]; });
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const f = feuille('textes', ENT_TEXTES);
    sauvegarder(f, 'textes (avant)');
    f.clearContents();
    f.getRange(1, 1, 1, ENT_TEXTES.length).setValues([ENT_TEXTES]).setFontWeight('bold');
    // Un texte qui commence par = + - @ reste du texte (pas une formule)
    if (lignes.length) { const r = f.getRange(2, 1, lignes.length, 2); r.setNumberFormat('@'); r.setValues(lignes); }
    const version = new Date().toISOString();
    PropertiesService.getScriptProperties().setProperty('version_textes', version);
    return { ok: true, version: version, total: lignes.length };
  } finally {
    verrou.releaseLock();
  }
}

/* ---------- Les comptes envoyés par les téléphones ---------- */
/* Les comptes, par lots (2 novembre 2026) : un seul verrou et une seule lecture de chaque onglet pour tout le lot.
   Avant, chaque compte relisait les onglets et attendait le verrou à son tour : quand plusieurs téléphones
   envoyaient en même temps, des comptes se perdaient (le verrou cède au bout de 15 s, sans rien dire). */
function noterEvenement(corps) { return noterEvenements([corps]); }
function noterEvenements(liste) {
  const evs = (liste || []).filter(function (ev) {
    return ev && typeof ev === 'object' && TYPES.indexOf(String(ev.type || '')) >= 0;
  }).slice(0, 40);
  if (!evs.length) return { ok: false, erreur: 'type' };
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(28000)) return { ok: false, erreur: 'occupe' };
  try {
    const maintenant = new Date();
    const jour = Utilities.formatDate(maintenant, 'Europe/Paris', 'yyyy-MM-dd');
    // Les totaux depuis le début
    const fc = feuille('compteurs', ENT_COMPTEURS);
    const vc = fc.getDataRange().getValues();
    const ligneC = {};
    for (let j = 1; j < vc.length; j++) if (vc[j][0] !== '') ligneC[vc[j][0]] = j;
    const changes = {}, nouvelles = [];
    const plus = function (cle) {
      if (ligneC[cle] == null) { ligneC[cle] = vc.length; vc.push([cle, 0]); nouvelles.push(cle); }
      const k = ligneC[cle];
      vc[k][1] = (Number(vc[k][1]) || 0) + 1;
      changes[k] = true;
    };
    // Jour par jour : tous les types (et leurs variantes), pour les courbes et les comptes de 7 et 30 jours
    const fj = feuille('jours', ENT_JOURS);
    const nj = fj.getLastRow();
    const debut = Math.max(2, nj - 400);
    const vj = nj >= 2 ? fj.getRange(debut, 1, nj - debut + 1, 3).getValues() : [];
    const ligneJ = {};
    vj.forEach(function (l, i) {
      const d = l[0] instanceof Date ? Utilities.formatDate(l[0], 'Europe/Paris', 'yyyy-MM-dd') : String(l[0]).replace(/^'/, '');
      if (d === jour) ligneJ[l[1]] = i;
    });
    const parJour = {};
    const journal = [];
    const choixLot = [];
    evs.forEach(function (ev) {
      const type = String(ev.type);
      const detail = String(ev.detail || '');
      const variante = detail && DETAIL.test(detail) ? detail : '';
      plus(type);
      if (variante) plus(type + ':' + variante);
      parJour[type] = (parJour[type] || 0) + 1;
      if (variante) parJour[type + ':' + variante] = (parJour[type + ':' + variante] || 0) + 1;
      journal.push([maintenant, type, variante]);
      if ((type === 'envie' || type === 'kiff') && Array.isArray(ev.choix)) choixLot.push({ type: type, choix: ev.choix });
    });
    // Écrire les totaux : les lignes changées, puis les nouvelles
    Object.keys(changes).forEach(function (k) {
      k = Number(k);
      if (nouvelles.indexOf(vc[k][0]) >= 0) return;
      fc.getRange(k + 1, 2).setValue(vc[k][1]);
    });
    if (nouvelles.length) fc.getRange(fc.getLastRow() + 1, 1, nouvelles.length, 2).setValues(nouvelles.map(function (c) { return [c, vc[ligneC[c]][1]]; }));
    // Écrire les comptes du jour
    const ajouts = [];
    Object.keys(parJour).forEach(function (t) {
      if (ligneJ[t] != null) {
        const i = ligneJ[t];
        fj.getRange(debut + i, 3).setValue((Number(vj[i][2]) || 0) + parJour[t]);
      } else ajouts.push(["'" + jour, t, parJour[t]]);
    });
    if (ajouts.length) fj.getRange(fj.getLastRow() + 1, 1, ajouts.length, 3).setValues(ajouts);
    // Le journal des derniers comptes
    const fl = feuille('journal', ENT_JOURNAL);
    fl.getRange(fl.getLastRow() + 1, 1, journal.length, 3).setValues(journal);
    const nl = fl.getLastRow();
    if (nl > JOURNAL_MAX + 200) fl.deleteRows(2, nl - 1 - JOURNAL_MAX);
    // Les mots choisis et les mots des kiff kiff
    if (choixLot.length) {
      const fx = feuille('choix', ENT_CHOIX);
      const vx = fx.getDataRange().getValues();
      const ligneX = {};
      for (let j = 1; j < vx.length; j++) ligneX[vx[j][0] + '|' + vx[j][1]] = j;
      const touches = {}, neufs = [];
      choixLot.forEach(function (c) {
        const col = c.type === 'kiff' ? 3 : 2;
        c.choix.slice(0, 3).forEach(function (mot, r) {
          mot = String(mot || '').trim().slice(0, 80);
          if (!mot) return;
          const cle = ROUES[r] + '|' + mot;
          if (ligneX[cle] == null) { ligneX[cle] = vx.length; vx.push([ROUES[r], mot, 0, 0]); neufs.push(ligneX[cle]); }
          const k = ligneX[cle];
          vx[k][col] = (Number(vx[k][col]) || 0) + 1;
          touches[k] = true;
        });
      });
      Object.keys(touches).forEach(function (k) {
        k = Number(k);
        if (neufs.indexOf(k) >= 0) return;
        fx.getRange(k + 1, 3, 1, 2).setValues([[vx[k][2], vx[k][3]]]);
      });
      if (neufs.length) fx.getRange(fx.getLastRow() + 1, 1, neufs.length, 4).setValues(neufs.map(function (k) { return vx[k]; }));
    }
    return { ok: true, n: evs.length };
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
  const journal = feuille('journal', ENT_JOURNAL).getDataRange().getValues().slice(1).slice(-80).reverse()
    .map(function (l) { return { quand: l[0] instanceof Date ? l[0].getTime() : 0, type: String(l[1]), variante: String(l[2] || '') }; });
  const enAttente = Math.max(0, feuille('boite', ENT_BOITE).getLastRow() - 1);
  return { ok: true, compteurs: compteurs, choix: choix, jours: jours, distance: lireDistance(), journal: journal, boite: enAttente };
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
  // Le coup : combien de vrais pas la partie a faits (2 novembre 2026). La feuille garde l’état le plus avancé dans la partie,
  // puis le plus récent : un réglage envoyé par un téléphone resté en arrière n’efface plus le coup de l’autre.
  const coup = Number(c.coup) || 0;
  if (!ID_PARTIE.test(id) || !etat || etat.length > 45000 || !/^[A-Za-z0-9_-]+$/.test(etat)) return { ok: false, erreur: 'partie' };
  const verrou = LockService.getScriptLock();
  // Occupé (les compteurs écrivent en même temps) : on le dit, le téléphone renverra l’état un peu plus tard
  if (!verrou.tryLock(25000)) return { ok: false, erreur: 'occupe' };
  try {
    const f = feuille('parties', ENT_PARTIES);
    if (f.getRange(1, 5).getValue() !== 'cree') f.getRange(1, 5).setValue('cree').setFontWeight('bold');
    if (f.getRange(1, 6).getValue() !== 'coup') f.getRange(1, 6).setValue('coup').setFontWeight('bold');
    const v = f.getDataRange().getValues();
    let k = -1;
    for (let j = 1; j < v.length; j++) if (String(v[j][0]) === id) { k = j; break; }
    // « k » devant : la feuille ne doit jamais prendre l’état pour un nombre ou une formule
    if (k < 0) f.appendRow([id, 'k' + etat, seq, new Date(), new Date(), coup]);
    else {
      const coupGarde = Number(v[k][5]) || 0, seqGarde = Number(v[k][2]) || 0;
      if (coup > coupGarde || (coup === coupGarde && seq > seqGarde)) {
        f.getRange(k + 1, 2, 1, 3).setValues([['k' + etat, seq, new Date()]]);
        f.getRange(k + 1, 6).setValue(coup);
      } else return { ok: true, ancien: true };
    }
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

/* ---------- La boîte aux lettres de la discussion ----------
 * Le téléphone qui écrit dépose ici le message déjà chiffré (avec la clé du lien, que ce script n’a pas)
 * pour l’autre téléphone ; celui-ci vient le chercher, puis demande de l’effacer. */
const ID_MESSAGE = /^[A-Za-z0-9_-]{6,24}$/;
function poserBoite(c) {
  const id = String(c.partie || ''), place = Number(c.place), mid = String(c.id || ''), corps = String(c.corps || '');
  if (!ID_PARTIE.test(id) || (place !== 0 && place !== 1)) return { ok: false, erreur: 'partie' };
  if (!ID_MESSAGE.test(mid)) return { ok: false, erreur: 'id' };
  if (!corps || corps.length > 12000 || !/^[A-Za-z0-9_-]+$/.test(corps)) return { ok: false, erreur: 'corps' };
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const f = feuille('boite', ENT_BOITE);
    const v = f.getDataRange().getValues();
    let n = 0;
    for (let j = 1; j < v.length; j++) if (String(v[j][0]) === id && Number(v[j][1]) === place) { if (String(v[j][2]) === mid) return { ok: true }; n++; }
    // Trop de messages en attente pour ce téléphone : le plus ancien laisse sa place
    if (n >= BOITE_MAX) for (let j = 1; j < v.length; j++) if (String(v[j][0]) === id && Number(v[j][1]) === place) { f.deleteRow(j + 1); break; }
    f.appendRow([id, place, mid, 'k' + corps, new Date()]);
  } finally {
    verrou.releaseLock();
  }
  return { ok: true };
}
function lireBoite(partie, place) {
  const id = String(partie || ''), s = Number(place);
  if (!ID_PARTIE.test(id) || (s !== 0 && s !== 1)) return { ok: false, erreur: 'partie' };
  const v = feuille('boite', ENT_BOITE).getDataRange().getValues().slice(1);
  const messages = v.filter(function (l) { return String(l[0]) === id && Number(l[1]) === s; })
    .slice(0, 200).map(function (l) { return { id: String(l[2]), corps: String(l[3]).replace(/^k/, '') }; });
  return { ok: true, messages: messages };
}
function viderBoite(c) {
  const id = String(c.partie || ''), place = Number(c.place);
  if (!ID_PARTIE.test(id) || (place !== 0 && place !== 1) || !Array.isArray(c.ids)) return { ok: false, erreur: 'partie' };
  const ids = c.ids.slice(0, 200).map(String).filter(function (x) { return ID_MESSAGE.test(x); });
  if (!ids.length) return { ok: true };
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const f = feuille('boite', ENT_BOITE);
    const v = f.getDataRange().getValues();
    for (let j = v.length - 1; j >= 1; j--) {
      if (String(v[j][0]) === id && Number(v[j][1]) === place && ids.indexOf(String(v[j][2])) >= 0) f.deleteRow(j + 1);
    }
  } finally {
    verrou.releaseLock();
  }
  return { ok: true };
}
// Avec les rappels, toutes les heures : les messages jamais venus chercher depuis 30 jours s’effacent
function nettoyerBoite() {
  const f = feuille('boite', ENT_BOITE);
  const v = f.getDataRange().getValues();
  const limite = Date.now() - BOITE_JOURS * 864e5;
  for (let j = v.length - 1; j >= 1; j--) {
    const q = v[j][4] instanceof Date ? v[j][4].getTime() : 0;
    if (q && q < limite) f.deleteRow(j + 1);
  }
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
/* Les idées pour rejouer : la liste de ce téléphone remplace la précédente (vide : il n’en veut plus) */
function planifierRelances(c) {
  const appareil = String(c.appareil || '');
  if (!ID_APPAREIL.test(appareil)) return { ok: false, erreur: 'appareil' };
  const liste = Array.isArray(c.liste) ? c.liste.slice(0, RELANCES_MAX) : [];
  const adresse = String(c.adresse || '');
  if (liste.length && (!PUSH_HOTES.test(adresse) || adresse.length > 1000)) return { ok: false, erreur: 'adresse' };
  const now = Date.now();
  const lignes = [];
  for (const x of liste) {
    const etape = String(x && x.etape || ''), corps = String(x && x.corps || ''), quand = Number(x && x.quand) || 0;
    if (!/^[a-z0-9]{1,10}$/.test(etape) || quand < now || quand > now + 30 * 864e5) return { ok: false, erreur: 'etape' };
    if (!corps || corps.length > 5000 || !/^[A-Za-z0-9_-]+$/.test(corps)) return { ok: false, erreur: 'corps' };
    lignes.push([appareil, etape, adresse, 'k' + corps, new Date(quand)]);
  }
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const f = feuille('relances', ENT_RELANCES);
    const v = f.getDataRange().getValues();
    for (let j = v.length - 1; j >= 1; j--) if (String(v[j][0]) === appareil) f.deleteRow(j + 1);
    if (lignes.length) f.getRange(f.getLastRow() + 1, 1, lignes.length, ENT_RELANCES.length).setValues(lignes);
  } finally {
    verrou.releaseLock();
  }
  try { installerRappels(); } catch (e) { /* l’installation se fait aussi à la main, une fois */ }
  return { ok: true };
}
// Les idées pour rejouer arrivées à l’heure : elles partent ; une adresse expirée efface tout ce téléphone
function envoyerRelances_() {
  const f = feuille('relances', ENT_RELANCES);
  const v = f.getDataRange().getValues();
  if (v.length < 2) return;
  const now = Date.now();
  const mort = {};
  for (let j = v.length - 1; j >= 1; j--) {
    const appareil = String(v[j][0]);
    if (mort[appareil]) { f.deleteRow(j + 1); continue; }
    const quand = v[j][4] instanceof Date ? v[j][4].getTime() : 0;
    if (quand > now) continue;
    f.deleteRow(j + 1);
    try {
      const r = envoyerNotification_({ adresse: String(v[j][2]), corps: String(v[j][3]).replace(/^k/, ''), urgence: 'normal' });
      noterEvenement({ type: 'relance', detail: (r && r.ok ? 'envoi-' : 'echec-') + String(v[j][1]) });
      if (r && (r.code === 404 || r.code === 410)) mort[appareil] = true;
    } catch (e) { /* la prochaine fois */ }
  }
}
// Toutes les heures : les rappels arrivés à échéance partent, si la partie attend toujours
function envoyerRappels() {
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(20000)) return;
  try {
    try { nettoyerBoite(); } catch (e) { /* la prochaine fois */ }
    try { envoyerRelances_(); } catch (e) { /* la prochaine fois */ }
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


/* ---------- Tout Kiff Kiff, 3 € (2 novembre 2026) ----------
   Le paiement passe par la page de paiement de Stancer : ni carte, ni nom, ni adresse ne passent par ce script.
   La clé secrète Stancer vit seulement dans les propriétés du script (STANCER_SECRET, sprod_… ou stest_…).
   L’onglet « achats » garde, pour chaque achat : un numéro tiré au hasard, l’intention de paiement Stancer, la date, l’état.
   Le code d’achat (numéro + signature) se vérifie sans rien garder d’autre : il rouvre Tout Kiff Kiff sur un autre téléphone. */
const ENT_ACHATS = ['achat', 'stancer', 'date', 'etat', 'paye_le', 'restaure'];
const PRIX_CENTIMES = 300;
const RETOUR_ACHAT = 'https://kiff-kiff.fr/';
function stancer(methode, chemin, corps) {
  const cle = PropertiesService.getScriptProperties().getProperty('STANCER_SECRET') || '';
  if (!/^s(test|prod)_/.test(cle)) return { erreur: 'cle' };
  const opts = { method: methode, muteHttpExceptions: true, headers: { Authorization: 'Basic ' + Utilities.base64Encode(cle + ':') } };
  if (corps) { opts.contentType = 'application/json'; opts.payload = JSON.stringify(corps); }
  const r = UrlFetchApp.fetch('https://api.stancer.com' + chemin, opts);
  let j = {};
  try { j = JSON.parse(r.getContentText() || '{}'); } catch (err) { j = {}; }
  if (r.getResponseCode() >= 300) return { erreur: 'stancer-' + r.getResponseCode(), detail: j && j.error ? String(j.error.message || j.error.type || '') : '' };
  return j;
}
function selAchat() {
  const props = PropertiesService.getScriptProperties();
  let sel = props.getProperty('achat_sel');
  if (!sel) { sel = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('achat_sel', sel); }
  return sel;
}
function signerAchat(id) { return hex(hmac(texteOctets(selAchat()), texteOctets(id))).slice(0, 12); }
const idAchatOk = (id) => /^[a-f0-9]{24}$/.test(String(id || ''));
function ligneAchat(f, id) {
  const ids = f.getRange(1, 1, Math.max(1, f.getLastRow()), 1).getValues();
  for (let i = ids.length - 1; i >= 1; i--) if (ids[i][0] === id) return i + 1;
  return 0;
}
function creerAchat() {
  const id = Utilities.getUuid().replace(/-/g, '').slice(0, 24);
  const pi = stancer('post', '/v2/payment_intents/', {
    amount: PRIX_CENTIMES, currency: 'eur', description: 'Kiff Kiff - Tout Kiff Kiff',
    order_id: id, unique_id: id, methods_allowed: ['card'], capture: true,
    return_url: RETOUR_ACHAT + '?achat=' + id
  });
  if (pi.erreur || !pi.id || !pi.url) return { ok: false, erreur: pi.erreur || 'stancer' };
  feuille('achats', ENT_ACHATS).appendRow([id, pi.id, new Date(), 'cree', '', 0]);
  return { ok: true, id: id, url: pi.url };
}
function verifierAchat(corps) {
  const id = String(corps.id || '');
  if (!idAchatOk(id)) return { ok: false, erreur: 'achat' };
  const f = feuille('achats', ENT_ACHATS);
  const n = ligneAchat(f, id);
  if (!n) return { ok: false, erreur: 'achat' };
  const l = f.getRange(n, 1, 1, ENT_ACHATS.length).getValues()[0];
  if (l[3] === 'paye') return { ok: true, paye: true, code: id + '-' + signerAchat(id) };
  let pi = stancer('get', '/v2/payment_intents/' + l[1]);
  if (pi.erreur) return { ok: false, erreur: pi.erreur };
  // Autorisé seulement : on encaisse, puis on relit
  if (pi.status === 'authorized') { stancer('post', '/v2/payment_intents/' + l[1] + '/capture'); pi = stancer('get', '/v2/payment_intents/' + l[1]); }
  const paye = pi.status === 'captured' || pi.status === 'processing';
  if (!paye) { f.getRange(n, 4).setValue(String(pi.status || 'inconnu')); return { ok: true, paye: false, etat: String(pi.status || '') }; }
  f.getRange(n, 4, 1, 2).setValues([['paye', new Date()]]);
  return { ok: true, paye: true, code: id + '-' + signerAchat(id) };
}
function retrouverAchat(corps) {
  const m = /^([a-f0-9]{24})-([a-f0-9]{12})$/.exec(String(corps.code || '').trim().toLowerCase());
  if (!m || signerAchat(m[1]) !== m[2]) return { ok: false, erreur: 'code' };
  const f = feuille('achats', ENT_ACHATS);
  const n = ligneAchat(f, m[1]);
  if (!n || f.getRange(n, 4).getValue() !== 'paye') return { ok: false, erreur: 'code' };
  const c = f.getRange(n, 6);
  c.setValue((+c.getValue() || 0) + 1);
  return { ok: true };
}
/* À lancer une fois depuis l’éditeur, après avoir mis STANCER_SECRET : vérifie la clé (une intention de 3 € créée, jamais payée) */
function testerStancer() {
  const r = creerAchat();
  Logger.log(r.ok ? 'La clé Stancer marche. Page de paiement de test : ' + r.url : 'Ça ne marche pas : ' + r.erreur);
}
