"use strict";

/* ============================================================
   Les calculs exacts : l'affectation, les douze règles, l'enveloppe
   d'archive, les adresses.
   ============================================================ */
import { suite, test, eq, ok, pasOk, contient } from "./harnais.js";
import { fauxReseau, fauxTrames, fauxInfos } from "./faux.js";
import { hongrois, COUTS } from "../js/core/affectation.js";
import { conscience } from "../js/core/conscience.js";
import { Archive } from "../js/core/archive.js";
import { urlSure, hote } from "../js/core/liensstore.js";

/** Optimum par force brute — la seule façon honnête de vérifier qu'un
    algorithme dit « exact » l'est vraiment. */
function forceBrute(cout) {
  const n = cout.length;
  const m = cout[0].length;
  if (n > m) return null;
  let best = Infinity;
  const rec = (i, pris, total) => {
    if (total >= best) return;
    if (i === n) {
      best = total;
      return;
    }
    for (let j = 0; j < m; j++)
      if (!pris[j]) {
        pris[j] = 1;
        rec(i + 1, pris, total + cout[i][j]);
        pris[j] = 0;
      }
  };
  rec(0, new Array(m).fill(0), 0);
  return best;
}

suite("Affectation — exacte, pas approchée", () => {
  test("3×3 : l'optimum, vérifié à la force brute", () => {
    const c = [
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ];
    eq(hongrois(c).total, forceBrute(c));
  });

  test("rectangulaire (moins de lignes que de colonnes)", () => {
    const c = [
      [7, 2, 9, 4],
      [5, 8, 1, 6],
    ];
    eq(hongrois(c).total, forceBrute(c));
  });

  test("vingt matrices aléatoires 5×5 tombent toutes juste", () => {
    for (let k = 0; k < 20; k++) {
      const c = Array.from({ length: 5 }, () =>
        Array.from({ length: 5 }, () => Math.floor(Math.random() * 30)),
      );
      eq(hongrois(c).total, forceBrute(c), `matrice aléatoire n°${k + 1}`);
    }
  });

  test("plus de candidats que de rôles : le déséquilibre reste soluble", () => {
    const r = hongrois([
      [0, 1],
      [1, 0],
      [3, 3],
      [3, 3],
    ]);
    eq(r.affectation.filter((x) => x === -1).length, 2, "deux non affectés");
    eq(r.total, 0, "et les deux affectations sont optimales");
  });

  test("le veto est évité tant que c'est possible", () => {
    // Deux candidats, deux rôles. Le premier refuse le rôle 0.
    const c = [
      [COUTS.veto, COUTS.accepte],
      [COUTS.indifferent, COUTS.adore],
    ];
    const r = hongrois(c);
    pasOk(r.affectation[0] === 0, "le veto ne doit pas être imposé");
  });

  test("… mais rendu quand il est inévitable, au lieu d'échouer", () => {
    const r = hongrois([[COUTS.veto]]);
    eq(r.affectation[0], 0, "une réponse est rendue");
    eq(r.total, COUTS.veto, "et son coût la signale");
  });

  test("matrice vide : pas de plantage", () => {
    eq(hongrois([]).total, 0);
  });
});

suite("Conscience — les douze règles", () => {
  const nu = () => ({
    reseau: fauxReseau({
      groupes: [{ id: "g1", nom: "Le groupe" }],
      personnages: [
        { id: "a", nom: "A", groupeId: "g1", moral: "Idem", role: "r", desir: "d", surprise: true },
        { id: "b", nom: "B", groupeId: "g1", moral: "Idem", role: "r", desir: "d" },
      ],
    }),
    trames: fauxTrames({ situations: [] }),
    infos: fauxInfos([]),
  });
  const regle = (st, cle) => conscience(st.reseau, st.trames, st.infos).find((r) => r.cle === cle);

  test("il y a bien douze règles, toutes nommées et sourcées", () => {
    const r = conscience(nu().reseau, nu().trames, nu().infos);
    eq(r.length, 12);
    for (const x of r) {
      ok(x.nom && x.question && x.source, `« ${x.cle} » doit porter nom, question et source`);
    }
  });

  test("« personne n'est seul » lit les liens ENTRANTS", () => {
    const st = nu();
    eq(regle(st, "seul").alertes.length, 2, "personne n'a de lien primaire entrant");
    st.reseau.liens().push({
      id: "x",
      de: "b",
      vers: "a",
      importance: "primaire",
      tonalite: "neutre",
      miroir: false,
      nature: "",
    });
    eq(regle(st, "seul").alertes.length, 1, "A est maintenant compté par B");
  });

  test("« différenciation morale » ne compare qu'à l'intérieur d'un groupe", () => {
    const st = nu();
    eq(regle(st, "differenciation").alertes.length, 1, "A et B, même groupe, même morale");
    st.reseau.personnage("b").groupeId = null;
    eq(regle(st, "differenciation").alertes.length, 0, "groupes différents : plus de comparaison");
  });

  test("« suites » ne compte pas une situation terminale", () => {
    const st = nu();
    st.trames = fauxTrames({
      situations: [{ id: "s1", titre: "Fin", terminale: true, pointDeVueId: "a" }],
    });
    eq(regle(st, "suites").alertes.length, 0);
  });

  test("les transpositions sont ÉCRITES, pas dissimulées", () => {
    const r = conscience(nu().reseau, nu().trames, nu().infos);
    const transposees = r.filter((x) => x.transpose);
    ok(transposees.length >= 2, "défection et mixité assument leur transposition");
    for (const x of transposees) ok(x.transpose.length > 40, `« ${x.cle} » doit l'expliquer`);
  });

  test("aucune règle ne renvoie de score global", () => {
    const r = conscience(nu().reseau, nu().trames, nu().infos);
    pasOk(
      r.some((x) => "score" in x || "note" in x),
      "douze compteurs, jamais une moyenne",
    );
  });
});

suite("Archive — l'enveloppe est un contrat", () => {
  const bon = { format: "gnomon-archive", version: 1, data: {} };

  test("une archive valide passe", () => {
    ok(Archive.verifier(bon).ok);
  });

  test("un fichier étranger est refusé, avec sa raison", () => {
    const v = Archive.verifier({ format: "autre-outil", version: 1, data: {} });
    pasOk(v.ok);
    contient(v.raison, "archive GNomon");
  });

  test("une version future est refusée plutôt qu'importée à moitié", () => {
    const v = Archive.verifier({ format: "gnomon-archive", version: 99, data: {} });
    pasOk(v.ok);
    contient(v.raison, "99");
  });

  test("un JSON sans données est refusé", () => {
    pasOk(Archive.verifier({ format: "gnomon-archive", version: 1 }).ok);
  });

  test("n'importe quoi ne passe pas", () => {
    pasOk(Archive.verifier(null).ok);
    pasOk(Archive.verifier("texte").ok);
  });

  test("le nom de fichier est lisible et triable", () => {
    const n = Archive.nomFichier("Les Cendres de Valmorel");
    contient(n, "les-cendres-de-valmorel");
    ok(/\d{4}-\d{2}-\d{2}\.json$/.test(n), "il finit par une date");
  });
});

suite("Adresses externes — la validation n'est pas du confort", () => {
  test("http et https passent", () => {
    ok(urlSure("https://exemple.org/a"));
    ok(urlSure("http://exemple.org"));
  });

  test("javascript: est refusé", () => {
    pasOk(urlSure("javascript:alert(1)"), "il s'exécuterait au clic");
    pasOk(urlSure("JavaScript:alert(1)"), "la casse ne doit pas suffire à passer");
  });

  test("data: et file: sont refusés", () => {
    pasOk(urlSure("data:text/html,<script>x</script>"));
    pasOk(urlSure("file:///etc/passwd"));
  });

  test("une adresse relative est refusée", () => {
    pasOk(urlSure("/local/truc"));
    pasOk(urlSure("exemple.org"));
  });

  test("l'hôte est extrait pour montrer où l'on va", () => {
    eq(hote("https://www.trello.com/b/x"), "trello.com");
    eq(hote("pas une url"), "");
  });
});
