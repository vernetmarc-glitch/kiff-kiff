/* Kiff Kiff — contenu des roues, avec niveau de piment.
 *
 * lvl : 1 tendre, 2 pimenté, 3 brûlant (absent = 1). Un niveau montre aussi tout ce qui est en dessous.
 *
 * Actions : s = forme après « que tu me » (subjonctif, 2e personne)
 *           i = forme après « de te » (infinitif)
 *           p = "à" quand l’action se construit avec « à » : la roue des endroits
 *               s’accorde alors toute seule (à la tête, au gros orteil, aux épaules).
 * Endroits : t = texte.
 * Manières : t = texte identique dans les deux sens,
 *            ou s / i quand un possessif change avec le sens
 *            (« que tu me … avec ton sexe » / « de te … avec mon sexe »).
 * Une case « texte libre » est ajoutée automatiquement à la fin de chaque roue.
 */
window.ROUE_DATA = {
  niveaux: [
    { n: 1, nom: "Tendre", desc: "Câlins, chatouilles et bêtises." },
    { n: 2, nom: "Pimenté", desc: "Ça chauffe : sexe, fesses et tétons." },
    { n: 3, nom: "Brûlant", desc: "Carrément cochon, entre adultes consentants." }
  ],

  actions: [
    { s: "gratouilles", i: "gratouiller" },
    { s: "caresses", i: "caresser" },
    { s: "léchouilles", i: "léchouiller" },
    { s: "fasses gouzi-gouzi", i: "faire gouzi-gouzi", p: "à" },
    { s: "titilles", i: "titiller" },
    { s: "fasses rien du tout", i: "faire rien du tout", p: "à" },
    { s: "masses", i: "masser" },
    { s: "souffles sur", i: "souffler sur" },
    { s: "pinces", i: "pincer" },
    { s: "martèles", i: "marteler" },
    { s: "mordilles", i: "mordiller" },
    { s: "renifles", i: "renifler" },
    { s: "bécotes", i: "bécoter" },
    { s: "effleures", i: "effleurer" },
    { s: "fasses la bise", i: "faire la bise", p: "à" },
    { s: "murmures des secrets", i: "murmurer des secrets", p: "à" },
    { s: "chantes une berceuse", i: "chanter une berceuse", p: "à" },
    { s: "présentes tes respects", i: "présenter mes respects", p: "à" },
    { s: "tapes du morse sur", i: "taper du morse sur" },
    { s: "dessines un cœur sur", i: "dessiner un cœur sur" },
    { s: "fasses des bisous papillon sur", i: "faire des bisous papillon sur" },

    /* Pimenté */
    { s: "suces", i: "sucer", lvl: 2 },
    { s: "déglingues", i: "déglinguer", lvl: 2 },
    { s: "circlues", i: "circlure", lvl: 2 },
    { s: "introduises un appendice dans", i: "introduire un appendice dans", lvl: 2 },
    { s: "fasses un suçon sur", i: "faire un suçon sur", lvl: 2 },
    { s: "mettes un glaçon sur", i: "mettre un glaçon sur", lvl: 2 },
    { s: "enduises d’huile", i: "enduire d’huile", lvl: 2 },
    { s: "verses du chocolat sur", i: "verser du chocolat sur", lvl: 2 },
    { s: "frottes", i: "frotter", lvl: 2 },

    /* Brûlant */
    { s: "lèches", i: "lécher", lvl: 3 },
    { s: "lapes", i: "laper", lvl: 3 },
    { s: "mordes", i: "mordre", lvl: 3 },
    { s: "dévores", i: "dévorer", lvl: 3 },
    { s: "fesses", i: "fesser", lvl: 3 },
    { s: "écartes", i: "écarter", lvl: 3 },
    { s: "attaches", i: "attacher", lvl: 3 },
    { s: "tètes", i: "téter", lvl: 3 },
    { s: "branles", i: "branler", lvl: 3 },
    { s: "doigtes", i: "doigter", lvl: 3 }
  ],

  objets: [
    { t: "la tête" },
    { t: "les épaules" },
    { t: "le gros orteil" },
    { t: "un ongle" },
    { t: "la chaussette" },
    { t: "la bouche" },
    { t: "le trou de nez" },
    { t: "le coude droit" },
    { t: "l’arrière du genou" },
    { t: "le dos" },
    { t: "le lobe de l’oreille" },
    { t: "le nombril" },
    { t: "la nuque" },
    { t: "la plante des pieds" },
    { t: "l’annulaire" },
    { t: "les sourcils" },
    { t: "la fossette de ton choix" },
    { t: "le grain de beauté le plus proche" },
    { t: "l’aura" },
    { t: "le chakra du cœur" },
    { t: "la moustache" },

    /* Pimenté */
    { t: "le sexe", lvl: 2 },
    { t: "le fessier", lvl: 2 },
    { t: "le téton gauche", lvl: 2 },
    { t: "les tétons", lvl: 2 },
    { t: "l’intérieur des cuisses", lvl: 2 },
    { t: "le creux des reins", lvl: 2 },
    { t: "le bas du ventre", lvl: 2 },
    { t: "les lèvres", lvl: 2 },
    { t: "les poignets", lvl: 2 },

    /* Brûlant : des zones que tout le monde a, quel que soit son sexe */
    { t: "l’entrejambe", lvl: 3 },
    { t: "le pubis", lvl: 3 },
    { t: "le périnée", lvl: 3 },
    { t: "la raie des fesses", lvl: 3 },
    { t: "l’anus", lvl: 3 },
    { t: "le point le plus sensible", lvl: 3 },
    { t: "tout ce qui dépasse", lvl: 3 }
  ],

  manieres: [
    { t: "avec application" },
    { t: "en chantonnant" },
    { t: "joyeusement" },
    { t: "très lentement" },
    { t: "avec amour" },
    { t: "vigoureusement" },
    { t: "en toute amitié" },
    { t: "délicatement" },
    { t: "à la bonne franquette" },
    { t: "en sautillant" },
    { t: "en pouffant" },
    { t: "en slow motion" },
    { t: "en cancanant tel le dauphin" },
    { t: "solennellement" },
    { t: "comme si c’était la première fois" },
    { t: "en récitant la liste de courses" },
    { t: "sans les mains" },
    { t: "en comptant en italien" },
    { t: "en rougissant" },
    { t: "avec une voix de documentaire" },

    /* Pimenté */
    { t: "sans vergogne", lvl: 2 },
    { t: "avec gourmandise", lvl: 2 },
    { t: "comme un·e sauvage", lvl: 2 },
    { t: "en twerkant", lvl: 2 },
    { t: "du bout des lèvres", lvl: 2 },
    { t: "les yeux dans les yeux", lvl: 2 },
    { t: "avec de l’huile", lvl: 2 },
    { t: "en gémissant doucement", lvl: 2 },
    { t: "avec un glaçon dans la bouche", lvl: 2 },

    /* Brûlant */
    { t: "goulûment", lvl: 3 },
    { t: "comme un·e bon·ne petit·e chien·ne", lvl: 3 },
    { t: "en mode soumis·e", lvl: 3 },
    { t: "en mode dominant·e", lvl: 3 },
    { s: "avec ton sexe", i: "avec mon sexe", lvl: 3 },
    { s: "avec tes tétons", i: "avec mes tétons", lvl: 3 },
    { s: "avec ta langue", i: "avec ma langue", lvl: 3 },
    { t: "les yeux bandés", lvl: 3 },
    { t: "à genoux", lvl: 3 },
    { s: "en me tirant les cheveux", i: "en te tirant les cheveux", lvl: 3 },
    { s: "jusqu’à ce que je supplie", i: "jusqu’à ce que tu supplies", lvl: 3 }
  ]
};
