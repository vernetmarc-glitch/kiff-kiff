/* Kiff Kiff — mots proposés à ajouter aux roues, sélectionnés par Marc le 20 octobre 2026.
 * L’atelier les montre dans « Mots à ajouter », au-dessus de chaque roue : on coche, on corrige si besoin,
 * on les ajoute, puis « Enregistrer dans l’appli ». Un mot déjà dans la roue n’y apparaît plus.
 * Actions : s (après « que tu me »), i (après « de te », sinon proposé tout seul), a (avec « à »).
 * Endroits et manières : t, ou s / i quand le possessif change avec le sens.
 * lvl : 1 Tendre, 2 Pimenté, 3 Brûlant ; dc : décalé (le brocoli). */
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
    { lvl: 3, dc: 1, s: 'ravales la façade de', i: 'ravaler la façade de' }, { lvl: 3, dc: 1, s: 'crépisses', i: 'crépir' }
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
    { lvl: 3, dc: 1, t: 'le tunnel sous la Manche' }, { lvl: 3, dc: 1, t: 'la chaufferette' }, { lvl: 3, dc: 1, t: 'la tirelire' }
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
    { lvl: 3, dc: 1, t: 'comme une petite chienne' }, { lvl: 3, dc: 1, t: 'en mode bat la rate' }
  ]
};
