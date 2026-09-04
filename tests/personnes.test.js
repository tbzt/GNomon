"use strict";

/* ============================================================
   PERSONNES — la vue par facette, et la conversion des incarnations.
   La conversion est le test le plus important de ce fichier : elle
   fait passer un GN écrit avec l'ancien modèle, et elle est portée en
   Python pour convertir un fichier hors de l'outil. Les deux ports se
   vérifient sur ces cas.
   ============================================================ */
import { suite, test, eq, ok, pasOk, eqDonnees } from "./harnais.js";
import { vue, existeA, cleFacette, separer, personneDepuisPlat, convertirIncarnations, TOUTES } from "../js/core/personnes.js";

const ORDRE = ["e65", "e85"];

/* Un GN de l'ancien modèle : Ange en deux incarnations, Antoine seul en 65. */
const ANCIEN = () => ({
  reseau: {
    personnages: [
      { id: "p01", nom: "Ange Sarti", pj: true, roleId: "r01", epoqueId: "e85", role: "le Vieux", moral: "juré", portrait: "", objectifs: ["Donner un chiffre"] },
      { id: "p50", nom: "Ange Sarti", pj: true, roleId: "r01", epoqueId: "e65", role: "celui qui décide", moral: "juré", portrait: "data:image/png;base64,x", objectifs: ["Empêcher le partage"] },
      { id: "p17", nom: "Antoine", pj: true, epoqueId: "e65", role: "le blessé" },
      { id: "p13", nom: "Daniel", pj: true, epoqueId: "e85", role: "le fils" },
    ],
    liens: [
      { id: "l1", de: "p01", vers: "p13", nature: "le fils", tonalite: "positif", importance: "primaire", miroir: false, epoqueId: "e85" },
      { id: "l2", de: "p50", vers: "p17", nature: "cette nuit", tonalite: "complique", importance: "primaire", miroir: false, epoqueId: "e65" },
      { id: "l3", de: "p17", vers: "p50", nature: "il décide", tonalite: "neutre", importance: "secondaire", miroir: false, epoqueId: "e65" },
    ],
    groupes: [{ id: "g1", nom: "La maison" }],
    sieges: [
      { id: "S1", nom: "Ange", personnageIds: ["p50", "p01"] },
      { id: "S2", nom: "Antoine puis Daniel", personnageIds: ["p17", "p13"] },
    ],
  },
  trames: {
    trames: [
      { id: "t0", titre: "1965", porteurId: "p50", notes: "" },
      { id: "t1", titre: "Le mariage", porteurId: "p01", notes: "" },
    ],
    situations: [
      { id: "s1", trameId: "t0", titre: "La planque", castIds: ["p01", "p17"], pointDeVueId: "p50" },
      { id: "s2", trameId: "t1", titre: "La file", castIds: ["p01", "p13"], pointDeVueId: "p01" },
    ],
    conclusions: [],
  },
  informations: {
    informations: [
      { id: "i1", contenu: "le sac est chez Ange", etats: { p01: "sait", p50: "croit", p13: "croit" }, croyances: { p50: "parti avec le Chat", p13: "les flics l'ont" } },
      { id: "i2", contenu: "Antoine a saigné", etats: { p50: "sait" }, croyances: {} },
    ],
  },
  casting: {
    candidatures: [{ id: "k1", label: "J1", preferences: { p50: 3, p01: 2 }, vetos: ["p17"] }],
    affectation: { k1: "p50" },
  },
  derogations: { "seul::p50": { justification: "x", date: "d" }, "differenciation::p50+p17": { justification: "y", date: "d" } },
  monde: { interrupteurs: [{ id: "k", question: "?", defaut: "", note: "", toucheIds: ["p50", "p01"] }] },
});

suite("Personnes — la vue par facette", () => {
  test("la vue est la facette de l'époque, fondue sur la personne", () => {
    const p = { id: "a", nom: "A", pj: true, facettes: { e65: { role: "jeune" }, e85: { role: "vieux" } } };
    eq(vue(p, "e65", ORDRE).role, "jeune");
    eq(vue(p, "e85", ORDRE).role, "vieux");
    eq(vue(p, "e85", ORDRE).nom, "A");
    eq(vue(p, "e85", ORDRE).objectifs.length, 0, "un champ absent reprend son défaut");
  });

  test("sans époque demandée, la dernière connue ; « * » vaut partout", () => {
    const p = { id: "a", nom: "A", facettes: { e65: { role: "jeune" }, e85: { role: "vieux" } } };
    eq(cleFacette(p, null, ORDRE), "e85");
    const q = { id: "b", nom: "B", facettes: { "*": { role: "seul" } } };
    eq(cleFacette(q, "e65", ORDRE), TOUTES);
    ok(existeA(q, "e65") && existeA(q, "e85"));
  });

  test("une époque absente rend la facette d'avant, et le dit", () => {
    const p = { id: "a", nom: "A", facettes: { e65: { role: "jeune" } } };
    const v = vue(p, "e85", ORDRE);
    eq(v.role, "jeune");
    pasOk(v.presentA);
    pasOk(existeA(p, "e85"));
  });

  test("un patch plat se sépare entre le commun et la facette", () => {
    const { commun, facette } = separer({ nom: "N", portrait: "p", moral: "m", objectifs: ["o"], id: "x" });
    eqDonnees(commun, { nom: "N", portrait: "p" });
    eqDonnees(facette, { moral: "m", objectifs: ["o"] });
  });

  test("un personnage plat devient une personne à une facette", () => {
    const p = personneDepuisPlat({ id: "a", nom: "A", pj: false, moral: "m", epoqueId: "e65", roleId: "r" });
    eq(Object.keys(p.facettes).join(), "e65");
    eq(p.facettes.e65.moral, "m");
    eq(p.pj, false);
    eq(p.roleId, undefined);
  });
});

suite("Personnes — la conversion des incarnations", () => {
  const conv = () => convertirIncarnations(ANCIEN(), ORDRE);

  test("deux incarnations d'un rôle font une personne à deux facettes", () => {
    const r = conv();
    eq(r.reseau.personnages.length, 3, "Ange, Antoine, Daniel");
    const ange = r.reseau.personnages.find((p) => p.id === "p01");
    ok(ange, "l'identifiant le plus référencé est gardé — celui des scènes");
    eq(ange.facettes.e65.role, "celui qui décide");
    eq(ange.facettes.e85.role, "le Vieux");
    eq(ange.portrait, "data:image/png;base64,x", "le portrait vient de l'incarnation qui en avait un");
    eq(r.fusions, 1);
    eq(r.correspondance.p50, "p01");
  });

  test("un GN mono-époque devient des personnes à facette « * », et rien d'autre", () => {
    const r = convertirIncarnations({ reseau: { personnages: [{ id: "a", nom: "A", moral: "m" }], liens: [], sieges: [] } }, []);
    eq(Object.keys(r.reseau.personnages[0].facettes).join(), "*");
    eq(r.reseau.personnages[0].facettes["*"].moral, "m");
    eq(r.fusions, 0);
  });

  test("une conversion déjà faite ne bouge rien", () => {
    const r = conv();
    const deux = convertirIncarnations(r, ORDRE);
    eqDonnees(deux.reseau, r.reseau);
    eq(deux.fusions, 0);
  });

  test("les liens sont ramenés sur la personne, sans doublon ni boucle", () => {
    const r = conv();
    const l2 = r.reseau.liens.find((l) => l.id === "l2");
    eq(l2.de, "p01");
    eq(l2.epoqueId, "e65", "et il garde sa date");
    eq(r.reseau.liens.find((l) => l.id === "l3").vers, "p01");
  });

  test("un siège ne tient la même personne qu'une fois", () => {
    const r = conv();
    eq(r.reseau.sieges.find((s) => s.id === "S1").personnageIds.join(), "p01");
    eq(r.reseau.sieges.find((s) => s.id === "S2").personnageIds.join(), "p17,p13");
  });

  test("la trame reçoit l'époque que son casting dit sans ambiguïté", () => {
    const r = conv();
    eq(r.trames.trames.find((t) => t.id === "t0").epoqueId, "e65", "Antoine n'existe qu'en 65");
    eq(r.trames.trames.find((t) => t.id === "t1").epoqueId, "e85", "Daniel n'existe qu'en 85");
    eq(r.trames.trames.find((t) => t.id === "t0").porteurId, "p01");
    eq(r.trames.situations.find((s) => s.id === "s1").pointDeVueId, "p01");
    eq(r.trames.situations.find((s) => s.id === "s1").castIds.join(), "p01,p17");
  });

  test("un savoir qui diffère entre les deux époques devient une exception datée", () => {
    const r = conv();
    const i1 = r.informations.informations.find((i) => i.id === "i1");
    eq(i1.etats.p01, "sait", "la dernière époque est la base");
    eq(i1.etatsParEpoque.e65.p01, "croit", "en 1965, il croyait autre chose");
    eq(i1.croyancesParEpoque.e65.p01, "parti avec le Chat");
    eq(i1.etats.p13, "croit");
    const i2 = r.informations.informations.find((i) => i.id === "i2");
    eq(i2.etats.p01, "sait", "su par la seule incarnation qui le savait : su par la personne");
    eq(Object.keys(i2.etatsParEpoque).length, 0);
  });

  test("le casting et les dérogations nomment la personne", () => {
    const r = conv();
    eq(r.casting.affectation.k1, "p01");
    eq(r.casting.candidatures[0].preferences.p01, 3, "le vœu le plus fort des deux");
    eq(r.casting.candidatures[0].preferences.p50, undefined);
    ok(r.derogations["seul::p01"]);
    ok(r.derogations["differenciation::p01+p17"]);
    eq(r.monde.interrupteurs[0].toucheIds.join(), "p01");
  });
});
