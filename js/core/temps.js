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
 * Le PIC de simultanéité d'un ensemble de situations : le plus grand
 * nombre d'entre elles ouvertes **au même instant**. Pour un PNJ, c'est
 * le nombre de comédiens à trouver.
 *
 * ── POURQUOI PAS « COMBIEN EN CHEVAUCHENT UNE AUTRE » ──
 * C'était le calcul d'avant, aux trois endroits qui en avaient besoin,
 * et il **surestime**. Compter, pour chaque situation, combien d'autres
 * la chevauchent donne le degré du nœud dans le graphe de
 * chevauchement — un majorant du maximum, pas le maximum :
 *
 *     A 20h→22h   B 21h→23h   C 22h30→24h
 *     A∩B = 21-22 · B∩C = 22h30-23 · A∩C = ∅
 *
 * Les trois se chevauchent deux à deux autour de B, mais jamais toutes
 * les trois ensemble : **deux** comédiens suffisent, et l'ancien calcul
 * en réclamait trois. Ce chiffre-là ne se corrige pas dans l'atelier,
 * il part au recrutement — un comédien de trop, c'est une personne
 * qu'on fait venir un week-end pour rien.
 *
 * On balaye donc les instants de **début**, seuls moments où le compte
 * peut croître, et on compte ce qui est ouvert à chacun. La borne
 * droite est exclue : une scène qui finit quand l'autre commence ne
 * réclame pas deux personnes.
 *
 * Une situation sans horaire ne compte pas — elle n'est pas plaçable,
 * et on ne déduit pas un besoin d'une simultanéité qu'on n'a pas les
 * moyens de constater.
 *
 * Renvoie `{ comediens, creneau }` : le nombre, et la situation qui
 * **ouvre** le pic — celle qui dit à quelle heure il faut être autant.
 * `comediens` vaut 0 si rien n'est daté ; c'est à l'appelant de dire ce
 * que vaut un PNJ dont aucune scène n'a d'heure.
 */
export function pic(situations) {
  const dates = (situations || []).filter(datee);
  let comediens = 0;
  let creneau = null;
  for (const s of dates) {
    const n = dates.filter((o) => o.debut <= s.debut && s.debut < o.fin).length;
    if (n > comediens) {
      comediens = n;
      creneau = s;
    }
  }
  return { comediens, creneau };
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
      // Le pic de simultanéité DONNE le nombre de comédiens (cf. `pic`).
      const { comediens, creneau } = pic(siennes);
      if (comediens > 1) besoins.push({ personnage: p, comediens, pic: creneau });
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
