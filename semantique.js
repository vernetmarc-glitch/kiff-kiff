/* Kiff Kiff — les familles de mots pour « Vous cherchez peut-être… » dans la loupe.
 * Chaque famille regroupe des débuts de mots proches par le sens, en minuscules et sans accents :
 * taper un mot d’une famille propose les mots de la roue qui commencent comme un autre mot de la même famille
 * (« bite » propose « le chibrax », « caresser » propose « effleures »). Une expression de plusieurs mots marche aussi.
 * On peut en ajouter : un début de mot assez long (4 lettres ou plus) évite les rapprochements de hasard. */
window.KIFF_FAMILLES = [
  ['bite', 'penis', 'queue', 'verge', 'zgeg', 'chibr', 'gland', 'sceptre', 'joystick', 'zizi', 'braquemart', 'phallus', 'membre', 'gaule', 'dgse', 'engin', 'petit oiseau', 'service trois pieces'],
  ['chatte', 'vulve', 'foufoun', 'teuch', 'zezette', 'minou', 'clito', 'vagin', 'levres intimes', 'point g', 'grotte', 'boite a bonheur', 'pot de miel', 'autel de venus', 'mont de venus', 'abricot', 'septum', 'skene', 'lubrificat'],
  ['testicul', 'bourse', 'rouston', 'glaoui', 'couille', 'bijoux de famille', 'service trois pieces'],
  ['fesse', 'fessier', 'cul', 'boul', 'popotin', 'miche', 'valseur', 'derriere', 'croupe', 'raie', 'arriere', 'pare-choc', 'rondelle'],
  ['anus', 'anal', 'rondelle', 'sphincter', 'porte arriere', 'trou', 'tunnel', 'orifice'],
  ['sein', 'teton', 'poitrine', 'roploplo', 'lolo', 'poitrail', 'mamelon', 'areol', 'decollete', 'boutons de rose', 'tetouill'],
  ['caress', 'effleur', 'frol', 'masse', 'masser', 'massage', 'calin', 'touch', 'gratouill', 'chatouill', 'titill', 'cajol', 'dorlot', 'frictionn', 'petri', 'flatt', 'enlac', 'gouzi'],
  ['embrass', 'bisou', 'baiser', 'becot', 'bise', 'pelle', 'sucon', 'levre', 'bouche'],
  ['lech', 'langue', 'suce', 'sucer', 'sucot', 'avale', 'gobe', 'lape', 'baves', 'baver'],
  ['mord', 'croqu', 'devor', 'mange', 'manger', 'gueuleton', 'boulot', 'griff', 'pince', 'pincer', 'degust', 'nappe', 'chantilly', 'caramel'],
  ['fesse', 'fesser', 'claqu', 'tapot', 'frapp', 'gifl', 'martel'],
  ['penetr', 'enfonc', 'prenne', 'prendre', 'rempli', 'introm', 'doigt', 'ken', 'tringl', 'ramon', 'labour', 'emboutir', 'emboutiss', 'poing', 'speleo'],
  ['masturb', 'branl', 'astiqu', 'polish', 'lustr', 'ponce', 'poncer', 'frott'],
  ['nettoy', 'lave', 'laver', 'savon', 'epousset', 'plumeau', 'lustr', 'karcher', 'vidange', 'debouch', 'propre', 'polish', 'crepi', 'facade'],
  ['doux', 'douce', 'tendre', 'delicat', 'douceur', 'lent', 'mollo', 'plume', 'calme', 'tranquill', 'sagement', 'amitie', 'amour'],
  ['fort', 'brutal', 'vigour', 'sauvag', 'profond', 'vehement', 'violent', 'bulldozer', 'marteau', 'shaker', 'rodeo', 'tgv', 'formule 1', 'turbo', 'saccag', 'deglingu', 'demont', 'ecartel'],
  ['chant', 'siffl', 'fredonn', 'serenade', 'samba', 'flute', 'flutiau', 'musique', 'concerto', 'karaoke', 'beatbox', 'play-back', 'pianot', 'celine', 'vivaldi', 'twerk'],
  ['rire', 'rigol', 'drole', 'marrant', 'blague', 'barjo'],
  ['attach', 'ligot', 'menott', 'soumis', 'domin', 'bandeau', 'bandes', 'liees', 'quatre pattes', 'genoux'],
  ['douche', 'pluie', 'bain', 'eau', 'savon', 'mouill', 'humide', 'glacon', 'huile', 'degoulin', 'gicle'],
  ['lit', 'couette', 'canape', 'table', 'cuisine', 'mur', 'porte', 'toilette', 'voiture', 'maison', 'salon'],
  ['buisson', 'public', 'montagne', 'plage', 'jardin', 'bar', 'dehors', 'foret', 'colline'],
  ['regard', 'yeux', 'oeil', 'mate', 'mater', 'miroir', 'voir'],
  ['murmur', 'chuchot', 'dire', 'disant', 'mots', 'parl', 'suppli', 'gemiss', 'soupir', 'cri', 'hurl', 'couin', 'ronronn', 'cancan'],
  ['pied', 'orteil', 'hallux', 'talon', 'chevill', 'malleole', 'chaussette'],
  ['tete', 'crane', 'front', 'visage', 'joue', 'menton', 'nez', 'philtrum', 'sourcil', 'moustache', 'paupiere', 'tempe', 'oreille', 'lobe', 'tympan', 'cheveu', 'retro-auriculaire'],
  ['cou', 'nuque', 'gorge', 'clavicule', 'pomme d\'adam'],
  ['ventre', 'nombril', 'bas-ventre', 'bide', 'bourrelet', 'poignees', 'pubis', 'pubien', 'bouee'],
  ['dos', 'rein', 'omoplate', 'epaule', 'torse', 'colonne'],
  ['bras', 'main', 'doigt', 'poignet', 'coude', 'paume', 'avant-bras', 'annulaire', 'auriculaire', 'ongle'],
  ['cuisse', 'jambe', 'genou', 'mollet', 'entrecuisse', 'rotule', 'rotulien'],
  ['vite', 'rapide', 'quick', 'prestement', 'viteuf', 'ralenti', 'slow', 'longtemps', 'lentement'],
  ['chaud', 'brulant', 'ardent', 'feu', 'chauff', 'fievre', 'rechauff'],
  ['chat', 'chien', 'goret', 'dauphin', 'mouette', 'pingouin', 'anaconda', 'pivert', 'koala', 'canard', 'lapin', 'woody'],
  ['jouir', 'jouiss', 'orgasm', 'gicle', 'degoulin', 'extase'],
  ['gliss', 'roule', 'parcour', 'explor', 'visit', 'inspect', 'audit', 'mesure', 'detecteur']
];
