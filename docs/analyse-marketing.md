# Kiff Kiff — métriques, croissance et monétisation

Statut : brouillon à valider par Marc · étude du 18 octobre 2026, mise à jour le 19 octobre 2026
Version de travail : le document Claude « Kiff Kiff : métriques, croissance et monétisation ».

**Recommandation : rester une appli web gratuite, mesurer la boucle d'invitation dès maintenant, puis vendre un « Pass Kiff » payé une fois, via un prestataire de paiement qui accepte le contenu adulte.** Le moteur de croissance existe déjà : chaque partie à deux téléphones fait venir un nouveau joueur. Les stores, l'abonnement et les partenariats avec les applis de rencontre viennent seulement quand la rétention est prouvée.

Trois constats guident tout le reste :

- **Le marché paie.** Les jeux coquins pour couples vendent des abonnements de 7 à 15 $ par mois, des accès à vie autour de 110 $ et des packs de 2 à 4 €.
- **Les intermédiaires sont le vrai risque.** Stripe refuse les « contenus sexuels, y compris la littérature » ; Buy Me a Coffee interdit le « contenu sexuellement explicite » ; Google Play interdit le « texte explicite ». Kiff Kiff doit choisir ses intermédiaires avant de chercher des revenus.
- **Les données sont intimes.** Les envies relèvent de la vie sexuelle, une donnée sensible au sens du RGPD. La mesure reste anonyme et agrégée, sans aucune phrase en clair côté serveur.

Le positionnement et les publics sont dans `vision-positionnement.md`.

## Marché et concurrents

Les jeux coquins pour couples sont un marché établi et payant, sur l'App Store en 18+. Ils vivent tous du freemium : gratuit pour essayer, puis abonnement, accès à vie ou packs.

| Appli | Mécanique | Modèle et prix | Note App Store |
| --- | --- | --- | --- |
| [Spicer](https://apps.apple.com/app/id1335558932) | Les deux partenaires répondent oui, peut-être ou non ; seuls les oui communs s'affichent | Abonnement 6,99 $ ou 59,99 $, à vie 109,99 $, packs 1,99 à 5,99 $ | 4,6 (3 900 avis) |
| [Desire](https://apps.apple.com/app/id923073855) | Défis générés, points et badges, chat de couple | « Platinum » 9,99 à 15,49 $, niveau « Chili » 12,99 $, pièces 0,99 à 24,99 $ | 4,3 (763 avis) |
| [Picolo](https://apps.apple.com/FR/app/id1001473964) (français) | Jeu de soirée, avec un pack coquin « Caliente » | Abonnement 4,99 à 49,99 €, packs à 3,99 € | 4,5 (47 000 avis) |
| Kindu, Couple Love Dice… ([Paired](https://www.paired.com/articles/sex-apps-for-couples)) | Matching d'idées, dés coquins numériques | Freemium | — |

Ce que ça apprend à Kiff Kiff :

- **Le niveau le plus chaud se vend à part.** Desire facture son niveau « Chili » 12,99 $. Le piment Brûlant est l'équivalent naturel.
- **Le marché français existe.** Picolo totalise 47 000 avis et vend son pack coquin 3,99 €.
- **Personne ne fait négocier l'envie.** Le « Oui, mais… » et l'ajustement d'une seule chose n'ont pas d'équivalent.

Taille du marché : Juniper Research prévoyait en 2020 plus de 950 millions de dollars de dépenses dans les contenus numériques de bien-être sexuel en 2025, dont 62 % en achats intégrés ([source](https://www.ictbusiness.biz/analysis/digital-sexual-wellness-market-will-approach-1-billion-by-2025)). C'est une prévision ancienne, à prendre comme un ordre de grandeur. En France, environ 7,2 millions de personnes utilisaient une appli de rencontre en 2024, selon Statista ([source](https://www.echodumardi.com/actualite/quels-pays-deurope-comptent-le-plus-grand-nombre-dutilisateurs-dapplications-de-rencontre/?print=pdf)).

## Métriques à suivre

L'indicateur central : **le nombre de kiff kiff trouvés par semaine**. Il ne monte que si des gens arrivent, jouent, s'accordent et reviennent. Depuis le 18 octobre 2026, le jeu mesure tout ce tableau sauf l'origine marketing des joueurs (elle demanderait un bandeau de consentement) ; le tableau de bord est dans l'onglet Statistiques de l'Atelier.

| Étape | Métrique | Définition | Ce qu'elle pilote |
| --- | --- | --- | --- |
| Arrivée | Ouvertures | Ouvertures de l'accueil par jour | Le volume de trafic |
| Arrivée | Origine | Lien partagé, invitation, icône installée, reprise | Les canaux qui marchent |
| Activation | Démarrage | Parties lancées / ouvertures | L'accueil et les écrans de règles |
| Activation | Premier kiff | Part des parties avec au moins un kiff kiff, et temps pour l'atteindre | Le « moment magique » du jeu |
| Jeu | Taux de kiff | Kiff kiff / envies proposées | La qualité des formules |
| Jeu | « Oui, mais… » et passes | Part des envies ajustées, part des passes | La négociation, le bon niveau de piment |
| Jeu | Piment | Niveaux choisis au départ, montées acceptées ou refusées | L'appétit pour le Brûlant (base du payant) |
| Jeu | Mode | Parties sur un téléphone / sur deux | L'importance du jeu à distance |
| Rétention | Parties actives | Parties à deux avec un coup dans les 7 derniers jours | La fidélité |
| Rétention | Retour à J+1, J+7, J+30 | Part des parties à deux encore jouées après 1, 7, 30 jours | La valeur dans le temps, le prix d'un abonnement |
| Viralité | Invitations | Invitations créées, rejointes, délai pour rejoindre | La boucle d'invitation |
| Viralité | Partages | fenêtres « Tu kiffes ? » ouvertes, liens envoyés, « Prévenir » touchés | Le bouche-à-oreille |
| Viralité | Coefficient K | Nouveaux joueurs amenés par joueur | La croissance sans publicité (K ≥ 1 = croissance seule) |
| Installation | Icône installée | Installations sur l'écran d'accueil | La rétention et les notifications |
| Revenus | Clics café, conversion | Clics « Payez-moi un café », puis achats / joueurs | Le prix, l'offre payante |
| Contenu | Formules gagnantes | Mots les plus kiffés, les plus passés, jamais choisis | L'Atelier : quoi garder, quoi réécrire |

Mesurer sans rien dévoiler : des compteurs anonymes envoyés à la feuille Google, sans identifiant de personne ni phrase en clair. La rétention se calcule sur l'onglet « parties », dont le contenu reste chiffré.

## Leviers de croissance

Le premier levier est gratuit et déjà construit : la partie à deux téléphones, où chaque joueur en fait venir un autre. Par ordre d'effet attendu :

1. **La boucle d'invitation.** Un aperçu soigné du lien dans WhatsApp ou un chat de rencontre (fait), l'invitation au nom de qui invite (fait), un domaine court et un QR code sur les images partagées (proposé).
2. **Les notifications.** « À toi de jouer » doit arriver sans que l'autre ait à penser à « Prévenir ». Les notifications web marchent sur Android, et sur iPhone quand l'appli est installée. Demande un petit serveur.
3. **Le partage au bon moment.** « Vous kiffez ? » (fenêtre « Tu kiffes ? ») est placé au pic émotionnel, juste après un kiff kiff, avec une carte image de la phrase, sans prénom.
4. **Les formules comme contenu.** Une phrase par jour sur Instagram ou TikTok, suggestive plutôt qu'explicite (ces réseaux masquent le contenu sexuel).
5. **Les relais de confiance.** Sexologues, podcasts et comptes d'éducation au consentement : le « double oui » leur donne une raison de recommander le jeu.
6. **Les moments forts.** Vacances d'été, rentrée, soirées entre amis, saison des rencontres de janvier : des roues de la semaine thématiques, et des pages qui répondent aux recherches « action ou vérité coquin », « jeu coquin à deux », « jeu sexto ». La Saint-Valentin et l'imagerie romantique sont évitées (voir `vision-positionnement.md`).
7. **Une version anglaise.** Les formules doivent être réécrites par quelqu'un de langue maternelle anglaise, pas traduites : l'humour tient aux mots.

## Modèles de monétisation

Le meilleur rapport revenu / risque est un **Pass Kiff payé une fois** : niveau Brûlant complet, packs de formules, parties à distance illimitées et historique. L'affiliation et le jeu de cartes physique le complètent ; la publicité et la revente de données sont exclues.

| Modèle | Comment | Repères de prix | Pour | Contre |
| --- | --- | --- | --- | --- |
| Pass Kiff (achat unique) | Gratuit en Tendre et Pimenté ; le Pass débloque Brûlant, les packs, l'illimité à distance | Desire « Chili » 12,99 $, Spicer à vie 109,99 $ ; cible 7 à 15 € | Simple, accepté pour un jeu joué par périodes | Revenu non récurrent |
| Packs de formules | Packs thématiques et saisonniers | Picolo 3,99 €, Spicer 1,99 à 5,99 $ | Renouvelle l'intérêt, s'ajoute au Pass | Demande d'écrire régulièrement |
| Abonnement | Nouveautés chaque mois, parties à distance illimitées | Spicer 6,99 $ ; Picolo 4,99 à 49,99 € | Récurrent | Justifier un flux de contenu ; résiliations |
| Affiliation bien-être sexuel | Une boutique choisie, lien suivi | Lovehoney : 16 à 17,6 % de la vente, cookie 30 jours ([source](https://www.flexoffers.com/affiliate-programs/lovehoney-fr-affiliate-program)) | Aucun paiement à gérer | Peut casser l'ambiance ; revenu modeste |
| Jeu de cartes physique | Boîte de cartes « roues », en ligne et en concept-stores, financement participatif | — | Forte marge, cadeau, visibilité | Stock, fabrication, logistique |
| Licence et partenariats | Mécanique « double oui » pour une appli de rencontre, des sexologues, des ateliers | Sur devis | Gros tickets, image | Long à signer |
| Dons (actuel) | Buy Me a Coffee | 5 % de frais + paiement ([source](https://schoolmaker.com/blog/buy-me-a-coffee-pricing)) | Déjà en place | Revenu faible ; règles interdisant le contenu explicite |
| Publicité | Régies adultes | — | — | Image dégradée ; les régies classiques refusent le contenu adulte |

Ordre de grandeur, à titre d'hypothèse : 10 000 joueurs par mois, dont 3 % achètent un Pass à 9,99 €, donnent 300 ventes, soit environ 3 000 € par mois avant frais (10 à 15 % avec un prestataire adulte, 15 % sur un store). Le taux de 3 % est à mesurer ; on cite souvent 1 à 5 % pour les jeux freemium, repère non vérifié.

## Site web, PWA ou application

Rester une appli web installée (PWA) est le bon choix pour l'instant : zéro coût, aucune validation de store, 100 % du prix encaissé hors frais de paiement.

| Option | Coût | Règles de contenu | Paiement | Verdict |
| --- | --- | --- | --- | --- |
| Appli web (actuelle) | 0 € : GitHub Pages et feuille Google | Aucune validation | Prestataire au choix | Maintenant |
| Serveur léger | Cloudflare Workers : gratuit jusqu'à 100 000 requêtes par jour, puis 5 $ par mois ([source](https://developers.cloudflare.com/workers/platform/pricing/)) | Aucune | — | Quand la feuille sature |
| Google Play (PWA emballée, TWA) | 25 $ une fois ([source](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)) | Interdit le « texte explicite » ([source](https://support.google.com/googleplay/android-developer/answer/9878810)) ; Spicer, Kindu et Couple Love Dice y sont pourtant | Facturation Google obligatoire | Tester plus tard, fiche très sage |
| App Store (iPhone) | 99 $ par an | Interdit le contenu « ouvertement sexuel », mais Spicer et Desire y sont en 18+ ([source](https://www.mactech.com/2026/02/06/apple-updates-its-app-review-guidelines-with-expanded-list-of-apps-with-objectionable-content/amp/)) | Achats intégrés, commission 15 % sous 1 M$ ([source](https://developer.apple.com/app-store/small-business-program/?page=2)) | Après la preuve de traction |

La feuille Google tient tant qu'il y a peu de joueurs : un compte personnel est limité à 30 exécutions simultanées ([source](https://developers.google.com/apps-script/guides/services/quotas?hl=en)), et chaque coup à distance en déclenche une. Le passage à un serveur léger se prépare dès quelques centaines de parties à distance en même temps.

## Applis de rencontre

Le chemin le plus court passe par leur chat, pas par un partenariat : deux personnes qui se plaisent peuvent déjà s'y envoyer le lien d'une partie à distance.

- **Le mode rencontre** (fait) : piment Tendre, invitation « … te propose un jeu avant de vous voir », double oui mis en avant. C'est la version à montrer aux applis.
- **Les applis ouvertes d'esprit d'abord** (relations libres, sexualité positive) : co-marketing, lien dans leur blog ou leur newsletter, puis intégration.
- **L'argument à leur vendre : la sécurité.** Rien ne s'affiche sans accord, le piment ne monte qu'à deux.
- **La forme d'un accord** : licence de la mécanique en marque blanche, ou partage de revenus sur les Pass vendus.
- Point à vérifier : aucune interface publique connue ne permet à un jeu tiers de s'intégrer aux grandes applis de rencontre.

## Contraintes

| Sujet | Ce qui s'applique | Conséquence pour Kiff Kiff |
| --- | --- | --- |
| Données intimes | Les envies touchent à la vie sexuelle, une catégorie sensible du RGPD | Jamais de phrase en clair côté serveur (déjà le cas) |
| Mesure d'audience | Sans consentement seulement si agrégée, anonyme, sans identifiant ni mesure des canaux d'acquisition ([source](https://matomo.org/faq/how-do-i-configure-matomo-without-tracking-consent-for-french-visitors-cnil-exemption/)) | Compteurs anonymes : OK. L'origine marketing des joueurs demanderait un bandeau |
| Âge | L'Arcom impose une vérification d'âge aux services de contenus pornographiques ([source](https://www.cbnews.fr/digital/mineurs-contenus-pornographiques-arcom-adopte-son-referentiel)) | Un jeu de phrases sans image n'est probablement pas visé ; mention « 18 ans ou plus » en place ; à faire valider par un juriste |
| Paiement | Stripe refuse le contenu sexuel, « y compris la littérature » ([source](https://support.stripe.com/questions/prohibited-and-restricted-businesses-faqs)) ; Buy Me a Coffee interdit le contenu sexuellement explicite ([source](https://tostracker.app/document/buy-me-a-coffee)) | Prestataire spécialisé (CCBill, Verotel…), environ 10 à 15 % de frais ([source](https://corepay.net/articles/cc-bill-alternatives/)), ou achats intégrés d'un store |
| Stores | Google interdit le texte explicite ; Apple, le contenu ouvertement sexuel | Une fiche et une version « store » plus suggestives qu'explicites |

À vérifier aussi : la disponibilité du nom « Kiff Kiff » comme marque, avant d'investir dans la notoriété.

## Plan par étapes

On ne passe à la phase suivante qu'une fois son critère atteint ; les durées sont des estimations.

| Phase | Quand | Contenu | Critère pour passer à la suivante |
| --- | --- | --- | --- |
| 1. Mesurer | En ligne depuis le 18 octobre 2026, 1 mois | Compteurs anonymes, aperçu du lien, mention 18 ans, tableau de bord | 2 semaines de données |
| 2. Faire grandir | Mois 1 à 3 | Notifications web, packs saisonniers, version anglaise, relais et réseaux | Rétention et coefficient K mesurés |
| 3. Monétiser | Mois 3 à 6 | Pass Kiff à 7–15 €, paiement adulte, affiliation, tests de prix | Premières ventes au rendez-vous |
| 4. Étendre | Mois 6 à 12 | Google Play (TWA), App Store à tester, applis de rencontre, jeu de cartes | — |

## Améliorations rapides

Douze des quatorze sont en ligne depuis le 18 octobre 2026.

| Changement | Indicateur visé | Effort | Statut |
| --- | --- | --- | --- |
| Message d'invitation au nom de qui invite | Invitations rejointes | Rapide | Fait |
| Première envie tirée parmi les formules les plus kiffées | Parties avec un kiff kiff | Rapide | Fait |
| Accueil plus court pour qui a déjà joué | Parties lancées / ouvertures | Rapide | Fait |
| Roues remélangées après un kiff kiff | Envies par partie | Rapide | Fait |
| « Installer l'appli » juste après le premier kiff kiff | Installations, retour à J+7 | Rapide | Fait |
| « Tu kiffes ? » (partage) et le café à partir du 2ᵉ kiff kiff | Partages, clics café | Rapide | Fait |
| Badge dans l'Atelier sur les formules souvent passées | Taux de kiff | Rapide | Fait |
| Compteurs groupés en une requête | Tenue de la feuille Google sous les quotas | Rapide | Fait |
| Carte image de la phrase, sans prénom | Liens envoyés | Moyen | Fait |
| Mode rencontre | Invitations créées | Moyen | Retiré le 19 octobre 2026 (toutes les parties à distance commencent en Tendre) |
| Formule de la semaine sur l'accueil | Retour à J+7 | Moyen | Retirée le 20 octobre 2026 (figée pendant des jours, sans lien avec les parties) |
| Démonstration : la formule roule sur l'accueil | Parties lancées / ouvertures | Moyen | Retirée avec elle ; une phrase d'intro à la première visite la remplace |
| Notifications « À toi de jouer » (Web Push, signées par le script) | Retour à J+1 et J+7 | Lourd | Fait |
| Remplacer Buy Me a Coffee | Revenus (risque de fermeture) | Moyen | En cours |

Rapide : une heure ou moins. Moyen : une demi-journée. Lourd : plusieurs jours.

## Partage et domaine (19 octobre 2026)

- L'ancienne adresse (`vernetmarc-glitch.github.io/roue-du-consentement`), longue et qui montrait le nom de Marc, est remplacée par kiff-kiff.fr depuis le 19 octobre 2026.
- Solution retenue en proposition : un domaine court branché sur GitHub Pages (environ 10 € par an pour un .fr), et un QR code vers ce domaine sur l'image partagée.
- Domaines non enregistrés au 19 octobre 2026 (vérification RDAP, à confirmer chez le registraire) : kiff-kiff.fr (préféré), kiffkiff.app, kiffkiff.net, lekiffkiff.fr, jeukiffkiff.fr, kiffkiffgame.com, deuxoui.fr. Pris : kiffkiff.fr, kiffkiff.com, kiff-kiff.com, kiff.app.
- Attention au changement d'adresse : la liste des parties est gardée par adresse dans le navigateur ; les joueurs actuels perdent leurs parties en cours en passant au nouveau domaine. À faire tant qu'il y a peu de joueurs.

## Idées gardées pour plus tard (19 octobre 2026)

Mises de côté par Marc le 19 octobre 2026, à reprendre quand la rétention sera mesurée. L'écran « Réglages : piment, déconne, roues » du canevas de maquettes les montre ensemble.

**Le renouvellement des roues.** Avec une quarantaine de mots par roue, il existe plus de 60 000 phrases ; l'impression de déjà-vu vient des mots qui reviennent, pas des phrases. Quatre leviers :

| Levier | Principe | Effort d'écriture | Statut |
| --- | --- | --- | --- |
| Ce qu'on ne s'est jamais proposé, d'abord | Chaque partie retient les mots déjà sortis entre deux personnes ; les tirages puisent d'abord dans les autres | Aucun | En ligne le 19 octobre 2026 |
| Vos mots à vous deux | Le texte libre d'une partie revient dans les roues de cette partie, pour les deux, chiffré | Aucun | En ligne le 19 octobre 2026 |
| Roue de la semaine | Chaque lundi, une douzaine de mots neufs sur un thème ; les plus kiffés restent | Une douzaine de mots par semaine | Gardé pour plus tard |
| Roues thématiques du Pass Kiff | « Anatomie de l'absurde », « Lenteur », « Brûlant intégral », « Sexto »… une quinzaine de mots par roue | Une quarantaine de mots par roue thématique | Gardé pour plus tard |
| Envies de la communauté | Les joueurs proposent de nouveaux mots pour chaque roue, votent pour les meilleurs ; chaque semaine ou chaque mois, les gagnants entrent officiellement dans les roues | Aucun pour Marc (modération et choix final seulement) | Gardé pour plus tard |

**Le niveau de « déconne ».** Le jeu se joue au premier degré (se donner du désir pour de vrai) ou au second (rire du télescopage entre mots crus et mots d'anatomie). Proposition : un seul jeu de roues, chaque mot marqué « décalé » ou non dans l'Atelier, et un réglage à trois positions à côté du piment :

- « Premier degré » : aucun mot décalé ;
- « Un brin décalé » : un mot décalé au plus par envie (par défaut pour une première partie avec quelqu'un) ;
- « Grand n'importe quoi » : les mots décalés d'abord.

Le réglage se change à chaque envie par qui compose, sans accord de l'autre (il ne rend rien plus intime, et l'autre peut toujours passer). Le décalé vit surtout dans les endroits et les manières, les actions servent aux deux registres : environ 8 à 10 mots par roue pour chaque piment et chaque registre, soit 150 à 180 mots au total (117 aujourd'hui). Marc veut y réfléchir avant de décider.

**Les envies de la communauté** (idée de Marc, 19 octobre 2026). Un levier d'habitude et de rétention : on revient pour voir si sa formule a été retenue, et pour voter.

- Proposer : un mot pour une roue (action, endroit ou manière), avec son niveau de piment.
- Voter : chaque membre vote pour ses envies préférées parmi les propositions de la période.
- Intégrer : chaque semaine ou chaque mois, les mieux votées entrent officiellement dans les roues, après relecture par Marc dans l'Atelier (grammaire, niveau de piment, ton du jeu). Le nom ou le pseudo de l'auteur·ice peut être crédité, si iel le souhaite.
- Accès : réservé aux personnes qui ont acheté un pack d'envies ou pris un abonnement, selon le modèle retenu. C'est un avantage concret à payer, et un filtre contre les propositions malveillantes.
- À prévoir : un compte ou un identifiant de membre (aujourd'hui, le jeu n'a pas de compte), une modération avant publication, et un stockage des propositions et des votes (la feuille de l'Atelier suffit au début). Les propositions ne contiennent que des mots de roue, jamais de phrase intime de partie.

**Les comptes, au plus simple** (19 octobre 2026). Pas de compte pour jouer, jamais : ni pour découvrir, ni pour jouer, ni pour inviter, ni pour rejoindre une partie. Le compte n'apparaît qu'au moment où il apporte quelque chose, et se crée en un geste, sans mot de passe.

| Moment | Pourquoi | Comment |
| --- | --- | --- |
| Achat du Pass ou d'un pack | Le paiement demande déjà un email | Étape 1 : un code (« KIFF-7XQ2-… ») actif tout de suite sur le téléphone, envoyé aussi par email ; sur un autre téléphone, on colle le code ou on clique le lien |
| Proposer une envie, voter | Une voix par personne, créditer l'auteur·ice | Étape 2 : le code devient un compte ; connexion par clé d'accès (Face ID, empreinte) ou lien magique par email ; un pseudo, jamais le vrai nom |
| Retrouver ses achats sur un nouveau téléphone | Le Pass suit la personne | Le lien de l'email, ou la clé d'accès |

- Pas de « Se connecter avec Google » : personne ne veut voir Kiff Kiff dans son compte Google.
- Le compte ne contient jamais de partie, de phrase ni de kiff kiff : seulement l'email, le Pass, le pseudo, les propositions et les votes. Les parties restent chiffrées sur les téléphones.
- Quand l'un·e des deux a le Pass, toute la partie en profite (Brûlant débloqué pour les deux) : la personne invitée découvre le meilleur du jeu sans payer.
- Technique : la feuille Google ne suffit pas pour des comptes ; il faudra un petit serveur (Cloudflare, gratuit au début).

**Brûlant se mérite, ou se débloque** (décision de Marc, 19 octobre 2026). À distance, le piment monte en jouant : Pimenté après un tour de kiff kiff, Brûlant après un tour en Pimenté. À terme, l’un·e des deux pourra débloquer Brûlant tout de suite en payant, pour la partie à deux. C’est le moment d’achat le plus naturel du jeu : l’envie est là, et l’autre en profite aussi.

**Le mode soirée, à plusieurs** (idée de Marc, 20 octobre 2026, à mûrir). Pour une soirée entre plusieurs personnes, sur un téléphone qui tourne, ou chacun·e sur le sien.

- Chacun·e son tour prend le téléphone. Au début de l'envie, à la place de « que tu me » et « de te », on choisit le prénom de la personne à qui on l'adresse.
- L'envie reste secrète : seule la personne choisie la voit, quand vient son tour sur le téléphone de la soirée, ou sur son propre téléphone.
- Les règles ne changent pas : la personne choisie répond « J'ai envie aussi », « Oui, mais… » ou « On passe », et rien n'est révélé aux autres.
- À penser : le piment doit se consentir pour chaque paire de personnes, pas pour tout le groupe ; dire aux autres qu'une envie a été envoyée sans dire laquelle, ni à qui ? ; ce que voit le groupe d'un kiff kiff (rien, par défaut).

**Des mots de saison** (idée de Marc, 21 octobre 2026). Des mots nouveaux en lien avec l'actualité ou la saison — Halloween, Noël, la Saint-Valentin, l'été, la rentrée… — qui entrent dans les roues pour quelques semaines, et un avertissement discret qui dit que de nouveaux mots sont arrivés, pour donner envie de rejouer.

- Les mots de saison se mélangent aux autres dans le tirage de 20, avec un petit signe sur la roue (une icône, pas une phrase) ; ils pourraient avoir leur propre ton, comme le décalé, pour qui veut jouer « tout Halloween ».
- Dans l'Atelier : un lot de mots avec une date de début et de fin, préparé à l'avance ; les mots sortent seuls à la fin de la saison et reviennent l'année suivante.
- L'avertissement suit la règle du jeu : dire qu'il y a du nouveau, jamais un mot ni une envie (« De nouveaux mots sont arrivés dans les roues. »), une seule fois par saison, et seulement pour qui a accepté les avertissements.
- Technique : aujourd'hui, l'adresse d'avertissement d'un téléphone ne vit que dans la partie chiffrée à deux ; pour prévenir tout le monde, chaque téléphone devrait aussi confier son adresse au script, avec son accord (une case « Me prévenir des nouveaux mots »). À mesurer : parties lancées dans les sept jours qui suivent l'avertissement.

**Le Pass Kiff enrichi.** En plus du niveau Brûlant complet et des parties à distance illimitées, le Pass débloquerait les roues thématiques. Les roues de la semaine resteraient gratuites : elles servent la rétention. Prix à tester entre 7 et 15 €, payé une fois.

## Sources

- [Spicer sur l'App Store](https://apps.apple.com/app/id1335558932)
- [Desire sur l'App Store](https://apps.apple.com/app/id923073855)
- [Picolo sur l'App Store (France)](https://apps.apple.com/FR/app/id1001473964)
- [Paired : les applis de sexe pour couples](https://www.paired.com/articles/sex-apps-for-couples)
- [Juniper Research via ICT Business (2020)](https://www.ictbusiness.biz/analysis/digital-sexual-wellness-market-will-approach-1-billion-by-2025)
- [Statista via Echo du Mardi](https://www.echodumardi.com/actualite/quels-pays-deurope-comptent-le-plus-grand-nombre-dutilisateurs-dapplications-de-rencontre/?print=pdf)
- [Google Play : règles sur le contenu sexuel](https://support.google.com/googleplay/android-developer/answer/9878810)
- [Google Play : frais d'inscription](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)
- [MacTech : règles de l'App Store (février 2026)](https://www.mactech.com/2026/02/06/apple-updates-its-app-review-guidelines-with-expanded-list-of-apps-with-objectionable-content/amp/)
- [Apple : App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/?page=2)
- [Stripe : activités interdites et restreintes](https://support.stripe.com/questions/prohibited-and-restricted-businesses-faqs)
- [Conditions de Buy Me a Coffee](https://tostracker.app/document/buy-me-a-coffee)
- [Tarifs de Buy Me a Coffee](https://schoolmaker.com/blog/buy-me-a-coffee-pricing)
- [Corepay : frais de CCBill et Verotel](https://corepay.net/articles/cc-bill-alternatives/)
- [Programme d'affiliation Lovehoney France](https://www.flexoffers.com/affiliate-programs/lovehoney-fr-affiliate-program)
- [Matomo : conditions de l'exemption CNIL](https://matomo.org/faq/how-do-i-configure-matomo-without-tracking-consent-for-french-visitors-cnil-exemption/)
- [CB News : référentiel de vérification d'âge de l'Arcom](https://www.cbnews.fr/digital/mineurs-contenus-pornographiques-arcom-adopte-son-referentiel)
- [Google Apps Script : quotas](https://developers.google.com/apps-script/guides/services/quotas?hl=en)
- [Cloudflare Workers : tarifs](https://developers.cloudflare.com/workers/platform/pricing/)
