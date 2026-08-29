"use strict";

/* ============================================================
   DÉFECTION — « et s'il ne vient pas ? »
   ------------------------------------------------------------
   La question que Morningstar pose à tout le monde et que personne
   n'outille : **la redondance est un choix de design, pas un
   accident.** Un GN écrit sans y penser tient parfois à un seul
   désistement — et on ne s'en aperçoit qu'à J-Jour, quand un courriel
   arrive à 8 h du matin.

   Ce module répond en une fonction, pour un personnage donné :
   qu'est-ce qui casse s'il n'est pas là ?

   ── QUATRE DÉGÂTS, ET ILS NE SE VALENT PAS ──
   1. **Les scènes orphelines** — il en est le point de vue. Personne
      d'autre ne peut la porter : la scène n'aura pas lieu.
   2. **Les scènes fragilisées** — il est au casting. Elle peut tenir
      si d'autres restent, sauf s'il était le dernier PJ.
   3. **Les miroirs perdus** — quelqu'un l'avait pour contact-miroir.
      Kröger : le miroir garantit que personne n'est laissé seul ; le
      perdre, c'est se retrouver seul le soir même.
   4. **Les informations orphelines** — il était le seul à savoir. Ce
      qui devait circuler ne circulera pas, et les scènes qui en
      dépendent tomberont en silence.

   Le quatrième est le plus traître : rien ne se voit, tout se grippe.

   Module **pur** : lit trois stores, n'en mute aucun, ne touche pas au
   DOM.
   ============================================================ */

/**
 * Ce que l'absence d'un personnage emporte.
 *
 *   { personnage, orphelines[], fragilisees[], miroirsPerdus[],
 *     informationsOrphelines[], noeudsTouches:Set, gravite }
 */
export function defection(personnageId, { reseau, trames, infos }) {
  const p = reseau.personnage(personnageId);
  if (!p) return null;

  const situations = trames.situations();

  const orphelines = situations
    .filter((s) => s.pointDeVueId === personnageId)
    .map((s) => ({ titre: s.titre || "Sans titre", id: s.id }));

  const fragilisees = situations
    .filter((s) => s.pointDeVueId !== personnageId && (s.castIds || []).includes(personnageId))
    .map((s) => {
      const restants = (s.castIds || []).filter((id) => {
        const q = reseau.personnage(id);
        return q && q.pj && id !== personnageId;
      });
      return {
        titre: s.titre || "Sans titre",
        id: s.id,
        restants: restants.length,
        // Sans PJ restant, la scène ne se joue plus : c'est le cas que
        // la règle 7 de la conscience compte déjà, vu d'un autre bout.
        morte: restants.length === 0,
      };
    });

  const miroirsPerdus = reseau
    .liens()
    .filter((l) => l.miroir && l.vers === personnageId)
    .map((l) => {
      const q = reseau.personnage(l.de);
      return q ? { id: q.id, nom: q.nom } : null;
    })
    .filter(Boolean);

  const informationsOrphelines = infos
    .informations()
    .filter((i) => {
      const porteurs = infos.detenteurs(i.id);
      return porteurs.length === 1 && porteurs[0] === personnageId;
    })
    .map((i) => ({
      id: i.id,
      contenu: i.contenu || "information sans contenu",
      // Les situations qui la réclament tomberont sans bruit.
      requisePar: trames
        .situationsAvec(i.id)
        .requiert.map((s) => s.titre || "Sans titre"),
    }));

  const noeudsTouches = new Set(miroirsPerdus.map((m) => m.id));
  for (const s of [...orphelines, ...fragilisees]) {
    const sit = trames.situation(s.id);
    for (const id of (sit && sit.castIds) || [])
      if (id !== personnageId) noeudsTouches.add(id);
  }

  const gravite =
    orphelines.length + fragilisees.filter((f) => f.morte).length + informationsOrphelines.length;

  return {
    personnage: p,
    orphelines,
    fragilisees,
    miroirsPerdus,
    informationsOrphelines,
    noeudsTouches,
    gravite,
  };
}

/** Le classement des fragilités : qui, s'il manque, coûte le plus.
    C'est le geste fait quarante fois d'un coup — utile à J-15 pour
    savoir sur qui prévoir une doublure. */
export function classementFragilite(stores) {
  return stores.reseau
    .pj()
    .map((p) => {
      const d = defection(p.id, stores);
      return { personnage: p, gravite: d.gravite, detail: d };
    })
    .filter((x) => x.gravite > 0)
    .sort((a, b) => b.gravite - a.gravite);
}
