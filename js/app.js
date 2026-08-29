"use strict";

/* ============================================================
   APP — bootstrap, écrans, routage.

   Sept écrans : « Le réseau » (les personnages), « La fiche »
   (l'écriture), « Les trames » (l'atelier), « Qui sait quoi » (la
   matrice), « La conscience » (les douze règles), « Le temps » (la
   frise) et « Le casting » (les vœux et l'affectation).

   ── LA CONSCIENCE VIT DANS LA BARRE ──
   La vision la voulait en panneau latéral permanent. Un panneau sur
   chaque écran aurait imposé de restructurer les quatre autres ; le
   compromis est un **compteur vivant dans la barre**, recalculé à
   chaque écriture, et un écran pour le détail. L'intention tient : la
   conscience n'est pas un bouton « vérifier » qu'on pense à cliquer,
   c'est un chiffre qu'on voit bouger pendant qu'on écrit. Le
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
import { Derogations } from "./core/derogations.js";
import { CastingStore } from "./core/castingstore.js";
import { conscience } from "./core/conscience.js";
import { frise as calculerFrise } from "./core/temps.js";
import { chargerValmorel } from "./data/valmorel.js";
import { Reseau } from "./widgets/reseau.js";
import { Fiche } from "./widgets/fiche.js";
import { Atelier } from "./widgets/atelier.js";
import { Matrice } from "./widgets/matrice.js";
import { Conscience } from "./widgets/conscience.js";
import { Frise } from "./widgets/frise.js";
import { Casting } from "./widgets/casting.js";
import { Utils } from "./core/utils.js";

const friseEtat = () => calculerFrise(ReseauStore, TrameStore);

export const App = {
  _ecran: "reseau",

  init() {
    Storage.runMigrations();
    ReseauStore.load();
    TrameStore.load();
    InformationStore.load();
    Derogations.load();
    CastingStore.load();

    this._hotes = {
      reseau: document.getElementById("ecran-reseau"),
      fiche: document.getElementById("ecran-fiche"),
      atelier: document.getElementById("ecran-atelier"),
      matrice: document.getElementById("ecran-matrice"),
      conscience: document.getElementById("ecran-conscience"),
      frise: document.getElementById("ecran-frise"),
      casting: document.getElementById("ecran-casting"),
    };

    Reseau.monter(this._hotes.reseau, ReseauStore, {
      onOuvrir: (id) => this.ouvrirFiche(id),
    });

    ReseauStore.subscribe(() => this._surChangement());
    TrameStore.subscribe(() => this._surChangement());
    InformationStore.subscribe(() => this._surChangement());
    Derogations.subscribe(() => this._surChangement());
    CastingStore.subscribe(() => this._surChangement());

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
    if (/^#\/conscience/.test(h)) return this.ouvrirConscience({ silencieux: true });
    if (/^#\/temps/.test(h)) return this.ouvrirFrise({ silencieux: true });
    if (/^#\/casting/.test(h)) return this.ouvrirCasting({ silencieux: true });
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

  ouvrirAtelier({ silencieux = false, situationId = null } = {}) {
    // Même garde que pour la fiche : le hashchange rappellerait ici, et
    // remonter le graphe remettrait la vue de l'auteur à zéro.
    if (this._ecran === "atelier") {
      if (situationId) Atelier.viser(situationId);
      if (!silencieux && location.hash !== "#/trames") location.hash = "#/trames";
      return;
    }
    this._quitter();
    this._basculer("atelier", "Les trames");
    Atelier.monter(this._hotes.atelier, TrameStore, ReseauStore, InformationStore);
    if (situationId) Atelier.viser(situationId);
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

  ouvrirConscience({ silencieux = false } = {}) {
    if (this._ecran === "conscience") {
      if (!silencieux && location.hash !== "#/conscience") location.hash = "#/conscience";
      return;
    }
    this._quitter();
    this._basculer("conscience", "La conscience");
    Conscience.monter(
      this._hotes.conscience,
      ReseauStore,
      TrameStore,
      InformationStore,
      Derogations,
    );
    if (!silencieux) location.hash = "#/conscience";
  },

  ouvrirFrise({ silencieux = false } = {}) {
    if (this._ecran === "casting") {
      const k = CastingStore.candidatures().length;
      const a = Object.keys(CastingStore.affectation()).length;
      el.textContent = `${k} ${Utils.plur(k, "candidature")} · ${a} ${Utils.plur(a, "rôle")} ${Utils.plur(a, "attribué")}`;
      return;
    }
    if (this._ecran === "frise") {
      if (!silencieux && location.hash !== "#/temps") location.hash = "#/temps";
      return;
    }
    this._quitter();
    this._basculer("frise", "Le temps");
    Frise.monter(this._hotes.frise, ReseauStore, TrameStore, {
      onOuvrir: (situationId) => this.ouvrirAtelier({ situationId }),
    });
    if (!silencieux) location.hash = "#/temps";
  },

  ouvrirCasting({ silencieux = false } = {}) {
    if (this._ecran === "casting") {
      if (!silencieux && location.hash !== "#/casting") location.hash = "#/casting";
      return;
    }
    this._quitter();
    this._basculer("casting", "Le casting");
    Casting.monter(this._hotes.casting, CastingStore, ReseauStore, TrameStore);
    if (!silencieux) location.hash = "#/casting";
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
    } else if (this._ecran === "conscience") {
      Conscience.rendre();
    } else if (this._ecran === "frise") {
      Frise.rendre();
    } else if (this._ecran === "casting") {
      Casting.rendre();
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
    document
      .getElementById("act-conscience")
      .addEventListener("click", () => this.ouvrirConscience());
    document.getElementById("act-temps").addEventListener("click", () => this.ouvrirFrise());
    document.getElementById("act-casting").addEventListener("click", () => this.ouvrirCasting());

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
      Derogations.vider();
      CastingStore.vider();
      const n = chargerValmorel(ReseauStore, TrameStore, InformationStore, CastingStore);
      this.ouvrirReseau();
      this._statut(
        `Valmorel chargé — ${n.personnages} personnages, ${n.liens} liens, ` +
          `${n.situations} situations, ${n.conclusions} conclusions ` +
          `(dont ${n.orphelines} question${n.orphelines > 1 ? "s" : ""} ouverte${n.orphelines > 1 ? "s" : ""}), ` +
          `${n.informations} informations, ${n.candidatures} candidatures.`,
      );
    });

    document.getElementById("act-vider").addEventListener("click", () => {
      if (!ReseauStore.personnages().length && !TrameStore.situations().length) return;
      if (!confirm("Tout vider ? Cette action n'est pas annulable.")) return;
      this._quitter();
      ReseauStore.vider();
      TrameStore.vider();
      InformationStore.vider();
      Derogations.vider();
      CastingStore.vider();
      this.ouvrirReseau();
      this._statut("Tout est vidé.");
    });
  },

  _statut(txt) {
    const el = document.getElementById("statut");
    el.textContent = txt;
    el.hidden = !txt;
  },

  /** Le compteur de la barre — recalculé à chaque écriture, sur tous
      les écrans. C'est lui qui fait de la conscience un linter plutôt
      qu'un bouton « vérifier ». */
  _badgeConscience() {
    const b = document.getElementById("act-conscience");
    let ouvertes = 0;
    for (const r of conscience(ReseauStore, TrameStore, InformationStore))
      for (const a of r.alertes) if (!Derogations.pour(r.cle, a.cible)) ouvertes++;
    b.textContent = ouvertes ? `Conscience ${ouvertes}` : "Conscience";
    b.classList.toggle("alerte", ouvertes > 0);
  },

  _compteurs() {
    this._badgeConscience();
    const el = document.getElementById("compteurs");
    if (this._ecran === "casting") {
      const k = CastingStore.candidatures().length;
      const a = Object.keys(CastingStore.affectation()).length;
      el.textContent = `${k} ${Utils.plur(k, "candidature")} · ${a} ${Utils.plur(a, "rôle")} ${Utils.plur(a, "attribué")}`;
      return;
    }
    if (this._ecran === "frise") {
      const f = friseEtat();
      el.textContent =
        `${f.erreurs.length} ${Utils.plur(f.erreurs.length, "collision")} · ` +
        `${f.besoins.reduce((n, b) => n + b.comediens, 0)} rôles de PNJ`;
      return;
    }
    if (this._ecran === "conscience") {
      const d = Derogations.compte();
      el.textContent = d ? `${d} ${Utils.plur(d, "dérogation")}` : "aucune dérogation";
      return;
    }
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
window.Derogations = Derogations;
window.CastingStore = CastingStore;

App.init();
