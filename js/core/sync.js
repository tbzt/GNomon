"use strict";

/* ============================================================
   SYNC — marier le GN local et l'espace partagé.
   ------------------------------------------------------------
   Trois choses entrent, et aucune n'est un singleton :

       depot     { lire(cle), ecrire(cle, bloc) }      les blocs locaux
       distant   { lireTout(), ecrire(chemin, d, rev, o) }  déjà lié à un GN
       registre  { lire(), ecrire(r) }                 ce qu'on croit savoir

   C'est ce qui rend ce module **testable sans base ni compte** : on lui
   donne un distant factice, on joue deux pairs, et on vérifie qu'ils
   convergent. Un moteur de synchronisation qu'on ne peut éprouver qu'en
   production n'est pas un moteur, c'est un pari.

   ── LE REGISTRE, ET POURQUOI IL N'EST PAS DANS LE MODÈLE ──
   Pour savoir si un personnage a changé depuis la dernière fois, il
   faut se souvenir de la dernière fois. On pourrait poser un `_rev` sur
   chaque objet — et il partirait dans l'archive, dans les livrets, dans
   le trombinoscope. Le registre est donc **à côté** : une table
   `chemin → { rev, empreinte }`, rangée sous une clé d'appareil.

   Conséquence voulue : exporter puis réimporter un GN ailleurs perd le
   registre, et la synchronisation suivante repart de zéro. Elle
   convergera quand même — c'est ce que prouve le test « un pair qui
   perd son registre ne casse rien ».

   ── CE QU'ON FAIT D'UN CONFLIT ──
   Deux personnes ont écrit le même objet depuis le même point. Trois
   réponses possibles, et deux sont mauvaises :

   · garder le local — la version de l'autre est perdue, en silence ;
   · prendre le distant sans rien dire — la sienne l'est ;
   · **prendre le distant ET rendre le local dans le rapport.**

   On fait le troisième. Tout le monde converge, et rien n'est détruit :
   la version écartée revient à l'appelant, qui la montre. C'est la même
   règle que l'archive — « on peut toujours réimporter, jamais
   ressusciter ce qui a été écrasé » — appliquée à chaud.

   ── LA PIERRE TOMBALE ──
   Supprimer, c'est écrire `{ sup: true }` avec la révision suivante,
   jamais effacer la branche. Effacer perdrait la révision, et le pair
   qui détient encore l'objet le repousserait à la synchronisation
   suivante : ce qu'on a supprimé reviendrait tout seul.
   ============================================================ */
import { decouperTout, recoudre, empreinte, chemin as versChemin, planDe } from "./objets.js";
import { CLES_PROJET } from "./storage.js";
import { normaliserDocument, resumeAnomalies } from "./normaliser.js";
import { Debug } from "./debug.js";

/** Les décisions possibles pour un chemin. Nommées, parce que le
    rapport les rend telles quelles et qu'un écran doit pouvoir les
    compter sans les traduire. */
export const ACTES = Object.freeze({
  rien: "rien",
  pousser: "pousser",
  tirer: "tirer",
  poserTombe: "poserTombe",
  tirerTombe: "tirerTombe",
  conflit: "conflit",
});

/* ================= La décision ================= */

/**
 * Que faire de ce chemin ? Fonction **pure** : trois états entrent, un
 * acte sort. C'est le cœur du module, et c'est pour ça qu'elle est
 * séparée — on peut l'éprouver cas par cas, sans rien monter.
 *
 * `L` local (ou `undefined`), `D` distant (ou `undefined`),
 * `R` registre (ou `undefined`).
 */
export function decider(L, D, R) {
  const localPresent = L !== undefined;
  const distantPresent = D !== undefined;
  const tombe = distantPresent && !!D.sup;
  const revD = distantPresent ? Number(D.rev) || 0 : 0;

  // Ce que le registre dit de ce qu'on a poussé ou tiré en dernier.
  const revConnue = R ? Number(R.rev) || 0 : 0;
  const localChange = localPresent && (!R || empreinte(L) !== R.empreinte);
  const distantAvance = distantPresent && revD !== revConnue;

  /* ---- Rien à distance ---- */
  if (!distantPresent) {
    if (!localPresent) return { acte: ACTES.rien };
    // Jamais poussé, ou branche disparue : on (re)pousse.
    return { acte: ACTES.pousser, rev: revConnue };
  }

  /* ---- Une pierre tombale à distance ---- */
  if (tombe) {
    if (!localPresent) return { acte: ACTES.rien, rev: revD };
    // Quelqu'un a supprimé ce que je détiens encore.
    if (localChange) return { acte: ACTES.conflit, rev: revD, cause: "supprimé ailleurs" };
    return { acte: ACTES.tirerTombe, rev: revD };
  }

  /* ---- Un objet à distance ---- */
  if (!localPresent) {
    // Supprimé ici, mais on l'avait : on propage la suppression.
    if (R && !distantAvance) return { acte: ACTES.poserTombe, rev: revD };
    // Jamais vu : c'est un objet neuf venu d'ailleurs.
    if (!R) return { acte: ACTES.tirer, rev: revD };
    // Supprimé ici ET modifié ailleurs : l'autre a écrit après nous.
    return { acte: ACTES.conflit, rev: revD, cause: "modifié après votre suppression" };
  }

  if (!localChange && !distantAvance) return { acte: ACTES.rien, rev: revD };
  if (localChange && !distantAvance) return { acte: ACTES.pousser, rev: revD };
  if (!localChange && distantAvance) return { acte: ACTES.tirer, rev: revD };

  // Les deux ont bougé. Sauf s'ils ont écrit la même chose — cas plus
  // fréquent qu'on ne croit (deux personnes cochent la même case) :
  // ce n'est pas un conflit, c'est un accord.
  if (empreinte(L) === empreinte(D.d)) return { acte: ACTES.tirer, rev: revD };
  return { acte: ACTES.conflit, rev: revD, cause: "modifié des deux côtés" };
}

/* ================= La synchronisation ================= */

/**
 * Un tour complet. Renvoie un rapport :
 *
 *   { ok, pousses, tires, tombes, conflits: [{ chemin, local, distant }],
 *     refus, actes }
 *
 * Les conflits portent **la version locale écartée** : c'est elle qu'un
 * écran doit pouvoir remontrer, sans quoi la promesse « rien n'est
 * détruit » n'en serait pas une.
 */
export async function synchroniser(depot, distant, registre) {
  const rapport = {
    ok: true,
    pousses: 0,
    tires: 0,
    tombes: 0,
    conflits: [],
    refus: [],
    anomalies: [],
    actes: {},
  };

  /* 1. Ce que chacun détient. */
  const blocs = {};
  for (const cle of CLES_PROJET) blocs[cle] = depot.lire(cle);

  const locaux = new Map();
  for (const d of decouperTout(blocs)) locaux.set(versChemin(d.collection, d.id), d);

  let distants;
  try {
    distants = await distant.lireTout();
  } catch (e) {
    return { ...rapport, ok: false, raison: e.message };
  }

  const reg = registre.lire() || {};
  const chemins = new Set([...locaux.keys(), ...Object.keys(distants), ...Object.keys(reg)]);

  /* 2. Décider, puis agir. On collecte les tirages AVANT d'écrire quoi
        que ce soit localement : recoudre un bloc demande de connaître
        tous ses documents, pas seulement celui qui a changé. */
  const aRecoudre = new Map(); // chemin → document (ou null pour retirer)
  const aPousser = [];

  for (const c of chemins) {
    const L = locaux.get(c)?.d;
    const D = distants[c];
    const R = reg[c];
    const d = decider(L, D, R);
    rapport.actes[d.acte] = (rapport.actes[d.acte] || 0) + 1;

    switch (d.acte) {
      case ACTES.pousser:
        aPousser.push({ chemin: c, d: L, rev: d.rev, sup: false });
        break;
      case ACTES.poserTombe:
        aPousser.push({ chemin: c, d: null, rev: d.rev, sup: true });
        break;
      case ACTES.tirer: {
        // ── CE QUI ARRIVE VIENT DE QUELQU'UN D'AUTRE ──
        // C'est la différence avec l'archive : personne n'a choisi
        // d'ouvrir ce document-là. Un lien du hub voyage avec son `url`,
        // qui sera rendue dans un `href` sans repasser par la porte de
        // `LiensStore`. On normalise donc à l'entrée, comme l'import.
        const n = normaliserDocument(collectionDe(c), D.d, idDe(c));
        rapport.anomalies.push(...n.anomalies);
        if (n.d === null) {
          // Écarté : on retient quand même sa révision, sinon on le
          // re-tirerait à chaque tour sans jamais l'accepter.
          reg[c] = { rev: d.rev, empreinte: null };
          break;
        }
        aRecoudre.set(c, n.d);
        reg[c] = { rev: d.rev, empreinte: empreinte(n.d) };
        break;
      }
      case ACTES.tirerTombe:
        aRecoudre.set(c, null);
        reg[c] = { rev: d.rev, empreinte: null };
        break;
      case ACTES.conflit: {
        // Le distant l'emporte pour que tout le monde converge ; le
        // local part dans le rapport, entier, pour ne rien perdre. Il
        // passe par la même normalisation que les tirages : un conflit
        // n'est pas une raison d'accepter n'importe quoi.
        const n = D.sup ? { d: null, anomalies: [] } : normaliserDocument(collectionDe(c), D.d, idDe(c));
        rapport.anomalies.push(...n.anomalies);
        rapport.conflits.push({ chemin: c, cause: d.cause, local: L, distant: n.d });
        aRecoudre.set(c, n.d);
        reg[c] = { rev: d.rev, empreinte: n.d === null ? null : empreinte(n.d) };
        break;
      }
      default:
        if (d.rev) reg[c] = { rev: d.rev, empreinte: L === undefined ? null : empreinte(L) };
    }
  }

  /* 3. Écrire localement ce qu'on a tiré. */
  if (aRecoudre.size) {
    for (const [c, valeur] of aRecoudre) {
      const info = locaux.get(c);
      const collection = info ? info.collection : collectionDe(c);
      const id = info ? info.id : idDe(c);
      if (valeur === null) locaux.delete(c);
      else locaux.set(c, { collection, id, d: valeur });
    }
    const docs = [...locaux.values()];
    for (const cle of CLES_PROJET) {
      if (!planDe(cle)) continue;
      depot.ecrire(cle, recoudre(cle, docs));
    }
    rapport.tires = [...aRecoudre.values()].filter((v) => v !== null).length;
    rapport.tombes = [...aRecoudre.values()].filter((v) => v === null).length;
  }

  /* 4. Pousser. Un refus n'arrête pas le tour : les autres documents
        n'ont rien à voir avec celui qui coince, et tout suspendre pour
        un personnage rendrait la synchronisation inutilisable dès qu'un
        objet pose problème. */
  for (const p of aPousser) {
    try {
      const rev = await distant.ecrire(p.chemin, p.d, p.rev, { sup: p.sup });
      reg[p.chemin] = { rev, empreinte: p.sup ? null : empreinte(p.d) };
      if (p.sup) rapport.tombes++;
      else rapport.pousses++;
    } catch (e) {
      rapport.refus.push({ chemin: p.chemin, raison: e.message });
      rapport.ok = false;
    }
  }

  registre.ecrire(reg);
  rapport.reparations = resumeAnomalies(rapport.anomalies);
  Debug.log("espace", "synchronisation", {
    pousses: rapport.pousses,
    tires: rapport.tires,
    conflits: rapport.conflits.length,
    refus: rapport.refus.length,
  });
  return rapport;
}

function collectionDe(c) {
  return c.slice(0, c.indexOf("/")).replace(/~/g, ".");
}

function idDe(c) {
  return decodeURIComponent(c.slice(c.indexOf("/") + 1));
}

/* ================= Le registre, rangé ================= */

/**
 * Le registre d'un projet, sous une clé d'**appareil** : il décrit ce
 * que CET appareil a vu, pas le GN. Deux personnes n'ont pas le même,
 * et il n'a rien à faire dans une archive.
 */
export function registreDe(Storage, projetId) {
  const cle = `sync_${projetId}`;
  return {
    lire: () => Storage.get(cle, {}) || {},
    ecrire: (r) => Storage.set(cle, r),
    oublier: () => Storage.remove(cle),
  };
}

/** Le dépôt local, vu par le moteur : neuf blocs qu'on lit et qu'on
    écrit. Passer par `Storage` et non par les stores est délibéré — le
    moteur range des blocs, il n'a pas à connaître les invariants de
    chacun, et les stores se rechargeront après. */
export function depotDe(Storage) {
  return {
    lire: (cle) => Storage.get(cle, null),
    ecrire: (cle, bloc) => Storage.set(cle, bloc),
  };
}
