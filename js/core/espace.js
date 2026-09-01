"use strict";

/* ============================================================
   ESPACE — le rattachement d'un GN, et le tour de synchronisation.
   ------------------------------------------------------------
   `remote.js` sait parler à la base. `sync.js` sait décider quoi
   pousser et quoi tirer. Il manquait ce qui les marie, et surtout la
   réponse à une question qu'aucun des deux ne porte : **ce GN-ci est
   rattaché à quel espace ?**

   ── LE RATTACHEMENT EST UNE CLÉ D'APPAREIL ──
   Il ne va PAS dans les clés du projet, et ce n'est pas un détail de
   rangement. Une archive qui porterait le rattachement brancherait le
   GN de quelqu'un d'autre sur votre espace à la première fusion — ou,
   pire, le vôtre sur le sien. Le rattachement se fait par un geste
   explicite, fait par quelqu'un de connecté ; il ne se reçoit pas dans
   un fichier.

   Même raisonnement que le registre de `sync.js`, et même forme :
   une clé par projet, hors du GN.

   ── CE MODULE NE DÉCIDE RIEN DE LA FUSION ──
   Il assemble : il donne à `synchroniser()` le dépôt, le registre et un
   distant lié à (espace, gn). Toute la logique de décision reste dans
   `sync.js`, qui est éprouvé hors ligne — ce module-ci ne fait que le
   brancher sur la vraie base.
   ============================================================ */
import * as Remote from "./remote.js";
import { synchroniser, registreDe, depotDe } from "./sync.js";
import { Storage } from "./storage.js";

/**
 * Le rattachement d'un projet, sous une clé d'**appareil** — même forme
 * et même idiome que `registreDe` dans `sync.js` : `Storage` est
 * **injecté**, donc ceci s'éprouve avec un faux et sans toucher au
 * `localStorage`.
 *
 * `oublier()` jette aussi le registre : le garder ferait croire, lors
 * d'un rattachement ultérieur, qu'on connaît des révisions qu'on n'a
 * plus aucune raison de croire à jour. Repartir de zéro converge, et
 * c'est déjà testé (`sync.test.js`, « un pair qui perd son registre ne
 * casse rien »).
 */
export function rattachementDe(Storage, projetId) {
  const cle = `espace_${projetId}`;
  return {
    lire() {
      const r = Storage.get(cle, null);
      return r && r.espace && r.gn ? { espace: r.espace, gn: r.gn } : null;
    },
    ecrire(espace, gn) {
      if (!projetId || !espace || !gn) return null;
      Storage.set(cle, { espace, gn });
      return this.lire();
    },
    oublier() {
      Storage.remove(cle);
      registreDe(Storage, projetId).oublier();
    },
  };
}

/* ---- Les commodités, sur le Storage réel ---------------------------
   L'écran n'a pas à injecter le singleton à chaque appel ; le module
   testable est au-dessus, celles-ci ne font que le brancher. */

export function rattachement(projetId) {
  return rattachementDe(Storage, projetId).lire();
}

export function rattacher(projetId, espace, gn) {
  return rattachementDe(Storage, projetId).ecrire(espace, gn);
}

/** Détacher NE touche pas au GN local : il reste entier, il cesse
    seulement de parler à la base. */
export function detacher(projetId) {
  rattachementDe(Storage, projetId).oublier();
}

/** Le distant, lié à un GN précis — la forme qu'attend `synchroniser`.
    C'est l'unique adaptateur entre les deux modules. */
export function distantDe(espace, gn) {
  return {
    lireTout: () => Remote.lireTout(espace, gn),
    ecrire: (chemin, d, rev, options) => Remote.ecrire(espace, gn, chemin, d, rev, options),
  };
}

/**
 * Un tour complet pour le projet rattaché. Renvoie le rapport de
 * `synchroniser()`, ou `{ ok: false, raison }` si les conditions ne
 * sont pas réunies — on ne lance pas un tour à moitié.
 */
export async function tour(projetId) {
  if (!Remote.configure()) return { ok: false, raison: "L'espace n'est pas configuré." };
  if (!Remote.session()) return { ok: false, raison: "Il faut être connecté." };
  const r = rattachement(projetId);
  if (!r) return { ok: false, raison: "Ce GN n'est rattaché à aucun espace." };

  return synchroniser(depotDe(Storage), distantDe(r.espace, r.gn), registreDe(Storage, projetId));
}
