"use strict";

/* ============================================================
   Le moteur de synchronisation, éprouvé à deux pairs.

   Ce qu'on cherche n'est pas « ça marche » mais **ça converge** : deux
   personnes qui écrivent chacune de leur côté doivent finir avec le
   même GN, sans qu'aucune ne perde ce qu'elle a écrit sans le savoir.

   Tout est hors ligne. La base factice applique la vraie règle de
   révision, donc le chemin du REFUS est joué pour de bon — c'est celui
   qu'on ne teste jamais à la main, et celui qui coûte un après-midi
   quand il est faux.
   ============================================================ */
import { suite, test, eq, ok, pasOk, eqDonnees } from "./harnais.js";
import { synchroniser, decider, ACTES } from "../js/core/sync.js";
import { fauxDistant, fauxDepot, fauxRegistre } from "./fauxdistant.js";
import { empreinte } from "../js/core/objets.js";

/** Un personnage de la forme que `ReseauStore.creerPersonnage` produit.

    Un objet minuscule (`{id, nom, pj}`) ferait un mauvais témoin : la
    normalisation d'entrée le complèterait en le tirant de la base, son
    empreinte changerait, et le tour suivant le croirait modifié
    localement — un conflit que l'application ne connaît pas, puisque
    ses objets sont complets dès leur création. On teste donc contre la
    forme réelle. L'idempotence de la normalisation sur cette forme est
    éprouvée dans `normaliser.test.js`. */
const perso = (id, nom, extra = {}) => ({
  id,
  nom,
  role: "",
  pj: true,
  groupeId: null,
  roleId: null,
  epoqueId: null,
  fonction: null,
  moral: "",
  desir: "",
  besoin: "",
  faiblesse: "",
  pouvoirs: "",
  transformation: "",
  archetype: "",
  surprise: false,
  notes: "",
  background: "",
  style: "",
  objectifs: [],
  possede: [],
  pressions: [],
  portrait: "",
  images: [],
  x: null,
  y: null,
  ...extra,
});
const gn = (personnages) => ({ reseau: { personnages, liens: [], groupes: [], sieges: [] } });

/** Un pair : son dépôt, son registre, et un tour de synchronisation. */
function pair(distant, blocs) {
  const depot = fauxDepot(blocs);
  const registre = fauxRegistre();
  return {
    depot,
    registre,
    sync: () => synchroniser(depot, distant, registre),
    persos: () => depot._blocs().reseau.personnages,
    ecrire: (persos) => depot.ecrire("reseau", { personnages: persos, liens: [], groupes: [], sieges: [] }),
  };
}

suite("Sync — la décision, cas par cas", () => {
  const L = { id: "p1", nom: "Elena" };
  const R = { rev: 3, empreinte: empreinte(L) };

  test("rien de neuf des deux côtés : on ne touche à rien", () => {
    eq(decider(L, { rev: 3, d: L }, R).acte, ACTES.rien);
  });

  test("un objet neuf ici part à distance", () => {
    eq(decider(L, undefined, undefined).acte, ACTES.pousser);
  });

  test("un objet neuf là-bas arrive ici", () => {
    eq(decider(undefined, { rev: 1, d: L }, undefined).acte, ACTES.tirer);
  });

  test("modifié ici seulement : on pousse", () => {
    eq(decider({ ...L, nom: "Elena V." }, { rev: 3, d: L }, R).acte, ACTES.pousser);
  });

  test("modifié là-bas seulement : on tire", () => {
    eq(decider(L, { rev: 4, d: { ...L, nom: "Elena F." } }, R).acte, ACTES.tirer);
  });

  test("supprimé ici : on pose une pierre tombale", () => {
    eq(decider(undefined, { rev: 3, d: L }, R).acte, ACTES.poserTombe);
  });

  test("supprimé là-bas : on suit", () => {
    eq(decider(L, { rev: 4, sup: true }, R).acte, ACTES.tirerTombe);
  });

  test("modifié des deux côtés : conflit", () => {
    const d = decider({ ...L, nom: "ici" }, { rev: 4, d: { ...L, nom: "là-bas" } }, R);
    eq(d.acte, ACTES.conflit);
    eq(d.cause, "modifié des deux côtés");
  });

  test("les deux ont écrit LA MÊME chose : ce n'est pas un conflit", () => {
    // Deux personnes cochent la même case. Crier au conflit là-dessus
    // apprendrait à l'équipe à ignorer les conflits.
    const pareil = { ...L, nom: "Elena V." };
    eq(decider(pareil, { rev: 4, d: pareil }, R).acte, ACTES.tirer);
  });

  test("supprimé ici, modifié là-bas : conflit, pas une suppression", () => {
    eq(decider(undefined, { rev: 9, d: L }, R).acte, ACTES.conflit);
  });

  test("modifié ici, supprimé là-bas : conflit aussi", () => {
    const d = decider({ ...L, nom: "j'écrivais" }, { rev: 9, sup: true }, R);
    eq(d.acte, ACTES.conflit);
    eq(d.cause, "supprimé ailleurs");
  });
});

suite("Sync — deux pairs convergent", () => {
  test("le premier tour envoie tout, le second n'envoie rien", async () => {
    const base = fauxDistant();
    const a = pair(base, gn([perso("p1", "Elena"), perso("p2", "Marek")]));

    const un = await a.sync();
    eq(un.pousses, 2);
    ok(un.ok);

    // Rien n'a bougé : le tour suivant doit être muet. Sans empreinte
    // stable, l'outil repousserait tout le GN à chaque tour.
    const deux = await a.sync();
    eq(deux.pousses, 0);
    eq(deux.tires, 0);
    eq(deux.actes.rien, 2);
  });

  test("ce que l'un écrit, l'autre le reçoit", async () => {
    const base = fauxDistant();
    const a = pair(base, gn([perso("p1", "Elena")]));
    const b = pair(base, gn([]));

    await a.sync();
    const r = await b.sync();
    eq(r.tires, 1);
    eq(b.persos().length, 1);
    eq(b.persos()[0].nom, "Elena");
  });

  test("deux auteurs, deux personnages différents : AUCUN conflit", async () => {
    // C'est la raison d'être de la maille par objet. En synchronisant
    // par bloc, ces deux-là se marcheraient dessus à chaque frappe.
    const base = fauxDistant();
    const a = pair(base, gn([perso("p1", "Elena"), perso("p2", "Marek")]));
    const b = pair(base, gn([perso("p1", "Elena"), perso("p2", "Marek")]));
    await a.sync();
    await b.sync();

    a.ecrire([perso("p1", "Elena Fabre"), perso("p2", "Marek")]);
    b.ecrire([perso("p1", "Elena"), perso("p2", "Marek Solt")]);

    const ra = await a.sync();
    const rb = await b.sync();
    eq(ra.conflits.length, 0);
    eq(rb.conflits.length, 0);

    await a.sync();
    const noms = (p) => p.persos().map((x) => x.nom).sort();
    eqDonnees(noms(a), ["Elena Fabre", "Marek Solt"]);
    eqDonnees(noms(b), ["Elena Fabre", "Marek Solt"]);
  });

  test("une suppression ne ressuscite pas au tour suivant", async () => {
    // Sans pierre tombale, le pair qui détient encore l'objet le
    // repousserait, et ce qu'on a supprimé reviendrait tout seul.
    const base = fauxDistant();
    const a = pair(base, gn([perso("p1", "Elena"), perso("p2", "Marek")]));
    const b = pair(base, gn([]));
    await a.sync();
    await b.sync();
    eq(b.persos().length, 2);

    a.ecrire([perso("p1", "Elena")]); // Marek retiré
    await a.sync();
    await b.sync();
    eq(b.persos().length, 1, "b a suivi la suppression");

    // Et le tour d'après ne le fait pas revenir.
    await a.sync();
    await b.sync();
    eq(a.persos().length, 1);
    eq(b.persos().length, 1);
  });

  test("un conflit prend le distant ET rend le local — rien n'est perdu", async () => {
    const base = fauxDistant();
    const a = pair(base, gn([perso("p1", "Elena")]));
    const b = pair(base, gn([perso("p1", "Elena")]));
    await a.sync();
    await b.sync();

    a.ecrire([perso("p1", "Elena", { moral: "écrit par A" })]);
    b.ecrire([perso("p1", "Elena", { moral: "écrit par B" })]);

    await a.sync(); // A passe le premier
    const rb = await b.sync(); // B part du même point : conflit

    eq(rb.conflits.length, 1);
    eq(rb.conflits[0].cause, "modifié des deux côtés");
    eq(rb.conflits[0].local.moral, "écrit par B", "la version écartée est rendue entière");
    eq(rb.conflits[0].distant.moral, "écrit par A");
    eq(b.persos()[0].moral, "écrit par A", "on converge sur le distant");
  });

  test("après un conflit, les deux pairs sont d'accord", async () => {
    const base = fauxDistant();
    const a = pair(base, gn([perso("p1", "Elena")]));
    const b = pair(base, gn([perso("p1", "Elena")]));
    await a.sync();
    await b.sync();
    a.ecrire([perso("p1", "Elena", { moral: "A" })]);
    b.ecrire([perso("p1", "Elena", { moral: "B" })]);
    await a.sync();
    await b.sync();
    await a.sync();
    await b.sync();
    eqDonnees(a.persos(), b.persos());
  });

  test("un pair qui perd son registre ne casse rien", async () => {
    // C'est le cas d'un GN exporté puis réimporté ailleurs : le
    // registre est une clé d'appareil, il ne suit pas. La
    // synchronisation doit repartir de zéro et converger quand même.
    const base = fauxDistant();
    const a = pair(base, gn([perso("p1", "Elena")]));
    await a.sync();

    const c = pair(base, gn([perso("p1", "Elena")])); // même contenu, aucun registre
    const rc = await c.sync();
    eq(rc.conflits.length, 0, "un contenu identique n'est pas un conflit");
    eq(rc.pousses, 0, "et il n'y a rien à repousser");
  });

  test("un refus de la base ne fait pas perdre le reste du tour", async () => {
    const base = fauxDistant();
    const a = pair(base, gn([perso("p1", "Elena"), perso("p2", "Marek")]));
    await a.sync();

    // Quelqu'un d'autre écrit p1 sans passer par nous : notre révision
    // n'est plus la bonne, la base refusera.
    base._ecrireDehors("reseau~personnages/p1", { id: "p1", nom: "Elena par un tiers", pj: true });
    a.ecrire([perso("p1", "Elena ici"), perso("p2", "Marek modifié")]);

    const r = await a.sync();
    // p1 est tiré (le distant a avancé, on ne l'avait pas vu) ;
    // p2 part sans encombre. Rien n'est bloqué par l'autre.
    ok(r.conflits.length + r.refus.length >= 1, "l'anomalie sur p1 est signalée");
    eq(base._branche()["reseau~personnages/p2"].d.nom, "Marek modifié", "p2 est bien parti");
  });
});
