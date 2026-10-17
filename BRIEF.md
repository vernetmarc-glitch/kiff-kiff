# Kiff Kiff — brief

Jeu à deux sur un seul téléphone ou sur deux téléphones, en portrait. Une phrase d’envie se compose avec des rouleaux de machine à sous ; elle ne devient une envie partagée que quand les deux personnes ont dit « j’ai envie ».

## Accueil : quatre écrans qui glissent

1. **Accueil** : le titre et une seule phrase qui dit le but du jeu (« Trois roues pour se proposer des envies, et ne vivre que celles dont vous avez envie tous les deux. »), puis « Commencer ». En bas : ambiance, son, installer l’appli. « Reprendre la partie en cours » quand une partie est en cours.
2. **Qui joue ?** : le prénom de la personne qui tient le téléphone, puis « L’autre joue… » **sur ce téléphone** (on écrit son prénom, puis « Suivant ») ou **sur son téléphone** (l’écran glisse tout de suite : on l’invitera à la fin).
3. **Le principe**, en trois lignes numérotées, avec les vrais prénoms, puis « Compris ».
4. **Quels piments ?** : les trois niveaux (Tendre, Pimenté, Brûlant) se cochent directement, indépendamment (au moins un), puis « C’est parti » lance la partie (c’est **la deuxième personne qui propose en premier** : « Au tour de …, passe-lui le téléphone »), ou « Inviter l’autre téléphone » ouvre l’invitation (QR code et lien) quand l’autre joue sur son téléphone.
5. **La personne invitée** (qui ne connaît pas forcément le jeu) arrive par le lien ou le QR code sur trois écrans qui glissent, avec retour au doigt :
   1. « Kiff Kiff » : « *A* t’invite à jouer, chacun·e sur son téléphone », et la phrase du jeu ; bouton « Comment on joue ? ».
   2. « Le principe » : tu commences (trois roues, « J’ai envie que tu me… »), *A* répond sur son téléphone (« J’ai envie aussi » ou « Oui, mais… », une seule chose changée), puis c’est son tour ; rien ne se passe sans deux « j’ai envie », on passe quand on veut. Les piments choisis par *A* sont rappelés. Bouton « Compris ».
   3. « Et toi ? » : son prénom (« *A* le verra sur son téléphone »), puis « Rejoindre la partie », qui lance la partie. Lien « Jouer sur ce téléphone seulement ».
   Pendant ce temps, le téléphone de *A* affiche « L’autre téléphone est là : il découvre le jeu… ».

Chaque écran glisse vers le suivant dès la réponse ; quatre points en haut montrent où on en est. Pour revenir en arrière : glisser le doigt vers la droite (l’écran suit le doigt), ou « Retour ». Le bouton maison du jeu ramène au premier écran.

## La phrase

**J’ai envie** · [que tu me | de te] · [action] · [endroit] · [manière]

- « J’ai envie… » est le début fixe de la phrase, au nom de la personne qui propose.
- « que tu me / de te » est un sélecteur à deux positions.
- Trois rouleaux : l’action, l’endroit, la manière.
- En bas, un seul bouton pour la personne qui a la main.

## Déroulé d’un tour (A propose, B répond)

1. **A compose** : règle « que tu me / de te » et les trois rouleaux (ou bouton Hasard), puis touche **« Proposer à B »**. L’écran ne s’adresse qu’à A.
2. **B lit l’envie** dans une modale, la phrase en grand (« L’envie de A ») :
   - **« J’ai envie aussi »** → célébration ;
   - **« Oui, mais… »** → une petite fenêtre explique qu’on ne peut changer qu’une seule chose, puis B arrive sur l’écran de modification ;
   - **« On passe »**.
3. **B modifie une seule chose** : une roue, ou le sens « que tu me / de te ». Les choix de A restent surlignés dans les roues pour les retrouver. Dès qu’une chose change, le reste se verrouille, et un petit bouton ↺ « annuler » apparaît à la place du badge « changé », sur la roue changée (ou à côté de « que tu me / de te ») : il remet tout comme A l’avait proposé et permet de changer autre chose. Le même retour existe en lien dans la consigne. En bas : **« Modification faite »** (ou « J’ai envie aussi » si rien n’a changé) et **« On passe »**.
4. **A relit l’envie ajustée** dans une modale (« B a ajusté ton envie », la partie changée surlignée) : **« J’ai envie »** → célébration, ou **« On passe »**.
5. **Célébration** animée (confettis, phrase finale), puis les rôles s’inversent : B propose, A répond.
   Tout en bas de la célébration, un bouton à part, sous un filet, « Vous avez kiffé ? Faites tourner ! » ouvre la fenêtre « Dealer du kiff » : « Envoyer le lien » ouvre le partage du téléphone (ou copie le message) avec « Tiens, je crois que ça te fera pas de mal : Kiff Kiff, un petit jeu à deux pour pimenter un peu les choses. » suivi du lien du jeu ; en dessous, un mot pour offrir un peu de kiff « sous forme pécuniaire » (2 € par exemple) et le bouton « Payez-moi un café » vers https://buymeacoffee.com/MarcVernet (même lien que dans le livre « Corps libres »). La même fenêtre s’ouvre aussi depuis un lien discret tout en bas de l’accueil : « Tu kiffes Kiff Kiff ? ».

Sur un seul téléphone, chaque modale commence par « Passe le téléphone à … » et offre un lien « Oups, … n’avait pas fini » pour revenir en arrière.

**On passe** est disponible à tout moment, sans justification : la même personne propose autre chose, ou l’autre propose à son tour.

## Grammaire

- « que tu me » → subjonctif (que tu me gratouilles) ; « de te » → infinitif (de te gratouiller). Chaque action a ses deux formes dans `data.js`.
- Élision automatique : « que tu m’intromettes », « de t’intromettre ».
- Les actions construites avec « à » (faire gouzi-gouzi, faire rien du tout, rouler une pelle chaude) accordent la roue des endroits : à la tête, au gros orteil, aux épaules.
- Une action qui finit par « de » (ou « à ») dans son texte, comme « glisser la langue le long de », laisse la préposition à la roue des endroits, qui fait la contraction toute seule : du bas du dos, des fesses, d’un genou, d’une épaule, de l’oreille, de ton cou (aussi en texte libre). Aucune case à cocher.
- « Faire rien du tout » est volontairement familier (« de te faire rien du tout au coude ») : la forme correcte « ne rien te faire » ne rentre pas après « de te ».
- « Circlure » se conjugue comme conclure : que tu me circlues.

## Piment

Trois niveaux qui se cochent indépendamment (au moins un) : **Tendre** (1 piment), **Pimenté** (2), **Brûlant** (3). Par défaut : Tendre et Pimenté.

- Accueil : une ligne « Piment » montre les niveaux cochés et ouvre la fenêtre de choix.
- Jeu : le bouton piments de la barre du haut ouvre la même fenêtre, pendant la composition seulement. Changer le piment depuis l’accueil au milieu d’une réponse oblige à lancer une nouvelle partie.
- **Sur deux téléphones, le piment se consent.** La personne invitée voit les piments choisis avant de rejoindre : rejoindre, c’est les accepter. Ensuite, seul·e celui ou celle qui compose peut changer le piment (la fenêtre prévient : « Lou devra d’abord accepter ce piment plus chaud »). Si le piment monte, l’autre voit d’abord « Avant de voir son envie · Marc monte le piment » (« Vous jouiez en Tendre + Pimenté. Marc propose d’ajouter le niveau Brûlant… », avec le niveau ajouté décrit) : « D’accord, voir l’envie », ou « Non, on reste en Tendre + Pimenté », qui remet l’ancien piment et renvoie la main à Marc (« On garde le piment d’avant… Propose une autre envie avec ce piment-là »). Pendant ce temps, l’attente de Marc dit « Lou doit d’abord accepter le nouveau piment ». Si le piment baisse, c’est accepté d’office et l’envie arrive avec « Marc a baissé le piment : Tendre. »
- Dans les roues, les cases pimentées portent une pastille à 2 piments, les brûlantes une pastille à 3 piments.
- Lien : `?piment=12`, `?piment=3`, `?piment=123`…
- Certaines manières et certains endroits changent de possessif selon le sens : « que tu me … avec ton sexe » / « de te … avec mon sexe » ; « que tu me caresses mon sexe chaud » / « de te caresser ton sexe chaud », « tout mon corps » / « tout ton corps », « mon petit cœur » / « ton petit cœur ».
- Chaque mot porte son niveau dans `data.js` (`lvl: 2` ou `lvl: 3`, rien = Tendre).
- Les listes ont été revues par Marc dans l’Atelier des roues (une page d’édition à part) le 16 octobre 2026 (cinquième passe) : 53 tendres, 28 pimentées, 36 brûlantes au total.

## Texte libre

Chaque rouleau a une dernière case « ✎ … à toi ». En la touchant, on écrit sa propre action, son endroit ou sa manière (40 caractères max), avec un aperçu de la phrase. Pour l’action, il faut écrire le verbe dans la bonne forme (indiqué dans l’aide). La case libre ne sort jamais au hasard.

## Repères pour bien jouer (revue UX)

- La consigne dit qui joue et quoi faire, avec le verbe « fais glisser » pour les roues.
- Écran de célébration : lien « Finalement, on passe » ; on peut changer d’avis jusqu’au bout.
- La case libre s’annonce « touche pour écrire ton action / ton endroit / ta manière ».
- Bouton « Accueil » (maison) dans la barre du haut : il rouvre le premier écran d’accueil pour changer les prénoms, l’ambiance ou le son. On y trouve « Reprendre la partie en cours » ou « Nouvelle partie ».

## Sensations

- Petit retour haptique et clic sonore très discret à chaque cran de rouleau.
- Petit son discret quand une envie part ou arrive, petit arpège à la célébration.
- Lien « Son : activé / coupé » sur l’écran d’accueil pour couper le son. Haptique : Android via l’API vibration ; iPhone via l’astuce du switch natif de Safari (iOS 18 et plus, au mieux).

## Ambiances

Ambiance par défaut : Red Corner. L’ambiance se choisit depuis le lien discret « Ambiance : … » sous le bouton de l’accueil (il ouvre une petite feuille avec les trois vignettes) et reste mémorisée sur le téléphone. On peut aussi l’imposer dans le lien : `?design=arty`, `?design=pomme` ou `?design=redcorner` (ou `#redcorner` en fin d’adresse). Les règles et les mots sont les mêmes partout. Chaque roue a un ombrage en haut et en bas et des repères sur la ligne lue, pour qu’on comprenne qu’elle tourne.

Les ambiances ont été conçues avec deux skills de design publics, lus directement (sans lancer leurs programmes) : **impeccable** (méthode de refonte, liste des défauts « faits par IA » à éviter) et **UI/UX Pro Max** (base de styles, palettes et associations de polices).

### Arty — fanzine risographe
Papier jaune citron avec grain, deux encres (rose fluo et bleu) qui se chevauchent en violet, repérage décalé. Rouleaux en bandes de papier de travers, ombre en trame ; ombrage du tambour en trame qui se resserre. Bande verrouillée : il ne reste que le contour en pointillés. Tampon « changé ». Typo : Bagel Fat One + Archivo.

### Pomme d’Amour — machine à sous de fête foraine
La façade d’une machine à sous en tôle lithographiée : rayons rouge et crème, plaques émaillées rivetées pour la consigne et les switches, borne bleu nuit avec rangée d’ampoules, hublots chromés et tambours crème ombrés, flèches rouges de ligne gagnante, manette rouge pour le hasard, touches de caisse enregistreuse pour « que tu me / de te », ticket d’entrée « changé ». Célébration : rayons qui tournent, phrase sur un ticket gagnant, étoiles et tickets. Typo : Abril Fatface (lettrage d’enseigne extrudé) + Merriweather.

### Red Corner — le Red Corner du Nostra
Boudoir du Nostra : logo « Kiff Kiff au Nostra », enseigne « Red Corner » au néon rouge sur l’accueil, reflets de boule à facettes sur le velours, célébration signée « au Red Corner du Nostra ». Velours bordeaux plissé, cadre doré à moulures, « que tu me / de te » sur une grande plaque de velours avec un curseur en feuille d’or qui glisse, médaillon doré pour le hasard, bougies qui vacillent (et s’embrasent quand on active un switch), écrin capitonné, rouleaux en cadres dorés avec tambours de velours satiné et filets d’or, sceau de cire « changé », feuille d’or sur les titres. Célébration : lumière dorée, pétales et étincelles, phrase sur une carte de visite. Typo : Cinzel pour le logo et les titres (lisible, capitales romaines), Baskervville droit pour les rouleaux, « que tu me / de te » et la phrase (reprise libre, par l’ANRT, de la famille du Romain du Roi de Louis XIV, plus lisible que le Bodoni italique d’avant ; le vrai Romain du Roi numérique existe chez Newglyph, payant), Great Vibes pour « J’ai envie », Jost pour le reste.

## Jouer à distance, chacun·e à son rythme

- Sur deux téléphones, pas besoin d’être connectés en même temps. Le relais public sert quand les deux sont là ; chaque coup est aussi rangé, chiffré par les téléphones, dans l’onglet « parties » de la feuille de l’atelier (illisible dans la feuille). Une partie sans nouvelle depuis 120 jours est effacée.
- **Vos parties à deux** : l’accueil liste toutes les parties du téléphone (jusqu’à 40), celles où c’est ton tour en premier, puis les kiff kiff trouvés, puis celles qui attendent l’autre, puis les invitations sans réponse (« Avec Lou · À toi de jouer », « Au tour de Lou », « Kiff kiff trouvé », « Personne n’a encore rejoint »), mises à jour depuis la feuille. Un toucher reprend la partie là où elle en est, même ouverte depuis l’icône ; × la retire de la liste de ce téléphone seulement.
- Pendant une partie à deux, l’accueil montre « En cours : partie à deux avec Lou » avec « Reprendre la partie » et « Arrêter cette partie » (deux touchers : « Touche encore : Lou sera prévenu·e » ; l’autre voit « Marc a arrêté la partie »). « Nouvelle partie » reste toujours là : la partie ouverte passe simplement dans la liste, sans rien arrêter. On peut ainsi mener plusieurs parties avec plusieurs personnes.
- Invitation : « Plus tard » ferme la fenêtre sans annuler (la partie attend sur l’accueil) ; « Annuler la partie » l’arrête pour de bon.
- Écran d’attente : quand l’autre n’est pas connecté·e, bouton « Prévenir Lou » (partage du téléphone : « À toi de jouer sur Kiff Kiff ! » + le lien) et « Tu peux fermer l’appli : la partie vous attend ».
- Chaque case voyage avec son texte : si les mots de l’atelier changent entre deux coups, la partie garde les siens.
- Côté Google : après une mise à jour du script, le recoller et faire Déployer › Gérer les déploiements › Nouvelle version (même adresse). Les étapes sont dans Réglages de l’atelier.

## Appli sur l’écran d’accueil

Kiff Kiff s’installe comme une appli (web app) : icône sur l’écran d’accueil, ouverture en plein écran sans barre de navigateur, et jeu sur un téléphone possible hors ligne une fois la page ouverte une première fois.

- Android (Chrome, Samsung Internet, Edge) : le lien « Installer l’appli » apparaît sur l’accueil quand le navigateur le permet ; sinon menu ⋮ puis « Ajouter à l’écran d’accueil » ou « Installer l’application ».
- iPhone : le lien « Installer l’appli » explique le geste (Partager, puis « Sur l’écran d’accueil »).
- Le logo : deux K en miroir (kif-kif, pareil des deux côtés) dont les bras forment un losange doré autour d’un cœur rose néon, sur le velours du Red Corner. Fichiers dans `icons/` (SVG source, PNG 192 et 512, versions « maskable » pour les icônes rondes d’Android, icône Apple, favicon).
- `manifest.webmanifest` décrit l’appli ; `sw.js` garde une copie des fichiers (réseau d’abord, copie si pas de réseau).

## L’atelier (statistiques et mots)

Page de travail : https://vernetmarc-glitch.github.io/roue-du-consentement/atelier/ (remplace l’ancien « Atelier des roues » en artifact).

- **Statistiques** : kiff kiff trouvés, parties jouées, envies proposées, « on passe », taux d’envies devenues kiff kiff ; pour chaque roue, le mot le plus choisi et les cinq suivants, parmi les kiff kiff ou parmi les envies proposées.
- **Les mots** : les trois roues, rangées par niveau de piment. Chaque mot se modifie, change de niveau (1, 2, 3), se supprime ; un bouton « Ajouter » par niveau. Pour les actions, la forme « de te » se propose toute seule à partir de « que tu me » (gratouilles → gratouiller, fasses → faire…) et se corrige à la main ; case « avec « à » ». Pour les endroits et les manières, case « change selon le sens » (mon / ton…). « Enregistrer dans l’appli » envoie la liste : les téléphones l’ont à leur prochaine partie.
- **Réglages** : adresse du script Google et mot de passe de l’atelier (gardés dans le navigateur), guide de mise en place.

**Comment ça marche.** Les données vivent dans une feuille Google Sheets de Marc, derrière un petit script Google Apps Script (`atelier/apps-script.gs`, publié en « application Web »). La feuille a trois onglets créés tout seuls : « mots » (la liste des roues), « compteurs », « choix » (pour chaque roue, combien de fois chaque mot a été proposé et a fini en kiff kiff). L’adresse du script se met dans `config.js` (`KIFF_API`) ; tant qu’elle est vide, le jeu n’envoie rien et garde `data.js`.

- Ce que les téléphones envoient : « partie » (une partie lancée), « envie » (une envie proposée, avec le mot de chaque roue), « kiff » (un kiff kiff, avec le mot de chaque roue), « passe ». Jamais de prénom ni de texte écrit à la main (il devient « (texte libre) »). Sur deux téléphones, seul le téléphone qui agit envoie, pour ne pas compter deux fois.
- Les mots : chaque téléphone demande la liste à l’ouverture, la garde pour la fois suivante, et l’applique avant de commencer une partie (jamais au milieu). `data.js` reste la liste de secours, hors ligne ou si la feuille ne répond pas.
- L’enregistrement des mots demande le mot de passe écrit en haut du script.

## Fichiers

- `index.html` : structure de l’écran, écrans superposés, sélecteur d’ambiance.
- `base.css` : mécanique commune (mise en page, rouleaux, switches).
- `skins/arty.css`, `skins/pomme.css`, `skins/redcorner.css` : une feuille par ambiance.
- `data.js` : les listes des rouleaux de secours (les mots se modifient dans l’atelier).
- `config.js` : adresse du script Google de l’atelier.
- `atelier/` : la page de l’atelier et le script Google à copier.
- `app.js` : rouleaux, déroulé du tour, grammaire, sons, confettis, ambiances, mode deux téléphones.
- `duo.js` : liaison chiffrée entre deux téléphones (relais public) et mémoire des parties dans la feuille de l’atelier.
- `vendor/` : mqtt.js et qrcode-generator, pour le mode deux téléphones.
- `manifest.webmanifest`, `sw.js`, `icons/` : l’appli sur l’écran d’accueil.

Aucune dépendance, aucun build : GitHub Pages sert les fichiers tels quels. À chaque mise à jour, augmenter le numéro `?v=` des fichiers dans `index.html` pour que les téléphones rechargent la nouvelle version.

## Pistes ouvertes

- Historique des envies réalisées.
- Ajouter ses propres mots de façon permanente dans les listes.
