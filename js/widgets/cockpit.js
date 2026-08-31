"use strict";

/* ============================================================
   COCKPIT — ce que GNomon déduit de ce que vous avez déjà écrit.
   ------------------------------------------------------------
   L'écran d'entrée d'un projet non vierge. Il répond à une seule
   question : « qu'est-ce que je devrais regarder maintenant ? » — pas
   « votre GN vaut combien ? ». Il applique les mêmes trois interdits
   que la conscience, parce qu'ils sont ceux du corpus, pas d'un écran
   en particulier :

   1. **Jamais bloquant** — un diagnostic se lit, rien ne s'arrête.
   2. **Toute alerte s'écarte avec une justification écrite, et reste
      affichée** — on réutilise `Derogations` telle quelle : un
      diagnostic écarté ici l'est aussi sur l'écran qui l'a produit
      (la conscience, par exemple), parce que c'est la MÊME décision.
   3. **Jamais de score global** — des diagnostics groupés par
      catégorie, jamais additionnés en une note.

   Et un quatrième, propre à cet écran : **le silence**. Un GN qui ne
   produit aucun diagnostic affiche « rien à signaler », pas une grille
   vide qu'on remplirait pour se justifier d'exister.

   ── LA NAVIGATION EST DÉLÉGUÉE ──
   Ce widget ne route rien lui-même : il connaît `diagnostic.js`, pas
   `App`. Chaque cible cliquée passe par `onNaviguer(ecran, cible)`, et
   c'est l'appelant qui sait ouvrir une fiche ou viser une situation —
   exactement le rôle que `App` joue déjà pour la frise et le graphe.
   ============================================================ */
import { diagnostics } from "../core/diagnostic.js";
import { Utils } from "../core/utils.js";

const NOMS_CATEGORIE = {
  personnage: "Personnages",
  situation: "Situations",
  information: "Informations",
  temps: "Le temps",
  groupe: "Groupes",
};
const ORDRE_CATEGORIE = ["personnage", "situation", "information", "temps", "groupe"];

/** Le compte des diagnostics ouverts (non écartés) — sans monter
    l'écran. Sert au badge permanent de la barre, qui doit rester à
    jour quel que soit l'écran affiché, pas seulement quand le cockpit
    est monté. Une seule formule ; `Cockpit.etat()` s'en sert aussi. */
export function compterOuverts(stores, derogations) {
  return diagnostics(stores).filter((d) => !derogations.pour(d.cle, d.cible)).length;
}

export const Cockpit = {
  _hote: null,
  _stores: null,
  _derog: null,
  _onNaviguer: null,
  _saisie: null, // "<cle>::<cible>" en cours de justification
  // Le second rang est replié par défaut : c'est ce qui fait du cockpit
  // une réponse plutôt qu'une liste. Il reste ouvert si on l'a ouvert,
  // y compris après un recalcul — sinon écarter une alerte du fond
  // refermerait le tiroir sous les doigts.
  _fondOuvert: false,

  monter(hote, stores, derogations, { onNaviguer = null } = {}) {
    this._hote = hote;
    this._stores = stores;
    this._derog = derogations;
    this._onNaviguer = onNaviguer;
    this.rendre();
  },

  demonter() {
    this._hote = null;
    this._saisie = null;
  },

  /** Les diagnostics, croisés avec les dérogations. `diagnostic.js`
      reste pur — comme `conscience()` — c'est ici, à la lisière du
      rendu, qu'on sait ce qui est déjà traité. Sert aussi au badge de
      la barre : un seul calcul, une seule vérité. */
  etat() {
    if (!this._stores) return { ouverts: [], ecartes: [] };
    const ds = diagnostics(this._stores).map((d) => ({
      ...d,
      derogation: this._derog.pour(d.cle, d.cible),
    }));
    return { ouverts: ds.filter((d) => !d.derogation), ecartes: ds.filter((d) => d.derogation) };
  },



  /** ── DEUX RANGS, ET C'EST UNE CORRECTION D'AUDIT ──
      Le cockpit affichait ses vingt-et-un signaux d'un bloc. Sur le jeu
      d'essai, un seul personnage en occupait quatre à lui seul : la
      page devenait une liste qu'on parcourt au lieu d'une réponse à
      « qu'est-ce que je regarde maintenant ? ».

      On montre donc d'abord ce qui est **à regarder maintenant**
      (gravité « attention »), et on range le reste — les observations
      de fond — derrière une ligne qui les annonce et les déplie. Rien
      n'est supprimé, rien n'est résumé : ce qui est montré l'est
      toujours en entier, avec son explication et sa source. C'est le
      principe « moins d'informations, mais plus pertinentes », pas
      « moins d'explications ». */
  rendre() {
    if (!this._hote) return;
    const { ouverts, ecartes } = this.etat();
    const urgents = ouverts.filter((d) => d.gravite === "attention");
    const fond = ouverts.filter((d) => d.gravite !== "attention");

    this._hote.innerHTML =
      '<div class="ck">' +
      this._entete(urgents, fond, ecartes) +
      (ouverts.length ? this._groupes(urgents, false) : this._silence()) +
      (fond.length
        ? `<button type="button" class="ck-plus" data-plus aria-expanded="${this._fondOuvert}">` +
          `${this._fondOuvert ? "Masquer" : "Voir"} ${fond.length} ${Utils.plur(fond.length, "observation")} de fond</button>` +
          (this._fondOuvert ? this._groupes(fond, false) : "")
        : "") +
      (ecartes.length
        ? '<p class="ck-soustitre">Écartées, avec leur justification</p>' + this._groupes(ecartes, true)
        : "") +
      "</div>";

    this._brancher();
  },

  _entete(urgents, fond, ecartes) {
    const bilan = [];
    if (urgents.length)
      bilan.push(
        `<b>${urgents.length}</b> ${Utils.plur(urgents.length, "point")} d'attention`,
      );
    if (fond.length)
      bilan.push(
        `<span class="ck-fond-compte">${fond.length} ${Utils.plur(fond.length, "observation")} de fond</span>`,
      );
    if (ecartes.length)
      bilan.push(
        `<span class="ck-ecartees">${ecartes.length} ${Utils.plur(ecartes.length, "écartée")}</span>`,
      );

    return (
      '<div class="ck-entete">' +
      (bilan.length
        ? `<p class="ck-total">${bilan.join(" · ")}</p>`
        : '<p class="ck-total ck-calme">Rien à signaler.</p>') +
      '<p class="ck-note">Ce que GNomon déduit du texte déjà écrit — des observations, pas une note. ' +
      "Chacune dit pourquoi, renvoie à son origine, et s'écarte en écrivant sa propre raison.</p>" +
      "</div>"
    );
  },

  _silence() {
    return (
      '<p class="ck-rien">Aucun point de fragilité détecté pour l\'instant dans ce que vous avez écrit. ' +
      "GNomon se tait quand il n'a rien à dire — continuez d'écrire, le diagnostic se met à jour à chaque changement.</p>"
    );
  },

  _groupes(liste, ecartees) {
    return ORDRE_CATEGORIE.map((c) => {
      const items = liste.filter((d) => d.categorie === c);
      if (!items.length) return "";
      return (
        '<section class="ck-groupe">' +
        `<h2 class="ck-cat">${Utils.escHtml(NOMS_CATEGORIE[c] || c)}</h2>` +
        `<ul class="ck-liste">${items.map((d) => this._carte(d, ecartees)).join("")}</ul>` +
        "</section>"
      );
    }).join("");
  },

  _carte(d, ecartee) {
    const cle = `${d.cle}::${d.cible}`;
    const enSaisie = this._saisie === cle;
    // Une observation à confiance moyenne ne doit pas se lire avec la
    // même autorité qu'un fait structurel : elle porte sa réserve en
    // toutes lettres, pas seulement dans une nuance de couleur qu'on
    // n'apprendrait jamais à décoder.
    const hypothese = d.confiance === "moyenne";
    return (
      `<li class="ck-diag${ecartee ? " ecartee" : ""}${hypothese ? " hypothese" : ""}">` +
      (hypothese ? '<p class="ck-reserve">Observation — à confirmer par vous</p>' : "") +
      `<p class="ck-titre">${Utils.escHtml(d.titre)}</p>` +
      `<p class="ck-detail">${Utils.escHtml(d.detail)}</p>` +
      `<p class="ck-source">${Utils.escHtml(d.source)}</p>` +
      (d.cibles.length
        ? `<p class="ck-cibles">${d.cibles
            .map(
              (c) =>
                `<button type="button" data-aller data-ecran="${Utils.escHtml(c.ecran)}" ` +
                `data-cid="${Utils.escHtml(c.id)}" data-sid="${Utils.escHtml((c.params && c.params.situationId) || "")}">` +
                `${Utils.escHtml(c.nom)}</button>`,
            )
            .join("")}</p>`
        : "") +
      (ecartee
        ? `<p class="ck-justif"><b>Écartée le ${d.derogation.date}</b> — ${Utils.escHtml(d.derogation.justification)}</p>` +
          `<button type="button" class="ck-retablir" data-retablir="${cle}">Rétablir</button>`
        : enSaisie
          ? '<div class="ck-saisie">' +
            `<textarea rows="2" data-justif="${cle}" placeholder="Pourquoi ce point ne mérite pas d'attention…"></textarea>` +
            `<span><button type="button" data-valider="${cle}">Écarter</button>` +
            '<button type="button" data-annuler>Annuler</button></span></div>'
          : `<button type="button" class="ck-ecarter" data-ecarter="${cle}">Écarter…</button>`) +
      "</li>"
    );
  },

  _brancher() {
    const q = (s) => this._hote.querySelectorAll(s);

    for (const b of q("[data-plus]"))
      b.addEventListener("click", () => {
        this._fondOuvert = !this._fondOuvert;
        this.rendre();
      });

    for (const b of q("[data-aller]"))
      b.addEventListener("click", () => {
        if (!this._onNaviguer) return;
        this._onNaviguer(b.dataset.ecran, {
          id: b.dataset.cid,
          params: b.dataset.sid ? { situationId: b.dataset.sid } : {},
        });
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
        const i = cle.indexOf("::");
        const regle = cle.slice(0, i);
        const cible = cle.slice(i + 2);
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
        const cle = b.dataset.retablir;
        const i = cle.indexOf("::");
        this._derog.retablir(cle.slice(0, i), cle.slice(i + 2));
      });
  },
};
