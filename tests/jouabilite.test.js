"use strict";

/* ============================================================
   Ce que l'audit de jouabilité a changé (cf. ARCHITECTURE.md §5u).

   Le premier test reprend la faute trouvée sur un GN réel : une nature
   de lien écrite pour l'auteur, imprimée dans le livret de celui qui
   ne doit pas la savoir.
   ============================================================ */
import { suite, test, eq, ok, pasOk, contient, neContientPas } from "./harnais.js";
import { fauxReseau, fauxTrames, fauxInfos, fauxMonde, fauxCasting } from "./faux.js";
import { livret, livretHtml, livretMarkdown, consigne, consigneHtml } from "../js/core/livret.js";
import { ciblesDe, objectifsVisant } from "../js/core/objectifs.js";
import { pointDeVue } from "../js/core/pointdevue.js";
import { conscience } from "../js/core/conscience.js";
import { feuilleDe2h } from "../js/core/feuille.js";
import { normaliserDocument } from "../js/core/normaliser.js";
import { TYPES_CONCLUSION } from "../js/core/tramestore.js";

const NATURE = "Le premier des cinq à qui l'offre est faite";
const ENONCE = "Un policier en civil chez les Vasseur, et vous avez tout à perdre";

function cas() {
  const reseau = fauxReseau({
    personnages: [
      {
        id: "marcel",
        nom: "Marcel Vidal",
        objectifs: ["Repartir demain matin sans avoir été vu seul avec qui que ce soit"],
        possede: ["Les papiers de Régis Doumé, dans la boîte à outils"],
        pressions: ["Charly commencera par vous, avant le repas"],
      },
      { id: "brun", nom: "Édouard Brun", objectifs: ["Faire signer Marcel Vidal avant le bal"] },
      { id: "prat", nom: "Édouard Prat", objectifs: ["Faire dire à Marcel, devant Colette, qui déplaçait ses voitures"] },
      { id: "colette", nom: "Colette Vidal", pj: false, objectifs: ["Monter voir Ange seule"] },
    ],
    liens: [
      { id: "l1", de: "marcel", vers: "brun", nature: NATURE, tonalite: "negatif", importance: "secondaire" },
      { id: "l2", de: "marcel", vers: "prat", nature: "Le petit qui n'a jamais donné son nom", enonce: "Il n'a jamais donné votre nom, et vous ne l'avez jamais remercié", tonalite: "complique" },
    ],
  });
  return {
    reseau,
    trames: fauxTrames({ situations: [] }),
    infos: fauxInfos([]),
    monde: fauxMonde({ titre: "Le Compte", contexte: "Un mariage." }),
    casting: fauxCasting(),
  };
}

suite("Jouabilité — le lien a deux textes", () => {
  test("la nature écrite pour l'auteur NE SORT PAS quand un énoncé existe", () => {
    const html = livretHtml(livret("marcel", cas()));
    contient(html, "Il n'a jamais donné votre nom");
    neContientPas(html, "Le petit qui n'a jamais donné son nom", "la nature a fuité");
  });

  test("sans énoncé, la nature sort faute de mieux, et l'auteur est PRÉVENU", () => {
    const l = livret("marcel", cas());
    contient(livretHtml(l), NATURE);
    ok(l.avertissements.some((a) => /sans formulation pour le joueur/.test(a)), "l'absence d'énoncé doit être signalée");
    eq(l.avertissements.filter((a) => /sans formulation pour le joueur/.test(a)).length, 1, "une ligne, pas une par contact");
  });

  test("un contact sans nature ni énoncé n'est pas signalé", () => {
    const st = cas();
    st.reseau.lien = null;
    const l = st.reseau.liens().find((x) => x.id === "l1");
    l.nature = "";
    const liv = livret("marcel", st);
    pasOk(liv.avertissements.some((a) => /sans formulation pour le joueur/.test(a)));
  });

  test("le normaliseur donne un énoncé vide à un lien qui n'en a pas", () => {
    const r = normaliserDocument("reseau.liens", { id: "l9", de: "a", vers: "b" }, "l9");
    eq(r.d.enonce, "");
    eq(r.anomalies.length, 0);
  });
});

suite("Jouabilité — ce qu'il a, ce qui le presse", () => {
  test("les deux listes sortent dans le livret, en HTML et en Markdown", () => {
    const l = livret("marcel", cas());
    const html = livretHtml(l);
    contient(html, "Ce que vous avez sur vous");
    contient(html, "boîte à outils");
    contient(html, "Ce qui vous presse");
    contient(html, "avant le repas");
    contient(livretMarkdown(l), "### Ce que vous avez sur vous");
  });

  test("elles sortent aussi dans la consigne d'un PNJ", () => {
    const st = cas();
    st.reseau.personnage("colette").possede = ["Un prix, écrit sur un papier"];
    contient(consigneHtml(consigne("colette", st)), "écrit sur un papier");
  });

  test("une fiche sans ces listes n'imprime pas de section vide", () => {
    const st = cas();
    const html = livretHtml(livret("brun", st));
    neContientPas(html, "Ce que vous avez sur vous");
    neContientPas(html, "Ce qui vous presse");
  });

  test("le normaliseur les fournit vides", () => {
    const r = normaliserDocument("reseau.personnages", { id: "p9", nom: "X" }, "p9");
    eq(r.d.possede.length, 0);
    eq(r.d.pressions.length, 0);
  });
});

suite("Jouabilité — qui vise qui", () => {
  const gens = () => cas().reseau.personnages();

  test("un nom entier est lu", () => {
    eq(ciblesDe("Faire signer Marcel Vidal avant le bal", gens(), "brun").join(), "marcel");
  });

  test("un prénom unique est lu, un prénom partagé ne l'est pas", () => {
    eq(ciblesDe("Faire dire à Marcel ce qu'il cache", gens(), "brun").join(), "marcel");
    eq(ciblesDe("Aborder Édouard le premier", gens(), "marcel").length, 0, "deux Édouard : personne");
    eq(ciblesDe("Aborder Édouard Brun le premier", gens(), "marcel").join(), "brun");
  });

  test("un nom de famille partagé ne désigne personne", () => {
    eq(ciblesDe("Parler à Vidal", gens(), "brun").length, 0, "Marcel et Colette Vidal");
  });

  test("une mention est lue, et l'auteur n'est jamais sa propre cible", () => {
    eq(ciblesDe("Voir @[Colette](colette) seule", gens(), "marcel").join(), "colette");
    eq(ciblesDe("Marcel Vidal reste chez lui", gens(), "marcel").length, 0);
  });

  test("l'époque borne les candidats", () => {
    const g = [
      { id: "a65", nom: "Ange Sarti", epoqueId: "e65" },
      { id: "n85", nom: "Nadia Sarti", epoqueId: "e85" },
    ];
    eq(ciblesDe("Parler à Nadia", g, "a65").length, 0, "Nadia n'existe pas en 65");
  });

  test("« ce qu'on va lui demander » est la somme des objectifs qui le visent", () => {
    const v = objectifsVisant(gens(), "marcel");
    eq(v.length, 2);
    ok(v.some((x) => x.de === "brun") && v.some((x) => x.de === "prat"));
  });
});

suite("Jouabilité — ce qu'il vit se mesure en demandes", () => {
  test("un personnage sans scène mais avec des objectifs qui le visent a quelque chose à vivre", () => {
    const st = cas();
    const v = pointDeVue("marcel", st);
    ok(v.aQuelqueChoseAVivre);
    eq(v.onLuiDemandera.length, 2);
    eq(v.peutDemander.length, 1);
    eq(v.peutDemander[0].cibles.length, 0, "« sans avoir été vu seul » ne nomme personne");
    eq(v.possede.length, 1);
    eq(v.pressions.length, 1);
  });

  test("sans rien, le verdict reste négatif", () => {
    const st = cas();
    st.reseau.personnage("brun").objectifs = [];
    const v = pointDeVue("brun", st);
    // Aucune scène, aucun objectif, et personne ne le nomme.
    pasOk(v.aQuelqueChoseAVivre);
  });

  test("être nommé dans l'objectif d'un autre suffit à avoir quelque chose à vivre", () => {
    const st = cas();
    st.reseau.personnage("colette").objectifs = [];
    const v = pointDeVue("colette", st);
    // Édouard Prat veut faire parler Marcel « devant Colette ».
    ok(v.aQuelqueChoseAVivre);
    eq(v.onLuiDemandera.length, 1);
  });

  test("un objectif sans cible lue compte quand même comme quelque chose à demander", () => {
    // « Monter voir Ange seule » vise quelqu'un que la lecture ne
    // trouve pas : c'est la conscience qui le signale, pas le verdict.
    const v = pointDeVue("colette", cas());
    ok(v.aQuelqueChoseAVivre);
    eq(v.peutDemander[0].cibles.length, 0);
  });
});

suite("Jouabilité — la treizième règle", () => {
  test("un PJ dont aucun objectif ne nomme quelqu'un est signalé, avec sa transposition", () => {
    const st = cas();
    const r = conscience(st.reseau, st.trames, st.infos).find((x) => x.cle === "adversaire");
    ok(r && r.transpose && r.transpose.length > 40);
    const noms = r.alertes.map((a) => a.nom);
    ok(noms.includes("Marcel Vidal"), "« sans avoir été vu seul » n'a pas d'adversaire");
    pasOk(noms.includes("Édouard Brun"), "Brun vise Marcel Vidal");
  });

  test("un seul objectif qui nomme quelqu'un suffit à lever l'alerte", () => {
    const st = cas();
    st.reseau.personnage("marcel").objectifs.push("Refuser à Colette Vidal de monter voir Ange");
    const r = conscience(st.reseau, st.trames, st.infos).find((x) => x.cle === "adversaire");
    pasOk(r.alertes.some((a) => a.nom === "Marcel Vidal"));
  });
});

suite("Jouabilité — conclusions et interrupteurs", () => {
  test("les conclusions ont quatre types", () => {
    ok("narration" in TYPES_CONCLUSION && "interrupteur" in TYPES_CONCLUSION);
    eq(Object.keys(TYPES_CONCLUSION).length, 4);
  });

  test("un interrupteur venu d'ailleurs est réparé, pas écarté", () => {
    const r = normaliserDocument("monde.interrupteurs", { id: "k1", question: "Quelqu'un est-il allé chez Nahmias ?", toucheIds: ["a", 3, ""] }, "k1");
    eq(r.d.defaut, "");
    eq(r.d.toucheIds.join(), "a,3");
    eq(r.anomalies.length, 0);
  });

  test("la feuille de 2 h nomme les gens, pas les identifiants", () => {
    const st = cas();
    const md = feuilleDe2h({
      titre: "Le Compte",
      interrupteurs: [
        { id: "k1", question: "Le compte a-t-il été publié ?", defaut: "Non, Ange l'a gardé", note: "Dire à Marcel qui connaît le chiffre", toucheIds: ["marcel", "fantome"] },
      ],
      reseau: st.reseau,
    });
    contient(md, "# Feuille de 2 h — Le Compte");
    contient(md, "Le compte a-t-il été publié ?");
    contient(md, "Marcel Vidal");
    contient(md, "personnage supprimé");
    neContientPas(md, "fantome");
    contient(md, "Valeur jouée");
  });

  test("sans interrupteur, la feuille le dit", () => {
    contient(feuilleDe2h({ interrupteurs: [] }), "Aucun interrupteur");
  });
});
