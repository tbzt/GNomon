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
import { crashTestInformation } from "../core/crashtest.js";
import { jamaisSueHtml } from "./degats.js";
import { Utils } from "../core/utils.js";

const SIGNE = { sait: "●", croit: "◆", ignore: "·" };

export const Matrice = {
  _hote: null,
  _infos: null,
  _reseau: null,
  _trames: null,
  _selId: null,
  _sig: "",
  _vif: null,
  // Pour QUELLE information le crash test est déplié — même règle que
  // l'atelier : un booléen se désynchroniserait de la sélection.
  _crashPour: null,

  monter(hote, infos, reseau, trames) {
    this._hote = hote;
    this._infos = infos;
    this._reseau = reseau;
    this._trames = trames;
    this.rendre();
  },

  /** ── LA GRILLE NE SE RECONSTRUIT PAS À CHAQUE CASE ──
      Mille deux cents décisions, chacune à un geste : c'est la doctrine
      de cet écran. Mais `rendre()` réécrivait tout à chaque clic, donc
      le conteneur `.scroll-x` était un nœud neuf et son défilement
      repartait de zéro. Mesuré : scrollLeft 319 → 0 à chaque case
      réglée, sur une grille de 210 cellules. On règle une case, on est
      renvoyé à la première colonne, on re-défile.

      D'où deux rendus, comme le tableau du réseau (§6) : `rendre()`
      construit, `rafraichir()` ne retouche que ce qui a changé. La
      signature ne porte que la STRUCTURE — quelles informations, quels
      personnages, laquelle est choisie — jamais l'état des cases, qui
      est précisément ce qu'on modifie. */
  _signature() {
    return [
      this._infos.informations().map((i) => i.id).join(","),
      this._reseau.personnages().map((p) => `${p.id}:${p.nom}:${p.pj ? 1 : 0}`).join(","),
      this._selId || "-",
      this._crashPour || "-",
    ].join("|");
  },

  rafraichir() {
    if (!this._hote || !this._hote.querySelector("table.matrice")) return this.rendre();
    if (this._signature() !== this._sig) return this.rendre();

    // Les cases, en place. Aucun nœud remplacé, donc aucun écouteur
    // reposé et aucun défilement perdu.
    for (const td of this._hote.querySelectorAll("td.cell")) {
      const e = this._infos.etat(td.dataset.i, td.dataset.p);
      const cr = e === "croit" ? this._infos.croyance(td.dataset.i, td.dataset.p) : "";
      td.className = `cell k-${e}`;
      td.textContent = SIGNE[e];
      const p = this._reseau.personnage(td.dataset.p);
      td.title = `${p ? p.nom : "?"} — ${ETATS[e]}${cr ? " : " + cr : ""}`;
    }
    // Le libellé d'une information et son « branchée nulle part »
    // dépendent des trames, qui ont pu bouger sans changer la structure.
    for (const th of this._hote.querySelectorAll("th.info-cell")) {
      const i = this._infos.information(th.dataset.sel);
      if (!i) continue;
      const u = this._trames.situationsAvec(i.id);
      const orph = !u.requiert.length && !u.produit.length;
      th.innerHTML =
        `${Utils.escHtml(i.contenu) || "<sans contenu>"}` +
        `<span class="infl">influence ${INFLUENCES[i.influence].toLowerCase()}` +
        (orph ? ' · <span class="orph">branchée nulle part</span>' : "") +
        "</span>";
    }
    // Le panneau ne se refait pas sous un curseur : on y tape la
    // croyance d'un personnage, et la sauvegarde est au `change`.
    const a = document.activeElement;
    const panneau = this._hote.querySelector("#info-panneau");
    if (!panneau || !panneau.contains(a)) this._rendrePanneau();
  },

  rendre() {
    // AVANT le remplacement de l'hôte : après, le champ focalisé n'est
    // plus dans le document et la frappe en cours serait perdue.
    this._vif = this._capturerSaisie();
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
    this._sig = this._signature();
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

  /** Le panneau porte deux saisies — le contenu de l'information, et ce
      que chacun croit à la place. Un rafraîchissement ordinaire ne le
      touche pas (cf. `rafraichir`), mais un changement de STRUCTURE
      reconstruit tout : créer une information ailleurs, ou en recevoir
      une par la synchronisation, arrachait alors la frappe en cours.

      On reporte donc ce que le store n'a pas encore — la valeur tapée et
      la position du curseur — comme la fiche le fait pour l'éditeur de
      lien. Même défaut, même parade. */
  /** Ce qui est en train d'être tapé dans le panneau, et où en est le
      curseur. À capturer AVANT toute réécriture : `rendre()` remplace
      l'hôte entier, donc `document.activeElement` n'existe déjà plus
      quand `_rendrePanneau` s'exécute. C'est le défaut qu'avait ma
      première version. */
  _capturerSaisie() {
    const hote = this._hote && this._hote.querySelector("#info-panneau");
    const a = document.activeElement;
    if (!hote || !a || !hote.contains(a)) return null;
    if (a.id !== "info-contenu" && !a.dataset.croyance) return null;
    return {
      cle: a.id === "info-contenu" ? "#info-contenu" : `[data-croyance="${a.dataset.croyance}"]`,
      texte: a.value,
      debut: a.selectionStart,
      fin: a.selectionEnd,
    };
  },

  _rendrePanneau() {
    const hote = this._hote.querySelector("#info-panneau");
    // Posée par `rendre()` avant qu'il n'écrase l'hôte ; sinon on la
    // prend nous-mêmes, pour les appels directs.
    const vif = this._vif || this._capturerSaisie();
    this._vif = null;
    const rendreVif = () => {
      if (!vif) return;
      const el = hote.querySelector(vif.cle);
      if (!el) return;
      el.value = vif.texte;
      el.focus();
      if (el.setSelectionRange) el.setSelectionRange(vif.debut, vif.fin);
    };
    const i = this._selId ? this._infos.information(this._selId) : null;
    if (!i) {
      hote.innerHTML =
        '<p class="file-vide">Choisissez une information dans la colonne de gauche pour la détailler.</p>';
      rendreVif();
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
      "</p>" +
      // Le crash test de l'information : la question « et si personne
      // ne l'apprend ? » se pose ici, sur l'objet même, et se propage
      // en cascade (cf. `core/crashtest.js`). N'a de sens que si au
      // moins une situation la requiert — sinon il n'y a rien à
      // empêcher, et le bouton poserait une question sans objet.
      (usages.requiert.length
        ? `<button type="button" class="info-crash" data-crash aria-expanded="${this._crashPour === i.id}">` +
          `${this._crashPour === i.id ? "Masquer" : "Et si personne ne l'apprend ?"}</button>` +
          (this._crashPour === i.id
            ? `<div class="info-degats">${jamaisSueHtml(crashTestInformation(i.id, { trames: this._trames, infos: this._infos }))}</div>`
            : "")
        : "") +
      "</div>";

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
    const crash = hote.querySelector("[data-crash]");
    if (crash)
      crash.addEventListener("click", () => {
        this._crashPour = this._crashPour === i.id ? null : i.id;
        this._rendrePanneau();
      });

    // Les écouteurs sont posés : on peut rendre le curseur.
    rendreVif();
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
