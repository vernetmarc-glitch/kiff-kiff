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
    { s: "déglingues", i: "déglinguer" }
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
    "le lobe de l’oreille"
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
    "en sautillant"
  ]
};
