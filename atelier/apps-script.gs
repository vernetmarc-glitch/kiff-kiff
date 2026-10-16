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
 * Les onglets « mots », « compteurs » et « choix » se créent tout seuls.
 * Rien de personnel n’est reçu : ni prénom, ni texte écrit à la main, seulement des comptes.
 */
const MOT_DE_PASSE = 'change-moi';

const ROUES = ['action', 'endroit', 'maniere'];
const TYPES = ['partie', 'envie', 'kiff', 'passe'];
const ENT_MOTS = ['roue', 'niveau', 'que tu me', 'de te', 'avec à', 'ordre'];
const ENT_COMPTEURS = ['compteur', 'valeur'];
const ENT_CHOIX = ['roue', 'mot', 'envies', 'kiffs'];

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'mots') return sortie(lireMots());
  if (action === 'stats') return sortie(lireStats());
  return sortie({ ok: true, appli: 'kiffkiff' });
}

function doPost(e) {
  let corps = {};
  try { corps = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return sortie({ ok: false, erreur: 'json' }); }
  if (corps.action === 'event') return sortie(noterEvenement(corps));
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
  feuille('mots', ENT_MOTS); feuille('compteurs', ENT_COMPTEURS); feuille('choix', ENT_CHOIX);
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
  return { ok: true, version: PropertiesService.getScriptProperties().getProperty('version') || '', mots: complet ? res : null };
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
    let k = -1;
    for (let j = 1; j < vc.length; j++) if (vc[j][0] === type) { k = j; break; }
    if (k < 0) fc.appendRow([type, 1]);
    else fc.getRange(k + 1, 2).setValue((Number(vc[k][1]) || 0) + 1);

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
  return { ok: true, compteurs: compteurs, choix: choix };
}
