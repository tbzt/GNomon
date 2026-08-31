"use strict";

/* ============================================================
   UNE BASE FACTICE, ET ELLE APPLIQUE LA VRAIE RÈGLE.
   ------------------------------------------------------------
   Elle n'imite pas Firebase : elle en reprend le seul comportement
   dont le moteur dépend — **une écriture n'est acceptée que si sa
   révision vaut exactement la précédente plus un.** C'est ce que dit
   `firebase.rules.json`, et c'est ce qui empêche deux personnes parties
   du même point d'écrire l'une après l'autre.

   Reproduire la règle ici sert à deux choses. D'abord éprouver le
   moteur sans compte ni réseau. Ensuite — et c'est le vrai gain —
   vérifier qu'il se comporte bien QUAND IL EST REFUSÉ : c'est le
   chemin qu'on ne joue jamais à la main, et c'est celui qui perd du
   travail quand il est faux.

   `depot()` et `registre()` en mémoire complètent le trio, pour monter
   deux pairs sur une même base sans rien persister.
   ============================================================ */

/** La base partagée. Un seul objet, plusieurs pairs branchés dessus. */
export function fauxDistant() {
  const branche = {};
  let refus = 0;

  return {
    /** Ce que la base contient, tel que `remote.lireTout` le rend. */
    async lireTout() {
      return JSON.parse(JSON.stringify(branche));
    },

    /** La règle, telle quelle : `rev` doit valoir la suivante. */
    async ecrire(chemin, d, rev, { sup = false } = {}) {
      const actuel = branche[chemin];
      const attendue = (Number(actuel?.rev) || 0) + 1;
      const proposee = (Number(rev) || 0) + 1;
      if (proposee !== attendue) {
        refus++;
        const e = new Error("Ce document a été modifié depuis que vous l'avez ouvert.");
        e.name = "ConflitError";
        throw e;
      }
      branche[chemin] = sup
        ? { rev: proposee, par: "test", sup: true }
        : { rev: proposee, par: "test", d: JSON.parse(JSON.stringify(d)) };
      return proposee;
    },

    /* --- pour les tests --- */
    _branche: () => branche,
    _refus: () => refus,
    /** Une écriture faite par quelqu'un d'autre, hors de tout pair. */
    _ecrireDehors(chemin, d) {
      const rev = (Number(branche[chemin]?.rev) || 0) + 1;
      branche[chemin] = { rev, par: "quelquun-dautre", d };
      return rev;
    },
  };
}

/** Un dépôt local en mémoire : les neuf blocs d'un GN. */
export function fauxDepot(blocs = {}) {
  const b = JSON.parse(JSON.stringify(blocs));
  return {
    lire: (cle) => (cle in b ? b[cle] : null),
    ecrire: (cle, bloc) => {
      b[cle] = bloc;
    },
    _blocs: () => b,
  };
}

/** Un registre en mémoire. */
export function fauxRegistre(depart = {}) {
  let r = JSON.parse(JSON.stringify(depart));
  return {
    lire: () => r,
    ecrire: (n) => {
      r = JSON.parse(JSON.stringify(n));
    },
    _etat: () => r,
  };
}
