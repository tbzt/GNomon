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

/* Un GN minuscule mais complet : une clé de chaque forme. */
const GN = () => ({
  monde: {
    titre: "Les Cendres de Valmorel",
    premisse: "Un village brûle et personne ne dit pourquoi.",
    securite: ["coupez", "referent"],
    lieux: [
      { id: "x1", nom: "Le dispensaire", note: "" },
      { id: "x2", nom: "La scierie", note: "fermée" },
    ],
  },
  reseau: {
    personnages: [
      { id: "p1", nom: "Elena", pj: true, moral: "on ne ment pas aux morts" },
      { id: "p2", nom: "Marek", pj: true, moral: "" },
    ],
    liens: [{ id: "l1", de: "p1", vers: "p2", tonalite: "positif", importance: "primaire", miroir: true }],
    groupes: [{ id: "g1", nom: "Le dispensaire" }],
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
    eqProfond(reste.d.securite, ["coupez", "referent"]);
    pasOk("lieux" in reste.d, "les lieux en sont sortis : ils ont un id");
    eq(docs.filter((d) => d.collection === "monde.lieux").length, 2);
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
    eq(decouper("reseau", { personnages: [], liens: [], groupes: [] }).length, 0);
    eq(decouper("monde", {}).length, 0, "un reste vide n'est pas un document");
    eq(decouper("reseau", null).length, 0);
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
