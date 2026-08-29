"use strict";

/* ============================================================
   CONDUITE — ce que le tableau doit montrer, calculé.
   ------------------------------------------------------------
   La conscience (S4) demande « ce texte est-il bon ? ». En jeu, la
   question change : **« qui est en train de ne rien vivre ? »**

   C'est la même intuition de Kröger — la qualité est relationnelle —
   mais en direct. À J-30 elle se mesure en liens manquants ; à 3 h du
   matin elle se mesure en minutes. Un joueur qui n'a croisé aucune
   scène depuis quarante minutes est en train de passer un mauvais GN,
   et personne dans l'équipe ne s'en aperçoit sans un tableau qui le
   dise.

   Trois lectures, dans l'ordre où l'équipe en a besoin :

     1. **Les fils**, triés par ce qui a le plus besoin d'attention —
        bloqués d'abord, puis les plus immobiles. Le tableau se
        réordonne tout seul : on regarde le haut, jamais on ne cherche.
     2. **Les délaissés**, avec depuis combien de temps.
     3. **Ce qui vient**, d'après l'heure de fiction.

   Module **pur** : lit trois stores, n'en mute aucun, ne touche pas au
   DOM.
   ============================================================ */

/** Au-delà, un joueur est considéré comme délaissé. Trente minutes :
    c'est la durée qu'un GN peut absorber sans que ça se voie, et
    au-delà de laquelle un joueur commence à s'ennuyer pour de bon.
    Réglable ici, en un endroit, plutôt qu'éparpillé dans le rendu. */
export const SEUIL_DELAISSE_MIN = 30;

const MIN = 60000;

/** Minutes écoulées depuis un horodatage. */
export function minutesDepuis(ts, maintenant = Date.now()) {
  if (!ts) return null;
  return Math.floor((maintenant - ts) / MIN);
}

/** « 42 min », « 1 h 20 ». Le tableau se lit de loin : pas de secondes,
    jamais de décimales. */
export function duree(minutes) {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/** Heure de fiction décimale → « 21h30 ». */
export function heureFiction(h) {
  if (h == null) return "—";
  const brut = ((h % 24) + 24) % 24;
  const hh = Math.floor(brut);
  const mm = Math.floor((brut - hh) * 60);
  return `${String(hh).padStart(2, "0")}h${String(mm).padStart(2, "0")}`;
}

/**
 * Projette le tableau.
 *
 *   {
 *     fils:       [{ trame, fil, situation, minutes, conclusions, impasse }],
 *     delaisses:  [{ personnage, minutes, jamais }],
 *     enScene:    Set<personnageId>,
 *     aVenir:     [{ situation, dansMinutes }],
 *     heure:      nombre|null,
 *   }
 */
export function tableau(run, trames, reseau, maintenant = Date.now()) {
  const heure = run.heureCourante();

  /* ---- 1. Les fils ---- */
  const fils = Object.entries(run.fils())
    .map(([trameId, fil]) => {
      const trame = trames.trame(trameId);
      const situation = trames.situation(fil.situationId);
      const conclusions = situation ? trames.conclusionsDe(situation.id) : [];
      return {
        trameId,
        trame,
        fil,
        situation,
        conclusions,
        minutes: minutesDepuis(fil.depuis, maintenant),
        // Une situation en jeu sans aucune conclusion écrite est un
        // cul-de-sac immédiat : l'équipe doit improviser, et doit le
        // savoir AVANT d'y arriver.
        impasse: !!situation && !situation.terminale && conclusions.length === 0,
      };
    })
    .filter((f) => f.trame);

  const rang = (f) =>
    f.fil.statut === "bloque" ? 0 : f.impasse ? 1 : f.fil.statut === "clos" ? 3 : 2;
  fils.sort((a, b) => rang(a) - rang(b) || (b.minutes || 0) - (a.minutes || 0));

  /* ---- 2. Qui est en scène, qui ne l'est pas ---- */
  // « En scène » ne compte QUE les fils actifs — un fil bloqué ne met
  // personne en scène, et c'est un choix, pas un oubli. Les joueurs
  // d'un fil bloqué sont physiquement là mais il ne leur arrive rien :
  // c'est exactement le moment où ils commencent à s'ennuyer, donc le
  // moment où le tableau doit les faire remonter, pas les masquer.
  const enScene = new Set();
  for (const f of fils)
    if (f.fil.statut === "actif" && f.situation)
      for (const id of f.situation.castIds || []) enScene.add(id);

  // Dernier passage en scène, DÉRIVÉ de la main courante : c'est elle
  // la mémoire. Tenir un registre séparé créerait une seconde vérité.
  const dernier = new Map();
  for (const e of run.journal()) {
    if (!e.situationId) continue;
    const s = trames.situation(e.situationId);
    if (!s) continue;
    for (const id of s.castIds || []) if (!dernier.has(id)) dernier.set(id, e.ts);
  }

  const debut = run.run() ? run.run().debut : null;
  const delaisses = reseau
    .pj()
    .filter((p) => !enScene.has(p.id))
    .map((p) => {
      const ts = dernier.get(p.id) || debut;
      return {
        personnage: p,
        minutes: minutesDepuis(ts, maintenant),
        jamais: !dernier.has(p.id),
      };
    })
    .filter((d) => d.minutes != null && d.minutes >= SEUIL_DELAISSE_MIN)
    .sort((a, b) => b.minutes - a.minutes);

  /* ---- 3. Ce qui vient ---- */
  const lancees = new Set(Object.values(run.fils()).map((f) => f.situationId));
  const aVenir =
    heure == null
      ? []
      : trames
          .situations()
          .filter((s) => s.debut != null && !lancees.has(s.id) && s.debut >= heure - 0.25)
          .map((s) => ({ situation: s, dansMinutes: Math.round((s.debut - heure) * 60) }))
          .sort((a, b) => a.dansMinutes - b.dansMinutes)
          .slice(0, 5);

  return { fils, delaisses, enScene, aVenir, heure };
}
