"use strict";

/* ============================================================
   ÉPOQUES — l'identité, l'incarnation, le siège.
   Ce que ces tests protègent avant tout : qu'un GN à un seul moment
   ne voie RIEN changer, et qu'un même rôle ne puisse pas être
   revendiqué par deux sièges sans que ça se dise.
   ============================================================ */
import { suite, test, eq, ok, pasOk, contient } from "./harnais.js";
import { fauxReseau, fauxMonde } from "./faux.js";
import {
  epoques, rang, roles, roleDe, incarnations,
  siegeDe, continu, comptes, anomalies, liensA, personnagesA,
  incarnationA, projeter, grapheA,
} from "../js/core/epoques.js";

const MONDE = fauxMonde({
  epoques: [
    { id: "e85", nom: "1985", ordre: 1 },
    { id: "e65", nom: "1965", ordre: 0 },
  ],
});

/* Ange joue les deux époques ; Antoine devient Daniel. */
const GN = fauxReseau({
  personnages: [
    { id: "p01", nom: "Ange 85", roleId: "r01", epoqueId: "e85" },
    { id: "p50", nom: "Ange 65", roleId: "r01", epoqueId: "e65" },
    { id: "p17", nom: "Antoine", epoqueId: "e65" },
    { id: "p13", nom: "Daniel", epoqueId: "e85" },
  ],
  liens: [
    { id: "lf", de: "p01", vers: "p13", nature: "sa fille" },
    { id: "l65", de: "p50", vers: "p17", nature: "cette nuit-là", epoqueId: "e65" },
  ],
  sieges: [
    { id: "S1", nom: "Siège 1", personnageIds: ["p50", "p01"] },
    { id: "S2", nom: "Siège 2", personnageIds: ["p17", "p13"] },
  ],
});

suite("Époques — l'ordre est déclaré, pas deviné", () => {
  test("les époques sortent triées par ordre, pas par saisie", () => {
    eq(epoques(MONDE).map((e) => e.nom).join(","), "1965,1985");
  });

  test("une époque inconnue a le rang -1", () => {
    eq(rang(MONDE, "e65"), 0);
    eq(rang(MONDE, "nexistepas"), -1);
  });

  test("un monde sans époque déclarée n'en a aucune", () => {
    eq(epoques(fauxMonde()).length, 0);
  });
});

suite("Rôles — dérivés, jamais stockés", () => {
  test("deux incarnations qui partagent un roleId sont un seul rôle", () => {
    const r = roles(GN, MONDE);
    eq(r.length, 3, "Ange compte pour un, Antoine et Daniel pour deux");
    const ange = r.find((x) => x.id === "r01");
    eq(ange.personnages.length, 2);
  });

  test("le nom du rôle est celui de la PREMIÈRE époque", () => {
    eq(roles(GN, MONDE).find((x) => x.id === "r01").nom, "Ange 65");
  });

  test("sans roleId, un personnage est son propre rôle", () => {
    eq(roleDe(GN, "p17"), "p17");
    eq(roleDe(GN, "p01"), "r01");
  });

  test("les incarnations d'un rôle sont ordonnées par époque", () => {
    eq(incarnations(GN, "r01", MONDE).map((p) => p.nom).join(" → "), "Ange 65 → Ange 85");
  });
});

suite("Sièges — déclarés, et c'est la différence", () => {
  test("un siège dont les incarnations partagent le rôle est CONTINU", () => {
    ok(continu(GN, GN.siege("S1")), "Ange vieillit");
    pasOk(continu(GN, GN.siege("S2")), "Antoine devient quelqu'un d'autre");
  });

  test("le compte des continus se calcule au lieu de s'écrire", () => {
    const c = comptes(GN);
    eq(c.sieges, 2);
    eq(c.continus, 1);
    eq(c.changements, 1);
  });

  test("on retrouve le siège d'une incarnation", () => {
    eq(siegeDe(GN, "p13").id, "S2");
    eq(siegeDe(GN, "inconnu"), null);
  });
});

suite("Invariants — les bugs qu'on veut rendre impossibles", () => {
  test("un même rôle revendiqué par deux sièges est signalé", () => {
    const r = fauxReseau({
      personnages: [
        { id: "a", nom: "Marise", epoqueId: "e65" },
        { id: "b", nom: "Line", epoqueId: "e65" },
        { id: "c", nom: "Nicole", epoqueId: "e85" },
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

  test("un siège avec deux rôles à la même époque est signalé", () => {
    const r = fauxReseau({
      personnages: [
        { id: "a", nom: "A", epoqueId: "e65" },
        { id: "b", nom: "B", epoqueId: "e65" },
      ],
      sieges: [{ id: "S1", nom: "un", personnageIds: ["a", "b"] }],
    });
    ok(anomalies(r).some((x) => x.code === "siege:epoque"), "un joueur, deux endroits");
  });

  test("un rôle avec deux incarnations à la même époque est signalé", () => {
    const r = fauxReseau({
      personnages: [
        { id: "a", nom: "Ange", roleId: "r1", epoqueId: "e65" },
        { id: "b", nom: "Ange bis", roleId: "r1", epoqueId: "e65" },
      ],
    });
    ok(anomalies(r).some((x) => x.code === "role:epoque"));
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

  test("une époque non déclarée est signalée", () => {
    const r = fauxReseau({ personnages: [{ id: "a", nom: "A", epoqueId: "e1900" }] });
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

  test("les personnages d'une époque, et ceux qui n'en ont pas", () => {
    eq(personnagesA(GN, "e65").map((p) => p.id).sort().join(","), "p17,p50");
    eq(personnagesA(GN, null).length, 4, "sans époque demandée, tout le monde");
  });
});

suite("Projection — un lien appartient au rôle, pas à l'incarnation", () => {
  test("on retrouve l'incarnation d'un rôle à une époque", () => {
    eq(incarnationA(GN, "p01", "e65").nom, "Ange 65", "depuis l'incarnation de 85");
    eq(incarnationA(GN, "p50", "e85").nom, "Ange 85", "et dans l'autre sens");
    eq(incarnationA(GN, "p17", "e85"), null, "Antoine n'existe pas en 1985");
  });

  test("un lien écrit en 1985 se lit aussi en 1965, entre les bons bouts", () => {
    // « sa fille » est un fait sur la personne : Ange-65 l'a déjà.
    const l = GN.liens().find((x) => x.id === "lf");
    eq(projeter(GN, l, "e85").de, "p01");
    eq(projeter(GN, l, "e65"), null, "…mais Daniel n'est pas né : le lien ne se projette pas");
  });

  test("un lien daté ne se projette pas hors de sa date", () => {
    const l = GN.liens().find((x) => x.id === "l65");
    ok(projeter(GN, l, "e65"), "il vit en 1965");
    eq(projeter(GN, l, "e85"), null);
  });

  test("le graphe d'une époque ne contient que ce qui y existe", () => {
    const g65 = grapheA(GN, "e65");
    eq(g65.personnages.map((p) => p.id).sort().join(","), "p17,p50");
    eq(g65.liens.length, 1, "le lien de 1965, projeté");
    eq(g65.liens[0].de, "p50");

    const g85 = grapheA(GN, "e85");
    eq(g85.personnages.map((p) => p.id).sort().join(","), "p01,p13");
    eq(g85.liens.length, 1, "« sa fille », projeté sur 1985");
  });

  test("sans époque demandée, le graphe est le réseau entier", () => {
    const g = grapheA(GN, null);
    eq(g.personnages.length, 4);
    eq(g.liens.length, 2);
  });
});

suite("Un GN mono-époque ne voit rien changer", () => {
  const simple = fauxReseau({
    personnages: [{ id: "a", nom: "A" }, { id: "b", nom: "B" }],
    liens: [{ id: "l", de: "a", vers: "b", nature: "x" }],
  });

  test("chaque personnage est son propre rôle", () => {
    eq(roles(simple).length, 2);
  });

  test("aucune anomalie, aucun siège exigé", () => {
    eq(anomalies(simple, fauxMonde()).length, 0);
  });

  test("tous les liens restent visibles", () => {
    eq(liensA(simple, "peu importe").length, 1);
  });
});
