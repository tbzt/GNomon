"use strict";

/* ============================================================
   VALMOREL — jeu d'essai.

   « Les Cendres de Valmorel » : un village de montagne, l'hiver 1912,
   trois semaines après l'avalanche. Sept personnages, trois groupes.

   Ce n'est pas une démo décorative : c'est le **fixture** sur lequel se
   vérifient les lots suivants. Il est construit pour porter des défauts
   VRAIS, ceux que la littérature nomme — sinon les validateurs se
   testeraient sur un réseau parfait, c'est-à-dire sur rien :

     · Lucie et Thomas ne sont primaires pour aucun PJ (seul un PNJ les
       compte)                                      → « personne n'est seul »
     · Marek, Joseph, Thomas n'ont aucun contact positif
                                                    → « pas que du noir »
     · Joseph et Lucie, même groupe, même point de vue moral
                                                    → « différenciation »
     · Elena déclare Marek en miroir ; Marek ne la compte que secondaire
                                                    → miroir non réciproque
     · « Le chantage au tunnel » n'a aucune conclusion et n'est pas
       marquée terminale                            → « suites »
     · trois conclusions écrites n'ont pas encore de suite
                                                    → la file « et après ? »
     · Lucie CROIT que son fils est mort de la fièvre — c'est faux, et
       trois personnes le savent                    → la divergence
     · une information n'est branchée sur aucune situation
                                                    → « branchée nulle part »

   Ne pas « réparer » ces défauts : ils sont le sujet.
   ============================================================ */

export const VALMOREL = {
  groupes: [
    { cle: "dispensaire", nom: "Le dispensaire" },
    { cle: "compagnie", nom: "La compagnie des mines" },
    { cle: "commune", nom: "La commune" },
  ],

  personnages: [
    {
      cle: "elena",
      nom: "Elena Fabre",
      role: "La doctoresse",
      pj: true,
      groupe: "dispensaire",
      fonction: "heros",
      moral: "La vérité avant la paix du village",
      desir: "Faire rouvrir l'enquête sur l'avalanche",
      besoin: "Cesser de se croire coupable",
      faiblesse: "Elle a signé le premier rapport sans le lire",
      pouvoirs: "La seule à savoir lire un relevé de charge",
      transformation: "De la culpabilité à la responsabilité",
      archetype: "La guérisseuse",
      surprise: true,
    },
    {
      cle: "marek",
      nom: "Marek Zilber",
      role: "L'ingénieur des mines",
      pj: true,
      groupe: "compagnie",
      fonction: "adversaire",
      moral: "Le village vit de la mine, pas de la vérité",
      desir: "Obtenir sa mutation avant le dégel",
      besoin: "Être absous par Elena",
      faiblesse: "Il n'a jamais su lui mentir en face",
      pouvoirs: "Il détient les relevés d'origine",
      transformation: "Avouer, ou verrouiller définitivement",
      archetype: "Le bâtisseur",
      surprise: true,
    },
    {
      cle: "augustine",
      nom: "Sœur Augustine",
      role: "L'infirmière",
      pj: true,
      groupe: "dispensaire",
      fonction: "allie",
      moral: "Le soin d'abord, le jugement après",
      desir: "Garder le dispensaire ouvert cet hiver",
      besoin: "Être crue une fois pour toutes",
      faiblesse: "Elle obéit encore au Père Corvin",
      pouvoirs: "Elle a veillé tous les blessés — elle a tout entendu",
      transformation: "Cesser d'obéir",
      archetype: "La gardienne",
      surprise: false,
    },
    {
      cle: "joseph",
      nom: "Joseph Cavaillé",
      role: "Le maire",
      pj: true,
      groupe: "commune",
      fonction: "fauxAllie",
      moral: "L'honneur du village avant tout",
      desir: "Faire signer le rachat des terrains hauts",
      besoin: "Que son beau-frère lui pardonne",
      faiblesse: "Il doit de l'argent à la compagnie",
      pouvoirs: "Il tient le registre d'état civil",
      transformation: "Choisir le village contre son intérêt",
      archetype: "Le roi",
      surprise: false,
    },
    {
      cle: "lucie",
      nom: "Lucie Roux",
      role: "La veuve",
      pj: true,
      groupe: "commune",
      fonction: "secondaire",
      moral: "L'honneur du village avant tout",
      desir: "Obtenir une tombe pour son fils",
      besoin: "Savoir comment il est mort",
      faiblesse: "Elle croit ce qu'on lui a dit",
      pouvoirs: "",
      transformation: "Cesser de croire",
      archetype: "L'endeuillée",
      surprise: false,
    },
    {
      cle: "thomas",
      nom: "Thomas Bru",
      role: "Le garde-barrière",
      pj: true,
      groupe: "compagnie",
      fonction: "secondaire",
      moral: "Chacun sa peau",
      desir: "Partir avec l'argent du silence",
      besoin: "Se sentir quelqu'un",
      faiblesse: "Il parle quand il a bu",
      pouvoirs: "Il a les clés du tunnel",
      transformation: "Parler pour rien, une fois",
      archetype: "Le passeur",
      surprise: false,
    },
    {
      cle: "corvin",
      nom: "Père Corvin",
      role: "Le curé",
      pj: false,
      groupe: "commune",
      fonction: null,
      moral: "Le secret de la confession, quoi qu'il en coûte",
      desir: "Empêcher l'exhumation",
      besoin: "",
      faiblesse: "",
      pouvoirs: "Il a confessé presque tout le village",
      transformation: "",
      archetype: "Le confesseur",
      surprise: false,
    },
  ],

  /* Liens ORIENTÉS : `de` déclare le contact, `vers` le reçoit.
     `retour` pose le sens inverse quand il existe — et il diffère
     souvent, c'est tout l'intérêt. */
  liens: [
    {
      de: "elena",
      vers: "marek",
      nature: "Anciens amants",
      tonalite: "complique",
      importance: "primaire",
      miroir: true,
      retour: { importance: "secondaire" }, // ← miroir NON réciproque, exprès
    },
    {
      de: "elena",
      vers: "augustine",
      nature: "Elle l'a formée",
      tonalite: "positif",
      importance: "primaire",
      retour: { nature: "Sa maîtresse", importance: "primaire" },
    },
    {
      de: "lucie",
      vers: "elena",
      nature: "Lui doit la vie de son fils cadet",
      tonalite: "positif",
      importance: "primaire",
      miroir: true,
      retour: { nature: "Une patiente parmi d'autres", tonalite: "neutre", importance: "confort" },
    },
    {
      de: "marek",
      vers: "joseph",
      nature: "Complices du rapport truqué",
      tonalite: "complique",
      importance: "primaire",
      retour: {},
    },
    {
      de: "marek",
      vers: "thomas",
      nature: "Il le fait chanter",
      tonalite: "negatif",
      importance: "secondaire",
      retour: { nature: "Il le tient", tonalite: "negatif", importance: "primaire", miroir: true },
    },
    {
      de: "joseph",
      vers: "lucie",
      nature: "Beau-frère",
      tonalite: "neutre",
      importance: "secondaire",
      retour: {},
    },
    {
      de: "augustine",
      vers: "corvin",
      nature: "Sa hiérarchie",
      tonalite: "negatif",
      importance: "secondaire",
      retour: { nature: "Une religieuse difficile", tonalite: "negatif", importance: "confort" },
    },
    {
      de: "thomas",
      vers: "joseph",
      nature: "Il le méprise",
      tonalite: "negatif",
      importance: "secondaire",
      retour: { nature: "Un employé", tonalite: "neutre", importance: "confort" },
    },
    {
      de: "lucie",
      vers: "corvin",
      nature: "Il l'a confessée",
      tonalite: "positif",
      importance: "secondaire",
      retour: { nature: "Il sait ce qu'elle ignore", tonalite: "complique", importance: "primaire" },
    },
    {
      de: "corvin",
      vers: "elena",
      nature: "Il la soupçonne",
      tonalite: "negatif",
      importance: "confort",
      retour: null, // Elena ne le compte pas — asymétrie assumée
    },
  ],
};

/* ── Les trames ──
   Deux fils parallèles, comme en GN : l'enquête et le rachat. Chacun a
   un porteur — le personnage (souvent PNJ) qui le tient en jeu. */
export const TRAMES = [
  {
    cle: "avalanche",
    titre: "L'avalanche",
    porteur: "corvin",
    situations: [
      {
        cle: "registre",
        titre: "L'ouverture du registre",
        pitch: "Elena exige de consulter le registre des charges. Augustine sait où il est, et sait aussi ce qu'il coûterait de le montrer.",
        pointDeVue: "elena",
        cast: ["elena", "augustine"],
        espace: "Le dispensaire",
        debut: 20,
        fin: 21,
        x: 150,
        y: 130,
        conclusions: [
          { texte: "Elena reconnaît la signature", vers: "confrontation" },
          { texte: "Le registre a disparu", vers: null },
        ],
      },
      {
        cle: "confrontation",
        titre: "La confrontation",
        pitch: "Elena met Marek devant la signature. Il peut avouer, mentir, ou retourner l'accusation contre elle — c'est elle qui a signé la première page.",
        pointDeVue: "elena",
        cast: ["elena", "marek"],
        espace: "Le dispensaire",
        debut: 21,
        fin: 22,
        x: 420,
        y: 130,
        conclusions: [
          { texte: "Marek avoue", vers: "aveu" },
          { texte: "Personne ne parle : Augustine intervient", vers: null, type: "echappatoire" },
        ],
      },
      {
        cle: "aveu",
        titre: "L'aveu",
        pitch: "Devant témoins, ce qui a été tu depuis trois semaines est dit à voix haute.",
        pointDeVue: "marek",
        cast: ["marek", "elena", "corvin"],
        espace: "L'église",
        debut: 23,
        fin: 24,
        terminale: true,
        x: 690,
        y: 130,
        conclusions: [],
      },
    ],
  },
  {
    cle: "rachat",
    titre: "Le rachat des terrains",
    porteur: "joseph",
    situations: [
      {
        cle: "negociation",
        titre: "La négociation du rachat",
        pitch: "Joseph a besoin de la signature de Marek avant minuit. Marek a besoin que personne ne relise le rapport.",
        pointDeVue: "marek",
        cast: ["marek", "joseph"],
        espace: "La mairie",
        debut: 20.5,
        fin: 22.5,
        x: 150,
        y: 130,
        conclusions: [
          { texte: "Thomas surgit et demande sa part", vers: "chantage" },
          { texte: "Lucie refuse de céder la parcelle de son fils", vers: null },
        ],
      },
      {
        cle: "chantage",
        titre: "Le chantage au tunnel",
        pitch: "Thomas a les clés, et il a bu. Il veut qu'on lui dise qu'il compte.",
        pointDeVue: "thomas",
        cast: ["thomas", "marek"],
        espace: "Le tunnel",
        debut: 21,
        fin: 21.5,
        x: 420,
        y: 130,
        conclusions: [], // cul-de-sac assumé : le validateur « suites » doit le voir
      },
    ],
  },
];

/* ── Les informations ──
   `sait` et `croit` par clé de personnage ; l'absence vaut « ignore ».
   `requise` / `produite` branchent l'information sur les situations,
   par clé — c'est ce branchement qui alimente le squelette de fiche. */
export const INFORMATIONS = [
  {
    cle: "rapport",
    contenu: "Le rapport de sécurité a été truqué avant l'avalanche",
    influence: "directe",
    sait: ["marek", "joseph", "thomas"],
    croit: {},
    requise: ["negociation"],
    produite: ["registre"],
  },
  {
    cle: "enfant",
    contenu: "Le fils de Lucie n'est pas mort de la fièvre : il était au tunnel",
    influence: "latente",
    sait: ["elena", "corvin"],
    croit: { lucie: "Son fils est mort de la fièvre, comme le docteur l'a écrit" },
    requise: [],
    produite: [],
  },
  {
    cle: "mutation",
    contenu: "Marek a demandé sa mutation il y a un mois",
    influence: "latente",
    sait: ["marek"],
    croit: { joseph: "Marek reste au village jusqu'au printemps" },
    requise: ["negociation"],
    produite: [],
  },
  {
    cle: "cles",
    contenu: "Thomas a gardé les clés du tunnel après l'accident",
    influence: "directe",
    sait: ["thomas", "marek"],
    croit: {},
    requise: ["chantage"],
    produite: [],
  },
  {
    cle: "signature",
    contenu: "C'est Elena qui a signé la première page du registre",
    influence: "directe",
    sait: ["elena", "augustine"],
    croit: {},
    requise: ["registre"],
    produite: ["confrontation"],
  },
];

/** Charge le jeu d'essai. `trames` est optionnel — le réseau seul reste
    utilisable. Ne fusionne pas : appeler `vider()` avant si besoin. */
export function chargerValmorel(reseau, trames = null, infos = null) {
  const idGroupe = {};
  for (const g of VALMOREL.groupes) idGroupe[g.cle] = reseau.creerGroupe(g.nom).id;

  const idPerso = {};
  for (const p of VALMOREL.personnages) {
    const { cle, groupe, ...champs } = p;
    idPerso[cle] = reseau.creerPersonnage({ ...champs, groupeId: idGroupe[groupe] }).id;
  }

  let nLiens = 0;
  for (const l of VALMOREL.liens) {
    const base = {
      de: idPerso[l.de],
      vers: idPerso[l.vers],
      nature: l.nature,
      tonalite: l.tonalite,
      importance: l.importance,
      miroir: !!l.miroir,
    };
    if (l.retour === null) {
      if (reseau.upsertLien(base)) nLiens++;
    } else {
      const paire = reseau.upsertPaire(base, l.retour || {});
      if (paire) nLiens += paire.filter(Boolean).length;
    }
  }

  const bilan = {
    personnages: VALMOREL.personnages.length,
    liens: nLiens,
    situations: 0,
    conclusions: 0,
    orphelines: 0,
    informations: 0,
  };
  if (!trames) return bilan;

  // Deux passes : toutes les situations d'abord, les conclusions
  // ensuite — un fil peut se relier en arrière, et une cible doit
  // exister avant qu'on pointe dessus.
  const idSit = {};
  for (const t of TRAMES) {
    const trame = trames.creerTrame({ titre: t.titre, porteurId: idPerso[t.porteur] || null });
    for (const s of t.situations) {
      const { cle, pointDeVue, cast, conclusions, ...champs } = s;
      idSit[cle] = trames.creerSituation(trame.id, {
        ...champs,
        pointDeVueId: idPerso[pointDeVue] || null,
        castIds: (cast || []).map((k) => idPerso[k]).filter(Boolean),
      }).id;
      bilan.situations++;
    }
  }
  for (const t of TRAMES)
    for (const s of t.situations)
      for (const c of s.conclusions || []) {
        const pose = trames.ajouterConclusion(idSit[s.cle], {
          texte: c.texte,
          type: c.type || "normale",
          vers: c.vers ? idSit[c.vers] : null,
        });
        if (pose) {
          bilan.conclusions++;
          if (!pose.vers) bilan.orphelines++;
        }
      }

  if (!infos) return bilan;

  for (const inf of INFORMATIONS) {
    const objet = infos.creer({ contenu: inf.contenu, influence: inf.influence });
    if (!objet) continue;
    bilan.informations++;
    for (const k of inf.sait) if (idPerso[k]) infos.poser(objet.id, idPerso[k], "sait");
    for (const [k, texte] of Object.entries(inf.croit || {}))
      if (idPerso[k]) infos.poser(objet.id, idPerso[k], "croit", texte);
    for (const k of inf.requise) if (idSit[k]) trames.lierInformation(idSit[k], objet.id, "requiert");
    for (const k of inf.produite) if (idSit[k]) trames.lierInformation(idSit[k], objet.id, "produit");
  }

  return bilan;
}
