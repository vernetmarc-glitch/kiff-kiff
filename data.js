/* Kiff Kiff — contenu des roues, avec niveau de piment.
 *
 * lvl : 1 tendre, 2 pimenté, 3 brûlant (absent = 1). Un niveau montre aussi tout ce qui est en dessous.
 * dc : 1 pour un mot décalé (pour rire) ; le brocoli des roues les enlève, pour ne garder que le premier degré.
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
    { n: 1, nom: "Tendre", desc: "Des frissons, des bisous, ça se chauffe tranquille." },
    { n: 2, nom: "Pimenté", desc: "Ça monte : on mordille, on fesse un peu, la tension monte." },
    { n: 3, nom: "Brûlant", desc: "Du bon cochon, entre adultes qui en ont envie." }
  ],

  actions: [
    { s: "gratouilles", i: "gratouiller" },
    { s: "caresses", i: "caresser" },
    { s: "fasses gouzi-gouzi", i: "faire gouzi-gouzi", p: "à", dc: 1 },
    { s: "titilles", i: "titiller" },
    { s: "fasses rien du tout", i: "faire rien du tout", p: "à", dc: 1 },
    { s: "masses", i: "masser" },
    { s: "souffles sur", i: "souffler sur" },
    { s: "pinces", i: "pincer" },
    { s: "martèles", i: "marteler", dc: 1 },
    { s: "renifles", i: "renifler", dc: 1 },
    { s: "bécotes", i: "bécoter" },
    { s: "effleures", i: "effleurer" },
    { s: "fasses un bécot", i: "faire un bécot", p: "à" },
    { s: "présentes tes respects", i: "présenter mes respects", p: "à", dc: 1 },
    { s: "dessines un cœur sur", i: "dessiner un cœur sur", dc: 1 },
    { s: "fasses des bisous papillon sur", i: "faire des bisous papillon sur" },

    /* Pimenté */
    { s: "suçotes", i: "suçoter", lvl: 2 },
    { s: "fasses un gros suçon sur", i: "faire un gros suçon sur", lvl: 2 },
    { s: "colles un glaçon sur", i: "coller un glaçon sur", lvl: 2 },
    { s: "frottes", i: "frotter", lvl: 2 },
    { s: "léchouilles", i: "léchouiller", lvl: 2 },
    { s: "mordilles", i: "mordiller", lvl: 2 },
    { s: "dévores", i: "dévorer", lvl: 2 },
    { s: "fesses", i: "fesser", lvl: 2 },
    { s: "roules une pelle chaude", i: "rouler une pelle chaude", p: "à", lvl: 2 },

    /* Brûlant */
    { s: "circlues", i: "circlure", lvl: 3, dc: 1 },
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
    { t: "le gros orteil", dc: 1 },
    { t: "un ongle (au choix)", dc: 1 },
    { t: "la chaussette", dc: 1 },
    { t: "la bouche" },
    { t: "le trou de nez", dc: 1 },
    { t: "le coude droit", dc: 1 },
    { t: "l’arrière du genou" },
    { t: "le bas du dos" },
    { t: "le lobe de l’oreille" },
    { t: "le fond du nombril" },
    { t: "la nuque" },
    { t: "le dessous du pied" },
    { t: "l’annulaire", dc: 1 },
    { t: "le sourcil droit", dc: 1 },
    { s: "mon petit cœur", i: "ton petit cœur" },
    { t: "la moustache", dc: 1 },
    { t: "le creux rétro-auriculaire", dc: 1 },

    /* Pimenté */
    { t: "le boul", lvl: 2 },
    { t: "le téton gauche", lvl: 2 },
    { t: "une zone moyennement érogène", lvl: 2, dc: 1 },
    { t: "la commissure des lèvres", lvl: 2 },
    { t: "les poignets", lvl: 2 },
    { t: "la pointe de la langue", lvl: 2 },
    { t: "les poils pubiens", lvl: 2 },
    { s: "tout mon corps", i: "tout ton corps", lvl: 2 },

    /* Brûlant */
    { s: "mon sexe chaud", i: "ton sexe chaud", lvl: 3 },
    { t: "l’entrecuisse", lvl: 3 },
    { t: "la raie", lvl: 3 },
    { t: "la porte arrière", lvl: 3, dc: 1 },
    { t: "le pare-choc", lvl: 3, dc: 1 },
    { t: "l’orifice de ton choix", lvl: 3, dc: 1 },
    { t: "le bout du gland", lvl: 3 },
    { t: "la zone périnéale", lvl: 3 },
    { t: "le sphincter anal", lvl: 3 },
    { t: "un appendice quelconque", lvl: 3, dc: 1 },
    { t: "la DGSE (demi-gaule semi-exploitable)", lvl: 3, dc: 1 },
    { t: "l’appareil génital", lvl: 3 }
  ],

  manieres: [
    { t: "avec application" },
    { t: "en chantonnant", dc: 1 },
    { t: "joyeusement" },
    { t: "tout délicatement" },
    { t: "avec tant d’amour" },
    { t: "vigoureusement" },
    { t: "en toute amitié" },
    { t: "avec lenteur et délectation" },
    { t: "à la bonne franquette", dc: 1 },
    { t: "en sautillant", dc: 1 },
    { t: "en slow motion" },
    { t: "en cancanant tel le dauphin", dc: 1 },
    { t: "et très solennellement", dc: 1 },
    { t: "comme si c’était la première fois" },
    { t: "sans les mains" },
    { t: "en comptant en italien (à l’envers)", dc: 1 },
    { t: "avec une voix de documentaire M6", dc: 1 },
    { t: "mais mollo mollo !" },

    /* Pimenté */
    { t: "sans vergogne", lvl: 2 },
    { t: "avec force gourmandise", lvl: 2 },
    { t: "en twerkant", lvl: 2, dc: 1 },
    { t: "du bout des lèvres", lvl: 2 },
    { t: "en gémissant un peu", lvl: 2 },
    { t: "goulûment", lvl: 2 },
    { t: "avec la pointe d’une langue agile", lvl: 2 },
    { t: "les yeux bandés", lvl: 2 },
    { t: "en couinant", lvl: 2, dc: 1 },
    { t: "bien sagement", lvl: 2 },
    { t: "de ouf !", lvl: 2 },

    /* Brûlant */
    { t: "comme un·e bon·ne chien·ne", lvl: 3 },
    { t: "mode bien soumis·e", lvl: 3 },
    { t: "en mode dominateur·rice", lvl: 3 },
    { s: "avec ton sexe chaud", i: "avec mon sexe chaud", lvl: 3 },
    { t: "de la pointe des tétons", lvl: 3 },
    { t: "à genoux", lvl: 3 },
    { s: "en me tirant bien fort les cheveux", i: "en te tirant bien fort les cheveux", lvl: 3 },
    { t: "comme un·e goret", lvl: 3, dc: 1 },
    { t: "mode sauvage", lvl: 3 },
    { t: "et que ça gicle !", lvl: 3 },
    { t: "en couinant salement", lvl: 3 }
  ]
};

/* Le classement d’origine (mots décalés compris), gardé à part : les mots reçus de l’atelier
   peuvent remplacer ROUE_DATA (config.js) ; l’atelier propose les mots décalés à partir d’ici. */
window.ROUE_BASE = JSON.parse(JSON.stringify(window.ROUE_DATA));
