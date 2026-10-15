/* La Roue du Consentement — contenu des roues.
 *
 * Actions : s = forme après « que tu me » (subjonctif, 2e personne)
 *           i = forme après « de te » (infinitif)
 *           p = "à" quand l'action se construit avec « à » : la roue des endroits
 *               s'accorde alors toute seule (à la tête, au gros orteil, aux épaules).
 * Les prépositions « sur » et « dans » font partie du texte de l'action.
 * Une case « texte libre » est ajoutée automatiquement à la fin de chaque roue.
 */
window.ROUE_DATA = {
  actions: [
    { s: "gratouilles", i: "gratouiller" },
    { s: "caresses", i: "caresser" },
    { s: "léchouilles", i: "léchouiller" },
    { s: "fasses gouzi-gouzi", i: "faire gouzi-gouzi", p: "à" },
    { s: "titilles", i: "titiller" },
    { s: "fasses rien du tout", i: "faire rien du tout", p: "à" },
    { s: "circlues", i: "circlure" },
    { s: "introduises un appendice dans", i: "introduire un appendice dans" },
    { s: "masses", i: "masser" },
    { s: "souffles sur", i: "souffler sur" },
    { s: "pinces", i: "pincer" },
    { s: "suces", i: "sucer" },
    { s: "martèles", i: "marteler" },
    { s: "déglingues", i: "déglinguer" },
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
    { s: "fasses des bisous papillon sur", i: "faire des bisous papillon sur" }
  ],
  objets: [
    "la tête",
    "les épaules",
    "le sexe",
    "le gros orteil",
    "un ongle",
    "la chaussette",
    "la bouche",
    "le trou de nez",
    "le téton gauche",
    "le coude droit",
    "l’arrière du genou",
    "le dos",
    "le lobe de l’oreille",
    "le nombril",
    "le fessier",
    "la nuque",
    "la plante des pieds",
    "l’annulaire",
    "les sourcils",
    "la fossette de ton choix",
    "le grain de beauté le plus proche",
    "l’aura",
    "le chakra du cœur",
    "la moustache"
  ],
  manieres: [
    "sans vergogne",
    "avec application",
    "en chantonnant",
    "joyeusement",
    "très lentement",
    "avec amour",
    "vigoureusement",
    "en toute amitié",
    "avec gourmandise",
    "délicatement",
    "comme un·e sauvage",
    "à la bonne franquette",
    "en sautillant",
    "en pouffant",
    "en slow motion",
    "en cancanant tel le dauphin",
    "solennellement",
    "comme si c’était la première fois",
    "en récitant la liste de courses",
    "sans les mains",
    "en comptant en italien",
    "en rougissant",
    "avec une voix de documentaire"
  ]
};
