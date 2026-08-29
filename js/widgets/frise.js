"use strict";

/* ============================================================
   FRISE — l'écran du temps.
   ------------------------------------------------------------
   Une ligne par personnage, une colonne par demi-heure. Les blocs sont
   les situations où il est attendu.

   Ce que l'écran sépare, parce que le calcul les sépare (cf.
   `core/temps.js`) :

   · **Les collisions de PJ** — en rouge. Une erreur : un joueur, un
     corps. Il faut réécrire.
   · **La charge des PNJ** — en violet. Pas une erreur : un nombre de
     comédiens à trouver. Ça part à l'organisation.

   Un seul bandeau les mélangerait, et l'auteur passerait son temps à
   « réparer » un planning de PNJ qui n'a rien de cassé.
   ============================================================ */
import { frise, heure } from "../core/temps.js";
import { Utils } from "../core/utils.js";

export const Frise = {
  _hote: null,
  _reseau: null,
  _trames: null,
  _onOuvrir: null,

  monter(hote, reseau, trames, { onOuvrir = null } = {}) {
    this._hote = hote;
    this._reseau = reseau;
    this._trames = trames;
    this._onOuvrir = onOuvrir;
    this.rendre();
  },

  rendre() {
    const f = frise(this._reseau, this._trames);

    if (!f.lignes.length) {
      this._hote.innerHTML =
        '<p class="vide">Aucune situation datée. Donnez un <em>temps dédié</em> à vos situations ' +
        "dans l'atelier — c'est ce qui permet de voir qui est attendu à deux endroits à la fois.</p>" +
        this._sansHoraire(f);
      return;
    }

    const pas = 0.5;
    const cases = Math.round((f.bornes.fin - f.bornes.debut) / pas);
    const heures = [];
    for (let h = f.bornes.debut; h < f.bornes.fin; h += pas) heures.push(h);

    this._hote.innerHTML =
      '<div class="frise">' +
      `<p class="carnet-titre">La nuit du jeu<span class="carnet-aide">${heure(f.bornes.debut)} → ${heure(f.bornes.fin)}</span></p>` +
      '<div class="scroll-x"><div class="fr-grille">' +
      '<div class="fr-entete"><span></span><div class="fr-heures" style="' +
      `grid-template-columns:repeat(${cases},1fr)">` +
      heures
        .map((h) => `<span>${h % 1 === 0 ? Utils.escHtml(heure(h)) : ""}</span>`)
        .join("") +
      "</div></div>" +
      f.lignes.map((l) => this._ligne(l, f.bornes, cases)).join("") +
      "</div></div>" +
      this._erreurs(f) +
      this._besoins(f) +
      this._sansHoraire(f) +
      "</div>";

    for (const b of this._hote.querySelectorAll("[data-sit]"))
      b.addEventListener("click", () => this._onOuvrir && this._onOuvrir(b.dataset.sit));
  },

  _ligne(l, bornes, cases) {
    const span = bornes.fin - bornes.debut;
    const blocs = l.blocs
      .map(({ situation: s, collision }) => {
        const gauche = ((s.debut - bornes.debut) / span) * 100;
        const large = ((s.fin - s.debut) / span) * 100;
        const classe = collision ? (l.personnage.pj ? " erreur" : " charge") : "";
        return (
          `<button type="button" class="fr-bloc${classe}" data-sit="${s.id}" ` +
          `style="left:${gauche.toFixed(2)}%;width:${large.toFixed(2)}%" ` +
          `title="${Utils.escHtml(s.titre || "Sans titre")} — ${heure(s.debut)} à ${heure(s.fin)}` +
          (s.espace ? ` · ${Utils.escHtml(s.espace)}` : "") +
          `">${Utils.escHtml(s.titre || "Sans titre")}</button>`
        );
      })
      .join("");
    return (
      '<div class="fr-ligne">' +
      `<span class="fr-nom${l.personnage.pj ? "" : " pnj"}">${Utils.escHtml(l.personnage.nom)}</span>` +
      `<div class="fr-piste"><div class="fr-quadrillage" style="grid-template-columns:repeat(${cases},1fr)">` +
      "<i></i>".repeat(cases) +
      `</div>${blocs}</div></div>`
    );
  },

  _erreurs(f) {
    if (!f.erreurs.length)
      return '<p class="fr-ok">Aucun joueur n\'est attendu à deux endroits en même temps.</p>';
    return (
      '<section class="fr-bandeau erreurs">' +
      `<p class="fr-bandeau-titre">${f.erreurs.length} ${Utils.plur(f.erreurs.length, "collision")} de joueur` +
      '<span>un joueur, un corps — il faut réécrire</span></p><ul>' +
      f.erreurs
        .map(
          (e) =>
            `<li><b>${Utils.escHtml(e.personnage.nom)}</b> est attendu dans ` +
            `« ${Utils.escHtml(e.a.titre || "Sans titre")} » (${heure(e.a.debut)}–${heure(e.a.fin)}) ` +
            `et « ${Utils.escHtml(e.b.titre || "Sans titre")} » (${heure(e.b.debut)}–${heure(e.b.fin)})</li>`,
        )
        .join("") +
      "</ul></section>"
    );
  },

  _besoins(f) {
    if (!f.besoins.length) return "";
    const total = f.besoins.reduce((n, b) => n + b.comediens, 0);
    return (
      '<section class="fr-bandeau besoins">' +
      '<p class="fr-bandeau-titre">Charge des PNJ' +
      "<span>ce n'est pas une erreur : c'est un besoin de recrutement</span></p><ul>" +
      f.besoins
        .map(
          (b) =>
            `<li><b>${Utils.escHtml(b.personnage.nom)}</b> est attendu dans ` +
            `${b.comediens} situations simultanées` +
            (b.pic ? ` (pic vers ${heure(b.pic.debut)})` : "") +
            ` → <b>${b.comediens} ${Utils.plur(b.comediens, "comédien")}</b></li>`,
        )
        .join("") +
      `</ul><p class="fr-bandeau-pied">${total} ${Utils.plur(total, "rôle")} de PNJ à pourvoir ` +
      "sur ces créneaux. Ce chiffre ne se corrige pas dans l'atelier — il part à l'organisation.</p>" +
      "</section>"
    );
  },

  _sansHoraire(f) {
    if (!f.sansHoraire.length) return "";
    return (
      '<section class="fr-bandeau neutre">' +
      `<p class="fr-bandeau-titre">${f.sansHoraire.length} ${Utils.plur(f.sansHoraire.length, "situation")} sans horaire` +
      "<span>ce n'est pas un défaut : beaucoup de scènes ont un déclencheur, pas une heure</span></p><ul>" +
      f.sansHoraire
        .map(
          (s) =>
            `<li><button type="button" class="lien-nu" data-sit="${s.id}">${Utils.escHtml(s.titre || "Sans titre")}</button></li>`,
        )
        .join("") +
      "</ul></section>"
    );
  },
};
