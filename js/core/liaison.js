"use strict";

/* ============================================================
   LIAISON — ce qu'il faut avoir sous les yeux pour écrire la suite.
   ------------------------------------------------------------
   La boucle « et après ? » existe depuis S2 : une conclusion sans cible
   est une question ouverte, et `creerSuite()` y répond en créant la
   situation suivante et en la reliant. Ce qui manquait n'est pas le
   geste — c'est le **contexte** au moment de le faire.

   Écrire la suite d'une scène demande de se rappeler deux choses, et
   les deux sont déjà dans les stores :

   1. **Ce que les gens présents savent déjà.** Sans ça, on réécrit une
      révélation qui a déjà eu lieu, ou on fait découvrir à quelqu'un ce
      qu'il sait depuis le début.
   2. **Ce que la scène d'origine produit et qui ne sert nulle part.**
      Ce sont les fils qu'on vient de tendre et qu'on n'a pas encore
      rattachés — les candidats naturels à ce que la suite exige.

   ── CE MODULE NE DÉCIDE RIEN ──
   Il ne rédige aucun titre, ne choisit aucune information, ne crée
   rien. Il **propose** — exactement comme le `@mention` propose l'arête
   sans jamais la poser seul (cf. ARCHITECTURE.md §5). L'auteur coche,
   ou pas. Un outil qui écrirait la suite à sa place produirait du texte
   à démêler du sien, ce que le squelette de fiche refuse déjà de faire
   pour les mêmes raisons (§5c).

   Module **pur** : lit deux stores, n'en mute aucun, ne touche pas au
   DOM.
   ============================================================ */

/**
 * Le contexte d'écriture d'une suite.
 *
 *   { conclusion, source, presents[], dejaSu[], aRattacher[] }
 *
 * `null` si la conclusion n'existe pas, ou si elle a déjà une cible —
 * il n'y a alors pas de suite à écrire, et proposer d'en créer une
 * seconde dupliquerait le fil sans que personne l'ait demandé.
 */
export function contexteSuite(conclusionId, { reseau, trames, infos }) {
  const c = trames.conclusion(conclusionId);
  if (!c || c.vers) return null;
  const source = trames.situation(c.de);
  if (!source) return null;

  const presents = (source.castIds || [])
    .map((id) => reseau.personnage(id))
    .filter(Boolean)
    .map((p) => ({ id: p.id, nom: p.nom, pj: !!p.pj }));

  // Ce que les présents savent déjà — dédoublonné, avec QUI le sait.
  // Deux personnes qui savent la même chose ne font pas deux lignes :
  // c'est l'information qui compte, pas le compte des porteurs.
  const parInfo = new Map();
  for (const p of presents)
    for (const i of infos.parPersonnage(p.id).sait) {
      if (!parInfo.has(i.id)) parInfo.set(i.id, { id: i.id, contenu: i.contenu || "sans contenu", qui: [] });
      parInfo.get(i.id).qui.push(p.nom);
    }
  const dejaSu = [...parInfo.values()];

  // Ce que la scène d'origine produit et qu'aucune situation ne
  // requiert encore : les fils tendus, pas encore rattachés. C'est le
  // même constat que la règle « chaîne complète » de la conscience,
  // mais pris à l'endroit où on peut y répondre d'un clic.
  const aRattacher = (source.produitIds || [])
    .map((id) => infos.information(id))
    .filter(Boolean)
    .filter((i) => !trames.situationsAvec(i.id).requiert.length)
    .map((i) => ({ id: i.id, contenu: i.contenu || "sans contenu" }));

  return { conclusion: c, source, presents, dejaSu, aRattacher };
}
