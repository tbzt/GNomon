"use strict";

/* ============================================================
   MATRICE — informations × personnages.
   ------------------------------------------------------------
   Un seul écran, et toute l'asymétrie du GN se lit dedans : qui sait,
   qui ignore, **qui croit autre chose**.

   Une cellule se règle au clic — elle fait tourner ignore → sait →
   croit → ignore. Pas de menu : quarante personnages × trente
   informations, c'est mille deux cents décisions, et chacune doit
   coûter un geste.

   Le panneau du bas montre l'information choisie : son contenu, son
   influence, **le texte de ce que croient ceux qui se trompent**, et où
   elle sert. Cette dernière ligne est ce qui empêche la matrice de
   devenir un tableur : une information qui n'est requise ni produite
   nulle part est une information qu'on a oublié de brancher.
   ============================================================ */
import { INFLUENCES, ETATS } from "../core/informationstore.js";
import { Utils } from "../core/utils.js";

const SIGNE = { sait: "●", croit: "◆", ignore: "·" };

export const Matrice = {
  _hote: null,
  _infos: null,
  _reseau: null,
  _trames: null,
  _selId: null,

  monter(hote, infos, reseau, trames) {
    this._hote = hote;
    this._infos = infos;
    this._reseau = reseau;
    this._trames = trames;
    this.rendre();
  },

  rendre() {
    const persos = this._reseau.personnages();
    const infos = this._infos.informations();

    this._hote.innerHTML =
      '<div class="matrice-tete">' +
      '<p class="carnet-titre">Qui sait quoi<span class="carnet-aide">clic sur une case : sait → croit autre chose → ignore</span></p>' +
      '<button type="button" id="act-info">+ Information</button>' +
      "</div>" +
      (infos.length && persos.length
        ? `<div class="scroll-x">${this._table(infos, persos)}</div>`
        : '<p class="vide">' +
          (persos.length
            ? "Aucune information. La première : ce que quelqu'un doit savoir avant que le jeu commence."
            : "Aucun personnage — la matrice a besoin de colonnes.") +
          "</p>") +
      '<div id="info-panneau"></div>';

    this._hote.querySelector("#act-info").addEventListener("click", () => this._nouvelle());
    this._brancherTable();
    this._rendrePanneau();
  },

  _table(infos, persos) {
    const cols = persos
      .map(
        (p) =>
          `<th class="${p.pj ? "" : "col-pnj"}" title="${Utils.escHtml(p.nom)}">${Utils.escHtml(p.nom.split(" ").slice(-1)[0])}</th>`,
      )
      .join("");

    const lignes = infos
      .map((i) => {
        const cells = persos
          .map((p) => {
            const e = this._infos.etat(i.id, p.id);
            const cr = e === "croit" ? this._infos.croyance(i.id, p.id) : "";
            return (
              `<td class="cell k-${e}" data-i="${i.id}" data-p="${p.id}" role="button" tabindex="0" ` +
              `title="${Utils.escHtml(p.nom)} — ${ETATS[e]}${cr ? " : " + Utils.escHtml(cr) : ""}">${SIGNE[e]}</td>`
            );
          })
          .join("");
        const usages = this._trames.situationsAvec(i.id);
        const orpheline = !usages.requiert.length && !usages.produit.length;
        return (
          `<tr class="${i.id === this._selId ? "sel" : ""}">` +
          `<th class="info-cell" data-sel="${i.id}" role="button" tabindex="0">` +
          `${Utils.escHtml(i.contenu) || "<sans contenu>"}` +
          `<span class="infl">influence ${INFLUENCES[i.influence].toLowerCase()}` +
          (orpheline ? ' · <span class="orph">branchée nulle part</span>' : "") +
          "</span></th>" +
          cells +
          "</tr>"
        );
      })
      .join("");

    return `<table class="matrice"><thead><tr><th>Information</th>${cols}</tr></thead><tbody>${lignes}</tbody></table>`;
  },

  _brancherTable() {
    const t = this._hote.querySelector("table.matrice");
    if (!t) return;

    const cycler = (td) => {
      this._infos.cycler(td.dataset.i, td.dataset.p);
      // Passer à « croit » sans dire ce qu'on croit ne sert à rien :
      // on ouvre la saisie dans la foulée, une seule fois.
      if (this._infos.etat(td.dataset.i, td.dataset.p) === "croit") {
        this._selId = td.dataset.i;
        this.rendre();
        const champ = this._hote.querySelector(`[data-croyance="${td.dataset.p}"]`);
        if (champ) champ.focus();
      }
    };

    for (const td of t.querySelectorAll(".cell")) {
      td.addEventListener("click", () => cycler(td));
      td.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          cycler(td);
        }
      });
    }

    for (const th of t.querySelectorAll("[data-sel]")) {
      const choisir = () => {
        this._selId = this._selId === th.dataset.sel ? null : th.dataset.sel;
        this.rendre();
      };
      th.addEventListener("click", choisir);
      th.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          choisir();
        }
      });
    }
  },

  /* ================= le panneau de l'information ================= */

  _rendrePanneau() {
    const hote = this._hote.querySelector("#info-panneau");
    const i = this._selId ? this._infos.information(this._selId) : null;
    if (!i) {
      hote.innerHTML =
        '<p class="file-vide">Choisissez une information dans la colonne de gauche pour la détailler.</p>';
      return;
    }

    const divergents = this._infos.divergents(i.id);
    const usages = this._trames.situationsAvec(i.id);
    const nom = (id) => {
      const p = this._reseau.personnage(id);
      return p ? p.nom : "personnage supprimé";
    };

    hote.innerHTML =
      '<div class="info-detail">' +
      `<textarea rows="2" id="info-contenu" placeholder="Le fait, tel qu'il est vrai">${Utils.escHtml(i.contenu)}</textarea>` +
      '<div class="info-ligne">' +
      '<span class="champ-label" title="Directe : le joueur peut la traduire en acte dès la lecture. Latente : elle ne permet aucune anticipation. C\'est le réglage de tension du GN.">Influence</span>' +
      Object.entries(INFLUENCES)
        .map(
          ([k, v]) =>
            `<button type="button" class="infl-btn${i.influence === k ? " actif" : ""}" data-infl="${k}">${v}</button>`,
        )
        .join("") +
      '<button type="button" class="info-suppr">Supprimer</button>' +
      "</div>" +
      (divergents.length
        ? '<div class="info-croyances"><span class="champ-label">Ce qu\'ils croient à la place</span>' +
          divergents
            .map(
              (p) =>
                `<label class="croyance"><span>${Utils.escHtml(nom(p))}</span>` +
                `<input data-croyance="${p}" value="${Utils.escHtml(this._infos.croyance(i.id, p))}" ` +
                `placeholder="Ce qu'il tient pour vrai…" /></label>`,
            )
            .join("") +
          "</div>"
        : "") +
      '<p class="info-usages">' +
      (usages.requiert.length
        ? `<b>Requise par</b> ${usages.requiert.map((s) => Utils.escHtml(s.titre || "Sans titre")).join(" · ")}<br>`
        : "") +
      (usages.produit.length
        ? `<b>Produite par</b> ${usages.produit.map((s) => Utils.escHtml(s.titre || "Sans titre")).join(" · ")}`
        : "") +
      (!usages.requiert.length && !usages.produit.length
        ? "Cette information n'est requise ni produite par aucune situation. " +
          "Elle existe dans le monde mais rien ne s'en sert — c'est peut-être un oubli de branchement."
        : "") +
      "</p></div>";

    hote.querySelector("#info-contenu").addEventListener("change", (e) =>
      this._infos.maj(i.id, { contenu: e.target.value }),
    );
    for (const b of hote.querySelectorAll("[data-infl]"))
      b.addEventListener("click", () => this._infos.maj(i.id, { influence: b.dataset.infl }));
    for (const c of hote.querySelectorAll("[data-croyance]"))
      c.addEventListener("change", (e) =>
        this._infos.poser(i.id, c.dataset.croyance, "croit", e.target.value),
      );
    hote.querySelector(".info-suppr").addEventListener("click", () => {
      if (!confirm("Supprimer cette information ?")) return;
      this._selId = null;
      this._infos.supprimer(i.id);
    });
  },

  _nouvelle() {
    const i = this._infos.creer({ contenu: "", influence: "latente" });
    if (!i) return;
    this._selId = i.id;
    this.rendre();
    const champ = this._hote.querySelector("#info-contenu");
    if (champ) champ.focus();
  },
};
