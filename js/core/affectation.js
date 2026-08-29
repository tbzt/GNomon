"use strict";

/* ============================================================
   AFFECTATION — le problème d'assignation, résolu exactement.
   ------------------------------------------------------------
   Caster un GN, c'est apparier des joueurs à des rôles en maximisant
   la satisfaction. C'est un **problème d'assignation** classique, et il
   se résout de façon *exacte* — pas approchée — par l'algorithme
   hongrois (Kuhn-Munkres), en O(n³). À l'échelle d'un GN (30 à 300
   participants) c'est instantané.

   L'implémentation ci-dessous est la variante à potentiels
   (Jonker-Volgenant), 1-indexée, qui exige `lignes ≤ colonnes`. On
   **complète donc la matrice en carré** avec un coût de non-attribution
   fini : un joueur sans rôle ou un rôle sans joueur reste une solution
   valide, simplement chère. Mettre l'infini rendrait le problème
   insoluble dès qu'il y a déséquilibre — or le déséquilibre est le cas
   normal (il y a toujours plus de candidats que de rôles, ou l'inverse).

   Une seule contrainte est modélisée, et c'est **la disponibilité** —
   parce qu'elle est vérifiable : la frise (S5) donne l'heure de chaque
   scène, la candidature donne l'heure d'arrivée. Les contraintes en
   texte libre (« sait chanter », « n'a pas peur du noir ») n'entrent
   pas dans le coût : les apparier automatiquement à un questionnaire en
   texte libre donnerait un résultat faux avec l'air d'être juste.

   ── POURQUOI LE VETO EST CHER MAIS PAS INFINI ──
   Quand quelqu'un écrit « surtout pas ce rôle », le respecter est une
   quasi-obligation. Mais si le seul appariement possible l'impose,
   l'algorithme doit quand même rendre une réponse — et l'écran doit la
   **signaler en rouge** plutôt que de planter en disant « aucune
   solution ». Un coût très élevé fait exactement ça : il évite le veto
   tant que c'est possible, et le rend visible quand ça ne l'est pas.

   Module **pur** : des nombres entrent, des nombres sortent. Aucun
   store, aucun DOM.
   ============================================================ */

/** Coûts. L'écart entre les rangs est de 1, celui d'un veto de 100 :
    l'algorithme préférera dégrader dix personnes d'un rang plutôt que
    d'imposer un seul veto. C'est le bon arbitrage. */
export const COUTS = Object.freeze({
  adore: 0, // premier choix
  bien: 1,
  accepte: 2,
  indifferent: 3, // rien d'exprimé
  veto: 100, // « surtout pas »
  indisponible: 8, // par scène du rôle hors de la fenêtre de présence
});

/**
 * Hongrois (Kuhn-Munkres), variante à potentiels. Minimise le coût
 * total. `cout` est une matrice `n × m` de nombres finis.
 *
 * Renvoie `{ affectation, total }` où `affectation[i]` est l'indice de
 * colonne attribué à la ligne `i`, ou `-1`.
 */
export function hongrois(cout) {
  const n = cout.length;
  if (!n) return { affectation: [], total: 0 };
  const m = cout[0].length;

  // Carré : on complète avec des lignes/colonnes fictives à coût nul.
  // Une case fictive ne représente rien — elle ne doit donc pas peser
  // dans l'arbitrage entre deux vraies affectations. Le déséquilibre
  // se lit ensuite dans le nombre de `-1` renvoyés, pas dans le total.
  const k = Math.max(n, m);
  const a = [];
  for (let i = 0; i < k; i++) {
    const ligne = [];
    for (let j = 0; j < k; j++) ligne.push(i < n && j < m ? cout[i][j] : 0);
    a.push(ligne);
  }

  const INF = Number.POSITIVE_INFINITY;
  const u = new Array(k + 1).fill(0);
  const v = new Array(k + 1).fill(0);
  const p = new Array(k + 1).fill(0); // p[j] = ligne affectée à la colonne j
  const way = new Array(k + 1).fill(0);

  for (let i = 1; i <= k; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(k + 1).fill(INF);
    const used = new Array(k + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= k; j++) {
        if (used[j]) continue;
        const cur = a[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= k; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }

  const affectation = new Array(n).fill(-1);
  let total = 0;
  for (let j = 1; j <= k; j++) {
    const i = p[j] - 1;
    if (i < n && j - 1 < m) {
      affectation[i] = j - 1;
      total += cout[i][j - 1];
    }
  }
  return { affectation, total };
}
