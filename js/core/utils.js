"use strict";

/* ============================================================
   UTILS — boîte à outils pure. Feuille sans dépendance.

   Volontairement maigre. La version de ShadowHerds fait 1 855 lignes
   parce qu'elle porte la résolution d'édition ; ici il n'y a pas
   d'éditions. On copie ce qui sert, pas ce qui suit.
   ============================================================ */

export const Utils = {
  /** Échappement HTML. À appeler sur TOUTE donnée d'auteur avant
      insertion dans du HTML construit à la main. */
  escHtml(s) {
    return String(s ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  },

  /** Normalisation pour la recherche : minuscules, sans accents.
      « Sœur Augustine » se trouve en tapant « soeur » ou « augus ». */
  searchNorm(s) {
    return String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/œ/g, "oe")
      .replace(/æ/g, "ae");
  },

  /** Accord au pluriel, cas simple : `plur(2, "lien")` → "liens". */
  plur(n, mot, suffixe = "s") {
    return n > 1 ? mot + suffixe : mot;
  },
};
