"use strict";

/* ============================================================
   L'ÉDITEUR DE LIEN — les quatre champs de l'arête, et son retrait.
   ------------------------------------------------------------
   ── POURQUOI CE MODULE EXISTE ──
   Le lien est la vérité racine du projet, et il n'avait **aucune porte
   d'édition**. La `@mention` le propose et ne demande que la tonalité —
   c'est le bon geste au moment d'écrire, et il fige délibérément le
   reste (`importance: secondaire`, `nature: ""`, `miroir: false`). Mais
   rien ne permettait ensuite de reprendre ces trois-là, ni de retirer
   un lien posé de travers.

   Conséquence mesurée : `primaire` et `miroir` étaient **inatteignables**
   dans un projet écrit avec l'outil. Cinq calculs les attendent — la
   règle « personne n'est seul » (qui lit les liens *entrants*
   primaires), la règle « miroir disponible », la pastille
   contact-miroir, le miroir désaccordé du bilan de casting, et les
   miroirs perdus de la défection. Tous restaient muets, sauf sur le jeu
   d'essai, qui pose ces valeurs à la main.

   ── POURQUOI IL EST PARTAGÉ ──
   Deux lentilles ont besoin du même geste : la **fiche**, où l'on écrit
   le personnage, et le **flanc du graphe**, où l'on voit la forme du
   réseau et donc où l'on repère qu'un lien devrait être primaire. Le
   copier serait la duplication de trop — on en a déjà payé une, celle
   du pic de simultanéité, en trois exemplaires tous faux de la même
   façon. Chaque hôte pose l'enveloppe qui lui convient (un `<li>` dans
   la fiche, un `<div>` dans le flanc) ; le corps est écrit ici.

   ── CE QU'IL NE FAIT PAS ──
   Il ne valide rien. Les énumérations sont fermées **dans le store**,
   et c'est là qu'elles doivent l'être : cet écran ne propose que des
   `<select>`, donc il ne peut pas produire un « positif  » avec une
   espace, mais si un jour il le pouvait, `upsertLien` le refuserait
   quand même. Le miroir unique est tenu par le store aussi.

   Il ne touche pas non plus au **lien de retour**. Le lien est orienté :
   ce que l'autre pense de vous est une seconde arête, qui s'écrit sur
   sa fiche à lui. Poser les deux d'un coup ici ferait passer pour
   réciproque une relation dont l'asymétrie est précisément le matériau.
   ============================================================ */
import { TONALITES, IMPORTANCES } from "../core/reseaustore.js";
import { Utils } from "../core/utils.js";

const options = (table, valeur) =>
  Object.entries(table)
    .map(
      ([k, v]) =>
        `<option value="${k}"${valeur === k ? " selected" : ""}>${Utils.escHtml(v)}</option>`,
    )
    .join("");

export const LienEditeur = {
  /** Le corps de l'éditeur, sans enveloppe. `de` est le personnage dont
      on lit la fiche — il sert à nommer les deux bouts dans la note,
      parce que l'orientation ne se devine pas à l'écran. */
  html(store, l, de = null) {
    if (!l) return "";
    const cible = store.personnage(l.vers);
    const moi = de || store.personnage(l.de);
    return (
      '<label class="le-champ"><span>Tonalité</span>' +
      `<select data-le="tonalite" data-l="${l.id}">${options(TONALITES, l.tonalite)}</select></label>` +
      '<label class="le-champ"><span>Importance</span>' +
      `<select data-le="importance" data-l="${l.id}">${options(IMPORTANCES, l.importance)}</select></label>` +
      '<label class="le-champ le-nature"><span>Nature du lien</span>' +
      `<input type="text" data-le="nature" data-l="${l.id}" value="${Utils.escHtml(l.nature)}" ` +
      "placeholder=\"sa sœur · son créancier · l'a vu sortir du tunnel…\" /></label>" +
      // Deux textes, comme sur l'information : la nature est la carte de
      // l'auteur, l'énoncé est ce que le joueur lit. Sans énoncé, le
      // livret imprime la nature et le signale.
      '<label class="le-champ le-nature"><span>Pour le joueur</span>' +
      `<input type="text" data-le="enonce" data-l="${l.id}" value="${Utils.escHtml(l.enonce || "")}" ` +
      "placeholder=\"À la deuxième personne, sans rien que le personnage ignore. Vide : le livret imprime la nature.\" /></label>" +
      '<label class="bascule le-miroir">' +
      `<input type="checkbox" data-le="miroir" data-l="${l.id}"${l.miroir ? " checked" : ""} /> ` +
      "Contact-miroir</label>" +
      '<p class="le-note">Un seul miroir par personnage : le poser ici retire le précédent. ' +
      `Ce que ${Utils.escHtml(cible ? cible.nom : "l'autre")} pense de ` +
      `${Utils.escHtml(moi ? moi.nom : "lui")} est un <b>second lien</b>, ` +
      "qui s'écrit sur sa fiche à lui.</p>" +
      `<button type="button" class="le-suppr" data-l-suppr="${l.id}">Supprimer ce lien</button>`
    );
  },

  /**
   * Câble tout ce que `html()` a posé dans `hote`.
   *
   * `avantSuppression` laisse l'hôte ranger son propre état (l'éditeur
   * qu'il tient ouvert) avant que le store n'émette et ne le fasse
   * re-projeter sur un lien qui n'existe plus.
   */
  brancher(hote, store, { avantSuppression = null } = {}) {
    if (!hote) return;

    // `change` et non `input` : on écrit quand le champ est quitté ou
    // validé. Toute écriture repasse par `upsertLien`, donc par les
    // invariants du store — c'est lui qui tient le miroir unique et qui
    // refuse une valeur hors énumération, pas cet écran.
    for (const el of hote.querySelectorAll("[data-le]"))
      el.addEventListener("change", () => {
        const l = store.lien(el.dataset.l);
        if (!l) return;
        const patch = {
          de: l.de,
          vers: l.vers,
          nature: l.nature,
          enonce: l.enonce || "",
          tonalite: l.tonalite,
          importance: l.importance,
          miroir: l.miroir,
          // Un lien garde son époque quand on le retouche.
          epoqueId: l.epoqueId || null,
        };
        patch[el.dataset.le] = el.type === "checkbox" ? el.checked : el.value;
        store.upsertLien(patch);
      });

    for (const b of hote.querySelectorAll("[data-l-suppr]"))
      b.addEventListener("click", () => {
        const id = b.dataset.lSuppr;
        const l = store.lien(id);
        const q = l && store.personnage(l.vers);
        // On nomme ce qui n'est PAS touché : supprimer l'aller ne dit
        // rien du retour, et laisser croire le contraire ferait
        // disparaître une arête qu'on croyait avoir retirée.
        if (
          !confirm(
            `Supprimer le lien vers « ${q ? q.nom : "?"} » ?\n\n` +
              "Le lien de retour, s'il existe, n'est pas touché.",
          )
        )
          return;
        if (avantSuppression) avantSuppression(id);
        store.supprimerLien(id);
      });
  },
};
