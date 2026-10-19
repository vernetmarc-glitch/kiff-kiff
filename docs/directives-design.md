# Kiff Kiff — directives de design

Statut : brouillon à valider par Marc · 19 octobre 2026

Ces règles valent pour toutes les ambiances. Elles viennent de la critique UX du 19 octobre 2026 (skills `design-critique` et `ux-copy` du plugin Design d'Anthropic) et des maquettes proposées le même jour.

## Principe directeur

Un jeu sensuel ne se raconte pas qu'avec des mots. Les écrans où l'on joue (composer, envie reçue) sont le modèle : un objet héros, un bouton plein, un bouton en contour, presque rien à lire. Les écrans autour du jeu (accueil, célébration, partage) doivent suivre ce modèle.

## Règles par écran

1. **Un point focal qui n'est pas du texte** sur chaque écran clé : l'emblème sur l'accueil, un cœur qui bat sur la célébration, les roues sur l'écran de jeu.
2. **60 mots au plus** sur un écran de jeu ou d'accueil, mention d'âge comprise. Au-delà, l'écran se lit plus qu'il ne se joue.
3. **Une seule action principale par écran**, en bouton plein. Les autres en contour, en icône ou en lien.
4. **Les actions du jeu restent en texte** (« Commencer », « Proposer à Lou », « J'ai envie aussi », « On passe »). **Les actions secondaires passent en icônes** (son, ambiance, « Tu kiffes ? », partager, prévenir, m'avertir, historique, café, retour, accueil, fermer).
5. **Le geste sur l'objet** : on partage une phrase depuis une icône posée sur la carte de la phrase, pas depuis un lien en dessous.
6. **Pas de répétition** : une phrase qui redit ce que montre le bouton ou l'écran disparaît.
7. **Le contenu au centre vertical** de l'écran sur les écrans courts (accueil, célébration), pour éviter le tiers vide en bas sur un grand téléphone.
8. **Pas de verrue de texte** (règle de Marc, 19 octobre 2026, pour tous les écrans à venir). Une nouvelle fonction ne s'ajoute jamais comme une phrase ou un lien de plus sous ce qui existe. Elle prend la forme d'une icône dans la rangée d'icônes de l'écran (avec un mot court dessous), ou de l'état d'un élément déjà là (une icône qui s'allume, comme le son). Une confirmation passe par un mot bref qui s'efface (3 secondes), à la place d'une ligne existante. Avant d'ajouter, on retire : une explication que l'écran montre déjà disparaît.
9. **Une ligne d'état, pas un paragraphe.** Ce qui décrit la situation (présence de l'autre, connexion, avertissements) tient en une seule ligne courte, précédée d'un point qui pulse ou non.

## Icônes

- **Un seul jeu d'icônes** pour toute l'appli : grille de 24 px, trait de 1,6 px, bouts et angles arrondis, sans remplissage.
- La couleur est celle du texte de l'ambiance (`currentColor`) : le même dessin sert partout.
- Bouton à icône seule : rond de 48 px, avec un nom lisible par les lecteurs d'écran (`aria-label`). Un mot court dessous quand le sens n'est pas évident (accueil : « Ambiance », « Son », « Tu kiffes ? » ; attente : « Prévenir », « M'avertir », « Accueil »).
- Un réglage qu'on allume ou éteint garde un seul bouton, dont l'icône change d'état (son / son coupé, cloche / cloche barrée), avec l'état dit aux lecteurs d'écran.
- Pilule icône + texte quand l'information compte (« Votre 3e kiff ensemble »).
- Jamais d'émoji comme icône.
- **Jamais de cœur.** Le signe du jeu est l'intersection de deux envies : deux cercles qui se chevauchent, leur zone commune allumée. Il remplace le cœur partout (kiff kiff, compteur, historique, célébration, emblème, image partagée).
- Le jeu proposé (16 icônes, plus « déconne », un nez de clown) : son, son coupé, ambiance, faites tourner, partager, nos kiffs, café, retour, écrire, deux téléphones, installer, QR code, copier le lien, piment, kiff kiff, fermer. Les dessins sont sur la planche de maquettes.

## Image et vocabulaire

- Le jeu célèbre une sexualité et des amours libres : pas d'imagerie romantique (cœurs, roses, alliances, Saint-Valentin), pas de mot « couple » dans l'interface ni dans la communication. On dit « à deux », « l'autre », « partenaire », ou le prénom.
- Pas de stéréotype de genre : texte neutre ou inclusif, pas d'illustration de corps genrés.
- Le désir se montre par la lumière, la matière et le mouvement (néon, velours, papier, rapprochement de deux formes), pas par des symboles convenus.

## Texte (UX copy)

- Clair, concis, utile, humain. Les boutons commencent par un verbe et disent le résultat.
- **Un seul nom par idée.** « Tu kiffes ? » (proposé le 19 octobre 2026, à la place de « Faites tourner ») pour la fenêtre qui réunit le partage du jeu, le café et l'histoire du jeu ; « Vous kiffez ? » sur la célébration, qui s'adresse aux deux. Une partie à deux : « partie à deux ». Un accord : « kiff kiff ».
- Le tutoiement pour la personne qui tient le téléphone, le « vous » pour s'adresser aux deux (« Vous avez kiffé ? »).
- Pas d'émoji dans le texte de l'interface. Exception : le mot signé de Marc.
- Les formules (les mots des roues) gardent leur crudité et leur humour ; elles se modifient dans l'Atelier, jamais en dur dans le code.

## Accessibilité

- Cibles tactiles de 44 px au moins (l'interrupteur « que tu me / de te » est à 30 px aujourd'hui : à corriger).
- Texte de 13 px au moins, opacité de 85 % au moins pour les textes atténués.
- Contraste de 4,5:1 pour le texte courant, 3:1 au-dessus de 24 px.
- Police script réservée à deux ou trois mots (« J'ai envie… », un titre), jamais à une phrase entière.
- Les animations (formule qui roule, néon qui scintille, cercles qui se rejoignent) s'arrêtent quand le téléphone demande moins d'animations.
- Les décors sont masqués aux lecteurs d'écran.

## Ambiances

- **Même structure, même texte, mêmes règles** dans toutes les ambiances : une ambiance n'est qu'une feuille de style (`skins/<nom>.css`) sur `base.css`. Ne jamais créer d'écran propre à une ambiance.
- **Trois ou quatre ambiances au plus.** Chaque ambiance multiplie le travail sur chaque nouvel écran.
- Chaque ambiance : un fond, une ou deux couleurs d'accent, deux ou trois polices, un objet signature.
- Ambiance par défaut aujourd'hui : Red Corner.

| Ambiance | Statut | Univers | Public visé | Polices |
| --- | --- | --- | --- | --- |
| Red Corner | En ligne, par défaut | Velours bordeaux, dorures, bougies ; à enrichir d'un second accent rose néon (emblème, compteur, célébration) | Tous publics, le soir | Cinzel, Baskervville, Great Vibes, Jost |
| Arty | En ligne | Fanzine risographe, jaune citron, rose fluo et bleu | Pas de cible définie (ton décalé) | Bagel Fat One, Archivo |
| Pomme d'Amour | En ligne | Machine à sous de fête foraine, rouge et crème | Pas de cible définie (ton festif) | Abril Fatface, Merriweather |
| Minuit | En ligne depuis le 19 octobre 2026 | Noir nuit, lilas, typographie grasse et moderne | 22–35 ans, rencontres sur les applis | Syne, Manrope |
| Pêche | Proposée | Pêche et prune, formes rondes, rassurant | 30–50 ans, partenaires de longue date, public bien-être et inclusif | Bricolage Grotesque, Figtree |
| Classé X | En ligne depuis le 19 octobre 2026 | Dossier d'agent secret : papier de rapport, machine à écrire, tampons rouges, mots caviardés (issue des pistes « Liaisons ») | Ton décalé, jeu au second degré, rencontres | Anton, Courier Prime |
| Liaisons | En recherche | Deux pistes restantes sur le canevas : lettres scellées (noir et cire), encre sympathique (se révèle à la flamme) | Jeu à distance et asynchrone, séduction par écrit | Selon la piste retenue |

## Tester les ambiances

- Figer tôt l'identité de marque (nom, emblème, domaine, image de partage) ; laisser les ambiances au choix de la personne qui joue.
- Pour comparer : chaque nouveau visiteur reçoit au hasard une ambiance par défaut parmi deux ou trois, chaque compteur porte l'ambiance, et l'on compare parties lancées, invitations envoyées et kiff kiff trouvés.
- Il faut quelques centaines de nouveaux visiteurs par ambiance pour qu'un écart veuille dire quelque chose. En dessous, se fier aux retours des testeurs.
- La gagnante devient l'ambiance par défaut ; les autres restent au choix.

## Validation avant déploiement

Toute évolution visible se montre d'abord en maquettes à Marc, et ne se déploie qu'après son accord écran par écran. Les maquettes du 19 octobre 2026 sont sur le canevas « Kiff Kiff : propositions de design ». Validés et en ligne le 19 octobre 2026 : 1 à 5 et Minuit. Restent à décider : 6 (gardé pour plus tard), Pêche, Liaisons.

1. Jeu d'icônes
2. Accueil Red Corner avec emblème néon, centré, sans sous-titre
3. Célébration : deux cercles de néon qui se rejoignent, une ligne, icône de partage sur la carte, bouton plein
4. « Faites tourner » en deux cartes (faire découvrir, café)
5. Image partagée avec QR code et domaine court
6. Réglages de la partie : piment, déconne, roues
7. Accueils des ambiances Minuit, Pêche et Liaisons

## Pour les ambiances, avant de dessiner

Les ambiances ont été conçues avec deux skills de design publics, lus sans lancer leurs programmes : **impeccable** (méthode de refonte, défauts « faits par IA » à éviter : dégradés gratuits, cartes à bordure gauche, émojis, polices passe-partout) et **UI/UX Pro Max** (styles, palettes, associations de polices). Les reprendre pour toute nouvelle ambiance.
