"use strict";

/* ============================================================
   CRASH TEST et POINT DE VUE — la vague 3.
   ------------------------------------------------------------
   Le crash test répond à « et si… ? » sur autre chose qu'une personne ;
   le point de vue répond à « ce personnage a-t-il quelque chose à
   vivre ? ». Les deux sont purs, donc montés ici sur des stores
   factices — et le premier test de chaque suite vérifie justement
   qu'aucun store n'est muté.
   ============================================================ */
import { suite, test, eq, ok, pasOk } from "./harnais.js";
import { fauxReseau, fauxTrames, fauxInfos } from "./faux.js";
import {
  crashTestSituation,
  crashTestInformation,
  crashTestArriveeTardive,
} from "../js/core/crashtest.js";
import { pointDeVue, trous } from "../js/core/pointdevue.js";
import { contexteSuite } from "../js/core/liaison.js";

suite("Crash test — supprimer une situation, sans la supprimer", () => {
  test("le store n'est PAS muté — c'est tout l'intérêt d'un essai", () => {
    const trames = fauxTrames({ situations: [{ id: "s1", titre: "La scène" }] });
    const avant = trames.situations().length;
    crashTestSituation("s1", { reseau: fauxReseau({}), trames, infos: fauxInfos([]) });
    eq(trames.situations().length, avant, "la situation doit toujours être là après l'essai");
    ok(trames.situation("s1"), "et rester lisible");
  });

  test("les conclusions qui pointaient vers elle redeviendraient orphelines", () => {
    const trames = fauxTrames({
      situations: [
        { id: "s1", titre: "L'amorce" },
        { id: "s2", titre: "La suite" },
      ],
      conclusions: [{ id: "c1", de: "s1", vers: "s2", texte: "il avoue" }],
    });
    const r = crashTestSituation("s2", { reseau: fauxReseau({}), trames, infos: fauxInfos([]) });
    eq(r.conclusionsOrphelinees.length, 1);
    eq(r.conclusionsOrphelinees[0].depuis, "L'amorce", "on dit d'où venait la conclusion");
  });

  test("une information qu'elle SEULE produit serait perdue", () => {
    const trames = fauxTrames({
      situations: [{ id: "s1", titre: "La révélation", produitIds: ["i1"] }],
    });
    const infos = fauxInfos([{ id: "i1", contenu: "Le secret" }]);
    const r = crashTestSituation("s1", { reseau: fauxReseau({}), trames, infos });
    eq(r.informationsPerdues.length, 1);
    eq(r.informationsPerdues[0].contenu, "Le secret");
  });

  test("… mais pas si une autre situation la produit aussi", () => {
    const trames = fauxTrames({
      situations: [
        { id: "s1", titre: "Une", produitIds: ["i1"] },
        { id: "s2", titre: "Deux", produitIds: ["i1"] },
      ],
    });
    const infos = fauxInfos([{ id: "i1", contenu: "Le secret" }]);
    const r = crashTestSituation("s1", { reseau: fauxReseau({}), trames, infos });
    eq(r.informationsPerdues.length, 0, "la redondance est justement ce qui protège");
  });

  test("un personnage dont c'était la seule scène n'aurait plus rien", () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "Elena", pj: true }] });
    const trames = fauxTrames({ situations: [{ id: "s1", titre: "S", castIds: ["a"] }] });
    const r = crashTestSituation("s1", { reseau, trames, infos: fauxInfos([]) });
    eq(r.personnagesDesoeuvres.length, 1);
    eq(r.personnagesDesoeuvres[0].nom, "Elena");
  });

  test("… mais pas s'il joue ailleurs", () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "Elena", pj: true }] });
    const trames = fauxTrames({
      situations: [
        { id: "s1", titre: "Une", castIds: ["a"] },
        { id: "s2", titre: "Deux", castIds: ["a"] },
      ],
    });
    const r = crashTestSituation("s1", { reseau, trames, infos: fauxInfos([]) });
    eq(r.personnagesDesoeuvres.length, 0);
  });

  test("une situation isolée : rien ne casse, et on le dit", () => {
    const trames = fauxTrames({ situations: [{ id: "s1", titre: "Seule" }] });
    const r = crashTestSituation("s1", { reseau: fauxReseau({}), trames, infos: fauxInfos([]) });
    ok(r.rienNeCasse);
  });

  test("une situation inexistante rend null plutôt que de planter", () => {
    eq(
      crashTestSituation("fantome", {
        reseau: fauxReseau({}),
        trames: fauxTrames({ situations: [] }),
        infos: fauxInfos([]),
      }),
      null,
    );
  });
});

suite("Crash test — une information jamais découverte, en cascade", () => {
  test("la situation qui la requiert n'arrive pas", () => {
    const trames = fauxTrames({
      situations: [{ id: "s1", titre: "La scène", requiertIds: ["i1"] }],
    });
    const infos = fauxInfos([{ id: "i1", contenu: "La clé" }]);
    const r = crashTestInformation("i1", { trames, infos });
    eq(r.situationsEmpechees.length, 1);
    eq(r.situationsEmpechees[0].titre, "La scène");
  });

  test("LA CASCADE : ce que cette scène produisait tombe aussi, et la suivante avec", () => {
    const trames = fauxTrames({
      situations: [
        { id: "s1", titre: "Première", requiertIds: ["i1"], produitIds: ["i2"] },
        { id: "s2", titre: "Seconde", requiertIds: ["i2"], produitIds: ["i3"] },
        { id: "s3", titre: "Troisième", requiertIds: ["i3"] },
      ],
    });
    const infos = fauxInfos([
      { id: "i1", contenu: "La clé" },
      { id: "i2", contenu: "Ce qu'on y apprend" },
      { id: "i3", contenu: "Ce qui en découle" },
    ]);
    const r = crashTestInformation("i1", { trames, infos });
    eq(r.situationsEmpechees.length, 3, "les trois tombent, l'une après l'autre");
    eq(r.informationsPerdues.length, 2, "et les deux informations qu'elles produisaient");
    eq(r.profondeur, 3, "trois étages traversés");
  });

  test("la profondeur ne dépend PAS de l'ordre des situations dans le store", () => {
    // Le même scénario, écrit à l'envers. Une propagation naïve
    // « tant que ça bouge » rendrait 3 dans un sens et 1 dans l'autre —
    // et l'auteur croirait l'effet local alors qu'il traverse tout.
    const infos = fauxInfos([
      { id: "i1", contenu: "La clé" },
      { id: "i2", contenu: "Ce qu'on y apprend" },
      { id: "i3", contenu: "Ce qui en découle" },
    ]);
    const ordre = (situations) => crashTestInformation("i1", { trames: fauxTrames({ situations }), infos });
    const droit = ordre([
      { id: "s1", titre: "Première", requiertIds: ["i1"], produitIds: ["i2"] },
      { id: "s2", titre: "Seconde", requiertIds: ["i2"], produitIds: ["i3"] },
      { id: "s3", titre: "Troisième", requiertIds: ["i3"] },
    ]);
    const inverse = ordre([
      { id: "s3", titre: "Troisième", requiertIds: ["i3"] },
      { id: "s2", titre: "Seconde", requiertIds: ["i2"], produitIds: ["i3"] },
      { id: "s1", titre: "Première", requiertIds: ["i1"], produitIds: ["i2"] },
    ]);
    eq(inverse.profondeur, droit.profondeur, "même scénario, même profondeur");
    eq(inverse.situationsEmpechees.length, droit.situationsEmpechees.length);
  });

  test("un effet direct, sans cascade, a une profondeur de 1", () => {
    const trames = fauxTrames({ situations: [{ id: "s1", titre: "S", requiertIds: ["i1"] }] });
    const infos = fauxInfos([{ id: "i1", contenu: "La clé" }]);
    eq(crashTestInformation("i1", { trames, infos }).profondeur, 1);
  });

  test("la cascade s'arrête si une autre scène produit la même information", () => {
    const trames = fauxTrames({
      situations: [
        { id: "s1", titre: "Première", requiertIds: ["i1"], produitIds: ["i2"] },
        { id: "s2", titre: "Voie de secours", produitIds: ["i2"] },
        { id: "s3", titre: "Suite", requiertIds: ["i2"] },
      ],
    });
    const infos = fauxInfos([
      { id: "i1", contenu: "La clé" },
      { id: "i2", contenu: "Le fait" },
    ]);
    const r = crashTestInformation("i1", { trames, infos });
    eq(r.situationsEmpechees.length, 1, "seule la première tombe");
    eq(r.informationsPerdues.length, 0, "l'information reste produite ailleurs");
  });

  test("une information qui ne conditionne rien ne casse rien", () => {
    const trames = fauxTrames({ situations: [{ id: "s1", titre: "S" }] });
    const infos = fauxInfos([{ id: "i1", contenu: "Décorative" }]);
    const r = crashTestInformation("i1", { trames, infos });
    ok(r.rienNeCasse);
  });

  test("un cycle requiert/produit ne fait pas boucler à l'infini", () => {
    const trames = fauxTrames({
      situations: [
        { id: "s1", titre: "A", requiertIds: ["i1"], produitIds: ["i2"] },
        { id: "s2", titre: "B", requiertIds: ["i2"], produitIds: ["i1"] },
      ],
    });
    const infos = fauxInfos([
      { id: "i1", contenu: "Un" },
      { id: "i2", contenu: "Deux" },
    ]);
    const r = crashTestInformation("i1", { trames, infos });
    eq(r.situationsEmpechees.length, 2, "les deux tombent, et le calcul termine");
  });
});

suite("Crash test — une arrivée tardive", () => {
  const monde = () => ({
    reseau: fauxReseau({ personnages: [{ id: "a", nom: "Elena", pj: true }] }),
    trames: fauxTrames({
      situations: [
        { id: "s1", titre: "Tôt", pointDeVueId: "a", castIds: ["a"], debut: 20, fin: 21 },
        { id: "s2", titre: "Tard", pointDeVueId: "a", castIds: ["a"], debut: 23, fin: 24 },
      ],
    }),
    infos: fauxInfos([]),
  });

  test("les scènes finies avant son arrivée sont manquées", () => {
    const r = crashTestArriveeTardive("a", 22, monde());
    eq(r.manquees.length, 1);
    eq(r.manquees[0].titre, "Tôt");
  });

  test("les scènes d'après tiennent — ce n'est pas une absence totale", () => {
    const r = crashTestArriveeTardive("a", 22, monde());
    // `defection` est calculée sur la vue réduite : seule « Tôt » y est.
    eq(r.degats.orphelines.length, 1, "seule la scène manquée perd son point de vue");
    eq(r.degats.orphelines[0].titre, "Tôt");
  });

  test("arriver avant tout le monde ne coûte rien", () => {
    const r = crashTestArriveeTardive("a", 19, monde());
    eq(r.manquees.length, 0);
    eq(r.degats, null, "aucun dégât à calculer");
  });

  test("une situation sans horaire n'est jamais « manquée » — on ne sait pas quand elle est", () => {
    const stores = {
      reseau: fauxReseau({ personnages: [{ id: "a", nom: "Elena", pj: true }] }),
      trames: fauxTrames({ situations: [{ id: "s1", titre: "Sans heure", castIds: ["a"] }] }),
      infos: fauxInfos([]),
    };
    eq(crashTestArriveeTardive("a", 23, stores).manquees.length, 0);
  });
});

suite("Point de vue — ce personnage a-t-il quelque chose à vivre ?", () => {
  test("un personnage sans aucune scène n'a rien à vivre", () => {
    const r = pointDeVue("a", {
      reseau: fauxReseau({ personnages: [{ id: "a", nom: "Elena", pj: true }] }),
      trames: fauxTrames({ situations: [] }),
      infos: fauxInfos([]),
    });
    pasOk(r.aQuelqueChoseAVivre);
    eq(r.situations.length, 0);
  });

  test("porter une scène suffit à avoir quelque chose à vivre", () => {
    const r = pointDeVue("a", {
      reseau: fauxReseau({ personnages: [{ id: "a", nom: "Elena", pj: true }] }),
      trames: fauxTrames({ situations: [{ id: "s1", titre: "S", pointDeVueId: "a" }] }),
      infos: fauxInfos([]),
    });
    ok(r.aQuelqueChoseAVivre);
    ok(r.situations[0].porteur, "et on distingue porter de figurer");
  });

  test("figurer sans rien porter, apprendre ni provoquer : c'est être décor", () => {
    const r = pointDeVue("a", {
      reseau: fauxReseau({ personnages: [{ id: "a", nom: "Elena", pj: true }] }),
      trames: fauxTrames({ situations: [{ id: "s1", titre: "S", castIds: ["a"] }] }),
      infos: fauxInfos([]),
    });
    pasOk(r.aQuelqueChoseAVivre, "présent au casting ne veut pas dire avoir un rôle");
    pasOk(r.situations[0].porteur);
  });

  test("ce qu'il peut apprendre exclut ce qu'il sait déjà", () => {
    const stores = {
      reseau: fauxReseau({ personnages: [{ id: "a", nom: "Elena", pj: true }] }),
      trames: fauxTrames({
        situations: [{ id: "s1", titre: "S", castIds: ["a"], produitIds: ["i1", "i2"] }],
      }),
      infos: fauxInfos([
        { id: "i1", contenu: "Du neuf" },
        { id: "i2", contenu: "Déjà su", etats: { a: "sait" } },
      ]),
    };
    const r = pointDeVue("a", stores);
    eq(r.peutApprendre.length, 1);
    eq(r.peutApprendre[0].contenu, "Du neuf");
  });

  test("une conclusion sans suite reste listée, mais marquée", () => {
    const r = pointDeVue("a", {
      reseau: fauxReseau({ personnages: [{ id: "a", nom: "Elena", pj: true }] }),
      trames: fauxTrames({
        situations: [{ id: "s1", titre: "S", pointDeVueId: "a" }],
        conclusions: [{ id: "c1", de: "s1", texte: "elle part", vers: null }],
      }),
      infos: fauxInfos([]),
    });
    eq(r.peutProvoquer.length, 1, "une question ouverte n'est pas une erreur, on la garde");
    pasOk(r.peutProvoquer[0].aUneSuite);
  });

  test("les contacts disent si l'autre les déclare en retour", () => {
    const r = pointDeVue("a", {
      reseau: fauxReseau({
        personnages: [
          { id: "a", nom: "Elena" },
          { id: "b", nom: "Marek" },
        ],
        liens: [{ id: "l1", de: "a", vers: "b", nature: "anciens amants" }],
      }),
      trames: fauxTrames({ situations: [] }),
      infos: fauxInfos([]),
    });
    eq(r.contacts.length, 1);
    pasOk(r.contacts[0].reciproque, "un lien à sens unique se voit");
  });

  test("un personnage supprimé rend null", () => {
    eq(
      pointDeVue("fantome", {
        reseau: fauxReseau({}),
        trames: fauxTrames({ situations: [] }),
        infos: fauxInfos([]),
      }),
      null,
    );
  });
});

suite("Point de vue — les trous de jeu", () => {
  test("un intervalle assez long entre deux scènes est un trou", () => {
    const t = trous([
      { debut: 20, fin: 21 },
      { debut: 23, fin: 24 },
    ]);
    eq(t.length, 1);
    eq(t[0].duree, 2);
  });

  test("un intervalle court n'en est pas un — un GN doit respirer", () => {
    eq(trous([{ debut: 20, fin: 21 }, { debut: 21.5, fin: 22 }]).length, 0);
  });

  test("avant la première et après la dernière, ce n'est pas un trou", () => {
    eq(trous([{ debut: 23, fin: 24 }]).length, 0, "une seule scène ne peut pas encadrer un trou");
  });

  test("deux scènes qui se chevauchent ne créent pas de trou entre elles", () => {
    eq(trous([{ debut: 20, fin: 24 }, { debut: 21, fin: 22 }]).length, 0);
  });

  test("une scène longue couvre celles qu'elle englobe", () => {
    // 20→24 englobe 21→22 ; la scène de 23h30 n'est donc PAS après un trou.
    eq(trous([{ debut: 20, fin: 24 }, { debut: 21, fin: 22 }, { debut: 23.5, fin: 24 }]).length, 0);
  });

  test("les situations sans horaire ne comptent pas dans les trous", () => {
    eq(trous([{ debut: null, fin: null }, { debut: 20, fin: 21 }]).length, 0);
  });
});

suite("Liaison — le contexte pour écrire la suite", () => {
  const monde = () => ({
    reseau: fauxReseau({
      personnages: [
        { id: "a", nom: "Elena", pj: true },
        { id: "b", nom: "Marek", pj: true },
      ],
    }),
    trames: fauxTrames({
      situations: [{ id: "s1", titre: "L'amorce", castIds: ["a", "b"], produitIds: ["i1", "i2"] }],
      conclusions: [{ id: "c1", de: "s1", vers: null, texte: "elle part avec le carnet" }],
    }),
    infos: fauxInfos([
      { id: "i1", contenu: "Le carnet existe", etats: {} },
      { id: "i2", contenu: "Déjà rattachée ailleurs", etats: {} },
      { id: "i3", contenu: "Ce qu'Elena sait", etats: { a: "sait" } },
    ]),
  });

  test("il propose ce que la scène produit et qui ne sert nulle part", () => {
    const ctx = contexteSuite("c1", monde());
    ok(ctx.aRattacher.some((i) => i.id === "i1"), "un fil tendu, jamais rattaché");
  });

  test("… mais pas ce qu'une situation requiert déjà", () => {
    const st = monde();
    st.trames = fauxTrames({
      situations: [
        { id: "s1", titre: "L'amorce", castIds: ["a"], produitIds: ["i1", "i2"] },
        { id: "s2", titre: "Ailleurs", requiertIds: ["i2"] },
      ],
      conclusions: [{ id: "c1", de: "s1", vers: null, texte: "t" }],
    });
    const ctx = contexteSuite("c1", st);
    pasOk(ctx.aRattacher.some((i) => i.id === "i2"), "elle sert déjà quelque part");
  });

  test("il rappelle ce que les présents savent déjà, avec qui le sait", () => {
    const ctx = contexteSuite("c1", monde());
    const su = ctx.dejaSu.find((i) => i.id === "i3");
    ok(su, "ce qu'Elena sait doit apparaître");
    eq(su.qui.join(","), "Elena");
  });

  test("deux personnes qui savent la même chose ne font qu'une ligne", () => {
    const st = monde();
    st.infos = fauxInfos([{ id: "i3", contenu: "Le secret", etats: { a: "sait", b: "sait" } }]);
    const ctx = contexteSuite("c1", st);
    eq(ctx.dejaSu.length, 1, "c'est l'information qui compte, pas le compte des porteurs");
    eq(ctx.dejaSu[0].qui.length, 2, "mais les deux noms sont dits");
  });

  test("une conclusion qui a DÉJÀ une suite ne propose rien", () => {
    const st = monde();
    st.trames = fauxTrames({
      situations: [{ id: "s1", titre: "A" }, { id: "s2", titre: "B" }],
      conclusions: [{ id: "c1", de: "s1", vers: "s2", texte: "t" }],
    });
    eq(contexteSuite("c1", st), null, "il n'y a pas de suite à écrire");
  });

  test("une conclusion inexistante rend null plutôt que de planter", () => {
    eq(contexteSuite("fantome", monde()), null);
  });

  test("le module ne mute rien — il propose, il ne décide pas", () => {
    const st = monde();
    const avant = JSON.stringify(st.trames.situations());
    contexteSuite("c1", st);
    eq(JSON.stringify(st.trames.situations()), avant, "aucune information n'a été rattachée");
  });
});
