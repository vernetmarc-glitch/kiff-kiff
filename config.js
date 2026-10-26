/* Kiff Kiff — réglages du site.
 *
 * KIFF_API : adresse de l’application Web Google Apps Script (voir atelier/apps-script.gs).
 *   Vide : le jeu n’envoie rien et garde les mots de data.js.
 *   Remplie : chaque téléphone envoie des comptes anonymes (parties, envies, kiff kiff, passes)
 *   et reçoit les mots modifiés dans l’atelier (data.js reste la liste de secours).
 */
/* KIFF_DON : la page de soutien ouverte par « Payez-moi un café » (à changer en un seul endroit). */
window.KIFF_DON = 'https://buymeacoffee.com/MarcVernet';

/* KIFF_OFFRE : la version gratuite et le jeu complet.
 *   'tout'   : tout est ouvert, rien n’est marqué.
 *   'essai'  : la version gratuite (20 mots par roue, Tendre et Pimenté) ; toucher une fonction du jeu complet
 *              ouvre « Tout Kiff Kiff », qui dit que pour l’instant tout est gratuit et débloque d’un geste.
 *   'payant' : plus tard, le paiement de 3 €. */
window.KIFF_OFFRE = 'essai';

window.KIFF_API = 'https://script.google.com/macros/s/AKfycby4c2tJl4cb1fWk3C86lt15OY6lEjUJZ7_Z5W9p3FC4PHAwSZu8nFSnQ5gPyx9rboI8Ug/exec';

/* Les derniers mots reçus de l’atelier sont gardés sur le téléphone et servent dès l’ouverture. */
(function () {
  try {
    var c = JSON.parse(localStorage.getItem('roue:mots') || 'null');
    var ok = function (l) { return Array.isArray(l) && l.length > 2; };
    if (window.KIFF_API && c && c.api === window.KIFF_API && c.mots && ok(c.mots.actions) && ok(c.mots.objets) && ok(c.mots.manieres) && window.ROUE_DATA) {
      window.ROUE_DATA.actions = c.mots.actions;
      window.ROUE_DATA.objets = c.mots.objets;
      window.ROUE_DATA.manieres = c.mots.manieres;
      window.KIFF_MOTS_VERSION = c.version || '';
    }
  } catch (e) { /* rien */ }
})();
/* Les textes changés dans l’atelier (onglet « Les textes ») : gardés sur le téléphone, servis dès l’ouverture. */
(function () {
  try {
    var c = JSON.parse(localStorage.getItem('roue:textes') || 'null');
    if (window.KIFF_API && c && c.api === window.KIFF_API && c.textes && window.KIFF_TX) {
      Object.keys(c.textes).forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(window.KIFF_TX, k) && typeof c.textes[k] === 'string') window.KIFF_TX[k] = c.textes[k];
      });
      window.KIFF_TEXTES_VERSION = c.version || '';
    }
  } catch (e) { /* rien */ }
})();
