# Kiff Kiff — brief

Jeu à deux sur un seul téléphone ou sur deux téléphones, en portrait. Une phrase d’envie se compose avec des rouleaux de machine à sous ; elle ne devient une envie partagée que quand les deux personnes ont dit « j’ai envie ».

## La phrase

**J’ai envie** · [que tu me | de te] · [action] · [endroit] · [manière]

- Le début « J’ai envie » est un switch : c’est l’envie de la personne qui propose.
- « que tu me / de te » est un sélecteur à deux positions.
- Trois rouleaux : l’action, l’endroit, la manière.
- La fin est un switch « J’ai envie aussi », grisé tant que l’autre personne ne l’a pas activé : c’est sa réponse.
- Les deux switches ont le même dessin.

## Déroulé d’un tour (A propose, B répond)

1. **A compose** : règle « que tu me / de te » et les trois rouleaux (ou bouton Hasard), puis active « J’ai envie ». Écran « passe le téléphone ».
2. **B ajuste** : peut changer **un seul** rouleau. Dès qu’un rouleau change, les deux autres se verrouillent et le « J’ai envie » de A passe en grisé. B ne peut pas toucher au sélecteur « que tu me / de te ». B peut annuler son changement.
3. **B active « J’ai envie aussi »**.
   - Si rien n’a changé : célébration.
   - Si un rouleau a changé : écran « passe le téléphone », A doit réactiver « J’ai envie », puis célébration.
4. **Célébration** animée (confettis, phrase finale). L’action a lieu hors du jeu. Puis les rôles s’inversent : B propose, A ajuste.

**On passe** est disponible à tout moment, sans justification : la même personne propose autre chose, ou l’autre propose à son tour.

## Deux téléphones

Sur l’accueil, à côté de « Et l’autre ? », le lien « Sur son téléphone ? » ouvre le mode à deux téléphones.

1. **Créer** : la première personne écrit son prénom et touche « Créer la partie ». Un QR code et un lien d’invitation s’affichent (« Envoyer le lien » ouvre le partage du téléphone, « Copier le lien » le copie).
2. **Rejoindre** : l’autre scanne le QR code ou ouvre le lien, écrit son prénom, touche « Rejoindre ». La partie commence : la personne qui a invité propose en premier, les rouleaux sont tirés au hasard.
3. **Jouer** : chaque téléphone ne montre les rouleaux qu’à la personne qui a la main. L’autre voit un écran d’attente : « Au tour de … » pendant la composition, « Envie envoyée » avec la phrase pendant la lecture, « Tu as changé … » pendant la reconfirmation. L’envie arrive sur l’autre téléphone avec un petit son, une vibration et les rouleaux qui tournent. La célébration s’affiche sur les deux téléphones en même temps.
4. **On passe** reste disponible partout, y compris depuis l’écran d’attente ; l’autre téléphone reçoit « On passe. Pas besoin d’expliquer pourquoi. »
5. **Accueil** pendant une partie à deux : « Reprendre la partie » ou « Quitter la partie à deux » (l’autre téléphone en est prévenu).

- Recharger la page ou rouvrir le lien reprend la partie là où elle en était.
- Une ligne prévient si l’autre téléphone n’est plus connecté ; tout reprend à son retour.
- Ambiance et son restent propres à chaque téléphone ; le piment est commun et se règle par la personne qui compose.

**Comment ça marche.** Pas de serveur à nous : les deux téléphones passent par un relais public gratuit (MQTT sur WebSocket sécurisé : HiveMQ, sinon EMQX, sinon Mosquitto). Tout ce qui passe par le relais est chiffré (AES-GCM) avec une clé qui n’existe que dans le lien d’invitation, après le « # » : le relais ne voit ni les prénoms ni les phrases. Les deux téléphones doivent avoir la même version des roues (sinon un message demande de recharger la page). Code : `duo.js` (liaison) et la partie « Deux téléphones » de `app.js` ; bibliothèques dans `vendor/` (mqtt.js 5.10.1 et qrcode-generator 1.4.4, licence MIT), chargées seulement quand on joue à deux.

## Grammaire

- « que tu me » → subjonctif (que tu me gratouilles) ; « de te » → infinitif (de te gratouiller). Chaque action a ses deux formes dans `data.js`.
- Élision automatique : « que tu m’intromettes », « de t’intromettre ».
- Les actions construites avec « à » (faire gouzi-gouzi, faire rien du tout, rouler une pelle chaude) accordent la roue des endroits : à la tête, au gros orteil, aux épaules.
- « Faire rien du tout » est volontairement familier (« de te faire rien du tout au coude ») : la forme correcte « ne rien te faire » ne rentre pas après « de te ».
- « Circlure » se conjugue comme conclure : que tu me circlues.

## Piment

Trois niveaux qui se cochent indépendamment (au moins un) : **Tendre** (1 piment), **Pimenté** (2), **Brûlant** (3). Par défaut : Tendre et Pimenté.

- Accueil : une ligne « Piment » montre les niveaux cochés et ouvre la fenêtre de choix.
- Jeu : le bouton piments de la barre du haut ouvre la même fenêtre, pendant la composition seulement. Changer le piment depuis l’accueil au milieu d’une réponse oblige à lancer une nouvelle partie.
- Dans les roues, les cases pimentées portent une pastille à 2 piments, les brûlantes une pastille à 3 piments.
- Lien : `?piment=12`, `?piment=3`, `?piment=123`…
- Certaines manières et certains endroits changent de possessif selon le sens : « que tu me … avec ton sexe » / « de te … avec mon sexe » ; « que tu me caresses mon sexe chaud » / « de te caresser ton sexe chaud », « tout mon corps » / « tout ton corps ».
- Chaque mot porte son niveau dans `data.js` (`lvl: 2` ou `lvl: 3`, rien = Tendre).
- Les listes ont été revues par Marc dans l’Atelier des roues (une page d’édition à part) le 15 octobre 2026 (quatre passes) : 53 tendres, 28 pimentées, 36 brûlantes au total.

## Texte libre

Chaque rouleau a une dernière case « ✎ … à toi ». En la touchant, on écrit sa propre action, son endroit ou sa manière (40 caractères max), avec un aperçu de la phrase. Pour l’action, il faut écrire le verbe dans la bonne forme (indiqué dans l’aide). La case libre ne sort jamais au hasard.

## Repères pour bien jouer (revue UX)

- Un switch éteint garde son texte en grisé (« J’ai envie », « J’ai envie aussi ») et s’allume quand on l’active.
- Le switch qu’on attend émet une onde : celui du haut pendant la composition et la reconfirmation, celui du bas pendant la réponse.
- La consigne dit qui joue et quoi faire, avec le verbe « fais glisser » pour les roues.
- Écran de passage : lien « Oups, … n’avait pas fini » pour revenir en arrière après un switch activé trop vite.
- Écran de célébration : lien « Finalement, on passe » ; on peut changer d’avis jusqu’au bout.
- La case libre s’annonce « touche pour écrire ton action / ton endroit / ta manière ».
- Bouton « Accueil » (maison) dans la barre du haut : il rouvre l’écran d’accueil pour changer les prénoms, l’ambiance ou le son. On y trouve « Reprendre la partie en cours » ou « Nouvelle partie ».

## Sensations

- Petit retour haptique et clic sonore très discret à chaque cran de rouleau.
- Petit son discret à l’activation des switches, petit arpège à la célébration.
- Lien « Son : activé / coupé » sur l’écran d’accueil pour couper le son. Haptique : Android via l’API vibration ; iPhone via l’astuce du switch natif de Safari (iOS 18 et plus, au mieux).

## Ambiances

Ambiance par défaut : Red Corner. L’ambiance se choisit depuis le lien discret « Ambiance : … » sous le bouton de l’accueil (il ouvre une petite feuille avec les trois vignettes) et reste mémorisée sur le téléphone. On peut aussi l’imposer dans le lien : `?design=arty`, `?design=pomme` ou `?design=redcorner` (ou `#redcorner` en fin d’adresse). Les règles et les mots sont les mêmes partout. Chaque roue a un ombrage en haut et en bas et des repères sur la ligne lue, pour qu’on comprenne qu’elle tourne.

Les ambiances ont été conçues avec deux skills de design publics, lus directement (sans lancer leurs programmes) : **impeccable** (méthode de refonte, liste des défauts « faits par IA » à éviter) et **UI/UX Pro Max** (base de styles, palettes et associations de polices).

### Arty — fanzine risographe
Papier jaune citron avec grain, deux encres (rose fluo et bleu) qui se chevauchent en violet, repérage décalé. Rouleaux en bandes de papier de travers, ombre en trame ; ombrage du tambour en trame qui se resserre. Bande verrouillée : il ne reste que le contour en pointillés. Tampon « changé ». Typo : Bagel Fat One + Archivo.

### Pomme d’Amour — machine à sous de fête foraine
La façade d’une machine à sous en tôle lithographiée : rayons rouge et crème, plaques émaillées rivetées pour la consigne et les switches, borne bleu nuit avec rangée d’ampoules, hublots chromés et tambours crème ombrés, flèches rouges de ligne gagnante, manette rouge pour le hasard, touches de caisse enregistreuse pour « que tu me / de te », ticket d’entrée « changé ». Célébration : rayons qui tournent, phrase sur un ticket gagnant, étoiles et tickets. Typo : Abril Fatface (lettrage d’enseigne extrudé) + Merriweather.

### Red Corner — le Red Corner du Nostra
Boudoir du Nostra : logo « Kiff Kiff au Nostra », enseigne « Red Corner » au néon rouge sur l’accueil, reflets de boule à facettes sur le velours, célébration signée « au Red Corner du Nostra ». Velours bordeaux plissé, cadre doré à moulures, « que tu me / de te » sur une grande plaque de velours avec un curseur en feuille d’or qui glisse, médaillon doré pour le hasard, bougies qui vacillent (et s’embrasent quand on active un switch), écrin capitonné, rouleaux en cadres dorés avec tambours de velours satiné et filets d’or, sceau de cire « changé », feuille d’or sur les titres. Célébration : lumière dorée, pétales et étincelles, phrase sur une carte de visite. Typo : Cinzel pour le logo et les titres (lisible, capitales romaines), Bodoni Moda italique pour les rouleaux, Great Vibes pour « J’ai envie », Jost pour le reste.

## Fichiers

- `index.html` : structure de l’écran, écrans superposés, sélecteur d’ambiance.
- `base.css` : mécanique commune (mise en page, rouleaux, switches).
- `skins/arty.css`, `skins/pomme.css`, `skins/redcorner.css` : une feuille par ambiance.
- `data.js` : les listes des rouleaux (à modifier pour changer les mots).
- `app.js` : rouleaux, déroulé du tour, grammaire, sons, confettis, ambiances, mode deux téléphones.
- `duo.js` : liaison chiffrée entre deux téléphones (relais public).
- `vendor/` : mqtt.js et qrcode-generator, pour le mode deux téléphones.

Aucune dépendance, aucun build : GitHub Pages sert les fichiers tels quels. À chaque mise à jour, augmenter le numéro `?v=` des fichiers dans `index.html` pour que les téléphones rechargent la nouvelle version.

## Pistes ouvertes

- Historique des envies réalisées.
- Ajouter ses propres mots de façon permanente dans les listes.
