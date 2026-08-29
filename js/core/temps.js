"use strict";

/* ============================================================
   TEMPS — la frise, les collisions, la charge.
   ------------------------------------------------------------
   `tempsDédié` et `espaceDédié` sont deux des treize champs de la
   situation chez eXpérience. Posés sur une frise, ils révèlent ce
   qu'aucune relecture de quarante fiches ne montre : qui est attendu à
   deux endroits en même temps.

   ── UNE COLLISION DE PJ EST UNE ERREUR, UNE COLLISION DE PNJ EST UN
      BESOIN — ET C'EST TOUTE LA DIFFÉRENCE ──
   Le calcul est le même ; la conclusion ne l'est pas.

   Un **PJ** dans deux situations simultanées, c'est un joueur, un
   corps, et une scène qui n'aura pas lieu. Il faut réécrire — décaler,
   couper, ou retirer quelqu'un du casting.

   Un **PNJ** dans trois situations simultanées, ce n'est pas une
   faute : c'est **trois comédiens à recruter**. Le PNJ est une
   fonction, pas une personne, et l'équipe peut en jouer autant qu'elle
   en trouve. Ce chiffre-là ne se corrige pas dans l'atelier — il part
   à l'organisation, et c'est exactement le pont entre les deux moitiés
   du projet.

   Confondre les deux dirait à l'auteur de « réparer » un planning de
   PNJ qui n'a rien de cassé, et lui laisserait croire qu'une collision
   de PJ se règle en recrutant.

   ── UNE SITUATION SANS HORAIRE N'EST PAS UNE ERREUR ──
   Elle n'est simplement pas plaçable. On ne la signale pas comme un
   défaut, on la range à part : beaucoup de scènes de GN n'ont pas
   d'heure, elles ont un déclencheur.

   Module **pur** : lit deux stores, n'en mute aucun, ne touche pas au
   DOM.
   ============================================================ */

/** Bornes par défaut quand rien n'est daté — une soirée de GN. */
const DEFAUT = { debut: 20, fin: 26 };

/** `21.5` → « 21h30 » ; `24.5` → « 00h30 » (après minuit, on continue
    de compter au-delà de 24 pour que l'ordre reste vrai). */
export function heure(h) {
  if (h == null) return "—";
  const brut = ((h % 24) + 24) % 24;
  const hh = Math.floor(brut);
  const mm = Math.round((brut - hh) * 60);
  return `${String(hh).padStart(2, "0")}h${mm ? String(mm).padStart(2, "0") : ""}`;
}

function chevauche(a, b) {
  return b.debut < a.fin && a.debut < b.fin;
}

function datee(s) {
  return s.debut != null && s.fin != null && s.fin > s.debut;
}

/**
 * Projette la frise.
 *
 *   {
 *     bornes:      { debut, fin },
 *     lignes:      [{ personnage, blocs: [{ situation, collision }] }],
 *     sansHoraire: [situation],
 *     erreurs:     [{ personnage, a, b }],   // PJ en double
 *     besoins:     [{ personnage, comediens, pic }],  // PNJ simultanés
 *   }
 */
export function frise(reseau, trames) {
  const situations = trames.situations().filter(datee);

  const bornes = situations.length
    ? {
        debut: Math.floor(Math.min(...situations.map((s) => s.debut))),
        fin: Math.ceil(Math.max(...situations.map((s) => s.fin))),
      }
    : { ...DEFAUT };
  if (bornes.fin - bornes.debut < 2) bornes.fin = bornes.debut + 2;

  const lignes = [];
  const erreurs = [];
  const besoins = [];

  for (const p of reseau.personnages()) {
    const siennes = situations.filter((s) => (s.castIds || []).includes(p.id));
    if (!siennes.length) continue;

    // Un bloc est « en collision » s'il en chevauche un autre de la
    // même personne. Le marquage vaut pour les deux, sans quoi la
    // frise ne montrerait que la moitié du problème.
    const blocs = siennes.map((s) => ({
      situation: s,
      collision: siennes.some((o) => o.id !== s.id && chevauche(s, o)),
    }));
    lignes.push({ personnage: p, blocs });

    if (p.pj) {
      for (let i = 0; i < siennes.length; i++)
        for (let j = i + 1; j < siennes.length; j++)
          if (chevauche(siennes[i], siennes[j]))
            erreurs.push({ personnage: p, a: siennes[i], b: siennes[j] });
    } else {
      // Le pic de simultanéité DONNE le nombre de comédiens : c'est le
      // plus grand nombre de situations ouvertes au même instant. On le
      // mesure aux instants de début, seuls moments où il peut croître.
      let pic = 1;
      let creneau = null;
      for (const s of siennes) {
        const n = siennes.filter((o) => chevauche(s, o) || o.id === s.id).length;
        if (n > pic) {
          pic = n;
          creneau = s;
        }
      }
      if (pic > 1) besoins.push({ personnage: p, comediens: pic, pic: creneau });
    }
  }

  // Les PJ d'abord : ce sont leurs collisions qu'il faut réparer.
  lignes.sort((a, b) => Number(b.personnage.pj) - Number(a.personnage.pj));

  return {
    bornes,
    lignes,
    sansHoraire: trames.situations().filter((s) => !datee(s)),
    erreurs,
    besoins,
  };
}
