"use strict";

/* ============================================================
   RÉSEAU — la liste du casting, par groupe.

   Écran nu exprès : il montre la vérité telle qu'elle est stockée.
   Le graphe force-dirigé viendra en S2 ; d'ici là, c'est ici qu'on
   vérifie que le modèle tient.

   Depuis S1, chaque carte porte sa **couverture** (n/9). Mise côte à
   côte sur tout le casting, elle dit d'un coup d'œil qui est écrit et
   qui ne l'est pas — ce qu'aucune relecture de quarante fiches ne
   donne. Un personnage sous 5/9 est signalé, jamais bloqué.
   ============================================================ */
import { scoreCouverture } from "../core/couverture.js";
import { TONALITES, IMPORTANCES, FONCTIONS } from "../core/reseaustore.js";
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

  monter(hote, store, { onOuvrir = null, onCreer = null } = {}) {
    this._hote = hote;
    this._store = store;
    this._onOuvrir = onOuvrir;
    this._onCreer = onCreer;
    this._hote.addEventListener("click", (e) => {
      if (e.target.closest("[data-creer]")) {
        if (this._onCreer) this._onCreer();
        return;
      }
      const carte = e.target.closest("[data-personnage]");
      if (carte && this._onOuvrir) this._onOuvrir(carte.dataset.personnage);
    });
    this.rendre();
  },

  rendre() {
    const persos = this._store.personnages();
    const bouton = '<button type="button" class="creer-perso" data-creer>+ Personnage</button>';
    if (!persos.length) {
      this._hote.innerHTML =
        '<p class="vide">Aucun personnage. Chargez le jeu d\'essai pour voir le modèle à l\'œuvre.</p>' +
        bouton;
      return;
    }

    const groupes = [...this._store.groupes(), { id: null, nom: "Sans groupe" }];
    this._hote.innerHTML =
      bouton +
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
