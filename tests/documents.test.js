"use strict";

/* ============================================================
   Les documents qui sortent de l'outil.

   Le premier test de ce fichier est le plus important du projet :
   **une croyance fausse ne doit jamais sortir accompagnée de la
   vérité**. C'est la seule régression qui ne se rattraperait pas —
   elle ne casse rien à l'écran, elle gâche un GN.
   ============================================================ */
import { suite, test, eq, ok, contient, neContientPas } from "./harnais.js";
import { fauxReseau, fauxTrames, fauxInfos, fauxMonde, fauxCasting } from "./faux.js";
import {
  livret,
  livretHtml,
  livretMarkdown,
  consigne,
  consigneHtml,
  trombinoscope,
  trombinoscopeHtml,
} from "../js/core/livret.js";

const VERITE = "Le fils est mort au tunnel";
const CROYANCE = "Il est mort de la fievre";

/** Un cas minimal mais complet : Lucie croit une chose fausse, Corvin
    (PNJ) connaît la vérité. */
function cas() {
  const reseau = fauxReseau({
    groupes: [{ id: "g1", nom: "La commune" }],
    personnages: [
      {
        id: "lucie",
        nom: "Lucie Roux",
        role: "La veuve",
        groupeId: "g1",
        fonction: "secondaire",
        transformation: "Cesser de croire",
        background: "Elle attend depuis trois semaines.",
        style: "Parle bas.",
        objectifs: ["Obtenir une tombe"],
        moral: "L'honneur du village",
      },
      { id: "corvin", nom: "Pere Corvin", role: "Le cure", pj: false, groupeId: "g1" },
      { id: "elena", nom: "Elena Fabre", role: "La doctoresse", groupeId: "g1" },
    ],
    liens: [
      {
        id: "l1",
        de: "lucie",
        vers: "elena",
        nature: "Lui doit la vie de son fils",
        tonalite: "positif",
        importance: "primaire",
        miroir: true,
      },
    ],
  });
  const infos = fauxInfos([
    {
      id: "i1",
      contenu: VERITE,
      influence: "latente",
      etats: { lucie: "croit", corvin: "sait" },
      croyances: { lucie: CROYANCE },
    },
  ]);
  const trames = fauxTrames({
    trames: [{ id: "t1", titre: "L'avalanche", porteurId: "corvin" }],
    situations: [
      {
        id: "s1",
        trameId: "t1",
        titre: "L'aveu",
        pointDeVueId: "corvin",
        castIds: ["corvin", "lucie"],
        debut: 23,
        fin: 24,
        espace: "L'eglise",
        requiertIds: ["i1"],
      },
    ],
  });
  const monde = fauxMonde(
    { titre: "Valmorel", contexte: "Une avalanche a emporte le tunnel.", intention: "Des silences." },
    [{ nom: "Coupez", texte: "Arrete la scene." }],
  );
  return { reseau, trames, infos, monde, casting: fauxCasting() };
}

suite("Livret — la soustraction", () => {
  test("la verite derriere une croyance fausse NE SORT PAS", () => {
    const st = cas();
    const html = livretHtml(livret("lucie", st));
    neContientPas(html, VERITE, "la verite a fuite dans le livret");
  });

  test("mais la croyance, elle, est bien la", () => {
    const st = cas();
    contient(livretHtml(livret("lucie", st)), CROYANCE);
  });

  test("le markdown ne fuite pas non plus", () => {
    const st = cas();
    neContientPas(livretMarkdown(livret("lucie", st)), VERITE, "fuite en markdown");
  });

  test("la fonction narrative est retiree", () => {
    const st = cas();
    neContientPas(livretHtml(livret("lucie", st)), "Personnage secondaire");
  });

  test("la transformation possible est retiree", () => {
    const st = cas();
    neContientPas(livretHtml(livret("lucie", st)), "Cesser de croire");
  });

  test("l'importance d'un lien et le miroir sont retires", () => {
    const st = cas();
    const html = livretHtml(livret("lucie", st));
    neContientPas(html, "Primaire");
    neContientPas(html, "◎");
  });

  test("le carnet prive de l'auteur ne sort pas", () => {
    const st = cas();
    st.reseau.personnage("lucie").notes = "A REVELER EN S3";
    neContientPas(livretHtml(livret("lucie", st)), "A REVELER EN S3", "le carnet a fuite");
  });

  test("le fil de l'histoire ne sort dans AUCUN document", () => {
    // Un livret est une coupe du fil, plus les erreurs de son
    // propriétaire. Le fil entier montrerait ces erreurs au joueur.
    // La consigne et la planche non plus : le fil est un document
    // d'organisation, il a sa propre place et n'en a qu'une.
    const st = cas();
    st.monde.monde().fil = "LE-FIL-SECRET : Marcel a fait demi-tour devant la porte.";
    neContientPas(livretHtml(livret("lucie", st)), "LE-FIL-SECRET", "le fil a fuité dans le livret");
    neContientPas(livretMarkdown(livret("lucie", st)), "LE-FIL-SECRET", "fuite en markdown");
    neContientPas(consigneHtml(consigne("corvin", st)), "LE-FIL-SECRET", "fuite dans la consigne");
    neContientPas(
      trombinoscopeHtml(trombinoscope(st, { avecPnj: true })),
      "LE-FIL-SECRET",
      "fuite sur la planche",
    );
  });

  test("l'intention et la securite y sont toujours", () => {
    const st = cas();
    const html = livretHtml(livret("lucie", st));
    contient(html, "Des silences.");
    contient(html, "Arrete la scene.");
  });

  test("les avertissements sont pour l'auteur, pas pour le document", () => {
    const st = cas();
    st.reseau.personnage("lucie").background = "";
    const l = livret("lucie", st);
    ok(l.avertissements.length > 0, "un background vide doit etre signale");
    neContientPas(livretHtml(l), "background est vide", "l'avertissement a fuite");
  });

  test("une croyance sans texte ecrit est signalee a l'auteur", () => {
    const st = cas();
    st.infos.information("i1").croyances.lucie = "";
    const l = livret("lucie", st);
    ok(
      l.avertissements.some((a) => a.includes("croit autre chose")),
      "la croyance muette doit etre signalee",
    );
  });
});

suite("Consigne PNJ — l'addition", () => {
  test("elle porte la verite ET la croyance des autres", () => {
    const st = cas();
    const html = consigneHtml(consigne("corvin", st));
    contient(html, VERITE, "la consigne doit dire la verite");
    contient(html, CROYANCE, "et ce que Lucie croit a la place");
  });

  test("elle dit qu'elle ne se remet a personne", () => {
    const st = cas();
    contient(consigneHtml(consigne("corvin", st)), "ne se remet à personne");
  });

  test("elle liste les trames portees et les scenes", () => {
    const st = cas();
    const k = consigne("corvin", st);
    eq(k.porte.length, 1);
    eq(k.scenes.length, 1);
    eq(k.scenes[0].titre, "L'aveu");
  });

  test("le nombre de comediens suit la simultaneite", () => {
    const st = cas();
    eq(consigne("corvin", st).comediens, 1, "une seule scene : un comedien");
    const st2 = cas();
    st2.trames.situations().push(
      { ...st2.trames.situation("s1"), id: "s2", titre: "Ailleurs", debut: 23.5, fin: 24.5 },
      { ...st2.trames.situation("s1"), id: "s3", titre: "Encore", debut: 23.2, fin: 24.2 },
    );
    eq(consigne("corvin", st2).comediens, 3, "trois scenes qui se chevauchent : trois comediens");
  });
});

suite("Trombinoscope — rien que du public", () => {
  test("il groupe par groupe et compte les portraits manquants", () => {
    const st = cas();
    const t = trombinoscope(st);
    eq(t.total, 2, "deux PJ");
    eq(t.sansPortrait, 2);
    eq(t.parGroupe.length, 1);
  });

  test("les PNJ n'y sont que si on le demande", () => {
    const st = cas();
    eq(trombinoscope(st, { avecPnj: true }).total, 3);
  });

  test("aucune donnee d'auteur n'y figure", () => {
    const st = cas();
    const html = trombinoscopeHtml(trombinoscope(st, { avecPnj: true }));
    neContientPas(html, VERITE);
    neContientPas(html, CROYANCE);
    neContientPas(html, "Personnage secondaire");
    neContientPas(html, "Cesser de croire");
    neContientPas(html, "Elle attend depuis trois semaines");
  });

  test("un portrait manquant devient une silhouette, pas un trou", () => {
    const st = cas();
    contient(trombinoscopeHtml(trombinoscope(st)), "LR", "les initiales de Lucie Roux");
  });
});
