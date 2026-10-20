/* Kiff Kiff — mots proposés à ajouter aux roues, sélectionnés par Marc le 20 octobre 2026.
 * L’atelier les montre dans « Mots à ajouter », au-dessus de chaque roue : on coche, on corrige si besoin,
 * on les ajoute, puis « Enregistrer dans l’appli ». Un mot déjà dans la roue n’y apparaît plus.
 * Actions : s (après « que tu me »), i (après « de te », sinon proposé tout seul), a (avec « à »).
 * Endroits et manières : t, ou s / i quand le possessif change avec le sens.
 * lvl : 1 Tendre, 2 Pimenté, 3 Brûlant ; dc : décalé (le ton barjot) ; lot : 2 pour les compléments du 21 octobre 2026. */
window.KIFF_SUGGESTIONS = {
  action: [
    { lvl: 1, s: 'frôles' }, { lvl: 1, s: 'enlaces' }, { lvl: 1, s: 'câlines' }, { lvl: 1, s: 'chatouilles' }, { lvl: 1, s: 'réchauffes' },
    { lvl: 1, s: 'couvres de baisers', i: 'couvrir de baisers' }, { lvl: 1, s: 'murmures des mots doux sur' }, { lvl: 1, s: 'respires l’odeur de' },

    { lvl: 1, dc: 1, s: 'fasses du morse', i: 'faire du morse' }, { lvl: 1, dc: 1, s: 'inspectes' }, { lvl: 1, dc: 1, s: 'baptises' },
    { lvl: 1, dc: 1, s: 'décores de gommettes' }, { lvl: 1, dc: 1, s: 'fasses un check', i: 'faire un check', a: 1 }, { lvl: 1, dc: 1, s: 'te prosternes', i: 'me prosterner' },
    { lvl: 1, dc: 1, s: 'fasses une présentation PowerPoint sur', i: 'faire une présentation PowerPoint sur' },

    { lvl: 2, s: 'griffes' }, { lvl: 2, s: 'pétrisses', i: 'pétrir' }, { lvl: 2, s: 'dénudes' }, { lvl: 2, s: 'serres fort' },
    { lvl: 2, s: 'embrasses à pleine bouche' }, { lvl: 2, s: 'parcoures de baisers', i: 'parcourir de baisers' },
    { lvl: 2, s: 'effleures de ta langue', i: 'effleurer de ma langue' }, { lvl: 2, s: 'dévores des yeux' }, { lvl: 2, s: 'fasses frissonner', i: 'faire frissonner' },

    { lvl: 2, dc: 1, s: 'boulotes' }, { lvl: 2, dc: 1, s: 'lustres' }, { lvl: 2, dc: 1, s: 'pianotes sur' }, { lvl: 2, dc: 1, s: 'tartines' },
    { lvl: 2, dc: 1, s: 'mettes un coup de propre sur', i: 'mettre un coup de propre sur' }, { lvl: 2, dc: 1, s: 'fasses des bulles sur', i: 'faire des bulles sur' },
    { lvl: 2, dc: 1, s: 'fasses un suçon', i: 'faire un suçon' }, { lvl: 2, dc: 1, s: 'fasses un selfie avec', i: 'faire un selfie avec' },

    { lvl: 3, s: 'suces', i: 'sucer' }, { lvl: 3, s: 'prennes', i: 'prendre' }, { lvl: 3, s: 'chevauches' }, { lvl: 3, s: 'remplisses', i: 'remplir' },
    { lvl: 3, s: 'avales' }, { lvl: 3, s: 'masturbes' }, { lvl: 3, s: 'écartes' }, { lvl: 3, s: 'explores' },
    { lvl: 3, s: 'serres entre tes cuisses', i: 'serrer entre mes cuisses' }, { lvl: 3, s: 'frottes ton sexe contre', i: 'frotter mon sexe contre' },
    { lvl: 3, s: 'malmènes', i: 'malmener' }, { lvl: 3, s: 'manges de la chantilly', i: 'manger de la chantilly' },

    { lvl: 3, dc: 1, s: 'astiques prestement', i: 'astiquer prestement' }, { lvl: 3, dc: 1, s: 'ponces assidument', i: 'poncer assidument' },
    { lvl: 3, dc: 1, s: 'ramones bien', i: 'ramoner bien' }, { lvl: 3, dc: 1, s: 'visites rapidement', i: 'visiter rapidement' },
    { lvl: 3, dc: 1, s: 'tamponnes bien', i: 'tamponner bien' }, { lvl: 3, dc: 1, s: 'passes un bon coup de polish sur', i: 'passer un bon coup de polish sur' },
    { lvl: 3, dc: 1, s: 'fasses la totale', i: 'faire la totale', a: 1 }, { lvl: 3, dc: 1, s: 'fasses de la spéléo dans', i: 'faire de la spéléo dans' },
    { lvl: 3, dc: 1, s: 'ravales la façade de', i: 'ravaler la façade de' }, { lvl: 3, dc: 1, s: 'crépisses', i: 'crépir' },
    // Compléments du 21 octobre 2026 : au moins 20 mots par piment et par ton
    { lvl: 1, s: 'cajoles', i: 'cajoler', lot: 2 }, { lvl: 1, s: 'dorlotes', i: 'dorloter', lot: 2 }, { lvl: 1, s: 'frictionnes', i: 'frictionner', lot: 2 },
    { lvl: 1, s: 'picores de bisous', i: 'picorer de bisous', lot: 2 }, { lvl: 1, s: 'dessines des ronds sur', i: 'dessiner des ronds sur', lot: 2 }, { lvl: 1, s: 'frôles des lèvres', i: 'frôler des lèvres', lot: 2 },
    { lvl: 1, s: 'tiennes', i: 'tenir', lot: 2 }, { lvl: 1, s: 'peignes', i: 'peigner', lot: 2 }, { lvl: 1, dc: 1, s: 'chronomètres', i: 'chronométrer', lot: 2 },
    { lvl: 1, dc: 1, s: 'mesures au mètre ruban', i: 'mesurer au mètre ruban', lot: 2 }, { lvl: 1, dc: 1, s: 'passes au détecteur de métaux', i: 'passer au détecteur de métaux', lot: 2 }, { lvl: 1, dc: 1, s: 'fasses un audit de', i: 'faire un audit de', lot: 2 },
    { lvl: 1, dc: 1, s: 'dédicaces', i: 'dédicacer', lot: 2 }, { lvl: 1, dc: 1, s: 'arroses', i: 'arroser', lot: 2 }, { lvl: 1, dc: 1, s: 'époussettes', i: 'épousseter', lot: 2 },
    { lvl: 1, dc: 1, s: 'fasses la bise', i: 'faire la bise', a: 1, lot: 2 }, { lvl: 1, dc: 1, s: 'notes sur 20', i: 'noter sur 20', lot: 2 }, { lvl: 1, dc: 1, s: 'caresses à rebrousse-poil', i: 'caresser à rebrousse-poil', lot: 2 },
    { lvl: 2, s: 'lèches', i: 'lécher', lot: 2 }, { lvl: 2, s: 'déshabilles', i: 'déshabiller', lot: 2 }, { lvl: 2, s: 'empoignes', i: 'empoigner', lot: 2 },
    { lvl: 2, s: 'agrippes', i: 'agripper', lot: 2 }, { lvl: 2, s: 'souffles chaud sur', i: 'souffler chaud sur', lot: 2 }, { lvl: 2, s: 'explores du bout de la langue', i: 'explorer du bout de la langue', lot: 2 },
    { lvl: 2, s: 'masses à l’huile chaude', i: 'masser à l’huile chaude', lot: 2 }, { lvl: 2, dc: 1, s: 'fasses du beatbox sur', i: 'faire du beatbox sur', lot: 2 }, { lvl: 2, dc: 1, s: 'tamponnes au rouge à lèvres', i: 'tamponner au rouge à lèvres', lot: 2 },
    { lvl: 2, dc: 1, s: 'passes au rouleau à pâtisserie', i: 'passer au rouleau à pâtisserie', lot: 2 }, { lvl: 2, dc: 1, s: 'fasses une dégustation de', i: 'faire une dégustation de', lot: 2 }, { lvl: 2, dc: 1, s: 'inspectes à la loupe', i: 'inspecter à la loupe', lot: 2 },
    { lvl: 2, dc: 1, s: 'fasses un massage à la spatule sur', i: 'faire un massage à la spatule sur', lot: 2 }, { lvl: 2, dc: 1, s: 'chantes une sérénade', i: 'chanter une sérénade', a: 1, lot: 2 }, { lvl: 2, dc: 1, s: 'fasses une visite guidée de', i: 'faire une visite guidée de', lot: 2 },
    { lvl: 2, dc: 1, s: 'mordilles en rythme', i: 'mordiller en rythme', lot: 2 }, { lvl: 2, dc: 1, s: 'nappes de chocolat', i: 'napper de chocolat', lot: 2 }, { lvl: 2, dc: 1, s: 'fasses du karaoké sur', i: 'faire du karaoké sur', lot: 2 },
    { lvl: 2, dc: 1, s: 'passes le plumeau sur', i: 'passer le plumeau sur', lot: 2 }, { lvl: 2, dc: 1, s: 'fasses le tour du propriétaire de', i: 'faire le tour du propriétaire de', lot: 2 }, { lvl: 2, dc: 1, s: 'pétrisses comme une pâte à pizza', i: 'pétrir comme une pâte à pizza', lot: 2 },
    { lvl: 3, s: 'lèches longuement', i: 'lécher longuement', lot: 2 }, { lvl: 3, s: 'prennes en bouche', i: 'prendre en bouche', lot: 2 }, { lvl: 3, s: 'pénètres', i: 'pénétrer', lot: 2 },
    { lvl: 3, s: 'titilles du bout de la langue', i: 'titiller du bout de la langue', lot: 2 }, { lvl: 3, s: 'mordes fort', i: 'mordre fort', lot: 2 }, { lvl: 3, s: 'fesses fort', i: 'fesser fort', lot: 2 },
    { lvl: 3, dc: 1, s: 'fasses le plein de', i: 'faire le plein de', lot: 2 }, { lvl: 3, dc: 1, s: 'passes le Kärcher sur', i: 'passer le Kärcher sur', lot: 2 }, { lvl: 3, dc: 1, s: 'fasses une vidange de', i: 'faire une vidange de', lot: 2 },
    { lvl: 3, dc: 1, s: 'graisses', i: 'graisser', lot: 2 }, { lvl: 3, dc: 1, s: 'tringles', i: 'tringler', lot: 2 }, { lvl: 3, dc: 1, s: 'débouches', i: 'déboucher', lot: 2 },
    { lvl: 3, dc: 1, s: 'fasses du rodéo sur', i: 'faire du rodéo sur', lot: 2 }, { lvl: 3, dc: 1, s: 'trempes la nouille dans', i: 'tremper la nouille dans', lot: 2 }, { lvl: 3, dc: 1, s: 'fasses une inspection technique de', i: 'faire une inspection technique de', lot: 2 },
    { lvl: 3, dc: 1, s: 'laboures', i: 'labourer', lot: 2 }, { lvl: 3, dc: 1, s: 'secoues comme un cocotier', i: 'secouer comme un cocotier', lot: 2 }, { lvl: 3, dc: 1, s: 'emboutisses', i: 'emboutir', lot: 2 }
  ],
  endroit: [
    { lvl: 1, t: 'le creux du cou' }, { lvl: 1, t: 'la paume de la main' }, { lvl: 1, t: 'les paupières' }, { lvl: 1, t: 'la tempe' }, { lvl: 1, t: 'le menton' },
    { lvl: 1, t: 'les omoplates' }, { lvl: 1, t: 'les cheveux' }, { lvl: 1, t: 'les mollets' }, { lvl: 1, t: 'la clavicule' }, { lvl: 1, t: 'le bout du nez' },

    { lvl: 1, dc: 1, t: 'le petit orteil' }, { lvl: 1, dc: 1, t: 'la rotule gauche' }, { lvl: 1, dc: 1, t: 'le talon d’Achille' },
    { lvl: 1, dc: 1, s: 'mon plus beau grain de beauté', i: 'ton plus beau grain de beauté' }, { lvl: 1, dc: 1, t: 'le tympan' }, { lvl: 1, dc: 1, t: 'le pli du coude' },
    { lvl: 1, dc: 1, t: 'le double menton' }, { lvl: 1, dc: 1, t: 'la fossette' }, { lvl: 1, dc: 1, t: 'la pomme d’Adam' }, { lvl: 1, dc: 1, t: 'l’auriculaire' },

    { lvl: 2, t: 'l’intérieur des cuisses' }, { lvl: 2, t: 'le creux des reins' }, { lvl: 2, t: 'le bas-ventre' },
    { lvl: 2, s: 'mes bonnes hanches', i: 'tes bonnes hanches' }, { lvl: 2, t: 'le fond du décolleté' }, { lvl: 2, t: 'les lèvres ardentes' },
    { lvl: 2, t: 'la gorge' }, { lvl: 2, t: 'le ventre brulant' },

    { lvl: 2, dc: 1, t: 'le téton droit (par équité)' }, { lvl: 2, dc: 1, t: 'le pli fessier' }, { lvl: 2, dc: 1, t: 'le triangle des Bermudas' },
    { lvl: 2, dc: 1, t: 'le poitrail' }, { lvl: 2, dc: 1, t: 'la zone interdite' }, { lvl: 2, dc: 1, s: 'ton bourrelet préféré', i: 'mon bourrelet préféré' },
    { lvl: 2, dc: 1, t: 'le string ficelle' },

    { lvl: 3, t: 'le clitoris' }, { lvl: 3, t: 'la verge' }, { lvl: 3, t: 'les testicules' }, { lvl: 3, t: 'les lèvres intimes' }, { lvl: 3, t: 'le point G' },
    { lvl: 3, t: 'le périnée' }, { lvl: 3, t: 'le pubis' }, { lvl: 3, t: 'l’anus' }, { lvl: 3, t: 'les tétons bien durs' }, { lvl: 3, t: 'le frein du gland' },

    { lvl: 3, dc: 1, t: 'les roustons' }, { lvl: 3, dc: 1, t: 'le joystick' }, { lvl: 3, dc: 1, t: 'le berlingot' }, { lvl: 3, dc: 1, t: 'la boîte à bonheur' },
    { lvl: 3, dc: 1, t: 'le tunnel sous la Manche' }, { lvl: 3, dc: 1, t: 'la chaufferette' }, { lvl: 3, dc: 1, t: 'la tirelire' },
    // Compléments du 21 octobre 2026 : au moins 20 mots par piment et par ton
    { lvl: 1, t: 'le dessus des mains', lot: 2 }, { lvl: 1, t: 'l’arrondi de l’épaule', lot: 2 }, { lvl: 1, t: 'le haut du dos', lot: 2 },
    { lvl: 1, t: 'le bout des doigts', lot: 2 }, { lvl: 1, t: 'les avant-bras', lot: 2 }, { lvl: 1, t: 'le front', lot: 2 },
    { lvl: 1, dc: 1, t: 'la malléole', lot: 2 }, { lvl: 1, dc: 1, t: 'le philtrum (le petit creux sous le nez)', lot: 2 }, { lvl: 1, dc: 1, t: 'le genou cagneux', lot: 2 },
    { lvl: 1, dc: 1, t: 'l’orteil du milieu', lot: 2 }, { lvl: 1, dc: 1, t: 'le coude gauche (le droit est pris)', lot: 2 }, { lvl: 1, dc: 1, t: 'le menton en galoche', lot: 2 },
    { lvl: 2, t: 'le creux des hanches', lot: 2 }, { lvl: 2, t: 'les fesses', lot: 2 }, { lvl: 2, t: 'le haut des cuisses', lot: 2 },
    { lvl: 2, t: 'les seins', lot: 2 }, { lvl: 2, t: 'le torse', lot: 2 }, { lvl: 2, t: 'la chute de reins', lot: 2 },
    { lvl: 2, t: 'la nuque offerte', lot: 2 }, { lvl: 2, t: 'la peau sous le nombril', lot: 2 }, { lvl: 2, t: 'l’élastique du slip', lot: 2 },
    { lvl: 2, dc: 1, t: 'les poignées d’amour', lot: 2 }, { lvl: 2, dc: 1, t: 'le popotin', lot: 2 }, { lvl: 2, dc: 1, t: 'les miches', lot: 2 },
    { lvl: 2, dc: 1, t: 'le valseur', lot: 2 }, { lvl: 2, dc: 1, t: 'les roploplos', lot: 2 }, { lvl: 2, dc: 1, t: 'la zone de confort', lot: 2 },
    { lvl: 2, dc: 1, t: 'la frontière du slip', lot: 2 }, { lvl: 2, dc: 1, t: 'le nombril (en cas d’urgence)', lot: 2 }, { lvl: 2, dc: 1, t: 'le gras du bide', lot: 2 },
    { lvl: 2, dc: 1, t: 'la zone en travaux', lot: 2 }, { lvl: 2, dc: 1, s: 'le tatouage que je regrette', i: 'le tatouage que tu regrettes', lot: 2 }, { lvl: 2, dc: 1, s: 'mes poils de dos', i: 'tes poils de dos', lot: 2 },
    { lvl: 2, dc: 1, t: 'la chair de poule', lot: 2 }, { lvl: 2, dc: 1, t: 'la bouée de sauvetage', lot: 2 }, { lvl: 3, t: 'la vulve', lot: 2 },
    { lvl: 3, t: 'les bourses', lot: 2 }, { lvl: 3, t: 'la prostate', lot: 2 }, { lvl: 3, t: 'les seins nus', lot: 2 },
    { lvl: 3, t: 'les fesses écartées', lot: 2 }, { lvl: 3, s: 'mon sexe tout humide', i: 'ton sexe tout humide', lot: 2 }, { lvl: 3, dc: 1, t: 'le zgeg', lot: 2 },
    { lvl: 3, dc: 1, t: 'la zézette', lot: 2 }, { lvl: 3, dc: 1, t: 'le chibre', lot: 2 }, { lvl: 3, dc: 1, t: 'la foufoune', lot: 2 },
    { lvl: 3, dc: 1, t: 'le bigorneau', lot: 2 }, { lvl: 3, dc: 1, t: 'les bijoux de famille', lot: 2 }, { lvl: 3, dc: 1, t: 'le service trois pièces', lot: 2 },
    { lvl: 3, dc: 1, t: 'la grotte d’Ali Baba', lot: 2 }, { lvl: 3, dc: 1, t: 'le petit oiseau', lot: 2 }, { lvl: 3, dc: 1, t: 'le pot de miel', lot: 2 },
    { lvl: 3, dc: 1, t: 'le mont de Vénus (version GPS)', lot: 2 }
  ],
  maniere: [
    { lvl: 1, t: 'les yeux dans les yeux' }, { lvl: 1, t: 'avec une infinie douceur' }, { lvl: 1, t: 'du bout des doigts' }, { lvl: 1, t: 'à la lueur des bougies' },
    { lvl: 1, t: 'comme une plume' }, { lvl: 1, t: 'en silence' }, { lvl: 1, t: 'au petit matin' }, { lvl: 1, t: 'sous la couette' },
    { lvl: 1, s: 'en me regardant', i: 'en te regardant' }, { lvl: 1, s: 'en prenant tout ton temps', i: 'en prenant tout mon temps' },

    { lvl: 1, dc: 1, t: 'avec un vieil accent marseillais' }, { lvl: 1, dc: 1, t: 'comme un·e notaire' }, { lvl: 1, dc: 1, t: 'en apnée statique' },
    { lvl: 1, dc: 1, t: 'avec une paire de moufle' }, { lvl: 1, dc: 1, t: 'déguisé·e en brocoli' }, { lvl: 1, dc: 1, t: 'quoiqu’en penses le voisin' },
    { lvl: 1, dc: 1, t: 'a la Zidane' }, { lvl: 1, dc: 1, t: 'au son de la flûte à bec' },

    { lvl: 2, t: 'lentement puis de plus en plus vite' }, { lvl: 2, t: 'en soupirant' }, { lvl: 2, t: 'sous la douche' }, { lvl: 2, t: 'contre le mur' },
    { lvl: 2, t: 'dans le noir complet' }, { lvl: 2, t: 'les mains liées' }, { lvl: 2, t: 'avec de l’huile de massage' },
    { lvl: 2, s: 'en me faisant languir', i: 'en te faisant languir' }, { lvl: 2, s: 'sans t’arrêter', i: 'sans m’arrêter' },
    { lvl: 2, s: 'en retenant ton souffle', i: 'en retenant mon souffle' }, { lvl: 2, t: 'dès qu’on rentre à la maison' },

    { lvl: 2, dc: 1, t: 'en ronronnant vaguement' }, { lvl: 2, dc: 1, t: 'avec des gants de vaisselle' }, { lvl: 2, dc: 1, t: 'en vrombissant (ex: lave vaisselle)' },
    { lvl: 2, dc: 1, t: 'sur un petit air de samba' }, { lvl: 2, dc: 1, t: 'déguisé·e en je ne sais trop quoi' }, { lvl: 2, dc: 1, t: 'comme un (petit) anaconda' },
    { lvl: 2, dc: 1, t: 'un peu comme le pape' }, { lvl: 2, dc: 1, t: 'en slip / chaussettes' },

    { lvl: 3, t: 'et lâches toi bien' }, { lvl: 3, t: 'bien profondément' }, { lvl: 3, t: 'vraiment bien fort' }, { lvl: 3, t: 'bien cambré.e' },
    { lvl: 3, t: 'à quatre pattes' }, { lvl: 3, t: 'attaché·e au lit' }, { lvl: 3, t: 'jusqu’à l’épuisement' }, { lvl: 3, t: 'en se matant dans le miroir' },
    { lvl: 3, s: 'jusqu’à ce que je jouisse', i: 'jusqu’à ce que tu jouisses' }, { lvl: 3, s: 'en me disant des bonnes cochonneries', i: 'en te disant des bonnes cochonneries' },
    { lvl: 3, s: 'en me suppliant de continuer', i: 'en te suppliant de continuer' }, { lvl: 3, t: 'derrière un buisson' }, { lvl: 3, t: 'mode quicky efficace' },
    { lvl: 3, t: 'dans les toilettes du bar' }, { lvl: 3, t: 'dans un lieu public' },

    { lvl: 3, dc: 1, t: 'tel le marteau-piqueur (un Bosh Professional)' }, { lvl: 3, dc: 1, t: 'façon rodéo Texan' }, { lvl: 3, dc: 1, t: 'mode quicky baclé' },
    { lvl: 3, dc: 1, t: 'tel le bûcheron hargneux' }, { lvl: 3, dc: 1, t: 'comme un petit shaker' }, { lvl: 3, dc: 1, t: 'en hurlant un peu trop' },
    { lvl: 3, dc: 1, t: 'en criant « Bismillah c’est le ténèbres ! »' }, { lvl: 3, dc: 1, t: 'comme un.e bon.ne petite salope' },
    { lvl: 3, dc: 1, t: 'comme une petite chienne' }, { lvl: 3, dc: 1, t: 'en mode bat la rate' },
    // Compléments du 21 octobre 2026 : au moins 20 mots par piment et par ton
    { lvl: 1, t: 'tendrement', lot: 2 }, { lvl: 1, t: 'en fermant les yeux', lot: 2 }, { lvl: 1, t: 'comme au premier rendez-vous', lot: 2 },
    { lvl: 1, t: 'au soleil couchant', lot: 2 }, { lvl: 1, t: 'en chuchotant', lot: 2 }, { lvl: 1, t: 'avec des mains toutes chaudes', lot: 2 },
    { lvl: 1, dc: 1, t: 'en récitant l’alphabet à l’envers', lot: 2 }, { lvl: 1, dc: 1, t: 'avec un accent québécois', lot: 2 }, { lvl: 1, dc: 1, t: 'en faisant des bruits de mouette', lot: 2 },
    { lvl: 1, dc: 1, t: 'façon commentateur·rice de Roland-Garros', lot: 2 }, { lvl: 1, dc: 1, t: 'en alexandrins', lot: 2 }, { lvl: 1, dc: 1, t: 'au ralenti, avec les bruitages', lot: 2 },
    { lvl: 1, dc: 1, t: 'en mode Bob Ross', lot: 2 }, { lvl: 1, dc: 1, t: 'comme un pingouin', lot: 2 }, { lvl: 1, dc: 1, t: 'en sifflotant du Vivaldi', lot: 2 },
    { lvl: 2, s: 'sans me quitter des yeux', i: 'sans te quitter des yeux', lot: 2 }, { lvl: 2, s: 'en me murmurant des mots crus', i: 'en te murmurant des mots crus', lot: 2 }, { lvl: 2, t: 'avec un glaçon entre les lèvres', lot: 2 },
    { lvl: 2, t: 'avec les mains qui tremblent un peu', lot: 2 }, { lvl: 2, t: 'contre la porte d’entrée', lot: 2 }, { lvl: 2, t: 'sur le canapé', lot: 2 },
    { lvl: 2, s: 'en retenant tes gémissements', i: 'en retenant mes gémissements', lot: 2 }, { lvl: 2, dc: 1, t: 'en commentant comme au JT', lot: 2 }, { lvl: 2, dc: 1, t: 'façon œnologue', lot: 2 },
    { lvl: 2, dc: 1, t: 'en chantant du Céline Dion', lot: 2 }, { lvl: 2, dc: 1, t: 'avec un bandeau de pirate', lot: 2 }, { lvl: 2, dc: 1, t: 'en faisant « miam » à chaque fois', lot: 2 },
    { lvl: 2, dc: 1, t: 'en mode GPS (« dans 200 mètres, tournez à gauche »)', lot: 2 }, { lvl: 2, dc: 1, t: 'avec une moustache postiche', lot: 2 }, { lvl: 2, dc: 1, t: 'au rythme d’un métronome', lot: 2 },
    { lvl: 2, dc: 1, t: 'avec des lunettes de piscine', lot: 2 }, { lvl: 2, dc: 1, t: 'en tenue de ski', lot: 2 }, { lvl: 2, dc: 1, t: 'tel un aspirateur robot', lot: 2 },
    { lvl: 2, dc: 1, t: 'comme un chat qui pétrit', lot: 2 }, { lvl: 2, dc: 1, t: 'en lisant la notice', lot: 2 }, { lvl: 3, t: 'sans retenue', lot: 2 },
    { lvl: 3, t: 'jusqu’au bout', lot: 2 }, { lvl: 3, t: 'à en perdre la tête', lot: 2 }, { lvl: 3, t: 'sur la table de la cuisine', lot: 2 },
    { lvl: 3, s: 'en me tenant fermement les hanches', i: 'en te tenant fermement les hanches', lot: 2 }, { lvl: 3, dc: 1, t: 'comme un lapin Duracell', lot: 2 }, { lvl: 3, dc: 1, t: 'en mode TGV', lot: 2 },
    { lvl: 3, dc: 1, t: 'comme une machine à laver en plein essorage', lot: 2 }, { lvl: 3, dc: 1, t: 'avec la délicatesse d’un bulldozer', lot: 2 }, { lvl: 3, dc: 1, t: 'en criant « Banzaï ! »', lot: 2 },
    { lvl: 3, dc: 1, t: 'comme dans un film des années 80', lot: 2 }, { lvl: 3, dc: 1, t: 'sur le générique de Thalassa', lot: 2 }, { lvl: 3, dc: 1, t: 'en mode Formule 1', lot: 2 },
    { lvl: 3, dc: 1, t: 'comme si le voisin écoutait', lot: 2 }, { lvl: 3, dc: 1, t: 'tel un pivert', lot: 2 }, { lvl: 3, dc: 1, t: 'jusqu’à ce que les voisins applaudissent', lot: 2 },
    { lvl: 3, dc: 1, t: 'en mode cascadeur·se', lot: 2 }
  ]
};
