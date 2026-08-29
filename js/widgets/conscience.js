"use strict";

/* ============================================================
   CONSCIENCE — l'écran des douze règles.
   ------------------------------------------------------------
   Trois interdits, et ils viennent du corpus lui-même. Ils sont tenus
   ici, dans le rendu, autant que dans les stores :

   1. **Jamais bloquant.** Rien de ce que fait cet écran n'empêche
      d'écrire. Il signale, il n'arrête pas.

   2. **Toute alerte s'écarte avec une justification écrite**, et la
      justification reste affichée — pas repliée, pas grisée en fin de
      liste. Une alerte écartée est une **décision prise**, et le
      *crosschecker* de Kröger doit pouvoir la relire.

   3. **Jamais de score global.** Douze compteurs, jamais une moyenne :
      Fredou avertit explicitement contre les barèmes de points, et une
      note unique inviterait à optimiser le chiffre plutôt qu'à écrire.
      L'en-tête additionne les alertes — c'est un inventaire, pas une
      note sur vingt.
   ============================================================ */
import { conscience } from "../core/conscience.js";
import { Utils } from "../core/utils.js";

export const Conscience = {
  _hote: null,
  _reseau: null,
  _trames: null,
  _infos: null,
  _derog: null,
  _ouvertes: new Set(),
  _saisie: null, // "<regle>::<cible>" en cours de justification

  monter(hote, reseau, trames, infos, derogations) {
    this._hote = hote;
    this._reseau = reseau;
    this._trames = trames;
    this._infos = infos;
    this._derog = derogations;
    this.rendre();
  },

  /** Les règles, enrichies de leur état de dérogation. Sert aussi au
      badge de la barre — un seul calcul, une seule vérité. */
  etat() {
    if (!this._reseau) return { regles: [], ouvertes: 0, ecartees: 0 };
    const regles = conscience(this._reseau, this._trames, this._infos).map((r) => ({
      ...r,
      alertes: r.alertes.map((a) => ({ ...a, derogation: this._derog.pour(r.cle, a.cible) })),
    }));
    let ouvertes = 0;
    let ecartees = 0;
    for (const r of regles)
      for (const a of r.alertes) (a.derogation ? ecartees++ : ouvertes++);
    return { regles, ouvertes, ecartees };
  },

  rendre() {
    const { regles, ouvertes, ecartees } = this.etat();

    this._hote.innerHTML =
      '<div class="conscience">' +
      '<div class="cs-entete">' +
      `<p class="cs-total"><b>${ouvertes}</b> ${Utils.plur(ouvertes, "alerte")} ${Utils.plur(ouvertes, "ouverte")}` +
      (ecartees
        ? ` · <span class="cs-ecartees">${ecartees} ${Utils.plur(ecartees, "écartée")} avec justification</span>`
        : "") +
      "</p>" +
      '<p class="cs-note">Douze compteurs indépendants, jamais une moyenne. Rien ici ne bloque : ' +
      "une alerte s'écarte en écrivant pourquoi, et la justification reste lisible.</p>" +
      "</div>" +
      '<div class="cs-regles">' +
      regles.map((r) => this._regle(r)).join("") +
      "</div></div>";

    this._brancher();
  },

  _regle(r) {
    const ouvertes = r.alertes.filter((a) => !a.derogation);
    const ecartees = r.alertes.filter((a) => a.derogation);
    const ouvert = this._ouvertes.has(r.cle);
    const etat = ouvertes.length
      ? `${ouvertes.length} ${Utils.plur(ouvertes.length, "alerte")}`
      : r.alertes.length
        ? "traitée"
        : "conforme";
    const classe = ouvertes.length ? "ko" : r.alertes.length ? "traitee" : "ok";

    return (
      `<section class="cs-regle ${classe}${ouvert ? " deplie" : ""}" data-regle="${r.cle}">` +
      `<button type="button" class="cs-tete" data-basculer="${r.cle}" aria-expanded="${ouvert}">` +
      `<span class="cs-nom">${Utils.escHtml(r.nom)}</span>` +
      `<span class="cs-question">${Utils.escHtml(r.question)}</span>` +
      `<span class="cs-compte">${etat}</span></button>` +
      (ouvert
        ? '<div class="cs-corps">' +
          `<p class="cs-source">${Utils.escHtml(r.source)}</p>` +
          (r.transpose
            ? `<p class="cs-transpose"><b>Transposition assumée.</b> ${Utils.escHtml(r.transpose)}</p>`
            : "") +
          (r.alertes.length
            ? `<ul class="cs-alertes">${[...ouvertes, ...ecartees].map((a) => this._alerte(r, a)).join("")}</ul>`
            : '<p class="cs-rien">Rien à signaler.</p>') +
          "</div>"
        : "") +
      "</section>"
    );
  },

  _alerte(r, a) {
    const cle = `${r.cle}::${a.cible}`;
    const enSaisie = this._saisie === cle;
    return (
      `<li class="cs-alerte${a.derogation ? " ecartee" : ""}">` +
      `<span class="cs-cible">${Utils.escHtml(a.nom)}</span>` +
      `<span class="cs-detail">${Utils.escHtml(a.detail)}</span>` +
      (a.derogation
        ? `<p class="cs-justif"><b>Écartée le ${a.derogation.date}</b> — ${Utils.escHtml(a.derogation.justification)}</p>` +
          `<button type="button" class="cs-retablir" data-retablir="${cle}">Rétablir</button>`
        : enSaisie
          ? '<div class="cs-saisie">' +
            `<textarea rows="2" data-justif="${cle}" placeholder="Pourquoi ce personnage n'a pas besoin de cet élément…"></textarea>` +
            `<span><button type="button" data-valider="${cle}">Écarter</button>` +
            '<button type="button" data-annuler>Annuler</button></span></div>'
          : `<button type="button" class="cs-ecarter" data-ecarter="${cle}">Écarter…</button>`) +
      "</li>"
    );
  },

  _brancher() {
    const q = (s) => this._hote.querySelectorAll(s);

    for (const b of q("[data-basculer]"))
      b.addEventListener("click", () => {
        const k = b.dataset.basculer;
        this._ouvertes.has(k) ? this._ouvertes.delete(k) : this._ouvertes.add(k);
        this._saisie = null;
        this.rendre();
      });

    for (const b of q("[data-ecarter]"))
      b.addEventListener("click", () => {
        this._saisie = b.dataset.ecarter;
        this.rendre();
        const ta = this._hote.querySelector("[data-justif]");
        if (ta) ta.focus();
      });

    for (const b of q("[data-annuler]"))
      b.addEventListener("click", () => {
        this._saisie = null;
        this.rendre();
      });

    for (const b of q("[data-valider]"))
      b.addEventListener("click", () => {
        const cle = b.dataset.valider;
        const ta = this._hote.querySelector(`[data-justif="${CSS.escape(cle)}"]`);
        const [regle, cible] = cle.split("::");
        // Le store refuse déjà une justification vide ; ici on le dit à
        // l'auteur plutôt que de laisser le clic sans effet.
        if (!ta || !ta.value.trim()) {
          ta && ta.focus();
          ta && ta.setAttribute("placeholder", "Une justification est nécessaire — c'est tout l'intérêt.");
          return;
        }
        this._derog.ecarter(regle, cible, ta.value);
        this._saisie = null;
      });

    for (const b of q("[data-retablir]"))
      b.addEventListener("click", () => {
        const [regle, cible] = b.dataset.retablir.split("::");
        this._derog.retablir(regle, cible);
      });
  },
};
