"use strict";

/* ============================================================
   Les calculs qui portent le modèle : couverture, défection,
   temps, besoins.
   ============================================================ */
import { suite, test, eq, ok, pasOk, contient } from "./harnais.js";
import { fauxReseau, fauxTrames, fauxInfos, fauxMonde, fauxSuivi } from "./faux.js";
import { couverture, scoreCouverture } from "../js/core/couverture.js";
import { defection, classementFragilite } from "../js/core/defection.js";
import { frise, heure, pic } from "../js/core/temps.js";
import { besoins, besoinsMarkdown } from "../js/core/besoins.js";

const trouve = (c, cle) => c.find((x) => x.cle === cle);

suite("Couverture — les neuf composantes", () => {
  test("un personnage nu ne couvre rien, ou presque", () => {
    const r = fauxReseau({ personnages: [{ id: "a", nom: "A", role: "" }] });
    eq(scoreCouverture(r, "a").couvert, 0);
  });

  test("« contact positif » se lit sur les liens SORTANTS", () => {
    // B est positif envers A, mais A ne déclare rien : A n'est pas couvert.
    const r = fauxReseau({
      personnages: [{ id: "a", nom: "A" }, { id: "b", nom: "B" }],
      liens: [{ de: "b", vers: "a", tonalite: "positif" }],
    });
    pasOk(trouve(couverture(r, "a"), "positif").ok, "A ne déclare aucun contact positif");
    ok(trouve(couverture(r, "b"), "positif").ok, "B, lui, en déclare un");
  });

  test("le miroir est celui qu'on déclare, pas celui qu'on reçoit", () => {
    const r = fauxReseau({
      personnages: [{ id: "a", nom: "A" }, { id: "b", nom: "B" }],
      liens: [{ de: "a", vers: "b", miroir: true }],
    });
    ok(trouve(couverture(r, "a"), "miroir").ok);
    pasOk(trouve(couverture(r, "b"), "miroir").ok, "recevoir un miroir ne suffit pas");
  });

  test("le conflit se lit dans les DEUX sens", () => {
    const r = fauxReseau({
      personnages: [{ id: "a", nom: "A" }, { id: "b", nom: "B" }],
      liens: [{ de: "b", vers: "a", tonalite: "negatif" }],
    });
    ok(trouve(couverture(r, "a"), "conflit").ok, "être détesté est un conflit");
  });

  test("chaque composante manquante dit POURQUOI", () => {
    const r = fauxReseau({ personnages: [{ id: "a", nom: "A" }] });
    for (const c of couverture(r, "a"))
      if (!c.ok) ok(c.manque && c.manque.length > 30, `« ${c.nom} » doit expliquer son absence`);
  });
});

suite("Défection — et s'il ne vient pas ?", () => {
  const st = () => ({
    reseau: fauxReseau({
      personnages: [
        { id: "a", nom: "A" },
        { id: "b", nom: "B" },
        { id: "c", nom: "C" },
      ],
      liens: [{ de: "b", vers: "a", miroir: true }],
    }),
    trames: fauxTrames({
      situations: [
        { id: "s1", titre: "Sienne", pointDeVueId: "a", castIds: ["a", "b"] },
        { id: "s2", titre: "Partagee", pointDeVueId: "c", castIds: ["c", "a"] },
        { id: "s3", titre: "Sans lui", pointDeVueId: "c", castIds: ["c", "b"] },
      ],
    }),
    infos: fauxInfos([{ id: "i1", contenu: "Le secret", etats: { a: "sait" } }]),
  });

  test("une scène dont il est le point de vue devient orpheline", () => {
    const d = defection("a", st());
    eq(d.orphelines.length, 1);
    eq(d.orphelines[0].titre, "Sienne");
  });

  test("une scène où il figure est fragilisée, pas perdue", () => {
    const d = defection("a", st());
    eq(d.fragilisees.length, 1);
    eq(d.fragilisees[0].titre, "Partagee");
    pasOk(d.fragilisees[0].morte, "C reste : la scène tient");
  });

  test("une scène qui perd son dernier joueur est morte", () => {
    const s = st();
    s.trames.situation("s2").castIds = ["a"];
    eq(defection("a", s).fragilisees[0].morte, true);
  });

  test("celui qui l'avait pour miroir le perd", () => {
    const d = defection("a", st());
    eq(d.miroirsPerdus.length, 1);
    eq(d.miroirsPerdus[0].nom, "B");
  });

  test("une information dont il est le SEUL porteur devient orpheline", () => {
    const d = defection("a", st());
    eq(d.informationsOrphelines.length, 1);
    contient(d.informationsOrphelines[0].contenu, "Le secret");
  });

  test("… mais pas si quelqu'un d'autre la sait aussi", () => {
    const s = st();
    s.infos.information("i1").etats.b = "sait";
    eq(defection("a", s).informationsOrphelines.length, 0);
  });

  test("le classement met le plus coûteux en tête", () => {
    const c = classementFragilite(st());
    eq(c[0].personnage.id, "a");
  });

  test("quelqu'un dont l'absence ne casse rien n'y figure pas", () => {
    const s = st();
    const c = classementFragilite(s);
    pasOk(c.some((x) => x.personnage.id === "b"), "B ne casse rien");
  });
});

suite("Temps — l'erreur et le besoin ne se confondent pas", () => {
  const st = (pj) => ({
    reseau: fauxReseau({ personnages: [{ id: "x", nom: "X", pj }] }),
    trames: fauxTrames({
      situations: [
        { id: "s1", titre: "Une", castIds: ["x"], debut: 20, fin: 22 },
        { id: "s2", titre: "Deux", castIds: ["x"], debut: 21, fin: 23 },
      ],
    }),
  });

  test("deux scènes simultanées pour un PJ : une ERREUR", () => {
    const f = frise(st(true).reseau, st(true).trames);
    eq(f.erreurs.length, 1);
    eq(f.besoins.length, 0);
  });

  test("les mêmes pour un PNJ : un BESOIN, pas une erreur", () => {
    const s = st(false);
    const f = frise(s.reseau, s.trames);
    eq(f.erreurs.length, 0, "aucune erreur pour un PNJ");
    eq(f.besoins.length, 1);
    eq(f.besoins[0].comediens, 2);
  });

  test("une situation sans horaire n'est pas une erreur, elle est à part", () => {
    const s = st(true);
    s.trames.situations().push({
      id: "s3",
      titre: "Sans heure",
      castIds: ["x"],
      debut: null,
      fin: null,
      trameId: null,
      pointDeVueId: null,
      requiertIds: [],
      produitIds: [],
    });
    const f = frise(s.reseau, s.trames);
    eq(f.sansHoraire.length, 1);
    eq(f.erreurs.length, 1, "toujours une seule erreur");
  });

  /* La régression que le lot corrige : l'ancien calcul comptait, pour
     chaque situation, combien d'autres la chevauchent — le degré du
     nœud dans le graphe de chevauchement, qui MAJORE le maximum. Trois
     scènes en chaîne se chevauchent deux à deux sans jamais coexister
     toutes les trois. */
  test("trois scènes en chaîne ne font pas trois comédiens", () => {
    const s = {
      reseau: fauxReseau({ personnages: [{ id: "n", nom: "Le Passeur", pj: false }] }),
      trames: fauxTrames({
        situations: [
          { id: "a", titre: "A", castIds: ["n"], debut: 20, fin: 22 },
          { id: "b", titre: "B", castIds: ["n"], debut: 21, fin: 23 },
          { id: "c", titre: "C", castIds: ["n"], debut: 22.5, fin: 24 },
        ],
      }),
    };
    // A∩B = 21-22 · B∩C = 22h30-23 · A∩C = ∅ → deux, jamais trois.
    eq(frise(s.reseau, s.trames).besoins[0].comediens, 2);
  });

  test("le pic se lit à l'instant, pas au chevauchement deux à deux", () => {
    // Trois scènes qui, elles, coexistent vraiment à 21h30.
    eq(
      pic([
        { debut: 21, fin: 23 },
        { debut: 21.5, fin: 22 },
        { debut: 20, fin: 24 },
      ]).comediens,
      3,
    );
    // Une situation sans horaire ne compte pas : elle n'est pas plaçable.
    eq(pic([{ debut: null, fin: null }, { debut: 20, fin: 21 }]).comediens, 1);
    eq(pic([]).comediens, 0, "rien de daté, aucun besoin déduit");
  });

  test("l'heure passe minuit sans reculer", () => {
    eq(heure(24.5), "00h30");
    eq(heure(21), "21h");
  });
});

suite("Besoins — dérivés, jamais stockés", () => {
  const st = () => ({
    reseau: fauxReseau({
      personnages: [
        { id: "a", nom: "A", desir: "x", background: "y", portrait: "p" },
        { id: "n", nom: "N", pj: false },
      ],
    }),
    trames: fauxTrames({
      situations: [
        {
          id: "s1",
          titre: "Scene",
          castIds: ["n"],
          debut: 20,
          fin: 21,
          espace: "La mairie",
          materiel: "Un registre\nUne lampe",
          miseEnScene: "Vider la piece",
          regles: "Rien",
          joueurParticulier: "Sans peur du noir",
        },
      ],
    }),
    monde: fauxMonde({ contexte: "c", intention: "i", avertissements: "a" }),
  });

  test("un champ libre se découpe en items cochables", () => {
    const g = besoins(st()).find((x) => x.categorie === "materiel");
    eq(g.besoins.length, 2, "« Un registre / Une lampe » fait deux besoins");
  });

  test("chaque besoin porte son contexte", () => {
    const b = besoins(st()).find((x) => x.categorie === "materiel").besoins[0];
    eq(b.source, "Scene");
    eq(b.ou, "La mairie");
    eq(b.quand, "20h → 21h");
  });

  test("la clé est stable : elle dérive de la source", () => {
    const a = besoins(st()).find((x) => x.categorie === "materiel").besoins[0].cle;
    const b = besoins(st()).find((x) => x.categorie === "materiel").besoins[0].cle;
    eq(a, b, "deux calculs donnent la même clé");
    ok(a.startsWith("materiel:s1:"), "et elle nomme sa source");
  });

  test("changer le texte source change le besoin", () => {
    const s = st();
    s.trames.situation("s1").materiel = "Une bougie";
    const g = besoins(s).find((x) => x.categorie === "materiel");
    eq(g.besoins.length, 1);
    eq(g.besoins[0].quoi, "Une bougie");
  });

  test("un document fini ne produit pas de besoin", () => {
    const g = besoins(st()).find((x) => x.categorie === "ecriture");
    pasOk(
      g && g.besoins.some((b) => b.cle === "portrait:a"),
      "A a son portrait : rien à produire",
    );
  });

  test("l'export markdown coche ce qui est fait et nomme le responsable", () => {
    const s = st();
    const cle = besoins(s).find((x) => x.categorie === "materiel").besoins[0].cle;
    const md = besoinsMarkdown(s, fauxSuivi({ [cle]: { fait: true, responsable: "Claire" } }));
    contient(md, "- [x] Un registre");
    contient(md, "(Claire)");
  });
});
