"use strict";

/* ============================================================
   FICHE — l'écran d'écriture d'un personnage.
   ------------------------------------------------------------
   Trois choses, et l'ordre compte :

   1. **Les huit champs d'eXpérience** (fonction, point de vue moral,
      désir, besoin, faiblesse, pouvoirs, transformation, archétype).
      Saisis, parce qu'ils sont l'intention de l'auteur. Repliés par
      défaut : on écrit d'abord, on structure ensuite.

   2. **La jauge de couverture** — neuf pastilles CALCULÉES depuis le
      réseau (cf. `core/couverture.js`). Aucune n'est saisissable. On
      clique une pastille grise, elle dit ce qui manque et pourquoi.

   3. **Le carnet** — de la prose, en markdown léger, où le `@mention`
      propose l'arête.

   ── RENDU EN DEUX ÉTAGES, et ce n'est pas de l'optimisation ──
   `rendre()` construit tout ; `rafraichirDerives()` ne remet à jour que
   la jauge, les liens et les compteurs. Le store émet à chaque frappe
   sauvegardée — si on re-construisait tout, on écraserait le textarea
   sous le curseur de l'auteur : sélection perdue, position perdue,
   frappe suivante à l'envers. On ne touche jamais au champ qui a le
   focus.
   ============================================================ */
import { couverture } from "../core/couverture.js";
import { TONALITES, IMPORTANCES, FONCTIONS } from "../core/reseaustore.js";
import { Mentions } from "./journal/mentions.js";
import { Utils } from "../core/utils.js";

const CHAMPS = [
  { cle: "moral", label: "Point de vue moral", aide: "Sa position sur le problème central. Différente de celle des autres, surtout de son adversaire." },
  { cle: "desir", label: "Désir", aide: "Sa carotte. On doit pouvoir dire QUAND il sera réalisé." },
  { cle: "besoin", label: "Besoin", aide: "Plus profond et plus flou que le désir — et souvent en contradiction avec lui." },
  { cle: "faiblesse", label: "Faiblesse", aide: "Ce qui l'empêche d'obtenir son désir." },
  { cle: "pouvoirs", label: "Pouvoirs et capacités", aide: "Ce qu'il sait faire que les autres ne savent pas." },
  { cle: "transformation", label: "Transformation possible", aide: "Ce qu'il peut devenir au cours du jeu." },
  { cle: "archetype", label: "Archétype", aide: "Le moule, pour se repérer — et sa zone d'ombre." },
];

export const Fiche = {
  _store: null,
  _hote: null,
  _id: null,
  _onOuvrir: null,
  _tSave: null,

  monter(hote, store, personnageId, { onOuvrir = null } = {}) {
    // On quitte peut-être une fiche en cours d'écriture : la sauvegarde
    // est débouncée, donc les dernières frappes ne sont pas encore au
    // store. Les écrire AVANT de changer de personnage.
    this.flush();
    this._hote = hote;
    this._store = store;
    this._id = personnageId;
    this._onOuvrir = onOuvrir;
    this.rendre();
  },

  personnageId() {
    return this._id;
  },

  /** Écrit immédiatement le carnet en attente et annule le débounce.
      À appeler avant toute navigation, et au blur du champ : sans ça,
      quitter l'écran dans les 400 ms perd les dernières frappes. */
  flush() {
    clearTimeout(this._tSave);
    this._tSave = null;
    if (!this._hote || !this._id) return;
    const carnet = this._hote.querySelector("#carnet");
    if (!carnet) return;
    const p = this._store.personnage(this._id);
    if (p && p.notes !== carnet.value) this._store.majPersonnage(this._id, { notes: carnet.value });
  },

  /* ================= rendu complet ================= */

  rendre() {
    const p = this._store.personnage(this._id);
    if (!p) {
      this._hote.innerHTML = '<p class="vide">Ce personnage n\'existe plus.</p>';
      return;
    }

    this._hote.innerHTML =
      `<article class="fiche${p.pj ? "" : " pnj"}">` +
      this._entete(p) +
      '<div class="fiche-corps">' +
      `<div class="fiche-gauche">${this._carnet(p)}<div id="fiche-liens">${this._liens(p)}</div></div>` +
      `<aside class="fiche-droite"><div id="fiche-jauge">${this._jauge(p)}</div>${this._champs(p)}</aside>` +
      "</div></article>";

    this._brancher();
  },

  /** Ne remet à jour que le dérivé. Ne touche jamais au champ focalisé. */
  rafraichirDerives() {
    const p = this._store.personnage(this._id);
    if (!p || !this._hote.querySelector(".fiche")) return;
    const j = this._hote.querySelector("#fiche-jauge");
    const l = this._hote.querySelector("#fiche-liens");
    if (j) j.innerHTML = this._jauge(p);
    if (l) l.innerHTML = this._liens(p);
    const t = this._hote.querySelector(".fiche-titre");
    if (t && document.activeElement !== t) t.value = p.nom;
    this._brancherJauge();
  },

  /* ================= morceaux ================= */

  _entete(p) {
    const opts = Object.entries(FONCTIONS)
      .map(
        ([k, v]) =>
          `<option value="${k}"${p.fonction === k ? " selected" : ""}>${Utils.escHtml(v)}</option>`,
      )
      .join("");
    return (
      '<header class="fiche-entete">' +
      `<input class="fiche-titre" value="${Utils.escHtml(p.nom)}" aria-label="Nom du personnage" />` +
      '<div class="fiche-meta">' +
      `<input class="fiche-role" value="${Utils.escHtml(p.role)}" placeholder="Métier ou fonction…" aria-label="Métier ou fonction" />` +
      `<select class="fiche-fonction" aria-label="Fonction narrative"><option value="">— fonction narrative —</option>${opts}</select>` +
      `<label class="bascule"><input type="checkbox" class="fiche-pj"${p.pj ? " checked" : ""} /> PJ</label>` +
      `<label class="bascule"><input type="checkbox" class="fiche-surprise"${p.surprise ? " checked" : ""} /> Surprise en réserve</label>` +
      "</div></header>"
    );
  },

  _jauge(p) {
    const c = couverture(this._store, p.id);
    const n = c.filter((x) => x.ok).length;
    return (
      '<div class="jauge-bloc">' +
      `<p class="jauge-titre"><span>Couverture</span><span class="jauge-score">${n}/9</span></p>` +
      '<div class="jauge">' +
      c
        .map(
          (x, i) =>
            `<button type="button" class="pastille${x.ok ? " on" : ""}" data-i="${i}" ` +
            `aria-pressed="false" aria-label="${Utils.escHtml(x.nom)} : ${x.ok ? "couvert" : "manquant"}" ` +
            `title="${Utils.escHtml(x.nom)}"></button>`,
        )
        .join("") +
      "</div>" +
      '<p class="jauge-dit" id="jauge-dit">Les neuf pastilles sont <b>calculées</b> depuis le réseau, ' +
      "jamais saisies. Touchez-en une pour savoir ce qu'elle mesure.</p>" +
      "</div>"
    );
  },

  _champs(p) {
    return (
      '<details class="champs-bloc"><summary title="Les huit champs de la méthode eXpérience. Le huitième — la fonction narrative — est dans l\'en-tête, avec l\'identité.">Structure du personnage</summary>' +
      CHAMPS.map(
        (c) =>
          `<label class="champ"><span class="champ-label" title="${Utils.escHtml(c.aide)}">${c.label}</span>` +
          `<textarea rows="2" data-champ="${c.cle}" placeholder="${Utils.escHtml(c.aide)}">${Utils.escHtml(p[c.cle] || "")}</textarea></label>`,
      ).join("") +
      "</details>"
    );
  },

  _carnet(p) {
    return (
      '<section class="carnet">' +
      '<p class="carnet-titre">Le carnet <span class="carnet-aide">markdown léger · <b>@</b> pour mentionner</span></p>' +
      `<textarea id="carnet" rows="14" placeholder="Écrivez. Tapez @ pour mentionner quelqu'un — le lien vous sera proposé.">${Utils.escHtml(p.notes || "")}</textarea>` +
      '<div id="proposition" hidden></div>' +
      '<p class="carnet-titre">Aperçu</p>' +
      `<div class="carnet-apercu" id="apercu">${Mentions.renderText(p.notes || "", this._store)}</div>` +
      "</section>"
    );
  },

  _liens(p) {
    const liens = this._store.liensDe(p.id);
    if (!liens.length)
      return '<p class="liens-vide">Aucun contact déclaré. Mentionnez quelqu\'un dans le carnet.</p>';
    return (
      '<p class="carnet-titre">Ses contacts</p><ul class="liens">' +
      liens
        .map((l) => {
          const cible = this._store.personnage(l.vers);
          const retour = this._store.reciproque(l);
          const sym =
            retour && retour.tonalite === l.tonalite && retour.importance === l.importance;
          return (
            `<li class="lien t-${l.tonalite} i-${l.importance}">` +
            `<span class="fleche" title="${sym ? "réciproque à l'identique" : retour ? "réciproque, mais différent" : "aucun lien de retour"}">${sym ? "⇄" : retour ? "⇄̸" : "→"}</span> ` +
            `<b>${Utils.escHtml(cible ? cible.nom : "?")}</b>` +
            (l.miroir ? ' <span class="miroir" title="contact-miroir">◎</span>' : "") +
            `<span class="nature">${Utils.escHtml(l.nature) || "—"}</span>` +
            `<span class="tags">${TONALITES[l.tonalite]} · ${IMPORTANCES[l.importance]}</span>` +
            "</li>"
          );
        })
        .join("") +
      "</ul>"
    );
  },

  /* ================= câblage ================= */

  _brancher() {
    const q = (s) => this._hote.querySelector(s);
    const maj = (patch) => this._store.majPersonnage(this._id, patch);

    q(".fiche-titre").addEventListener("change", (e) => maj({ nom: e.target.value.trim() }));
    q(".fiche-role").addEventListener("change", (e) => maj({ role: e.target.value.trim() }));
    q(".fiche-fonction").addEventListener("change", (e) =>
      maj({ fonction: e.target.value || null }),
    );
    q(".fiche-pj").addEventListener("change", (e) => maj({ pj: e.target.checked }));
    q(".fiche-surprise").addEventListener("change", (e) => maj({ surprise: e.target.checked }));

    for (const ta of this._hote.querySelectorAll("[data-champ]"))
      ta.addEventListener("change", (e) => maj({ [e.target.dataset.champ]: e.target.value }));

    const carnet = q("#carnet");
    carnet.addEventListener("input", () => {
      q("#apercu").innerHTML = Mentions.renderText(carnet.value, this._store);
      clearTimeout(this._tSave);
      this._tSave = setTimeout(() => maj({ notes: carnet.value }), 400);
    });
    carnet.addEventListener("blur", () => this.flush());

    Mentions.attach(carnet, {
      store: this._store,
      personnageId: this._id,
      onMention: ({ cible, existe }) => {
        if (existe) this._propositionFermer();
        else this._proposer(cible);
      },
    });

    // Une puce ouvre la fiche du personnage mentionné.
    q("#apercu").addEventListener("click", (e) => {
      const chip = e.target.closest('[data-action="ouvrir-personnage"]');
      if (chip && this._onOuvrir) this._onOuvrir(chip.dataset.id);
    });

    this._brancherJauge();
  },

  _brancherJauge() {
    const c = couverture(this._store, this._id);
    const dit = this._hote.querySelector("#jauge-dit");
    for (const b of this._hote.querySelectorAll(".pastille")) {
      b.addEventListener("click", () => {
        for (const o of this._hote.querySelectorAll(".pastille"))
          o.setAttribute("aria-pressed", "false");
        b.setAttribute("aria-pressed", "true");
        const x = c[Number(b.dataset.i)];
        dit.innerHTML = x.ok
          ? `<b>${Utils.escHtml(x.nom)}</b> — couvert.`
          : `<b>${Utils.escHtml(x.nom)}</b> — manquant. ${Utils.escHtml(x.manque)}`;
      });
    }
  },

  /* ================= la proposition d'arête ================= */

  /** Quatre boutons de tonalité, et rien de pré-sélectionné : c'est le
      seul choix que l'auteur DOIT faire, parce qu'aucun défaut ne serait
      honnête. L'importance a un défaut au milieu, ajustable après coup. */
  _proposer(cible) {
    const moi = this._store.personnage(this._id);
    const box = this._hote.querySelector("#proposition");
    box.innerHTML =
      '<p class="prop-titre">Créer le lien ' +
      `<b>${Utils.escHtml(moi.nom)} → ${Utils.escHtml(cible.nom)}</b> ?</p>` +
      '<div class="prop-tons">' +
      Object.entries(TONALITES)
        .map(
          ([k, v]) =>
            `<button type="button" class="prop-ton t-${k}" data-ton="${k}">${Utils.escHtml(v)}</button>`,
        )
        .join("") +
      "</div>" +
      '<p class="prop-note">L\'importance sera <b>secondaire</b> — ajustable ensuite. ' +
      "La tonalité, elle, n'est pas devinée : un « neutre » posé en douce ferait " +
      "passer pour couvert un personnage qui ne l'est pas.</p>" +
      '<button type="button" class="prop-plus-tard">Plus tard</button>';
    box.hidden = false;

    for (const b of box.querySelectorAll(".prop-ton"))
      b.addEventListener("click", () => {
        this._store.upsertLien({
          de: this._id,
          vers: cible.id,
          nature: "",
          tonalite: b.dataset.ton,
          importance: "secondaire",
        });
        this._propositionFermer();
      });

    box.querySelector(".prop-plus-tard").addEventListener("click", () =>
      this._propositionFermer(),
    );
  },

  _propositionFermer() {
    const box = this._hote.querySelector("#proposition");
    if (box) {
      box.hidden = true;
      box.innerHTML = "";
    }
  },
};
