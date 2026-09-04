"use strict";

/* ============================================================
   ÉPOQUES — la personne est l'unité, l'époque est une facette.
   Ce que ces tests protègent avant tout : qu'un GN à un seul moment
   ne voie RIEN changer, et qu'une personne se lise à chaque époque
   sans jamais devenir deux personnages.
   ============================================================ */
import { suite, test, eq, ok, pasOk, contient } from "./harnais.js";
import { fauxReseau, fauxMonde } from "./faux.js";
import {
  epoques, rang, ordre, roles, roleDe, incarnations,
  siegeDe, continu, comptes, anomalies, liensA, personnagesA,
  incarnationA, projeter, grapheA, roleParEpoque, epoquesDe,
} from "../js/core/epoques.js";

const MONDE = fauxMonde({
  epoques: [
    { id: "e85", nom: "1985", ordre: 1 },
    { id: "e65", nom: "1965", ordre: 0 },
  ],
});
const ORDRE = ["e65", "e85"];

/* Ange traverse les deux époques ; Antoine n'a que 1965, Daniel que 1985. */
const GN = fauxReseau({
  epoques: ORDRE,
  personnages: [
    { id: "p01", nom: "Ange Sarti", facettes: { e65: { role: "celui qui décide", moral: "juré" }, e85: { role: "le Vieux", moral: "juré" } } },
    { id: "p17", nom: "Antoine", facettes: { e65: { role: "le blessé" } } },
    { id: "p13", nom: "Daniel", facettes: { e85: { role: "le fils" } } },
  ],
  liens: [
    { id: "lf", de: "p01", vers: "p13", nature: "le fils d'Antoine" },
    { id: "l65", de: "p01", vers: "p17", nature: "cette nuit-là", epoqueId: "e65" },
  ],
  sieges: [
    { id: "S1", nom: "Siège 1", personnageIds: ["p01"] },
    { id: "S2", nom: "Siège 2", personnageIds: ["p17", "p13"] },
  ],
});

suite("Époques — l'ordre est déclaré, pas deviné", () => {
  test("les époques sortent triées par ordre, pas par saisie", () => {
    eq(epoques(MONDE).map((e) => e.nom).join(","), "1965,1985");
    eq(ordre(MONDE).join(","), "e65,e85");
  });

  test("une époque inconnue a le rang -1", () => {
    eq(rang(MONDE, "e65"), 0);
    eq(rang(MONDE, "nexistepas"), -1);
  });

  test("un monde sans époque déclarée n'en a aucune", () => {
    eq(epoques(fauxMonde()).length, 0);
  });
});

suite("La personne — une, à plusieurs époques", () => {
  test("une personne est son propre rôle, et un rôle compte pour une personne", () => {
    eq(roles(GN).length, 3, "Ange, Antoine, Daniel");
    eq(roleDe(GN, "p01"), "p01");
    eq(incarnations(GN, "p01").length, 1);
  });

  test("la vue à une époque est la facette de cette époque", () => {
    eq(GN.personnage("p01", "e65").role, "celui qui décide");
    eq(GN.personnage("p01", "e85").role, "le Vieux");
    eq(GN.personnage("p01", "e85").id, "p01", "même identifiant : c'est la même personne");
  });

  test("une personne absente d'une époque rend sa facette la plus proche, et le dit", () => {
    const v = GN.personnage("p17", "e85");
    eq(v.role, "le blessé");
    pasOk(v.presentA, "Antoine n'est pas de 1985");
    pasOk(GN.existeA("p17", "e85"));
    ok(GN.existeA("p17", "e65"));
  });

  test("ses époques se lisent dans l'ordre", () => {
    eq(epoquesDe(GN, "p01").join(","), "e65,e85");
    eq(epoquesDe(GN, "p13").join(","), "e85");
  });
});

suite("La personne, époque par époque — ce que la fiche lit", () => {
  test("une entrée par époque déclarée, dans l'ordre, avec la facette ou rien", () => {
    const l = roleParEpoque(GN, MONDE, "p01");
    eq(l.map((x) => x.epoque.nom).join(","), "1965,1985", "toutes les époques, triées");
    eq(l[0].personnage.role, "celui qui décide");
    eq(l[1].personnage.role, "le Vieux");
    eq(l[1].personnage.id, "p01");
  });

  test("une personne qui n'existe qu'à une époque a une entrée vide à l'autre", () => {
    const l = roleParEpoque(GN, MONDE, "p17");
    eq(l.length, 2);
    eq(l[0].personnage.id, "p17");
    eq(l[1].personnage, null, "Antoine n'a pas de 1985");
  });

  test("sans époque déclarée, la liste est vide : un GN mono-époque ne voit rien", () => {
    eq(roleParEpoque(GN, fauxMonde(), "p01").length, 0);
  });
});

suite("Sièges — déclarés, et c'est la différence", () => {
  test("un siège tenu par une personne à deux époques est CONTINU", () => {
    ok(continu(GN, GN.siege("S1")), "Ange vieillit");
    pasOk(continu(GN, GN.siege("S2")), "Antoine devient quelqu'un d'autre");
  });

  test("le compte des continus se calcule au lieu de s'écrire", () => {
    const c = comptes(GN);
    eq(c.sieges, 2);
    eq(c.continus, 1);
    eq(c.changements, 1);
  });

  test("on retrouve le siège d'une personne", () => {
    eq(siegeDe(GN, "p13").id, "S2");
    eq(siegeDe(GN, "inconnu"), null);
  });
});

suite("Invariants — les bugs qu'on veut rendre impossibles", () => {
  test("une même personne revendiquée par deux sièges est signalée", () => {
    const r = fauxReseau({
      epoques: ORDRE,
      personnages: [
        { id: "a", nom: "Marise", facettes: { e65: {} } },
        { id: "b", nom: "Line", facettes: { e65: {} } },
        { id: "c", nom: "Nicole", facettes: { e85: {} } },
      ],
      sieges: [
        { id: "S1", nom: "un", personnageIds: ["a", "c"] },
        { id: "S2", nom: "deux", personnageIds: ["b", "c"] },
      ],
    });
    const a = anomalies(r);
    ok(a.some((x) => x.code === "siege:double"), "Nicole est dans deux sièges");
    contient(a.find((x) => x.code === "siege:double").message, "Nicole");
  });

  test("un siège avec deux personnes à la même époque est signalé", () => {
    const r = fauxReseau({
      epoques: ORDRE,
      personnages: [
        { id: "a", nom: "A", facettes: { e65: {} } },
        { id: "b", nom: "B", facettes: { e65: {} } },
      ],
      sieges: [{ id: "S1", nom: "un", personnageIds: ["a", "b"] }],
    });
    ok(anomalies(r).some((x) => x.code === "siege:epoque"), "un joueur, deux endroits");
  });

  test("un PJ sans siège est signalé — mais seulement si le casting a commencé", () => {
    const sans = fauxReseau({ personnages: [{ id: "a", nom: "A" }] });
    eq(anomalies(sans).length, 0, "aucun siège : le GN n'est pas casté, on ne reproche rien");

    const avec = fauxReseau({
      personnages: [{ id: "a", nom: "A" }, { id: "b", nom: "B" }],
      sieges: [{ id: "S1", nom: "un", personnageIds: ["a"] }],
    });
    ok(avec && anomalies(avec).some((x) => x.code === "siege:orphelin"));
  });

  test("une facette à une époque non déclarée est signalée", () => {
    const r = fauxReseau({ epoques: ORDRE, personnages: [{ id: "a", nom: "A", facettes: { e1900: {} } }] });
    ok(anomalies(r, MONDE).some((x) => x.code === "epoque:inconnue"));
  });

  test("le GN bien formé ne produit aucune anomalie", () => {
    eq(anomalies(GN, MONDE).length, 0);
  });
});

suite("Liens — sans date, ils valent partout", () => {
  test("un lien sans époque se lit aux deux époques", () => {
    ok(liensA(GN, "e65").some((l) => l.id === "lf"), "la parenté n'a pas de date");
    ok(liensA(GN, "e85").some((l) => l.id === "lf"));
  });

  test("un lien daté ne se lit qu'à son époque", () => {
    ok(liensA(GN, "e65").some((l) => l.id === "l65"));
    pasOk(liensA(GN, "e85").some((l) => l.id === "l65"));
  });

  test("les personnes d'une époque, et tout le monde sans époque", () => {
    eq(personnagesA(GN, "e65").map((p) => p.id).sort().join(","), "p01,p17");
    eq(personnagesA(GN, null).length, 3, "sans époque demandée, tout le monde");
  });
});

suite("Lecture d'un lien à une époque", () => {
  test("on retrouve la personne à une époque, ou rien", () => {
    eq(incarnationA(GN, "p01", "e65").role, "celui qui décide");
    eq(incarnationA(GN, "p17", "e85"), null, "Antoine n'existe pas en 1985");
  });

  test("un lien sans date se lit là où ses deux bouts existent", () => {
    const l = GN.liens().find((x) => x.id === "lf");
    eq(projeter(GN, l, "e85").de, "p01");
    eq(projeter(GN, l, "e65"), null, "Daniel n'est pas né : le lien ne se lit pas en 1965");
  });

  test("un lien daté ne se lit pas hors de sa date", () => {
    const l = GN.liensBruts().find((x) => x.id === "l65");
    ok(projeter(GN, l, "e65"), "il vit en 1965");
    eq(projeter(GN, l, "e85"), null);
  });

  test("le graphe d'une époque ne contient que ce qui y existe", () => {
    const g65 = grapheA(GN, "e65");
    eq(g65.personnages.map((p) => p.id).sort().join(","), "p01,p17");
    eq(g65.liens.length, 1, "le lien de 1965");
    eq(g65.liens[0].de, "p01");

    const g85 = grapheA(GN, "e85");
    eq(g85.personnages.map((p) => p.id).sort().join(","), "p01,p13");
    eq(g85.liens.length, 1, "« le fils d'Antoine », lisible en 1985");
  });

  test("sans époque demandée, le graphe est le réseau entier", () => {
    const g = grapheA(GN, null);
    eq(g.personnages.length, 3);
    eq(g.liens.length, 2);
  });
});

suite("Un GN mono-époque ne voit rien changer", () => {
  const simple = fauxReseau({
    personnages: [{ id: "a", nom: "A" }, { id: "b", nom: "B" }],
    liens: [{ id: "l", de: "a", vers: "b", nature: "x" }],
  });

  test("chaque personne est son propre rôle", () => {
    eq(roles(simple).length, 2);
  });

  test("aucune anomalie, aucun siège exigé", () => {
    eq(anomalies(simple, fauxMonde()).length, 0);
  });

  test("tous les liens restent visibles", () => {
    eq(liensA(simple, "peu importe").length, 1);
  });
});
