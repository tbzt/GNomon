"use strict";

/* ============================================================
   La découpe d'un GN en documents.

   La propriété qui compte : **découper puis recoudre rend le bloc de
   départ**. Si elle tombe, l'espace partagé ne rendrait pas ce qu'on
   lui a confié — et ça ne se verrait qu'après avoir synchronisé, chez
   quelqu'un d'autre, sur un GN qu'on n'a plus.

   Tout est hors ligne : aucune base, aucun compte, aucun réseau.
   ============================================================ */
import { suite, test, eq, ok, pasOk, eqProfond, eqDonnees } from "./harnais.js";
import {
  decouper,
  recoudre,
  decouperTout,
  recoudreTout,
  empreinte,
  chemin,
  depuisChemin,
  RESTE,
} from "../js/core/objets.js";
import { fusionnerBloc } from "../js/core/archive.js";

/* Un GN minuscule mais complet : une clé de chaque forme. */
const GN = () => ({
  monde: {
    titre: "Les Cendres de Valmorel",
    premisse: "Un village brûle et personne ne dit pourquoi.",
    fil: "## 1912\n\n- [FIXE] Le tunnel n'a pas cédé tout seul.",
    securite: ["coupez", "referent"],
    lieux: [
      { id: "x1", nom: "Le dispensaire", note: "" },
      { id: "x2", nom: "La scierie", note: "fermée" },
    ],
    epoques: [
      { id: "e1", nom: "1912", ordre: 0 },
      { id: "e2", nom: "1932", ordre: 1 },
    ],
    interrupteurs: [],
  },
  reseau: {
    personnages: [
      { id: "p1", nom: "Elena", pj: true, facettes: { "*": { moral: "on ne ment pas aux morts" } } },
      { id: "p2", nom: "Marek", pj: true, facettes: { "*": { moral: "" } } },
    ],
    liens: [{ id: "l1", de: "p1", vers: "p2", tonalite: "positif", importance: "primaire", miroir: true }],
    groupes: [{ id: "g1", nom: "Le dispensaire" }],
    sieges: [{ id: "S1", nom: "Siège 1", personnageIds: ["p1"] }],
  },
  trames: {
    trames: [{ id: "t1", titre: "L'incendie", porteurId: null, notes: "" }],
    situations: [{ id: "s1", trameId: "t1", titre: "L'aveu", castIds: ["p1"], debut: 23, fin: 24 }],
    conclusions: [{ id: "c1", de: "s1", vers: null, texte: "elle se tait", type: "normale" }],
  },
  informations: {
    informations: [
      { id: "i1", contenu: "le duc a menti", influence: "directe", etats: { p1: "sait" }, croyances: {} },
    ],
  },
  casting: {
    candidatures: [{ id: "k1", label: "Joueur 1", preferences: { p1: 3 }, vetos: [], arrivee: 20, depart: null, notes: "" }],
    affectation: { k1: "p1" },
    dateAffectation: "2026-08-30 14:12",
  },
  derogations: {
    "seul::p2": { justification: "il arrive au milieu du jeu", date: "2026-08-30" },
  },
  run: {
    run: { debut: 1756000000000, heureFiction: 20, pause: null, cumulPause: 0, fin: null },
    fils: { t1: { situationId: "s1", depuis: 1756000000000, statut: "actif", porteurId: null } },
    journal: [{ id: "j1", ts: 1756000000000, type: "lancement", texte: "Début du jeu", trameId: null, situationId: null }],
  },
  suivi: {
    "materiel:s1:0": { responsable: "Claire", fait: true, note: "" },
  },
  liens: [{ id: "n1", titre: "Le Drive", url: "https://exemple.org/drive", note: "", ancre: null }],
});

suite("Objets — découper un GN, et le recoudre", () => {
  test("chaque clé se recoud à l'identique", () => {
    const gn = GN();
    for (const cle of Object.keys(gn))
      eqDonnees(recoudre(cle, decouper(cle, gn[cle])), gn[cle], `la clé « ${cle} » ne revient pas`);
  });

  test("le GN entier se recoud à l'identique", () => {
    const gn = GN();
    eqDonnees(recoudreTout(decouperTout(gn)), gn);
  });

  test("l'ordre des documents n'a aucune importance", () => {
    // Une base distante rend ses enfants triés par clé, jamais dans
    // l'ordre où on les a écrits. Recoudre doit s'en moquer.
    const gn = GN();
    const melanges = decouperTout(gn).reverse();
    eqDonnees(recoudreTout(melanges), gn);
  });

  test("deux personnages font deux documents — c'est tout l'objet du lot", () => {
    const docs = decouper("reseau", GN().reseau);
    const persos = docs.filter((d) => d.collection === "reseau.personnages");
    eq(persos.length, 2);
    ok(persos[0].id !== persos[1].id, "chacun porte son identité");
    // Elena et Marek ne se croisent nulle part : deux auteurs peuvent
    // les écrire en même temps sans se marcher dessus.
    ok(
      !docs.some((d) => d.collection === "reseau" && d.id === RESTE),
      "le réseau n'a rien qui n'ait d'identité",
    );
  });

  test("ce qui n'a pas d'identité tient dans un seul document", () => {
    const docs = decouper("monde", GN().monde);
    const reste = docs.find((d) => d.id === RESTE);
    ok(reste, "le monde a un document de reste");
    eq(reste.d.titre, "Les Cendres de Valmorel");
    ok(reste.d.fil.startsWith("## 1912"), "le fil de l'histoire voyage avec le reste");
    eqProfond(reste.d.securite, ["coupez", "referent"]);
    pasOk("lieux" in reste.d, "les lieux en sont sortis : ils ont un id");
    eq(docs.filter((d) => d.collection === "monde.lieux").length, 2);
    pasOk("epoques" in reste.d, "les époques aussi : deux auteurs peuvent en écrire deux");
    eq(docs.filter((d) => d.collection === "monde.epoques").length, 2);
  });

  test("l'affectation voyage entière, jamais par candidature", () => {
    // Deux moitiés de deux castings différents ne forment pas un
    // casting : `poserAffectation` le refuse déjà en local.
    const docs = decouper("casting", GN().casting);
    const reste = docs.find((d) => d.id === RESTE);
    eqProfond(reste.d.affectation, { k1: "p1" });
    eq(docs.filter((d) => d.collection === "casting.candidatures").length, 1);
  });

  test("une carte se découpe par entrée, clé comprise", () => {
    const docs = decouper("derogations", GN().derogations);
    eq(docs.length, 1);
    eq(docs[0].id, "seul::p2", "la clé de dérogation survit telle quelle");
  });

  test("un bloc vide ne produit aucun document", () => {
    eq(decouper("reseau", { personnages: [], liens: [], groupes: [], sieges: [] }).length, 0);
    eq(decouper("monde", {}).length, 0, "un reste vide n'est pas un document");
    eq(decouper("reseau", null).length, 0);
  });
});

/* ============================================================
   L'import en mode « fusionner » : l'archive COMPLÈTE, elle n'écrase
   pas. Les blocs sont ceux du stockage — les mêmes que `decouper`
   reçoit — et rien n'est écrit : `fusionnerBloc` est pure, là où
   `Archive.appliquer` passe par le vrai `Storage`.

   La régression que ces tests ferment : un champ à `id` absent de la
   table des listes fusionnées était remplacé par la version locale en
   entier. Les sièges, lieux et époques d'une archive disparaissaient dès
   que le projet avait déjà un bloc `reseau` ou `monde`.
   ============================================================ */
suite("Archive — fusionner complète, n'écrase pas", () => {
  test("les sièges de l'archive s'ajoutent sans toucher aux locaux", () => {
    const local = GN().reseau;
    const entrant = {
      ...GN().reseau,
      sieges: [
        { id: "S1", nom: "Renommé ailleurs", personnageIds: ["p1", "p2"] },
        { id: "S2", nom: "Siège 2", personnageIds: ["p2"] },
      ],
    };
    const { bloc, ajoutes } = fusionnerBloc("reseau", local, entrant);
    eq(ajoutes, 1, "un seul siège manquait");
    eq(bloc.sieges.length, 2);
    eqDonnees(bloc.sieges[0], local.sieges[0], "le siège local n'est pas touché");
    eq(bloc.sieges[1].id, "S2", "le siège nouveau est ajouté à la suite");
    eqDonnees(bloc.personnages, local.personnages, "les autres listes non plus");
  });

  test("les lieux de l'archive s'ajoutent sans toucher aux locaux", () => {
    const local = GN().monde;
    const entrant = {
      ...GN().monde,
      titre: "Un autre titre",
      lieux: [
        { id: "x2", nom: "La scierie", note: "rouverte" },
        { id: "x3", nom: "Le tunnel", note: "" },
      ],
    };
    const { bloc, ajoutes } = fusionnerBloc("monde", local, entrant);
    eq(ajoutes, 1);
    eq(bloc.titre, "Les Cendres de Valmorel", "ce qui n'a pas d'id garde la version locale");
    eq(bloc.lieux.length, 3);
    eq(bloc.lieux[1].note, "fermée", "la scierie locale n'est pas touchée");
    eq(bloc.lieux[2].id, "x3");
  });

  test("les époques de l'archive s'ajoutent APRÈS les locales, dans leur ordre", () => {
    const local = GN().monde;
    const entrant = {
      ...GN().monde,
      epoques: [
        { id: "e9", nom: "1965", ordre: 1 },
        { id: "e1", nom: "1912 renommée", ordre: 0 },
        { id: "e8", nom: "1945", ordre: 0 },
      ],
    };
    const { bloc, ajoutes } = fusionnerBloc("monde", local, entrant);
    eq(ajoutes, 2, "e1 existait déjà");
    eqDonnees(
      bloc.epoques.map((e) => [e.id, e.ordre]),
      [["e1", 0], ["e2", 1], ["e8", 2], ["e9", 3]],
      "les nouvelles suivent les locales, 1945 avant 1965 comme dans l'archive",
    );
    eq(bloc.epoques[0].nom, "1912", "l'époque locale garde son nom");
  });

  test("un projet sans époque ni siège reçoit ceux de l'archive", () => {
    // Un GN écrit avant ces champs n'a pas les clés : elles doivent
    // apparaître, pas être considérées comme « déjà là et vides ».
    const { titre, premisse, fil, securite, lieux } = GN().monde;
    const monde = fusionnerBloc("monde", { titre, premisse, fil, securite, lieux }, GN().monde);
    eqDonnees(monde.bloc.epoques, GN().monde.epoques);
    eq(monde.ajoutes, 2);
    const { personnages, liens, groupes } = GN().reseau;
    const reseau = fusionnerBloc("reseau", { personnages, liens, groupes }, GN().reseau);
    eqDonnees(reseau.bloc.sieges, GN().reseau.sieges);
    eq(reseau.ajoutes, 1);
  });

  test("fusionner deux fois n'ajoute rien la seconde", () => {
    const une = fusionnerBloc("monde", GN().monde, { ...GN().monde, epoques: [{ id: "e3", nom: "1950", ordre: 0 }] });
    const deux = fusionnerBloc("monde", une.bloc, { ...GN().monde, epoques: [{ id: "e3", nom: "1950", ordre: 0 }] });
    eq(une.ajoutes, 1);
    eq(deux.ajoutes, 0);
    eqDonnees(deux.bloc, une.bloc);
  });
});

suite("Objets — l'empreinte et le chemin", () => {
  test("l'ordre des clés ne change pas l'empreinte", () => {
    // Sans tri, réécrire un champ suffirait à faire repousser tout le
    // GN au démarrage suivant.
    eq(empreinte({ a: 1, b: 2 }), empreinte({ b: 2, a: 1 }));
    eq(empreinte({ x: { p: 1, q: 2 } }), empreinte({ x: { q: 2, p: 1 } }));
  });

  test("une vraie différence change l'empreinte", () => {
    ok(empreinte({ a: 1 }) !== empreinte({ a: 2 }));
    ok(empreinte([1, 2]) !== empreinte([2, 1]), "un tableau garde son ordre");
    ok(empreinte(null) !== empreinte(0));
  });

  test("le chemin distant ne porte aucun caractère interdit", () => {
    // Realtime Database refuse . $ # [ ] / dans une clé.
    const gn = GN();
    for (const d of decouperTout(gn)) {
      const c = chemin(d.collection, d.id);
      const cle = c.slice(0, c.indexOf("/"));
      pasOk(/[.$#[\]]/.test(cle), `« ${cle} » porte un caractère interdit`);
    }
  });

  test("le chemin se relit", () => {
    for (const [col, id] of [
      ["reseau.personnages", "p1"],
      ["derogations", "seul::p2"],
      ["suivi", "materiel:s1:0"],
      ["monde", RESTE],
    ]) {
      const r = depuisChemin(chemin(col, id));
      eq(r.collection, col);
      eq(r.id, id);
    }
  });

  test("le nom du champ reste lisible dans le chemin", () => {
    // On regarde cette base dans la console de Firebase : un chemin
    // opaque rendrait la branche illisible à qui la dépanne.
    ok(chemin("reseau.personnages", "p1").startsWith("reseau~personnages/"));
  });
});
