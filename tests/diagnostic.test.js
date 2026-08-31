"use strict";

/* ============================================================
   DIAGNOSTIC — la couche d'interprétation (vague 1).
   ------------------------------------------------------------
   Ce module ne recalcule rien : il traduit `conscience()`, `frise()`,
   `classementFragilite()`, et ajoute les signaux structurels à haute
   confiance de PRODUCT_TRANSFORMATION.md §4/§11 — prise absente (C),
   information sans porteur (D1), référence orpheline, fragilité
   résumée (B). La promesse narrative (G, confiance moyenne) est
   volontairement hors de cette vague : voir tests/diagnostic.test.js
   git history si besoin de la retrouver, elle revient en vague 4.
   ============================================================ */
import { suite, test, eq, ok, pasOk } from "./harnais.js";
import { fauxReseau, fauxTrames, fauxInfos } from "./faux.js";
import { diagnostics, parCategorie } from "../js/core/diagnostic.js";

suite("Diagnostic — traduction de la conscience", () => {
  test("une alerte de conscience devient un diagnostic explicable", () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "Elena", pj: true }] });
    const trames = fauxTrames({ situations: [] });
    const infos = fauxInfos([]);
    const ds = diagnostics({ reseau, trames, infos });
    const seul = ds.find((d) => d.cle === "seul" && d.cible === "a");
    ok(seul, "« personne n'est seul » doit produire un diagnostic pour Elena");
    ok(seul.titre.includes("Elena"), "le titre nomme la personne concernée");
    ok(seul.detail, "chaque diagnostic porte une explication");
    ok(seul.source, "chaque diagnostic porte l'origine de son raisonnement");
    ok(seul.cibles.length && seul.cibles[0].ecran === "fiche", "la cible route vers la fiche");
  });

  test("aucun diagnostic ne porte de score global", () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "A" }, { id: "b", nom: "B" }] });
    const ds = diagnostics({ reseau, trames: fauxTrames({ situations: [] }), infos: fauxInfos([]) });
    pasOk(ds.some((d) => "score" in d || "note" in d), "un diagnostic n'a ni score ni note");
    for (const d of ds) {
      ok(["attention", "a-verifier"].includes(d.gravite), "la gravité est qualitative, à deux valeurs");
      ok(["haute", "moyenne"].includes(d.confiance), "la confiance est déclarée, toujours");
    }
  });

  test("les diagnostics « attention » passent avant les « a-verifier »", () => {
    const reseau = fauxReseau({
      groupes: [{ id: "g1", nom: "G" }],
      personnages: [
        { id: "a", nom: "A", groupeId: "g1", moral: "M" },
        { id: "b", nom: "B", groupeId: "g1", moral: "M" },
      ],
    });
    const ds = diagnostics({ reseau, trames: fauxTrames({ situations: [] }), infos: fauxInfos([]) });
    const rangs = ds.map((d) => (d.gravite === "attention" ? 0 : 1));
    eqOrdreCroissant(rangs);
  });
});

function eqOrdreCroissant(rangs) {
  for (let i = 1; i < rangs.length; i++)
    ok(rangs[i] >= rangs[i - 1], "le tri par gravité doit être stable et croissant");
}

suite("Diagnostic — collisions de temps", () => {
  test("un PJ prévu à deux endroits produit un diagnostic « temps:collision »", () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "Elena", pj: true }] });
    const trames = fauxTrames({
      situations: [
        { id: "s1", titre: "Un", castIds: ["a"], debut: 20, fin: 22 },
        { id: "s2", titre: "Deux", castIds: ["a"], debut: 21, fin: 23 },
      ],
    });
    const ds = diagnostics({ reseau, trames, infos: fauxInfos([]) });
    ok(ds.some((d) => d.cle === "temps:collision"), "la collision doit apparaître");
  });

  test("trois scènes simultanées font UNE carte, pas trois paires", () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "Marek", pj: true }] });
    const trames = fauxTrames({
      situations: [
        { id: "s1", titre: "Un", castIds: ["a"], debut: 20, fin: 23 },
        { id: "s2", titre: "Deux", castIds: ["a"], debut: 21, fin: 23 },
        { id: "s3", titre: "Trois", castIds: ["a"], debut: 21.5, fin: 23 },
      ],
    });
    const cs = diagnostics({ reseau, trames, infos: fauxInfos([]) }).filter(
      (d) => d.cle === "temps:collision",
    );
    eq(cs.length, 1, "trois paires, mais un seul problème pour l'auteur");
    ok(cs[0].titre.includes("3 scènes"), "et le titre dit combien");
    for (const t of ["Un", "Deux", "Trois"])
      ok(cs[0].detail.includes(t), `« ${t} » doit être nommée dans le détail`);
  });

  test("deux personnes en collision font bien deux cartes", () => {
    const reseau = fauxReseau({
      personnages: [
        { id: "a", nom: "A", pj: true },
        { id: "b", nom: "B", pj: true },
      ],
    });
    const trames = fauxTrames({
      situations: [
        { id: "s1", titre: "Un", castIds: ["a", "b"], debut: 20, fin: 22 },
        { id: "s2", titre: "Deux", castIds: ["a", "b"], debut: 21, fin: 23 },
      ],
    });
    eq(
      diagnostics({ reseau, trames, infos: fauxInfos([]) }).filter(
        (d) => d.cle === "temps:collision",
      ).length,
      2,
    );
  });

  test("une collision de PNJ n'est PAS un diagnostic — c'est un besoin, pas une erreur", () => {
    const reseau = fauxReseau({ personnages: [{ id: "n", nom: "Le curé", pj: false }] });
    const trames = fauxTrames({
      situations: [
        { id: "s1", titre: "Un", castIds: ["n"], debut: 20, fin: 22 },
        { id: "s2", titre: "Deux", castIds: ["n"], debut: 21, fin: 23 },
      ],
    });
    const ds = diagnostics({ reseau, trames, infos: fauxInfos([]) });
    pasOk(ds.some((d) => d.cle === "temps:collision"), "un PNJ simultané est un besoin de recrutement, pas une erreur");
  });
});

suite("Diagnostic — information sans porteur", () => {
  test("une information requise mais détenue par personne est signalée", () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "A" }] });
    const trames = fauxTrames({
      situations: [{ id: "s1", titre: "La scène", requiertIds: ["i1"] }],
    });
    const infos = fauxInfos([{ id: "i1", contenu: "Le secret", etats: {} }]);
    const ds = diagnostics({ reseau, trames, infos });
    ok(ds.some((d) => d.cle === "information:sans-porteur" && d.cible === "i1"));
  });

  test("une information que quelqu'un détient déjà n'est pas signalée", () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "A" }] });
    const trames = fauxTrames({ situations: [{ id: "s1", titre: "La scène", requiertIds: ["i1"] }] });
    const infos = fauxInfos([{ id: "i1", contenu: "Le secret", etats: { a: "sait" } }]);
    const ds = diagnostics({ reseau, trames, infos });
    pasOk(ds.some((d) => d.cle === "information:sans-porteur"));
  });

  test("une information non requise nulle part n'est pas signalée", () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "A" }] });
    const trames = fauxTrames({ situations: [] });
    const infos = fauxInfos([{ id: "i1", contenu: "Sans usage", etats: {} }]);
    const ds = diagnostics({ reseau, trames, infos });
    pasOk(ds.some((d) => d.cle === "information:sans-porteur"));
  });
});

suite("Diagnostic — prise absente", () => {
  test("un PJ absent de toute situation est signalé", () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "Thomas", pj: true }] });
    const trames = fauxTrames({ situations: [] });
    const ds = diagnostics({ reseau, trames, infos: fauxInfos([]) });
    ok(ds.some((d) => d.cle === "prise:absente" && d.cible === "a"));
  });

  test("un PJ simple figurant (castIds) n'est pas absent", () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "A", pj: true }] });
    const trames = fauxTrames({ situations: [{ id: "s1", titre: "S", castIds: ["a"] }] });
    const ds = diagnostics({ reseau, trames, infos: fauxInfos([]) });
    pasOk(ds.some((d) => d.cle === "prise:absente"));
  });

  test("PNJ non concernés — la question ne porte que sur les PJ", () => {
    const reseau = fauxReseau({ personnages: [{ id: "n", nom: "Le curé", pj: false }] });
    const trames = fauxTrames({ situations: [] });
    const ds = diagnostics({ reseau, trames, infos: fauxInfos([]) });
    pasOk(ds.some((d) => d.cle === "prise:absente"));
  });

  test("« héros » s'efface devant « prise:absente » pour la même personne — un seul constat, le plus sévère", () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "A", pj: true }] });
    const trames = fauxTrames({ situations: [] });
    const ds = diagnostics({ reseau, trames, infos: fauxInfos([]) });
    ok(ds.some((d) => d.cle === "prise:absente" && d.cible === "a"));
    pasOk(ds.some((d) => d.cle === "heros" && d.cible === "a"), "le doublon plus faible ne doit pas apparaître à côté");
  });

  test("« héros » reste seul quand le personnage figure ailleurs sans en être le point de vue", () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "A", pj: true }] });
    const trames = fauxTrames({ situations: [{ id: "s1", titre: "S", castIds: ["a"] }] });
    const ds = diagnostics({ reseau, trames, infos: fauxInfos([]) });
    ok(ds.some((d) => d.cle === "heros" && d.cible === "a"), "présent au casting mais jamais point de vue : le signal plus doux s'applique");
    pasOk(ds.some((d) => d.cle === "prise:absente"));
  });
});

suite("Diagnostic — la promesse narrative, et sa prudence", () => {
  const promesse = () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "Elena" }] });
    const trames = fauxTrames({
      situations: [{ id: "s1", titre: "Le carnet", requiertIds: ["i1"], produitIds: ["i2"] }],
    });
    const infos = fauxInfos([
      { id: "i1", contenu: "L'emplacement du carnet", etats: { a: "sait" } },
      { id: "i2", contenu: "Ce que révèle le carnet", etats: {} },
    ]);
    return diagnostics({ reseau, trames, infos }).find((d) => d.cle === "promesse:condition-fragile");
  };

  test("une situation qui promet, tenue par un seul porteur, est signalée", () => {
    const p = promesse();
    ok(p, "un porteur unique doit déclencher le signal");
    ok(p.titre.includes("Le carnet"));
  });

  test("elle est déclarée à confiance MOYENNE — c'est une heuristique, pas un fait", () => {
    eq(promesse().confiance, "moyenne");
  });

  test("une hypothèse ne passe jamais devant un fait : gravité « a-verifier »", () => {
    eq(promesse().gravite, "a-verifier");
  });

  test("LA FORMULATION EST PRUDENTE — jamais une affirmation", () => {
    const p = promesse();
    ok(
      /semble|risque|peut|pourrait/i.test(p.titre),
      "le titre doit être au conditionnel, pas à l'affirmatif",
    );
    ok(
      /peut être voulue|à vous de dire/i.test(p.detail),
      "le détail doit rappeler qu'une fragilité peut être délibérée",
    );
  });

  test("à gravité égale, un fait est trié avant une hypothèse", () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "A" }] });
    const trames = fauxTrames({
      situations: [
        { id: "s1", titre: "Promesse", requiertIds: ["i1"], produitIds: ["i2"] },
        { id: "s2", titre: "Cassée", pointDeVueId: "disparu" },
      ],
    });
    const infos = fauxInfos([
      { id: "i1", contenu: "X", etats: { a: "sait" } },
      { id: "i2", contenu: "Y", etats: {} },
    ]);
    const ds = diagnostics({ reseau, trames, infos }).filter((d) => d.gravite === "a-verifier");
    const iFait = ds.findIndex((d) => d.confiance === "haute");
    const iHypo = ds.findIndex((d) => d.confiance === "moyenne");
    ok(iFait >= 0 && iHypo >= 0, "les deux doivent être présents pour comparer");
    ok(iFait < iHypo, "le fait structurel passe avant l'observation");
  });

  test("une situation qui ne produit rien n'est pas une promesse", () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "A" }] });
    const trames = fauxTrames({ situations: [{ id: "s1", titre: "S", requiertIds: ["i1"] }] });
    const infos = fauxInfos([{ id: "i1", contenu: "X", etats: { a: "sait" } }]);
    pasOk(
      diagnostics({ reseau, trames, infos }).some((d) => d.cle === "promesse:condition-fragile"),
    );
  });

  test("deux porteurs ou plus : la condition n'est plus étroite", () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "A" }, { id: "b", nom: "B" }] });
    const trames = fauxTrames({
      situations: [{ id: "s1", titre: "S", requiertIds: ["i1"], produitIds: ["i2"] }],
    });
    const infos = fauxInfos([
      { id: "i1", contenu: "X", etats: { a: "sait", b: "sait" } },
      { id: "i2", contenu: "Y", etats: {} },
    ]);
    pasOk(
      diagnostics({ reseau, trames, infos }).some((d) => d.cle === "promesse:condition-fragile"),
    );
  });

  test("aucun porteur du tout : c'est « sans porteur », pas une promesse fragile", () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "A" }] });
    const trames = fauxTrames({
      situations: [{ id: "s1", titre: "S", requiertIds: ["i1"], produitIds: ["i2"] }],
    });
    const infos = fauxInfos([
      { id: "i1", contenu: "X", etats: {} },
      { id: "i2", contenu: "Y", etats: {} },
    ]);
    const ds = diagnostics({ reseau, trames, infos });
    ok(ds.some((d) => d.cle === "information:sans-porteur"), "le fait certain s'applique");
    pasOk(
      ds.some((d) => d.cle === "promesse:condition-fragile"),
      "et l'hypothèse ne se surajoute pas — un seul signal par problème",
    );
  });
});

suite("Diagnostic — accessibilité du graphe de trame (D2)", () => {
  const dg = (situations, conclusions) =>
    diagnostics({
      reseau: fauxReseau({ personnages: [{ id: "a", nom: "A" }] }),
      trames: fauxTrames({ situations, conclusions }),
      infos: fauxInfos([]),
    }).filter((d) => d.cle === "acces:boucle-fermee");

  /* ---- les NON-déclenchements : c'est là que se jouent les faux
     positifs, et ils sont plus nombreux que les cas positifs. ---- */

  test("une situation sans conclusion entrante est une RACINE, jamais signalée", () => {
    eq(dg([{ id: "s1", titre: "L'ouverture" }], []).length, 0);
  });

  test("un scénario linéaire ne déclenche rien", () => {
    eq(
      dg(
        [
          { id: "s1", titre: "Un" },
          { id: "s2", titre: "Deux" },
          { id: "s3", titre: "Trois" },
        ],
        [
          { id: "c1", de: "s1", vers: "s2" },
          { id: "c2", de: "s2", vers: "s3" },
        ],
      ).length,
      0,
    );
  });

  test("des situations sans AUCUNE conclusion ne déclenchent rien", () => {
    eq(dg([{ id: "s1", titre: "Un" }, { id: "s2", titre: "Deux" }], []).length, 0);
  });

  test("une boucle DANS laquelle une conclusion entre est atteignable", () => {
    eq(
      dg(
        [
          { id: "s0", titre: "La porte" },
          { id: "s1", titre: "Un" },
          { id: "s2", titre: "Deux" },
        ],
        [
          { id: "c0", de: "s0", vers: "s1" },
          { id: "c1", de: "s1", vers: "s2" },
          { id: "c2", de: "s2", vers: "s1" },
        ],
      ).length,
      0,
      "on y entre par « La porte » : la boucle n'est pas fermée",
    );
  });

  test("une conclusion SANS cible ne ferme rien — c'est une question ouverte, pas une erreur", () => {
    eq(
      dg(
        [{ id: "s1", titre: "Un" }, { id: "s2", titre: "Deux" }],
        [{ id: "c1", de: "s1", vers: null }],
      ).length,
      0,
    );
  });

  test("une conclusion vers une situation supprimée ne fait pas d'une racine une impasse", () => {
    eq(
      dg(
        [{ id: "s1", titre: "Un" }],
        [{ id: "c1", de: "s1", vers: "disparue" }],
      ).length,
      0,
    );
  });

  /* ---- les vrais cas ---- */

  test("deux situations qui se renvoient l'une à l'autre, sans entrée, sont signalées", () => {
    const r = dg(
      [{ id: "s1", titre: "Un" }, { id: "s2", titre: "Deux" }],
      [
        { id: "c1", de: "s1", vers: "s2" },
        { id: "c2", de: "s2", vers: "s1" },
      ],
    );
    eq(r.length, 1, "une carte pour la boucle, pas une par situation");
    ok(r[0].detail.includes("Un") && r[0].detail.includes("Deux"), "les deux sont nommées");
  });

  test("une situation qui ne pointe que vers elle-même est signalée", () => {
    const r = dg([{ id: "s1", titre: "Le rituel" }], [{ id: "c1", de: "s1", vers: "s1" }]);
    eq(r.length, 1);
    ok(r[0].titre.includes("sauf elle-même"));
  });

  test("deux boucles séparées font deux cartes", () => {
    const r = dg(
      [
        { id: "a1", titre: "A1" },
        { id: "a2", titre: "A2" },
        { id: "b1", titre: "B1" },
        { id: "b2", titre: "B2" },
      ],
      [
        { id: "c1", de: "a1", vers: "a2" },
        { id: "c2", de: "a2", vers: "a1" },
        { id: "c3", de: "b1", vers: "b2" },
        { id: "c4", de: "b2", vers: "b1" },
      ],
    );
    eq(r.length, 2);
  });

  test("une boucle de trois fait UNE carte qui les compte", () => {
    const r = dg(
      [
        { id: "s1", titre: "Un" },
        { id: "s2", titre: "Deux" },
        { id: "s3", titre: "Trois" },
      ],
      [
        { id: "c1", de: "s1", vers: "s2" },
        { id: "c2", de: "s2", vers: "s3" },
        { id: "c3", de: "s3", vers: "s1" },
      ],
    );
    eq(r.length, 1);
    ok(/2 autres/.test(r[0].titre), `le titre doit compter les autres — obtenu « ${r[0].titre} »`);
  });

  /* ---- la prudence, qui est la condition de ce signal ---- */

  test("elle est déclarée à confiance MOYENNE et rangée en « a-verifier »", () => {
    const r = dg(
      [{ id: "s1", titre: "Un" }, { id: "s2", titre: "Deux" }],
      [
        { id: "c1", de: "s1", vers: "s2" },
        { id: "c2", de: "s2", vers: "s1" },
      ],
    );
    eq(r[0].confiance, "moyenne");
    eq(r[0].gravite, "a-verifier");
  });

  test("le détail RAPPELLE qu'une scène peut se déclencher hors du modèle", () => {
    const r = dg(
      [{ id: "s1", titre: "Un" }, { id: "s2", titre: "Deux" }],
      [
        { id: "c1", de: "s1", vers: "s2" },
        { id: "c2", de: "s2", vers: "s1" },
      ],
    );
    ok(
      /hors du modèle|improvise|à la main/i.test(r[0].detail),
      "sans ce rappel, l'outil affirmerait une impossibilité qu'il ne peut pas constater",
    );
    ok(/écartez/i.test(r[0].detail), "et il propose explicitement d'écarter");
  });

  test("la cible est stable quel que soit l'ordre de lecture — la dérogation doit survivre", () => {
    const boucle = (situations) =>
      dg(situations, [
        { id: "c1", de: "s1", vers: "s2" },
        { id: "c2", de: "s2", vers: "s1" },
      ])[0].cible;
    eq(
      boucle([{ id: "s1", titre: "Un" }, { id: "s2", titre: "Deux" }]),
      boucle([{ id: "s2", titre: "Deux" }, { id: "s1", titre: "Un" }]),
    );
  });
});

suite("Diagnostic — références orphelines", () => {
  test("un point de vue supprimé est signalé", () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "A" }] });
    const trames = fauxTrames({
      situations: [{ id: "s1", titre: "S", pointDeVueId: "disparu" }],
    });
    const ds = diagnostics({ reseau, trames, infos: fauxInfos([]) });
    ok(ds.some((d) => d.cle === "reference:orpheline" && d.cible.includes("disparu")));
  });

  test("un casting entièrement vivant ne déclenche rien", () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "A" }] });
    const trames = fauxTrames({ situations: [{ id: "s1", titre: "S", pointDeVueId: "a", castIds: ["a"] }] });
    const ds = diagnostics({ reseau, trames, infos: fauxInfos([]) });
    pasOk(ds.some((d) => d.cle === "reference:orpheline"));
  });
});

suite("Diagnostic — fragilité (défection résumée)", () => {
  test("une fragilité isolée (un seul dégât) reste sous le seuil", () => {
    const reseau = fauxReseau({
      personnages: [
        { id: "a", nom: "A", pj: true },
        { id: "b", nom: "B", pj: true },
      ],
    });
    const trames = fauxTrames({ situations: [{ id: "s1", titre: "S", pointDeVueId: "a", castIds: ["a", "b"] }] });
    const ds = diagnostics({ reseau, trames, infos: fauxInfos([]) });
    pasOk(ds.some((d) => d.cle === "fragilite:defection" && d.cible === "a"), "un seul dégât ne mérite pas d'alerte — la conscience le couvre déjà via « défection »");
  });

  test("regroupé par catégorie, pour l'affichage du cockpit", () => {
    const reseau = fauxReseau({ personnages: [{ id: "a", nom: "Elena", pj: true }] });
    const g = parCategorie({ reseau, trames: fauxTrames({ situations: [] }), infos: fauxInfos([]) });
    ok(Array.isArray(g.personnage) && g.personnage.length > 0);
  });
});
