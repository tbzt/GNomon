"use strict";

/* ============================================================
   APP — bootstrap, écrans, routage.

   Quatre écrans depuis S3 : « Le réseau » (le casting), « La fiche »
   (l'écriture d'un personnage), « Les trames » (l'atelier) et
   « Qui sait quoi » (la matrice des informations). Le
   routage est nu — un champ `_ecran` et un hash — parce qu'il n'y a
   rien à router de plus, et qu'un routeur qu'on ne remplit pas est un
   routeur qu'on maintient pour rien.

   ── L'ÉVÉNEMENT VA À L'ÉCRAN ACTIF, ET LUI SEUL ──
   Les stores émettent à chaque écriture, y compris pendant que l'auteur
   tape (sauvegarde débouncée). Si l'app re-rendait tout, elle écraserait
   le champ sous le curseur : sélection perdue, position perdue. Chaque
   écran expose donc un rafraîchissement partiel, et l'app ne réveille
   que celui qui est à l'écran.
   ============================================================ */
import { Storage } from "./core/storage.js";
import { ReseauStore } from "./core/reseaustore.js";
import { TrameStore } from "./core/tramestore.js";
import { InformationStore } from "./core/informationstore.js";
import { chargerValmorel } from "./data/valmorel.js";
import { Reseau } from "./widgets/reseau.js";
import { Fiche } from "./widgets/fiche.js";
import { Atelier } from "./widgets/atelier.js";
import { Matrice } from "./widgets/matrice.js";
import { Utils } from "./core/utils.js";

export const App = {
  _ecran: "reseau",

  init() {
    Storage.runMigrations();
    ReseauStore.load();
    TrameStore.load();
    InformationStore.load();

    this._hotes = {
      reseau: document.getElementById("ecran-reseau"),
      fiche: document.getElementById("ecran-fiche"),
      atelier: document.getElementById("ecran-atelier"),
      matrice: document.getElementById("ecran-matrice"),
    };

    Reseau.monter(this._hotes.reseau, ReseauStore, {
      onOuvrir: (id) => this.ouvrirFiche(id),
    });

    ReseauStore.subscribe(() => this._surChangement());
    TrameStore.subscribe(() => this._surChangement());
    InformationStore.subscribe(() => this._surChangement());

    this._brancherBarre();
    window.addEventListener("hashchange", () => this._lireHash());
    this._lireHash();
  },

  /* ---------------- routage ---------------- */

  _lireHash() {
    const h = location.hash || "";
    const f = h.match(/^#\/fiche\/(.+)$/);
    if (f && ReseauStore.personnage(f[1])) return this.ouvrirFiche(f[1], { silencieux: true });
    if (/^#\/trames/.test(h)) return this.ouvrirAtelier({ silencieux: true });
    if (/^#\/informations/.test(h)) return this.ouvrirMatrice({ silencieux: true });
    this.ouvrirReseau({ silencieux: true });
  },

  /** Sortie propre de l'écran courant : écrire ce qui est en attente et
      démonter ce qui tient des ressources. */
  _quitter() {
    if (this._ecran === "fiche") Fiche.flush();
    if (this._ecran === "atelier") Atelier.demonter();
  },

  _basculer(ecran, titre) {
    this._ecran = ecran;
    for (const [nom, el] of Object.entries(this._hotes)) el.hidden = nom !== ecran;
    document.getElementById("act-retour").hidden = ecran === "reseau";
    document.getElementById("fil").textContent = titre;
    this._compteurs();
  },

  ouvrirReseau({ silencieux = false } = {}) {
    this._quitter();
    this._basculer("reseau", "Le réseau");
    Reseau.rendre();
    if (!silencieux && location.hash) location.hash = "";
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

    this._quitter();
    this._basculer("fiche", p.nom);
    Fiche.monter(this._hotes.fiche, ReseauStore, id, {
      onOuvrir: (autreId) => this.ouvrirFiche(autreId),
      infos: InformationStore,
    });
    if (!silencieux) location.hash = `#/fiche/${id}`;
  },

  ouvrirAtelier({ silencieux = false } = {}) {
    // Même garde que pour la fiche : le hashchange rappellerait ici, et
    // remonter le graphe remettrait la vue de l'auteur à zéro.
    if (this._ecran === "atelier") {
      if (!silencieux && location.hash !== "#/trames") location.hash = "#/trames";
      return;
    }
    this._quitter();
    this._basculer("atelier", "Les trames");
    Atelier.monter(this._hotes.atelier, TrameStore, ReseauStore, InformationStore);
    if (!silencieux) location.hash = "#/trames";
  },

  ouvrirMatrice({ silencieux = false } = {}) {
    if (this._ecran === "matrice") {
      if (!silencieux && location.hash !== "#/informations") location.hash = "#/informations";
      return;
    }
    this._quitter();
    this._basculer("matrice", "Qui sait quoi");
    Matrice.monter(this._hotes.matrice, InformationStore, ReseauStore, TrameStore);
    if (!silencieux) location.hash = "#/informations";
  },

  /* ---------------- réactions ---------------- */

  _surChangement() {
    if (this._ecran === "fiche") {
      Fiche.rafraichirDerives();
      const p = ReseauStore.personnage(Fiche.personnageId());
      if (p) document.getElementById("fil").textContent = p.nom;
    } else if (this._ecran === "atelier") {
      Atelier.rafraichir();
    } else if (this._ecran === "matrice") {
      Matrice.rendre();
    } else {
      Reseau.rendre();
    }
    this._compteurs();
  },

  /* ---------------- barre ---------------- */

  _brancherBarre() {
    document.getElementById("act-retour").addEventListener("click", () => this.ouvrirReseau());
    document.getElementById("act-trames").addEventListener("click", () => this.ouvrirAtelier());
    document.getElementById("act-infos").addEventListener("click", () => this.ouvrirMatrice());

    document.getElementById("act-nouveau").addEventListener("click", () => {
      if (this._ecran !== "reseau" && this._ecran !== "fiche") return;
      const p = ReseauStore.creerPersonnage({ nom: "Sans nom" });
      this.ouvrirFiche(p.id);
    });

    document.getElementById("act-seed").addEventListener("click", () => {
      if (
        ReseauStore.personnages().length &&
        !confirm("Remplacer le réseau et les trames par le jeu d'essai « Valmorel » ?")
      )
        return;
      this._quitter();
      ReseauStore.vider();
      TrameStore.vider();
      InformationStore.vider();
      const n = chargerValmorel(ReseauStore, TrameStore, InformationStore);
      this.ouvrirReseau();
      this._statut(
        `Valmorel chargé — ${n.personnages} personnages, ${n.liens} liens, ` +
          `${n.situations} situations, ${n.conclusions} conclusions ` +
          `(dont ${n.orphelines} question${n.orphelines > 1 ? "s" : ""} ouverte${n.orphelines > 1 ? "s" : ""}), ` +
          `${n.informations} informations.`,
      );
    });

    document.getElementById("act-vider").addEventListener("click", () => {
      if (!ReseauStore.personnages().length && !TrameStore.situations().length) return;
      if (!confirm("Tout vider ? Cette action n'est pas annulable.")) return;
      this._quitter();
      ReseauStore.vider();
      TrameStore.vider();
      InformationStore.vider();
      this.ouvrirReseau();
      this._statut("Tout est vidé.");
    });
  },

  _statut(txt) {
    const el = document.getElementById("statut");
    el.textContent = txt;
    el.hidden = !txt;
  },

  _compteurs() {
    const el = document.getElementById("compteurs");
    if (this._ecran === "matrice") {
      const i = InformationStore.informations().length;
      const d = InformationStore.informations().filter((x) => InformationStore.divergents(x.id).length).length;
      el.textContent =
        `${i} ${Utils.plur(i, "information")} · ${d} ${Utils.plur(d, "divergence")}`;
      return;
    }
    if (this._ecran === "atelier") {
      const t = TrameStore.trames().length;
      const s = TrameStore.situations().length;
      const o = TrameStore.orphelines().length;
      el.textContent =
        `${t} ${Utils.plur(t, "trame")} · ${s} ${Utils.plur(s, "situation")} · ` +
        `${o} ${Utils.plur(o, "question")} ${Utils.plur(o, "ouverte")}`;
      return;
    }
    const p = ReseauStore.personnages().length;
    const l = ReseauStore.liens().length;
    const m = ReseauStore.liens().filter((x) => x.miroir).length;
    el.textContent =
      `${p} ${Utils.plur(p, "personnage")} · ${l} ${Utils.plur(l, "lien")} ${Utils.plur(l, "orienté")} · ${m} ${Utils.plur(m, "miroir")}`;
  },
};

// Accès console pour explorer la vérité à la main.
window.App = App;
window.ReseauStore = ReseauStore;
window.TrameStore = TrameStore;
window.InformationStore = InformationStore;

App.init();
