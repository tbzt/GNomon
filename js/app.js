"use strict";

/* ============================================================
   APP — bootstrap, écrans, routage.

   Huit écrans. Sept forment **l'atelier** — le réseau, la fiche, les
   trames, qui sait quoi, la conscience, le temps, le casting — et le
   huitième est **la conduite**, le tableau de la nuit.

   L'atelier et la conduite ne se ressemblent pas, et c'est délibéré :
   l'un est un bureau à J-30, l'autre une salle de veille à 3 h du
   matin. La conduite définit ses propres tokens et ne suit pas le thème
   du reste (cf. la feuille de style, § « LA CONDUITE »).

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
import { RunStore } from "./core/runstore.js";
import { MondeStore } from "./core/mondestore.js";
import { Archive, telecharger } from "./core/archive.js";
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
import { Conduite } from "./widgets/conduite.js";
import { Monde } from "./widgets/monde.js";
import { Livrets } from "./widgets/livrets.js";
import { Utils } from "./core/utils.js";

/** ── LES QUATRE MOMENTS ──
    Huit écrans en rangée ne disent rien de l'ordre dans lequel on
    fabrique un GN. Regroupés, ils le disent : on écrit, on vérifie, on
    distribue, on joue. La barre devient une **progression**, pas une
    liste — et le regroupement est de l'information, pas de la
    décoration.

    « La fiche » n'y figure pas : on n'y va pas depuis la barre, on y
    arrive depuis un personnage. Elle s'affiche en fil d'Ariane. */
const MODES = [
  {
    cle: "ecrire",
    nom: "Écrire",
    ecrans: [
      { cle: "monde", nom: "Le monde" },
      { cle: "reseau", nom: "Le réseau" },
      { cle: "atelier", nom: "Les trames" },
      { cle: "matrice", nom: "Qui sait quoi" },
    ],
  },
  {
    cle: "verifier",
    nom: "Vérifier",
    ecrans: [
      { cle: "conscience", nom: "La conscience" },
      { cle: "frise", nom: "Le temps" },
    ],
  },
  {
    cle: "distribuer",
    nom: "Distribuer",
    ecrans: [
      { cle: "casting", nom: "Le casting" },
      { cle: "livrets", nom: "Les livrets" },
    ],
  },
  { cle: "jouer", nom: "Jouer", ecrans: [{ cle: "conduite", nom: "La conduite" }] },
];

/** La fiche appartient au moment « écrire » sans en être une destination. */
const MODE_DE = { fiche: "ecrire" };
for (const m of MODES) for (const e of m.ecrans) MODE_DE[e.cle] = m.cle;

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
    RunStore.load();
    MondeStore.load();

    this._hotes = {
      reseau: document.getElementById("ecran-reseau"),
      fiche: document.getElementById("ecran-fiche"),
      atelier: document.getElementById("ecran-atelier"),
      matrice: document.getElementById("ecran-matrice"),
      conscience: document.getElementById("ecran-conscience"),
      frise: document.getElementById("ecran-frise"),
      casting: document.getElementById("ecran-casting"),
      conduite: document.getElementById("ecran-conduite"),
      monde: document.getElementById("ecran-monde"),
      livrets: document.getElementById("ecran-livrets"),
    };

    Reseau.monter(this._hotes.reseau, ReseauStore, {
      onOuvrir: (id) => this.ouvrirFiche(id),
      onCreer: () => this.ouvrirFiche(ReseauStore.creerPersonnage({ nom: "Sans nom" }).id),
    });

    ReseauStore.subscribe(() => this._surChangement());
    TrameStore.subscribe(() => this._surChangement());
    InformationStore.subscribe(() => this._surChangement());
    Derogations.subscribe(() => this._surChangement());
    CastingStore.subscribe(() => this._surChangement());
    RunStore.subscribe(() => this._surChangement());
    MondeStore.subscribe(() => this._surChangement());

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
    if (/^#\/conduite/.test(h)) return this.ouvrirConduite({ silencieux: true });
    if (/^#\/monde/.test(h)) return this.ouvrirMonde({ silencieux: true });
    if (/^#\/livrets/.test(h)) return this.ouvrirLivrets({ silencieux: true });
    this.ouvrirReseau({ silencieux: true });
  },

  /** Sortie propre de l'écran courant : écrire ce qui est en attente et
      démonter ce qui tient des ressources. */
  _quitter() {
    if (this._ecran === "fiche") Fiche.flush();
    if (this._ecran === "atelier") Atelier.demonter();
    // Le tableau bat toutes les 15 s : le laisser tourner en fond
    // ferait vivre une minuterie sur un écran que personne ne regarde.
    if (this._ecran === "conduite") Conduite.demonter();
    if (this._ecran === "monde") Monde.flush();
  },

  _basculer(ecran, titre) {
    this._ecran = ecran;
    this._titre = titre;
    for (const [nom, el] of Object.entries(this._hotes)) el.hidden = nom !== ecran;
    // Les écrans-instruments prennent la largeur ; seule la fiche garde
    // une colonne de lecture — c'est le seul écran qu'on lit vraiment.
    document.querySelector("main").dataset.ecran = ecran;
    this._rendreNav();
    this._compteurs();
  },

  /* ---------------- navigation à deux niveaux ---------------- */

  _rendreNav() {
    // GitHub Pages sert tout en `max-age=600` : dans les dix minutes qui
    // suivent un déploiement, un visiteur qui revient peut récupérer un
    // `index.html` et des modules désaccordés. Une navigation absente ne
    // doit alors PAS emporter l'application — mieux vaut un écran sans
    // barre qu'un écran blanc. La dégradation est gracieuse, et le même
    // garde protège de toute dérive future du balisage.
    const hoteModes = document.getElementById("modes");
    const sous = document.getElementById("sous-barre");
    if (!hoteModes || !sous) return;

    const modeActif = MODE_DE[this._ecran] || "ecrire";
    const alertes = this._alertesOuvertes();

    hoteModes.innerHTML = MODES.map((m) => {
      // Le compte d'alertes est porté par le moment « vérifier »
      // lui-même : le signal vit là où on va le traiter.
      const badge =
        m.cle === "verifier" && alertes
          ? `<span class="mode-badge">${alertes}</span>`
          : "";
      return (
        `<button type="button" class="mode${m.cle === modeActif ? " actif" : ""}" ` +
        `data-mode="${m.cle}" aria-current="${m.cle === modeActif}">` +
        `${Utils.escHtml(m.nom)}${badge}</button>`
      );
    }).join("");

    const mode = MODES.find((m) => m.cle === modeActif);
    const onglets = mode.ecrans
      .map(
        (e) =>
          `<button type="button" class="onglet${e.cle === this._ecran ? " actif" : ""}" ` +
          `data-ecran="${e.cle}">${Utils.escHtml(e.nom)}</button>`,
      )
      .join("");
    const fil =
      this._ecran === "fiche"
        ? `<span class="fil-ariane"><button type="button" data-ecran="reseau">Le réseau</button>` +
          `<span class="fil-sep">›</span>${Utils.escHtml(this._titre || "")}</span>`
        : "";
    sous.innerHTML = onglets + fil;
    sous.hidden = mode.ecrans.length < 2 && !fil;

    for (const b of document.querySelectorAll("[data-mode]"))
      b.addEventListener("click", () => {
        const m = MODES.find((x) => x.cle === b.dataset.mode);
        if (m) this._aller(m.ecrans[0].cle);
      });
    for (const b of document.querySelectorAll("[data-ecran]"))
      b.addEventListener("click", () => this._aller(b.dataset.ecran));
  },

  _aller(ecran) {
    const routes = {
      reseau: () => this.ouvrirReseau(),
      atelier: () => this.ouvrirAtelier(),
      matrice: () => this.ouvrirMatrice(),
      conscience: () => this.ouvrirConscience(),
      frise: () => this.ouvrirFrise(),
      casting: () => this.ouvrirCasting(),
      conduite: () => this.ouvrirConduite(),
      monde: () => this.ouvrirMonde(),
      livrets: () => this.ouvrirLivrets(),
    };
    if (routes[ecran]) routes[ecran]();
  },

  _alertesOuvertes() {
    let n = 0;
    for (const r of conscience(ReseauStore, TrameStore, InformationStore))
      for (const a of r.alertes) if (!Derogations.pour(r.cle, a.cible)) n++;
    return n;
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
      this._titre = p.nom;
      this._rendreNav();
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

  ouvrirConduite({ silencieux = false } = {}) {
    if (this._ecran === "conduite") {
      if (!silencieux && location.hash !== "#/conduite") location.hash = "#/conduite";
      return;
    }
    this._quitter();
    this._basculer("conduite", "La conduite");
    Conduite.monter(this._hotes.conduite, RunStore, TrameStore, ReseauStore);
    if (!silencieux) location.hash = "#/conduite";
  },

  ouvrirMonde({ silencieux = false } = {}) {
    if (this._ecran === "monde") {
      if (!silencieux && location.hash !== "#/monde") location.hash = "#/monde";
      return;
    }
    this._quitter();
    this._basculer("monde", "Le monde");
    Monde.monter(this._hotes.monde, MondeStore);
    if (!silencieux) location.hash = "#/monde";
  },

  ouvrirLivrets({ silencieux = false } = {}) {
    if (this._ecran === "livrets") {
      if (!silencieux && location.hash !== "#/livrets") location.hash = "#/livrets";
      return;
    }
    this._quitter();
    this._basculer("livrets", "Les livrets");
    Livrets.monter(this._hotes.livrets, this._stores());
    if (!silencieux) location.hash = "#/livrets";
  },

  /** Le paquet de stores passé aux modules qui en lisent plusieurs. */
  _stores() {
    return {
      reseau: ReseauStore,
      trames: TrameStore,
      infos: InformationStore,
      monde: MondeStore,
      casting: CastingStore,
    };
  },

  /* ---------------- réactions ---------------- */

  _surChangement() {
    if (this._ecran === "fiche") {
      Fiche.rafraichirDerives();
      const p = ReseauStore.personnage(Fiche.personnageId());
      if (p) this._titre = p.nom;
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
    } else if (this._ecran === "conduite") {
      Conduite.rendre();
    } else if (this._ecran === "monde") {
      Monde.rafraichirDerives();
    } else if (this._ecran === "livrets") {
      Livrets.rendre();
    } else {
      Reseau.rendre();
    }
    this._compteurs();
  },

  /* ---------------- barre ---------------- */

  _brancherBarre() {
    document.getElementById("act-exporter").addEventListener("click", () => {
      this._quitter();
      const titre = MondeStore.monde().titre;
      telecharger(Archive.nomFichier(titre), JSON.stringify(Archive.construire(titre), null, 1));
      this._statut("Archive téléchargée — c'est ce fichier qui se partage et se sauvegarde.");
    });

    document.getElementById("act-importer").addEventListener("click", () =>
      document.getElementById("fichier-archive").click(),
    );

    document.getElementById("fichier-archive").addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!f) return;
      let paquet;
      try {
        paquet = JSON.parse(await f.text());
      } catch {
        this._statut("Ce fichier n'est pas un JSON lisible.");
        return;
      }
      const v = Archive.verifier(paquet);
      if (!v.ok) return this._statut(v.raison);
      const inv = Archive.inventaire(paquet);
      const resume =
        `${inv.titre || "Archive sans titre"} (${inv.date}) — ${inv.personnages} personnages, ` +
        `${inv.liens} liens, ${inv.trames} trames, ${inv.situations} situations, ` +
        `${inv.informations} informations, ${inv.candidatures} candidatures.`;
      // Deux sémantiques opposées : on nomme laquelle avant d'écrire.
      const remplacer = confirm(
        `${resume}\n\nOK = REMPLACER tout ce qui est ici par l'archive.\n` +
          "Annuler = FUSIONNER (ajoute ce qui manque, ne touche pas à l'existant).",
      );
      const r = Archive.appliquer(paquet, remplacer ? "remplacer" : "fusionner");
      if (!r.ok) return this._statut(r.raison);
      for (const st of [ReseauStore, TrameStore, InformationStore, CastingStore, RunStore, MondeStore, Derogations])
        st.load();
      this.ouvrirReseau();
      this._statut(
        `Archive ${remplacer ? "appliquée en remplacement" : "fusionnée"} — ` +
          Object.entries(r.bilan).map(([k, v]) => `${k} : ${v}`).join(" · "),
      );
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
      RunStore.vider();
      MondeStore.vider();
      const n = chargerValmorel(ReseauStore, TrameStore, InformationStore, CastingStore, MondeStore);
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
      RunStore.vider();
      MondeStore.vider();
      this.ouvrirReseau();
      this._statut("Tout est vidé.");
    });
  },

  _statut(txt) {
    const el = document.getElementById("statut");
    if (!el) return;
    el.textContent = txt;
    el.hidden = !txt;
  },

  _compteurs() {
    this._rendreNav();
    const el = document.getElementById("compteurs");
    if (!el) return;
    if (this._ecran === "conduite") {
      const f = Object.keys(RunStore.fils()).length;
      const j = RunStore.journal().length;
      el.textContent = RunStore.run()
        ? `${f} ${Utils.plur(f, "fil")} · ${j} ${Utils.plur(j, "entrée")}`
        : "jeu non démarré";
      return;
    }
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
window.RunStore = RunStore;
window.MondeStore = MondeStore;

App.init();
