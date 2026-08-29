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

/** Charge le jeu d'essai dans un store vide. Renvoie le nombre de
    personnages et de liens posés. Ne fusionne pas : appeler
    `store.vider()` avant si besoin. */
export function chargerValmorel(store) {
  const idGroupe = {};
  for (const g of VALMOREL.groupes) idGroupe[g.cle] = store.creerGroupe(g.nom).id;

  const idPerso = {};
  for (const p of VALMOREL.personnages) {
    const { cle, groupe, ...champs } = p;
    idPerso[cle] = store.creerPersonnage({ ...champs, groupeId: idGroupe[groupe] }).id;
  }

  let n = 0;
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
      if (store.upsertLien(base)) n++;
    } else {
      const paire = store.upsertPaire(base, l.retour || {});
      if (paire) n += paire.filter(Boolean).length;
    }
  }

  return { personnages: VALMOREL.personnages.length, liens: n };
}
