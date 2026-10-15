# Kiff Kiff — brief

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

## Ambiances

L’ambiance se choisit sur l’écran d’accueil et reste mémorisée sur le téléphone. Les règles et les mots sont les mêmes partout. Chaque roue a un ombrage en haut et en bas et des repères sur la ligne lue, pour qu’on comprenne qu’elle tourne.

Les ambiances ont été conçues avec deux skills de design publics, lus directement (sans lancer leurs programmes) : **impeccable** (méthode de refonte, liste des défauts « faits par IA » à éviter) et **UI/UX Pro Max** (base de styles, palettes et associations de polices).

### Zinzin — fanzine risographe
Papier jaune citron avec grain, deux encres (rose fluo et bleu) qui se chevauchent en violet, repérage décalé. Rouleaux en bandes de papier de travers, ombre en trame ; ombrage du tambour en trame qui se resserre. Bande verrouillée : il ne reste que le contour en pointillés. Tampon « changé ». Typo : Bagel Fat One + Archivo.

### Pomme d’Amour — machine à sous de fête foraine
La façade d’une machine à sous en tôle lithographiée : rayons rouge et crème, plaques émaillées rivetées pour la consigne et les switches, borne bleu nuit avec rangée d’ampoules, hublots chromés et tambours crème ombrés, flèches rouges de ligne gagnante, manette rouge pour le hasard, touches de caisse enregistreuse pour « que tu me / de te », ticket d’entrée « changé ». Célébration : rayons qui tournent, phrase sur un ticket gagnant, étoiles et tickets. Typo : Abril Fatface (lettrage d’enseigne extrudé) + Merriweather.

### Red Corner — boudoir
Velours bordeaux plissé, cadre doré à moulures, bougies qui vacillent (et s’embrasent quand on active un switch), écrin capitonné, rouleaux en cadres dorés avec tambours de velours satiné et filets d’or, sceau de cire « changé », feuille d’or sur les titres. Célébration : lumière dorée, pétales et étincelles, phrase sur une carte de visite. Typo : Bodoni Moda italique + Great Vibes pour « J’ai envie » + Jost.

## Fichiers

- `index.html` : structure de l’écran, écrans superposés, sélecteur d’ambiance.
- `base.css` : mécanique commune (mise en page, rouleaux, switches).
- `skins/zinzin.css`, `skins/pomme.css`, `skins/redcorner.css` : une feuille par ambiance.
- `data.js` : les listes des rouleaux (à modifier pour changer les mots).
- `app.js` : rouleaux, déroulé du tour, grammaire, sons, confettis, ambiances.

Aucune dépendance, aucun build : GitHub Pages sert les fichiers tels quels. À chaque mise à jour, augmenter le numéro `?v=` des fichiers dans `index.html` pour que les téléphones rechargent la nouvelle version.

## Pistes ouvertes

- Historique des envies réalisées.
- Ajouter ses propres mots de façon permanente dans les listes.
