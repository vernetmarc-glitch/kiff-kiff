# La Roue du Consentement — brief

Jeu à deux sur un seul téléphone, en portrait. Une phrase d’envie se compose avec des rouleaux de machine à sous ; elle ne devient une envie partagée que quand les deux personnes ont dit « j’ai envie ».

## La phrase

**J’ai envie** · [que tu me | de te] · [action] · [endroit] · [manière]

- Le début « J’ai envie » est un switch : c’est l’envie de la personne qui propose.
- « que tu me / de te » est un sélecteur à deux positions.
- Trois rouleaux : l’action, l’endroit, la manière.
- La fin est un switch « Oui mais… » (par défaut) / « J’ai envie aussi » : c’est la réponse de l’autre personne.
- Les deux switches ont le même dessin.

## Déroulé d’un tour (A propose, B répond)

1. **A compose** : règle « que tu me / de te » et les trois rouleaux (ou bouton Hasard), puis active « J’ai envie ». Écran « passe le téléphone ».
2. **B ajuste** : peut changer **un seul** rouleau. Dès qu’un rouleau change, les deux autres se verrouillent et le « J’ai envie » de A passe en grisé. B ne peut pas toucher au sélecteur « que tu me / de te ». B peut annuler son changement.
3. **B active « J’ai envie aussi »**.
   - Si rien n’a changé : célébration.
   - Si un rouleau a changé : écran « passe le téléphone », A doit réactiver « J’ai envie », puis célébration.
4. **Célébration** animée (confettis, phrase finale). L’action a lieu hors du jeu. Puis les rôles s’inversent : B propose, A ajuste.

**On passe** est disponible à tout moment, sans justification : la même personne propose autre chose, ou l’autre propose à son tour.

## Grammaire

- « que tu me » → subjonctif (que tu me gratouilles) ; « de te » → infinitif (de te gratouiller). Chaque action a ses deux formes dans `data.js`.
- Élision automatique : « que tu m’introduises », « de t’introduire ».
- Les actions construites avec « à » (faire gouzi-gouzi, faire rien du tout) accordent la roue des endroits : à la tête, au gros orteil, aux épaules.
- « Faire rien du tout » est volontairement familier (« de te faire rien du tout au coude ») : la forme correcte « ne rien te faire » ne rentre pas après « de te ».
- « Circlure » se conjugue comme conclure : que tu me circlues.

## Texte libre

Chaque rouleau a une dernière case « ✎ … à toi ». En la touchant, on écrit sa propre action, son endroit ou sa manière (40 caractères max), avec un aperçu de la phrase. Pour l’action, il faut écrire le verbe dans la bonne forme (indiqué dans l’aide). La case libre ne sort jamais au hasard.

## Sensations

- Petit retour haptique et clic sonore très discret à chaque cran de rouleau.
- Petit son discret à l’activation des switches, petit arpège à la célébration.
- Bouton pour couper le son. Haptique : Android via l’API vibration ; iPhone via l’astuce du switch natif de Safari (iOS 18 et plus, au mieux).

## Direction graphique

Fête foraine rétro, léger et décalé : auvent rayé cerise, borne cerise bordée d’ampoules dorées (qui clignotent pendant le hasard et la célébration), fenêtre de rouleaux couleur beurre, fond menthe, encre prune. Typo d’affiche ronde (Shrikhand) pour les switches et les titres, Bricolage Grotesque pour le reste.

## Fichiers

- `index.html` : structure de l’écran et des écrans superposés.
- `style.css` : tout le visuel.
- `data.js` : les listes des rouleaux (à modifier pour changer les mots).
- `app.js` : rouleaux, déroulé du tour, grammaire, sons, confettis.

Aucune dépendance, aucun build : GitHub Pages sert les fichiers tels quels.

## Pistes ouvertes

- Historique des envies réalisées.
- Thème sombre « fête foraine de nuit ».
- Ajouter ses propres mots de façon permanente dans les listes.
