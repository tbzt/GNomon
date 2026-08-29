"use strict";

/* ============================================================
   RÉSEAU — le casting, en deux lentilles.
   ------------------------------------------------------------
   **Une vérité, deux vues** — la doctrine du projet appliquée là où
   elle sert le plus.

   · **La liste** met les couvertures côte à côte : elle dit d'un coup
     d'œil qui est écrit et qui ne l'est pas, ce qu'aucune relecture de
     quarante fiches ne donne.
   · **Le graphe** montre ce que la liste ne peut pas : la forme du
     réseau, les groupes, et surtout **ce qui casse si quelqu'un ne
     vient pas**.

   Aucune n'est « la vraie » : les deux lisent le même store, avec le
   même vocabulaire (⇄ accord · ⇄̸ désaccord · → sens unique).
   ============================================================ */
import { scoreCouverture } from "../core/couverture.js";
import { TONALITES, IMPORTANCES, FONCTIONS } from "../core/reseaustore.js";
import { ReseauGraphe } from "./reseaugraphe.js";
import { Accueil } from "./accueil.js";
import { Utils } from "../core/utils.js";

const SEUIL_ALERTE = 5;

function inits(nom) {
  return String(nom || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0].toUpperCase())
    .join("");
}

export const Reseau = {
  _store: null,
  _hote: null,
  _onOuvrir: null,
  _onCreer: null,
  _stores: null,
  _lentille: "liste",

  monter(hote, store, { onOuvrir = null, onCreer = null, stores = null, actions = null } = {}) {
    this._hote = hote;
    this._store = store;
    this._stores = stores;
    this._onOuvrir = onOuvrir;
    this._onCreer = onCreer;
    this._actions = actions;
    this._hote.addEventListener("click", (e) => {
      const lent = e.target.closest("[data-lentille]");
      if (lent) {
        this._lentille = lent.dataset.lentille;
        this.rendre();
        return;
      }
      if (e.target.closest("[data-creer]")) {
        if (this._onCreer) this._onCreer();
        return;
      }
      const carte = e.target.closest("[data-personnage]");
      if (carte && this._onOuvrir) this._onOuvrir(carte.dataset.personnage);
    });
    this.rendre();
  },

  demonter() {
    ReseauGraphe.demonter();
  },

  rendre() {
    const persos = this._store.personnages();
    const barre =
      '<div class="lentilles">' +
      `<button type="button" class="lentille${this._lentille === "liste" ? " actif" : ""}" data-lentille="liste">Liste</button>` +
      `<button type="button" class="lentille${this._lentille === "graphe" ? " actif" : ""}" data-lentille="graphe">Graphe</button>` +
      '<span class="spacer"></span>' +
      '<button type="button" class="creer-perso" data-creer>+ Personnage</button>' +
      "</div>";

    if (!persos.length) {
      ReseauGraphe.demonter();
      // Le projet entièrement vierge mérite mieux qu'une phrase : on
      // ne sait ni par où commencer ni que dix autres écrans existent.
      if (this._actions && Accueil.estVierge(this._store, this._actions.monde_store)) {
        this._hote.innerHTML = Accueil.html();
        Accueil.brancher(this._hote, this._actions);
        return;
      }
      this._hote.innerHTML =
        barre +
        '<p class="vide">Aucun personnage. Ajoutez-en un, ou chargez le jeu d\'essai.</p>';
      return;
    }

    if (this._lentille === "graphe") {
      this._hote.innerHTML = barre + '<div id="rg-hote"></div>';
      ReseauGraphe.monter(this._hote.querySelector("#rg-hote"), this._store, this._stores, {
        onOuvrir: this._onOuvrir,
      });
      return;
    }

    ReseauGraphe.demonter();
    const groupes = [...this._store.groupes(), { id: null, nom: "Sans groupe" }];
    this._hote.innerHTML =
      barre +
      groupes
      .map((g) => {
        const membres = persos.filter((p) => p.groupeId === g.id);
        if (!membres.length) return "";
        return (
          `<section class="groupe"><h2>${Utils.escHtml(g.nom)}</h2>` +
          membres.map((p) => this._carte(p)).join("") +
          "</section>"
        );
      })
      .join("");
  },

  _carte(p) {
    const liens = this._store.liensDe(p.id);
    const primairesRecus = this._store
      .liensVers(p.id)
      .filter((l) => l.importance === "primaire").length;
    const { couvert, total } = scoreCouverture(this._store, p.id);

    const lignes = liens.length
      ? liens.map((l) => this._ligne(l)).join("")
      : '<li class="lien vide-lien">aucun contact déclaré</li>';

    return (
      `<article class="perso${p.pj ? "" : " pnj"}" data-personnage="${p.id}" tabindex="0" role="button">` +
      '<header class="perso-tete">' +
      '<span class="perso-vignette">' +
      (p.portrait
        ? `<img src="${Utils.escHtml(p.portrait)}" alt="" />`
        : `<span class="silhouette">${Utils.escHtml(inits(p.nom))}</span>`) +
      "</span><span class=\"perso-texte\">" +
      `<h3>${Utils.escHtml(p.nom)}` +
      `<span class="cote${couvert < SEUIL_ALERTE ? " basse" : ""}" title="Couverture : ${couvert} composantes sur ${total}">${couvert}/${total}</span>` +
      "</h3>" +
      `<p class="role">${Utils.escHtml(p.role)}${p.fonction ? " · " + FONCTIONS[p.fonction] : ""} · ${p.pj ? "PJ" : "PNJ"}</p>` +
      "</span></header>" +
      (p.moral ? `<p class="moral">« ${Utils.escHtml(p.moral)} »</p>` : "") +
      `<p class="compte">${liens.length} ${Utils.plur(liens.length, "contact")} ${Utils.plur(liens.length, "déclaré")} · ` +
      `<span class="${primairesRecus ? "" : "alerte"}">${primairesRecus} ${Utils.plur(primairesRecus, "lien")} ${Utils.plur(primairesRecus, "primaire")} ${Utils.plur(primairesRecus, "reçu")}</span></p>` +
      `<ul class="liens">${lignes}</ul>` +
      "</article>"
    );
  },

  _ligne(l) {
    const cible = this._store.personnage(l.vers);
    const retour = this._store.reciproque(l);
    const sym = retour && retour.tonalite === l.tonalite && retour.importance === l.importance;
    const titre = sym
      ? "réciproque à l'identique"
      : retour
        ? "réciproque, mais différent"
        : "aucun lien de retour";
    return (
      `<li class="lien t-${l.tonalite} i-${l.importance}">` +
      `<span class="fleche" title="${titre}">${sym ? "⇄" : retour ? "⇄̸" : "→"}</span> ` +
      `<b>${Utils.escHtml(cible ? cible.nom : "?")}</b>` +
      (l.miroir ? ' <span class="miroir" title="contact-miroir">◎</span>' : "") +
      `<span class="nature">${Utils.escHtml(l.nature) || "—"}</span>` +
      `<span class="tags">${TONALITES[l.tonalite]} · ${IMPORTANCES[l.importance]}</span>` +
      "</li>"
    );
  },
};
