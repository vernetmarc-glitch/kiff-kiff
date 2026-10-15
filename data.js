/* Kiff Kiff — contenu des roues, avec niveau de piment.
 *
 * lvl : 1 tendre, 2 pimenté, 3 brûlant (absent = 1). Un niveau montre aussi tout ce qui est en dessous.
 *
 * Actions : s = forme après « que tu me » (subjonctif, 2e personne)
 *           i = forme après « de te » (infinitif)
 *           p = "à" quand l’action se construit avec « à » : la roue des endroits
 *               s’accorde alors toute seule (à la tête, au gros orteil, aux épaules).
 * Endroits : t = texte, ou s / i quand le possessif change avec le sens
 *            (« que tu me … mon sexe » / « de te … ton sexe »).
 * Manières : t = texte identique dans les deux sens,
 *            ou s / i quand un possessif change avec le sens
 *            (« que tu me … avec ton sexe » / « de te … avec mon sexe »).
 * Une case « texte libre » est ajoutée automatiquement à la fin de chaque roue.
 */
window.ROUE_DATA = {
  niveaux: [
    { n: 1, nom: "Tendre", desc: "Câlins, chatouilles et bêtises." },
    { n: 2, nom: "Pimenté", desc: "Ça chauffe : fesses, tétons et morsures." },
    { n: 3, nom: "Brûlant", desc: "Carrément cochon, entre adultes consentants." }
  ],

  actions: [
    { s: "gratouilles", i: "gratouiller" },
    { s: "caresses", i: "caresser" },
    { s: "fasses gouzi-gouzi", i: "faire gouzi-gouzi", p: "à" },
    { s: "titilles", i: "titiller" },
    { s: "fasses rien du tout", i: "faire rien du tout", p: "à" },
    { s: "masses", i: "masser" },
    { s: "souffles sur", i: "souffler sur" },
    { s: "pinces", i: "pincer" },
    { s: "martèles", i: "marteler" },
    { s: "renifles", i: "renifler" },
    { s: "bécotes", i: "bécoter" },
    { s: "effleures", i: "effleurer" },
    { s: "fasses la bise", i: "faire la bise", p: "à" },
    { s: "présentes tes respects", i: "présenter mes respects", p: "à" },
    { s: "dessines un cœur sur", i: "dessiner un cœur sur" },
    { s: "fasses des bisous papillon sur", i: "faire des bisous papillon sur" },

    /* Pimenté */
    { s: "suçotes", i: "suçoter", lvl: 2 },
    { s: "fasses un petit suçon sur", i: "faire un petit suçon sur", lvl: 2 },
    { s: "mettes un glaçon sur", i: "mettre un glaçon sur", lvl: 2 },
    { s: "frottes", i: "frotter", lvl: 2 },
    { s: "léchouilles", i: "léchouiller", lvl: 2 },
    { s: "mordilles", i: "mordiller", lvl: 2 },
    { s: "dévores", i: "dévorer", lvl: 2 },
    { s: "fesses", i: "fesser", lvl: 2 },
    { s: "roules une pelle chaude", i: "rouler une pelle chaude", p: "à", lvl: 2 },

    /* Brûlant */
    { s: "circlues", i: "circlure", lvl: 3 },
    { s: "intromettes", i: "intromettre", lvl: 3 },
    { s: "écartèles", i: "écarteler", lvl: 3 },
    { s: "attaches", i: "attacher", lvl: 3 },
    { s: "tétouilles", i: "tétouiller", lvl: 3 },
    { s: "branles", i: "branler", lvl: 3 },
    { s: "doigtes", i: "doigter", lvl: 3 },
    { s: "fasses du sale", i: "faire du sale", p: "à", lvl: 3 },
    { s: "déglingues", i: "déglinguer", lvl: 3 },
    { s: "démontes", i: "démonter", lvl: 3 },
    { s: "mordes", i: "mordre", lvl: 3 },
    { s: "saccages", i: "saccager", lvl: 3 },
    { s: "ken", i: "ken", lvl: 3 }
  ],

  objets: [
    { t: "le haut du crâne" },
    { t: "les épaules" },
    { t: "le gros orteil" },
    { t: "un ongle (au choix)" },
    { t: "la chaussette" },
    { t: "la bouche" },
    { t: "le trou de nez" },
    { t: "le coude droit" },
    { t: "l’arrière du genou" },
    { t: "le bas du dos" },
    { t: "le lobe de l’oreille" },
    { t: "le fond du nombril" },
    { t: "la nuque" },
    { t: "le dessous du pied" },
    { t: "l’annulaire" },
    { t: "le sourcil droit" },
    { t: "le petit cœur" },
    { t: "la moustache" },
    { t: "le creux rétro-auriculaire" },

    /* Pimenté */
    { t: "le boul", lvl: 2 },
    { t: "le téton gauche", lvl: 2 },
    { t: "le téton droit", lvl: 2 },
    { t: "une zone moyennement érogène", lvl: 2 },
    { t: "la commissure des lèvres", lvl: 2 },
    { t: "les poignets", lvl: 2 },
    { t: "la pointe de la langue", lvl: 2 },
    { s: "tout mon corps", i: "tout ton corps", lvl: 2 },

    /* Brûlant */
    { s: "mon sexe chaud", i: "ton sexe chaud", lvl: 3 },
    { t: "l’entrecuisse", lvl: 3 },
    { t: "la raie", lvl: 3 },
    { t: "la porte arrière", lvl: 3 },
    { t: "le pare-choc", lvl: 3 },
    { t: "l’orifice de ton choix", lvl: 3 },
    { t: "le bout du gland", lvl: 3 },
    { t: "la zone périnéale", lvl: 3 },
    { t: "le sphincter anal", lvl: 3 },
    { t: "un appendice quelconque", lvl: 3 },
    { t: "la DGSE (demi-gaule semi-exploitable)", lvl: 3 },
    { t: "l’appareil génital", lvl: 3 }
  ],

  manieres: [
    { t: "avec application" },
    { t: "en chantonnant" },
    { t: "joyeusement" },
    { t: "bien délicatement" },
    { t: "avec tant d’amour" },
    { t: "vigoureusement" },
    { t: "en toute amitié" },
    { t: "avec lenteur et délectation" },
    { t: "à la bonne franquette" },
    { t: "en sautillant" },
    { t: "en slow motion" },
    { t: "en cancanant tel le dauphin" },
    { t: "et très solennellement" },
    { t: "comme si c’était la première fois" },
    { t: "sans les mains" },
    { t: "en comptant en italien (à l’envers)" },
    { t: "avec une voix de documentaire M6" },
    { t: "et mollo mollo !" },

    /* Pimenté */
    { t: "sans vergogne", lvl: 2 },
    { t: "avec force gourmandise", lvl: 2 },
    { t: "en twerkant proprement", lvl: 2 },
    { t: "du bout des lèvres", lvl: 2 },
    { t: "en gémissant un peu", lvl: 2 },
    { t: "goulûment", lvl: 2 },
    { t: "avec la pointe d’une langue agile", lvl: 2 },
    { t: "les yeux bandés", lvl: 2 },
    { t: "en couinant", lvl: 2 },
    { t: "bien sagement", lvl: 2 },
    { t: "de ouf !", lvl: 2 },

    /* Brûlant */
    { t: "comme un·e bon·ne chien·ne", lvl: 3 },
    { t: "mode bien soumis·e", lvl: 3 },
    { t: "mode bien dominant·e", lvl: 3 },
    { s: "avec ton sexe chaud", i: "avec mon sexe chaud", lvl: 3 },
    { t: "de la pointe des tétons", lvl: 3 },
    { t: "à genoux", lvl: 3 },
    { s: "en me tirant fort les cheveux", i: "en te tirant fort les cheveux", lvl: 3 },
    { t: "comme un·e goret", lvl: 3 },
    { t: "mode sauvage", lvl: 3 },
    { t: "et que ça gicle !", lvl: 3 },
    { t: "en couinant salement", lvl: 3 }
  ]
};
