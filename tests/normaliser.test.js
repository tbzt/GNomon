"use strict";

/* ============================================================
   Ce qui entre par l'import ou par la synchronisation.

   Les invariants du modèle sont tenus dans les stores, mais deux
   chemins ne passent pas par leurs portes d'écriture. Ces tests
   vérifient que la normalisation les rattrape — et, tout autant,
   qu'elle ne signale RIEN sur des données saines : un rapport qui
   crie pour un champ absent s'apprend à s'ignorer.
   ============================================================ */
import { suite, test, eq, ok, pasOk, eqDonnees } from "./harnais.js";
import { normaliserDocument, normaliserBloc, resumeAnomalies } from "../js/core/normaliser.js";
import { Archive, AVERTISSEMENT } from "../js/core/archive.js";

const causes = (a) => a.map((x) => x.quoi);

suite("Normaliser — un document venu d'ailleurs", () => {
  test("une adresse qui n'est pas http(s) fait écarter le lien", () => {
    // `LiensStore.ajouter()` la refuse déjà ; la synchronisation ne
    // passait pas par cette porte, et l'url part dans un `href`.
    const r = normaliserDocument("liens", { id: "n1", titre: "Piège", url: "javascript:alert(1)" }, "n1");
    eq(r.d, null);
    ok(causes(r.anomalies).some((c) => /adresse refusée/.test(c)));
  });

  test("une adresse http passe intacte", () => {
    const r = normaliserDocument("liens", { id: "n2", titre: "Drive", url: "https://ex.org/a" }, "n2");
    eq(r.d.url, "https://ex.org/a");
    eq(r.anomalies.length, 0);
  });

  test("une information sans `etats` ne casse plus rien", () => {
    // C'est le cas qui rendait « Qui sait quoi » vide, définitivement.
    const r = normaliserDocument("informations.informations", { id: "i1", contenu: "le duc a menti" }, "i1");
    eq(typeof r.d.etats, "object");
    eq(typeof r.d.croyances, "object");
    eq(r.anomalies.length, 0, "un champ absent n'est pas une anomalie");
  });

  test("« ignore » n'est jamais conservé — c'est l'absence", () => {
    const r = normaliserDocument(
      "informations.informations",
      { id: "i1", contenu: "x", etats: { p1: "ignore", p2: "sait", p3: "n'importe quoi" } },
      "i1",
    );
    eqDonnees(r.d.etats, { p2: "sait" });
  });

  test("une croyance ne survit pas à la sortie de l'état « croit »", () => {
    const r = normaliserDocument(
      "informations.informations",
      { id: "i1", contenu: "x", etats: { p1: "sait" }, croyances: { p1: "texte fantôme" } },
      "i1",
    );
    eqDonnees(r.d.croyances, {}, "le texte fantôme est retiré");
  });

  test("une énumération inconnue retombe sur sa valeur neutre, et se dit", () => {
    const r = normaliserDocument(
      "reseau.liens",
      { id: "l1", de: "a", vers: "b", tonalite: "positif ", importance: "PRIMAIRE" },
      "l1",
    );
    eq(r.d.tonalite, "neutre");
    eq(r.d.importance, "secondaire");
    eq(r.anomalies.length, 2);
  });

  test("un lien sans bout ne désigne rien", () => {
    eq(normaliserDocument("reseau.liens", { id: "l1", de: "a" }, "l1").d, null);
    eq(normaliserDocument("reseau.liens", { id: "l1", de: "a", vers: "a" }, "l1").d, null);
  });

  test("un objet de liste sans identifiant est écarté", () => {
    const r = normaliserDocument("reseau.personnages", { nom: "Anonyme" }, "");
    eq(r.d, null);
    ok(causes(r.anomalies).includes("objet sans identifiant"));
  });

  test("une conclusion sans cible reste valide — c'est la question ouverte", () => {
    const r = normaliserDocument("trames.conclusions", { id: "c1", de: "s1", vers: null }, "c1");
    ok(r.d, "elle survit");
    eq(r.d.vers, null);
    eq(r.anomalies.length, 0);
  });

  test("une source d'image hors http(s) et data:image est retirée", () => {
    const r = normaliserDocument(
      "reseau.personnages",
      { id: "p1", nom: "X", portrait: "javascript:alert(1)" },
      "p1",
    );
    eq(r.d.portrait, "");
    ok(causes(r.anomalies).includes("portrait à source refusée"));
  });

  test("une image embarquée légitime passe", () => {
    const src = "data:image/jpeg;base64,AAAA";
    eq(normaliserDocument("reseau.personnages", { id: "p1", nom: "X", portrait: src }, "p1").d.portrait, src);
  });

  test("un champ ABSENT ne produit aucune anomalie", () => {
    // Le rapport doit rester lisible : signaler « portrait refusé » pour
    // un personnage qui n'en a jamais eu apprend à ignorer le rapport.
    const r = normaliserDocument("reseau.personnages", { id: "p1", nom: "Ana" }, "p1");
    eq(r.anomalies.length, 0);
    eq(r.d.portrait, "");
    eqDonnees(r.d.objectifs, []);
  });

  /** ── L'INVARIANT QUI REND LA SYNCHRONISATION SAINE ──
      Normaliser à l'entrée ne vaut que si l'opération ne bouge pas ce
      qui est déjà bien formé. Sinon chaque document tiré changerait
      d'empreinte, le registre retiendrait la forme normalisée, la
      prochaine écriture locale semblerait différente — et l'outil
      repousserait tout le GN à chaque tour, en croyant l'avoir modifié. */
  test("normaliser ne bouge pas un objet déjà bien formé", () => {
    const complet = {
      id: "p1", nom: "Elena", role: "", pj: true, groupeId: null, fonction: null,
      moral: "", desir: "", besoin: "", faiblesse: "", pouvoirs: "",
      transformation: "", archetype: "", surprise: false, notes: "",
      background: "", style: "", objectifs: [], portrait: "", images: [],
      x: null, y: null,
    };
    const r = normaliserDocument("reseau.personnages", complet, "p1");
    eqDonnees(r.d, complet, "aucun champ ajouté ni retiré");
    eq(r.anomalies.length, 0);
  });

  test("normaliser deux fois donne la même chose qu'une", () => {
    const brut = { id: "l1", de: "a", vers: "b", tonalite: "n'importe quoi" };
    const une = normaliserDocument("reseau.liens", brut, "l1").d;
    const deux = normaliserDocument("reseau.liens", une, "l1").d;
    eqDonnees(deux, une);
    eq(normaliserDocument("reseau.liens", une, "l1").anomalies.length, 0, "et sans re-signaler");
  });

  test("un document illisible est écarté sans lever", () => {
    eq(normaliserDocument("reseau.personnages", "pas un objet", "p1").d, null);
    eq(normaliserDocument("reseau.personnages", null, "p1").d, null);
  });
});

suite("Normaliser — un bloc entier", () => {
  test("une liste qui n'en est pas une devient vide", () => {
    const r = normaliserBloc("reseau", { personnages: "pas un tableau", liens: null, groupes: 3 });
    eqDonnees(r.bloc, { personnages: [], liens: [], groupes: [], sieges: [] });
  });

  test("l'ordre des listes est CONSERVÉ", () => {
    // La main courante est rangée du plus récent au plus ancien et la
    // conduite en dépend : normaliser ne doit jamais trier.
    const journal = [
      { id: "j3", ts: 300, texte: "récent" },
      { id: "j2", ts: 200, texte: "milieu" },
      { id: "j1", ts: 100, texte: "ancien" },
    ];
    const r = normaliserBloc("run", { run: null, fils: {}, journal });
    eqDonnees(
      r.bloc.journal.map((e) => e.texte),
      ["récent", "milieu", "ancien"],
    );
  });

  test("le reste d'un bloc survit à côté de ses listes", () => {
    const r = normaliserBloc("monde", {
      titre: "Valmorel",
      contexte: "un village",
      securite: ["coupez"],
      lieux: [{ id: "x1", nom: "Le dispensaire" }],
    });
    eq(r.bloc.titre, "Valmorel");
    eq(r.bloc.lieux.length, 1);
    eqDonnees(r.bloc.securite, ["coupez"]);
  });

  /* Le fil de l'histoire est le document le plus sensible du GN, et il
     n'entre que par ici : l'archive et la synchronisation. Il doit
     traverser intact, et ressortir texte quoi qu'on ait reçu. */
  test("le fil de l'histoire traverse le reste du monde intact", () => {
    const fil = "## Lundi 12 avril 1965 [FIXE]\n\n| Vérité | Qui la sait |\n|---|---|\n| le compte | Simone |";
    const r = normaliserBloc("monde", { titre: "Le compte n'y est pas", fil, lieux: [] });
    eq(r.bloc.fil, fil, "pas un caractère de changé — le Markdown est de la donnée");
    eq(r.anomalies.length, 0);
  });

  test("un fil absent devient un texte vide, sans un mot", () => {
    // Toute archive d'avant ce champ en est dépourvue : ce n'est pas
    // une anomalie, c'est le passé.
    const r = normaliserBloc("monde", { titre: "Valmorel", lieux: [] });
    eq(r.bloc.fil, "");
    eq(r.anomalies.length, 0);
  });

  test("un fil qui n'est pas un texte en devient un", () => {
    eq(normaliserBloc("monde", { fil: null, lieux: [] }).bloc.fil, "");
    eq(normaliserBloc("monde", { fil: 1965, lieux: [] }).bloc.fil, "1965");
  });

  test("une carte se normalise entrée par entrée", () => {
    const r = normaliserBloc("derogations", {
      "seul::p1": { justification: "il arrive tard", date: "2026-08-30" },
      "seul::p2": "pas un objet",
    });
    eq(Object.keys(r.bloc).length, 1);
    eq(r.bloc["seul::p1"].justification, "il arrive tard");
  });

  test("le résumé groupe par cause plutôt que de répéter", () => {
    const r = normaliserBloc("liens", [
      { id: "a", url: "javascript:1" },
      { id: "b", url: "javascript:2" },
      { id: "c", url: "https://ok.org" },
    ]);
    eq(r.bloc.length, 1);
    ok(/\(2\)/.test(resumeAnomalies(r.anomalies)), "deux fois la même cause, une seule ligne");
  });
});

suite("Archive — le contenu aussi, pas seulement l'enveloppe", () => {
  const paquet = (data) => ({ format: "gnomon-archive", version: 1, data });

  test("une archive d'enveloppe valide mais au contenu abîmé ne casse plus rien", () => {
    const faux = {
      get: (c) => faux._d[c] ?? null,
      set: (c, v) => {
        faux._d[c] = v;
      },
      _d: {},
    };
    // On éprouve la normalisation seule : `Archive.appliquer` écrit dans
    // le vrai `Storage`, dont les tests ne veulent pas.
    const r = normaliserBloc("informations", { informations: [{ id: "i1", contenu: "le duc a menti" }] });
    eq(typeof r.bloc.informations[0].etats, "object");
    ok(faux, "le faux dépôt n'a pas servi, et c'est voulu");
  });

  test("l'inventaire dit si le fil de l'histoire est là", () => {
    // C'est la pièce qu'on veut savoir présente avant de remplacer la
    // sienne — et celle qui rappelle que ce fichier ne va pas à un joueur.
    ok(Archive.inventaire(paquet({ monde: { titre: "X", fil: "## 1965\n- [FIXE] …" } })).fil);
    pasOk(Archive.inventaire(paquet({ monde: { titre: "X", fil: "   " } })).fil, "des blancs ne sont pas un fil");
    pasOk(Archive.inventaire(paquet({ monde: { titre: "X" } })).fil, "une archive d'avant le champ");
    pasOk(Archive.inventaire(paquet({})).fil, "ni monde, ni fil");
  });

  test("l'avertissement de l'archive nomme le fil de l'histoire", () => {
    // Il est écrit en clair dans le fichier : c'est la seule protection
    // qui ait du sens pour un JSON qu'on s'envoie soi-même.
    ok(/fil de l'histoire/.test(AVERTISSEMENT));
    eq(Archive.construire("T").avertissement, AVERTISSEMENT);
  });

  test("l'enveloppe reste un contrat, elle n'est pas remplacée", () => {
    // La normalisation s'ajoute au contrôle d'enveloppe, elle ne le
    // relâche pas : un fichier étranger est toujours refusé en bloc.
    pasOk(Archive.verifier({ format: "autre-outil", version: 1, data: {} }).ok);
    pasOk(Archive.verifier(paquet(null)).ok);
    ok(Archive.verifier(paquet({ reseau: {} })).ok);
  });
});
