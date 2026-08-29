"use strict";

/* ============================================================
   APP — bootstrap, écrans, routage.

   Deux écrans depuis S1 : « Le réseau » (le casting) et « La fiche »
   (l'écriture d'un personnage). Le routage est nu — un champ `_ecran`
   et un hash — parce qu'il n'y a rien à router de plus, et qu'un
   routeur qu'on ne remplit pas est un routeur qu'on maintient pour
   rien.

   ── L'ÉVÉNEMENT VA À L'ÉCRAN ACTIF, ET LUI SEUL ──
   `ReseauStore` émet à chaque écriture, y compris pendant que l'auteur
   tape dans le carnet (sauvegarde débouncée). Si l'app re-rendait tout,
   elle écraserait le textarea sous le curseur : sélection perdue,
   position perdue. Alors l'écran fiche ne rafraîchit **que son
   dérivé** — la jauge et les liens — et jamais les champs de saisie.
   ============================================================ */
import { Storage } from "./core/storage.js";
import { ReseauStore } from "./core/reseaustore.js";
import { chargerValmorel } from "./data/valmorel.js";
import { Reseau } from "./widgets/reseau.js";
import { Fiche } from "./widgets/fiche.js";
import { Utils } from "./core/utils.js";

export const App = {
  _ecran: "reseau",

  init() {
    Storage.runMigrations();
    ReseauStore.load();

    this._hoteReseau = document.getElementById("ecran-reseau");
    this._hoteFiche = document.getElementById("ecran-fiche");

    Reseau.monter(this._hoteReseau, ReseauStore, {
      onOuvrir: (id) => this.ouvrirFiche(id),
    });

    ReseauStore.subscribe(() => this._surChangement());
    this._brancherBarre();
    window.addEventListener("hashchange", () => this._lireHash());
    this._lireHash();
  },

  /* ---------------- routage ---------------- */

  _lireHash() {
    const m = (location.hash || "").match(/^#\/fiche\/(.+)$/);
    if (m && ReseauStore.personnage(m[1])) this.ouvrirFiche(m[1], { silencieux: true });
    else this.ouvrirReseau({ silencieux: true });
  },

  ouvrirReseau({ silencieux = false } = {}) {
    if (this._ecran === "fiche") Fiche.flush();
    this._ecran = "reseau";
    this._hoteReseau.hidden = false;
    this._hoteFiche.hidden = true;
    document.getElementById("act-retour").hidden = true;
    document.getElementById("fil").textContent = "Le réseau";
    Reseau.rendre();
    if (!silencieux && location.hash) location.hash = "";
    this._compteurs();
  },

  ouvrirFiche(id, { silencieux = false } = {}) {
    const p = ReseauStore.personnage(id);
    if (!p) return this.ouvrirReseau();

    // Garde anti-remontage. `ouvrirFiche` écrit le hash, et le
    // `hashchange` qui s'ensuit rappelle `_lireHash` → `ouvrirFiche` sur
    // le MÊME personnage. Sans cette garde, la fiche se re-construit
    // pendant que l'auteur écrit : le carnet est reconstruit depuis le
    // store, dont la sauvegarde est débouncée — donc encore vide. Le
    // texte à l'écran disparaît. C'est le bug que la doctrine annonce,
    // et il s'attrape ici, une fois.
    if (this._ecran === "fiche" && Fiche.personnageId() === id) {
      if (!silencieux && location.hash !== `#/fiche/${id}`) location.hash = `#/fiche/${id}`;
      document.getElementById("fil").textContent = p.nom;
      return;
    }

    this._ecran = "fiche";
    this._hoteReseau.hidden = true;
    this._hoteFiche.hidden = false;
    document.getElementById("act-retour").hidden = false;
    document.getElementById("fil").textContent = p.nom;
    Fiche.monter(this._hoteFiche, ReseauStore, id, {
      onOuvrir: (autreId) => this.ouvrirFiche(autreId),
    });
    if (!silencieux) location.hash = `#/fiche/${id}`;
    this._compteurs();
  },

  /* ---------------- réactions ---------------- */

  _surChangement() {
    if (this._ecran === "fiche") {
      Fiche.rafraichirDerives();
      const p = ReseauStore.personnage(Fiche.personnageId());
      if (p) document.getElementById("fil").textContent = p.nom;
    } else {
      Reseau.rendre();
    }
    this._compteurs();
  },

  /* ---------------- barre ---------------- */

  _brancherBarre() {
    document.getElementById("act-retour").addEventListener("click", () =>
      this.ouvrirReseau(),
    );

    document.getElementById("act-nouveau").addEventListener("click", () => {
      const p = ReseauStore.creerPersonnage({ nom: "Sans nom" });
      this.ouvrirFiche(p.id);
    });

    document.getElementById("act-seed").addEventListener("click", () => {
      if (
        ReseauStore.personnages().length &&
        !confirm("Remplacer le réseau actuel par le jeu d'essai « Valmorel » ?")
      )
        return;
      ReseauStore.vider();
      const n = chargerValmorel(ReseauStore);
      this.ouvrirReseau();
      this._statut(
        `Valmorel chargé — ${n.personnages} personnages, ${n.liens} liens orientés.`,
      );
    });

    document.getElementById("act-vider").addEventListener("click", () => {
      if (!ReseauStore.personnages().length) return;
      if (!confirm("Vider le réseau ? Cette action n'est pas annulable.")) return;
      ReseauStore.vider();
      this.ouvrirReseau();
      this._statut("Réseau vidé.");
    });
  },

  _statut(txt) {
    const el = document.getElementById("statut");
    el.textContent = txt;
    el.hidden = !txt;
  },

  _compteurs() {
    const p = ReseauStore.personnages().length;
    const l = ReseauStore.liens().length;
    const m = ReseauStore.liens().filter((x) => x.miroir).length;
    document.getElementById("compteurs").textContent =
      `${p} ${Utils.plur(p, "personnage")} · ${l} ${Utils.plur(l, "lien")} ${Utils.plur(l, "orienté")} · ${m} ${Utils.plur(m, "miroir")}`;
  },
};

// Accès console pour explorer la vérité à la main.
window.App = App;
window.ReseauStore = ReseauStore;

App.init();
