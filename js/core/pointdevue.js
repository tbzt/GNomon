"use strict";

/* ============================================================
   POINT DE VUE — le GN vu d'un seul personnage.
   ------------------------------------------------------------
   Pas un moteur de jeu. Une **fiche de lecture dérivée**, qui répond à
   une question et une seule :

       ce personnage a-t-il réellement quelque chose à vivre ?

   Tout est déjà dans les stores — ce module n'invente aucun calcul, il
   assemble ce qui existe déjà sous l'angle d'une personne :

   · ce qu'il sait / croit  → `InformationStore.parPersonnage()`
   · qui il peut contacter  → `ReseauStore.liensDe()`
   · où il est attendu      → les situations qui le portent ou l'ont au
                              casting
   · ce qu'il peut provoquer → `TrameStore.conclusionsDe()` sur ses
                              situations
   · ce qu'il peut apprendre → ce que ses situations `produit`ent et
                              qu'il ne sait pas encore

   ── LE SEUL CALCUL NEUF : LES TROUS ──
   Un intervalle sans aucune scène programmée, entre sa première et sa
   dernière — c'est là qu'un joueur se retrouve à errer. On ne regarde
   qu'ENTRE deux scènes : avant la première et après la dernière, il n'y
   a pas de trou, il y a un début et une fin de GN.

   Une situation **sans horaire** ne compte pas dans les trous, mais
   n'est pas ignorée pour autant : elle est rendue à part. C'est la même
   règle que la frise — beaucoup de scènes n'ont pas d'heure, elles ont
   un déclencheur, et les compter comme des trous inventerait un
   problème (cf. ARCHITECTURE.md §5e).

   Module **pur** : lit trois stores, n'en mute aucun, ne touche pas au
   DOM.
   ============================================================ */

/** Au-delà de ça, un joueur commence à ne plus savoir quoi faire.
    Volontairement généreux : le but est de repérer un vrai désert, pas
    de reprocher une heure de flottement — un GN a besoin de respirer. */
export const TROU_MIN = 1.5;

/**
 * Le GN vu depuis un personnage.
 *
 *   { personnage, sait[], croit[], contacts[], situations[],
 *     sansHoraire[], peutApprendre[], peutProvoquer[], trous[],
 *     aQuelqueChoseAVivre }
 */
export function pointDeVue(personnageId, { reseau, trames, infos }) {
  const p = reseau.personnage(personnageId);
  if (!p) return null;

  const { sait, croit } = infos.parPersonnage(personnageId);

  const contacts = reseau.liensDe(personnageId).map((l) => {
    const q = reseau.personnage(l.vers);
    const retour = reseau.reciproque(l);
    return {
      id: l.vers,
      nom: q ? q.nom : "personnage supprimé",
      nature: l.nature || "",
      tonalite: l.tonalite,
      importance: l.importance,
      miroir: !!l.miroir,
      // Un contact que l'autre ne déclare pas en retour est un contact
      // qu'on ne peut pas tenir pour acquis en jeu.
      reciproque: !!retour,
    };
  });

  const siennes = trames
    .situations()
    .filter((s) => s.pointDeVueId === personnageId || (s.castIds || []).includes(personnageId));

  const situations = siennes.map((s) => ({
    id: s.id,
    titre: s.titre || "Sans titre",
    debut: s.debut,
    fin: s.fin,
    espace: s.espace || "",
    // « Porteur » : c'est SA scène, pas une où il figure. La différence
    // est celle que la règle « héros » de la conscience mesure.
    porteur: s.pointDeVueId === personnageId,
  }));

  const sansHoraire = situations.filter((s) => s.debut == null || s.fin == null);

  // Ce qu'il peut apprendre : produit par une de ses scènes, et qu'il
  // ne sait pas déjà. C'est la réponse à « a-t-il quelque chose à
  // découvrir, ou sait-il déjà tout ce que ses scènes révèlent ? ».
  const dejaSu = new Set(sait.map((i) => i.id));
  const vus = new Set();
  const peutApprendre = [];
  for (const s of siennes)
    for (const id of s.produitIds || []) {
      if (dejaSu.has(id) || vus.has(id)) continue;
      vus.add(id);
      const i = infos.information(id);
      if (i)
        peutApprendre.push({
          id: i.id,
          contenu: i.contenu || "information sans contenu",
          depuis: s.titre || "Sans titre",
        });
    }

  // Ce qu'il peut provoquer : les conclusions écrites de ses scènes.
  // Une conclusion sans suite n'est pas retirée — c'est une question
  // ouverte, l'état normal d'une trame en cours (cf. §5b) — mais elle
  // est marquée, parce qu'un personnage dont TOUTES les conséquences
  // sont en attente n'a encore rien à provoquer pour de vrai.
  const peutProvoquer = [];
  for (const s of siennes)
    for (const c of trames.conclusionsDe(s.id))
      peutProvoquer.push({
        id: c.id,
        texte: c.texte || "sans texte",
        depuis: s.titre || "Sans titre",
        aUneSuite: !!c.vers,
      });

  return {
    personnage: p,
    sait,
    croit,
    contacts,
    situations,
    sansHoraire,
    peutApprendre,
    peutProvoquer,
    trous: trous(situations),
    // La réponse en un booléen à la question du module. Volontairement
    // exigeante sur UN point : figurer au casting sans jamais rien
    // porter ni rien apprendre, c'est être décor.
    aQuelqueChoseAVivre:
      situations.some((s) => s.porteur) || peutApprendre.length > 0 || peutProvoquer.length > 0,
  };
}

/** Les intervalles sans scène, ENTRE la première et la dernière. Avant
    la première et après la dernière, ce n'est pas un trou : c'est le
    début et la fin du GN. */
export function trous(situations, seuil = TROU_MIN) {
  const datees = situations
    .filter((s) => s.debut != null && s.fin != null)
    .sort((a, b) => a.debut - b.debut);
  if (datees.length < 2) return [];

  const out = [];
  // `fin` court sur le maximum vu, pas sur la fin de la précédente :
  // deux scènes qui se chevauchent ne créent pas un trou entre elles,
  // et une scène longue couvre celles qu'elle englobe.
  let fin = datees[0].fin;
  for (const s of datees.slice(1)) {
    if (s.debut - fin >= seuil) out.push({ debut: fin, fin: s.debut, duree: s.debut - fin });
    fin = Math.max(fin, s.fin);
  }
  return out;
}
