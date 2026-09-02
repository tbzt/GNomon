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
import { Projets } from "./core/projets.js";
import { ReseauStore } from "./core/reseaustore.js";
import { TrameStore } from "./core/tramestore.js";
import { InformationStore } from "./core/informationstore.js";
import { Derogations } from "./core/derogations.js";
import { CastingStore } from "./core/castingstore.js";
import { RunStore } from "./core/runstore.js";
import { MondeStore } from "./core/mondestore.js";
import { Archive, telecharger, AVERTISSEMENT } from "./core/archive.js";
import { poids, conseil, formaterOctets, BORNE } from "./core/poids.js";
import { SuiviStore } from "./core/suivistore.js";
import { LiensStore } from "./core/liensstore.js";
import { frise as calculerFrise } from "./core/temps.js";
import { tousLesBesoins as besoinsPlats } from "./core/besoins.js";
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
import { Besoins } from "./widgets/besoins.js";
import { Accueil } from "./widgets/accueil.js";
import { Cockpit, compterOuverts } from "./widgets/cockpit.js";
import { Espace } from "./widgets/espace.js";
import { rattachement } from "./core/espace.js";
import { Theme, LIBELLES } from "./core/theme.js";
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
      { cle: "besoins", nom: "Les besoins" },
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

/** L'espace partagé n'est d'aucun moment de fabrication — on n'y va pas
    « après avoir distribué », on y va quand on veut écrire à plusieurs.
    Il vit donc à côté, comme le cockpit, et se rejoint par la barre. */

/** La fiche appartient au moment « écrire » sans en être une destination. */
const MODE_DE = { fiche: "ecrire" };
for (const m of MODES) for (const e of m.ecrans) MODE_DE[e.cle] = m.cle;

const friseEtat = () => calculerFrise(ReseauStore, TrameStore);

export const App = {
  // Aucun écran n'est monté avant `demarrer()`. Y mettre « reseau » par
  // défaut mentait sur l'état réel, et la garde anti-remontage
  // d'`ouvrirReseau` aurait cru l'écran déjà en place au démarrage.
  _ecran: null,

  init() {
    // AVANT tout le reste : une écriture qui échoue pendant une
    // migration doit se voir comme les autres. C'est le seul message
    // dont dépend la survie du travail en cours — il vivait jusqu'ici
    // dans la console, où personne ne va le chercher.
    Storage.onEchec((msg) => this._alerte(msg));

    Storage.runMigrations();
    // AVANT tout `load()` : c'est lui qui décide quelles clés les stores
    // vont lire. Les migrations d'abord, parce que la v3 fabrique le
    // premier projet à partir des clés nues d'avant.
    Projets.init();
    ReseauStore.load();
    TrameStore.load();
    InformationStore.load();
    Derogations.load();
    CastingStore.load();
    RunStore.load();
    MondeStore.load();
    SuiviStore.load();
    LiensStore.load();

    this._hotes = {
      cockpit: document.getElementById("ecran-cockpit"),
      espace: document.getElementById("ecran-espace"),
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
      besoins: document.getElementById("ecran-besoins"),
    };

    Reseau.monter(this._hotes.reseau, ReseauStore, {
      onOuvrir: (id) => this.ouvrirFiche(id),
      onCreer: () => this.ouvrirFiche(ReseauStore.creerPersonnage({ nom: "Sans nom" }).id),
      stores: this._stores(),
      actions: {
        monde_store: MondeStore,
        monde: () => this.ouvrirMonde(),
        essai: () => document.getElementById("act-seed").click(),
        import: () => document.getElementById("act-importer").click(),
      },
    });

    ReseauStore.subscribe(() => this._surChangement());
    TrameStore.subscribe(() => this._surChangement());
    InformationStore.subscribe(() => this._surChangement());
    Derogations.subscribe(() => this._surChangement());
    CastingStore.subscribe(() => this._surChangement());
    RunStore.subscribe(() => this._surChangement());
    MondeStore.subscribe(() => this._surChangement());
    SuiviStore.subscribe(() => this._surChangement());
    LiensStore.subscribe(() => this._surChangement());

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
    if (/^#\/besoins/.test(h)) return this.ouvrirBesoins({ silencieux: true });
    if (/^#\/reseau/.test(h)) return this.ouvrirReseau({ silencieux: true });
    if (/^#\/diagnostic/.test(h)) return this.ouvrirCockpit({ silencieux: true });
    if (/^#\/espace/.test(h)) return this.ouvrirEspace({ silencieux: true });
    // Sans hash : un projet vierge garde l'accueil (porté par l'écran
    // réseau, cf. `Reseau.rendre`) ; un projet qui a déjà du contenu
    // ouvre sur le diagnostic — la porte d'entrée du cockpit remplace
    // l'accueil dès qu'il y a quelque chose à diagnostiquer.
    if (Accueil.estVierge(ReseauStore, MondeStore)) return this.ouvrirReseau({ silencieux: true });
    this.ouvrirCockpit({ silencieux: true });
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
    // Le moteur de graphe est un singleton : deux écrans ne peuvent pas
    // le tenir en même temps. On le rend en sortant.
    if (this._ecran === "reseau") Reseau.demonter();
    if (this._ecran === "espace") Espace.demonter();
    // ── IDEMPOTENCE ──
    // `_quitter()` peut être appelé deux fois pour une seule sortie :
    // l'import le fait avant d'écrire, puis `ouvrirReseau()` le refait.
    // Sans cette marque, le second `Monde.flush()` réécrivait le DOM
    // PÉRIMÉ par-dessus les données fraîchement importées. On note donc
    // qu'on a déjà quitté ; `_basculer` repose l'écran juste après.
    this._ecran = null;
  },

  _basculer(ecran, titre) {
    this._ecran = ecran;
    this._titre = titre;
    for (const [nom, el] of Object.entries(this._hotes)) el.hidden = nom !== ecran;
    // Les écrans-instruments prennent la largeur ; seule la fiche garde
    // une colonne de lecture — c'est le seul écran qu'on lit vraiment.
    // `data-actif` et non `data-ecran` : ce marqueur dit dans quel écran
    // on EST, alors que `data-ecran` désigne un bouton qui MÈNE quelque
    // part. Les deux ont porté le même nom, et `<main>` — ancêtre de
    // toute l'application — se faisait ramasser par le balayage qui
    // câble les onglets. Il recevait donc un écouteur de plus à chaque
    // rendu, jamais retiré, et chaque clic n'importe où rejouait
    // l'ouverture de l'écran courant autant de fois qu'il en avait
    // accumulé. Invisible tant que les écrans se reconstruisaient de
    // toute façon ; fatal dès qu'un widget garde un état dans le DOM.
    document.querySelector("main").dataset.actif = ecran;
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

    // Le cockpit n'est d'aucun des quatre moments — le marquer « actif »
    // sur l'un d'eux mentirait sur ce qu'on regarde. `modeActif` reste
    // `null`, et la sous-barre se vide : pas d'onglets à montrer pour
    // un écran qui n'appartient à aucun moment.
    const modeActif = this._ecran === "cockpit" ? null : MODE_DE[this._ecran] || "ecrire";

    // ── UN SEUL COMPTEUR DANS LA BARRE ──
    // « Vérifier » portait le compte des alertes de conscience, et c'était
    // juste tant qu'il était seul. Depuis le diagnostic, deux nombres se
    // côtoyaient — 16 et 19 — sans que rien ne dise que le premier est un
    // SOUS-ENSEMBLE du second : le diagnostic traduit les douze règles ET
    // ajoute ses propres signaux. Deux chiffres qui se contredisent
    // apprennent à n'en croire aucun. On garde celui qui couvre tout ;
    // l'écran de la conscience affiche toujours le sien, dans son
    // en-tête, là où il a un sens précis.
    hoteModes.innerHTML = MODES.map(
      (m) =>
        `<button type="button" class="mode${m.cle === modeActif ? " actif" : ""}" ` +
        `data-mode="${m.cle}" aria-current="${m.cle === modeActif}">` +
        `${Utils.escHtml(m.nom)}</button>`,
    ).join("");

    const mode = MODES.find((m) => m.cle === modeActif);
    const onglets = mode
      ? mode.ecrans
          .map(
            (e) =>
              `<button type="button" class="onglet${e.cle === this._ecran ? " actif" : ""}" ` +
              `data-ecran="${e.cle}">${Utils.escHtml(e.nom)}</button>`,
          )
          .join("")
      : "";
    const fil =
      this._ecran === "fiche"
        ? `<span class="fil-ariane"><button type="button" data-ecran="reseau">Le réseau</button>` +
          `<span class="fil-sep">›</span>${Utils.escHtml(this._titre || "")}</span>`
        : "";
    sous.innerHTML = onglets + fil;
    sous.hidden = !mode || (mode.ecrans.length < 2 && !fil);

    // Le balayage reste borné aux deux conteneurs qu'on vient de
    // réécrire : leurs boutons sont neufs, donc sans écouteur. Un
    // `document.querySelectorAll` attraperait ce qui vit ailleurs et
    // survit d'un rendu à l'autre — c'est-à-dire une fuite.
    for (const b of hoteModes.querySelectorAll("[data-mode]"))
      b.addEventListener("click", () => {
        const m = MODES.find((x) => x.cle === b.dataset.mode);
        if (m) this._aller(m.ecrans[0].cle);
      });
    for (const b of sous.querySelectorAll("[data-ecran]"))
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
      besoins: () => this.ouvrirBesoins(),
    };
    if (routes[ecran]) routes[ecran]();
  },

  /** Le réseau était le seul écran SANS adresse : il vidait le hash au
      lieu d'en poser un. Le `hashchange` qui suivait rappelait
      `_lireHash`, qui ne trouvait plus rien à router et retombait sur la
      règle du bas — « projet non vierge → le diagnostic ». Cliquer « Le
      réseau » depuis n'importe quel écran adressé renvoyait donc au
      cockpit, et l'écran demandé n'apparaissait jamais.

      Un hash vide est ambigu : il veut dire « accueil » pour un projet
      vierge et « diagnostic » pour les autres. Il ne pouvait pas vouloir
      dire « réseau » en plus. L'écran prend donc son adresse comme les
      onze autres — ce qui rend aussi le retour arrière du navigateur
      juste, là où il ramenait au diagnostic. */
  ouvrirReseau({ silencieux = false } = {}) {
    // Même garde que la fiche et l'atelier : le `hashchange` rappelle
    // ici, et remonter le graphe remettrait la vue de l'auteur à zéro.
    if (this._ecran === "reseau") {
      if (!silencieux && location.hash !== "#/reseau") location.hash = "#/reseau";
      return;
    }
    this._quitter();
    this._basculer("reseau", "Le réseau");
    Reseau.rendre();
    if (!silencieux) location.hash = "#/reseau";
  },

  /** Le cockpit — la porte d'entrée d'un projet non vierge, hors des
      quatre moments (cf. PRODUCT_TRANSFORMATION.md §10). Ce n'est pas
      un cinquième bouton dans la même rangée que Écrire/Vérifier/
      Distribuer/Jouer : `_rendreNav` ne marque aucun moment actif
      pendant qu'on y est. */
  ouvrirCockpit({ silencieux = false } = {}) {
    if (this._ecran === "cockpit") {
      if (!silencieux && location.hash !== "#/diagnostic") location.hash = "#/diagnostic";
      return;
    }
    this._quitter();
    this._basculer("cockpit", "Le diagnostic");
    Cockpit.monter(this._hotes.cockpit, this._stores(), Derogations, {
      onNaviguer: (ecran, cible) => this._naviguerDepuisCockpit(ecran, cible),
    });
    if (!silencieux) location.hash = "#/diagnostic";
  },

  /** L'espace partagé. Hors des quatre moments, comme le cockpit — on
      n'y va pas « après avoir distribué », on y va quand on veut
      écrire à plusieurs. */
  ouvrirEspace({ silencieux = false } = {}) {
    if (this._ecran === "espace") {
      if (!silencieux && location.hash !== "#/espace") location.hash = "#/espace";
      return;
    }
    this._quitter();
    this._basculer("espace", "L'espace partagé");
    Espace.monter(this._hotes.espace, Projets, {
      // Une synchronisation réécrit les blocs sous les stores : sans
      // rechargement, l'écran suivant montrerait le GN d'avant le tour.
      onChange: () => {
        this._rechargerTout();
        this._compteurs();
      },
    });
    if (!silencieux) location.hash = "#/espace";
  },

  /** Une cible de diagnostic route vers l'écran qui l'a produite — le
      cockpit ne connaît pas `App`, il délègue entièrement ici. */
  _naviguerDepuisCockpit(ecran, cible) {
    const routes = {
      fiche: () => this.ouvrirFiche(cible.id),
      atelier: () => this.ouvrirAtelier({ situationId: cible.params && cible.params.situationId }),
      matrice: () => this.ouvrirMatrice(),
      reseau: () => this.ouvrirReseau(),
      conscience: () => this.ouvrirConscience(),
      frise: () => this.ouvrirFrise(),
    };
    if (routes[ecran]) routes[ecran]();
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
      // Pour « ce qu'il vit » : les scènes qu'il porte, ce qu'il peut y
      // apprendre, et ce que son absence coûterait.
      trames: TrameStore,
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
    Casting.monter(this._hotes.casting, CastingStore, ReseauStore, TrameStore, MondeStore);
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
    Monde.monter(this._hotes.monde, MondeStore, LiensStore);
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

  ouvrirBesoins({ silencieux = false } = {}) {
    if (this._ecran === "besoins") {
      if (!silencieux && location.hash !== "#/besoins") location.hash = "#/besoins";
      return;
    }
    this._quitter();
    this._basculer("besoins", "Les besoins");
    Besoins.monter(this._hotes.besoins, this._stores(), SuiviStore, LiensStore);
    if (!silencieux) location.hash = "#/besoins";
  },

  /** Tous les stores, dans l'ordre où ils sont chargés au démarrage.
      Une seule liste : trois endroits les rechargeaient ou les vidaient
      chacun avec sa propre énumération, et en ajouter un quatrième
      revenait à espérer que personne n'en oublie un. */
  _tousLesStores() {
    return [
      ReseauStore,
      TrameStore,
      InformationStore,
      Derogations,
      CastingStore,
      RunStore,
      MondeStore,
      SuiviStore,
      LiensStore,
    ];
  },

  /** Relit tout depuis le stockage. Après une bascule de projet, la
      fenêtre de lecture a bougé sous les pieds des stores : leur copie
      en mémoire appartient au GN précédent. */
  _rechargerTout() {
    for (const st of this._tousLesStores()) st.load();
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
      Matrice.rafraichir();
    } else if (this._ecran === "conscience") {
      Conscience.rendre();
    } else if (this._ecran === "frise") {
      Frise.rendre();
    } else if (this._ecran === "casting") {
      Casting.rafraichir();
    } else if (this._ecran === "conduite") {
      Conduite.rendre();
    } else if (this._ecran === "monde") {
      Monde.rafraichirDerives();
    } else if (this._ecran === "livrets") {
      Livrets.rendre();
    } else if (this._ecran === "besoins") {
      Besoins.rendre();
    } else if (this._ecran === "cockpit") {
      Cockpit.rendre();
    } else if (this._ecran === "espace") {
      // L'espace ne se re-rend PAS sur événement de store : il porte
      // des champs de saisie (adresse, mot de passe, nom d'espace) et
      // un tour en cours. Le reconstruire arracherait la frappe, et
      // c'est justement lui qui provoque les écritures qu'on observe.
    } else {
      Reseau.rendre();
    }
    this._compteurs();
  },

  /* ---------------- barre ---------------- */

  /* ---------------- les projets ----------------
     Un projet est un préfixe de clés (cf. `core/projets.js`). Le
     sélecteur est posé à côté du titre parce qu'il NOMME ce qu'on
     regarde : mis dans la rangée d'actions, à droite, il aurait eu l'air
     d'un bouton de plus, alors qu'il dit dans quel GN on est. */

  /** On nomme d'après un IDENTIFIANT, pas d'après une entrée de liste :
      l'entrée peut manquer là où le GN existe. Le nom donné à la main
      l'emporte ; sinon on prend le titre du monde, qui est déjà écrit et
      qu'il serait absurde de redemander. */
  _nomProjet(id) {
    if (!id) return "Sans titre";
    const p = Projets.projet(id);
    if (p && p.nom) return p.nom;
    return Projets.resume(id).titre || "Sans titre";
  },

  _rendreProjet() {
    const b = document.getElementById("act-projet");
    if (!b) return;
    b.textContent = this._nomProjet(Projets.actif());
    b.title = "Le GN ouvert. Cliquez pour en changer, en créer un autre, ou le renommer.";
  },

  _rendrePanneauProjets() {
    const hote = document.getElementById("projet-panneau");
    if (!hote) return;
    const actif = Projets.actif();
    hote.innerHTML =
      '<p class="pj-titre">Vos GN</p>' +
      '<ul class="pj-liste">' +
      Projets.liste()
        .map((p) => {
          const r = Projets.resume(p.id);
          const detail = [
            r.personnages ? `${r.personnages} ${Utils.plur(r.personnages, "personnage")}` : "",
            r.situations ? `${r.situations} ${Utils.plur(r.situations, "situation")}` : "",
            formaterOctets(Projets.octets(p.id)),
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            `<li class="pj-item${p.id === actif ? " actif" : ""}">` +
            `<button type="button" class="pj-ouvrir" data-pj="${Utils.escHtml(p.id)}">` +
            `<span class="pj-nom">${Utils.escHtml(this._nomProjet(p.id))}</span>` +
            `<span class="pj-detail">${Utils.escHtml(detail || "vide")}</span></button>` +
            `<button type="button" class="pj-act" data-pj-nom="${Utils.escHtml(p.id)}" title="Renommer">Renommer</button>` +
            `<button type="button" class="pj-act pj-suppr" data-pj-x="${Utils.escHtml(p.id)}" title="Supprimer définitivement">Supprimer</button>` +
            "</li>"
          );
        })
        .join("") +
      "</ul>" +
      '<button type="button" class="pj-neuf" data-pj-neuf>＋ Nouveau GN</button>' +
      '<p class="pj-note">Chaque GN a son propre stockage sur cet appareil. ' +
      "Rien ne circule entre eux — pour reprendre du matériel d'un autre, exportez son archive et fusionnez-la.</p>";

    for (const el of hote.querySelectorAll("[data-pj]"))
      el.addEventListener("click", () => this._basculerProjet(el.dataset.pj));

    for (const el of hote.querySelectorAll("[data-pj-nom]"))
      el.addEventListener("click", () => {
        const nom = prompt("Nom de ce GN ?", this._nomProjet(el.dataset.pjNom));
        if (nom === null) return;
        Projets.renommer(el.dataset.pjNom, nom);
        this._rendreProjet();
        this._rendrePanneauProjets();
      });

    for (const el of hote.querySelectorAll("[data-pj-x]"))
      el.addEventListener("click", () => this._supprimerProjet(el.dataset.pjX));

    const neuf = hote.querySelector("[data-pj-neuf]");
    if (neuf)
      neuf.addEventListener("click", () => {
        const nom = prompt("Nom du nouveau GN ?", "");
        if (nom === null) return;
        const p = Projets.creer(nom);
        this._basculerProjet(p.id);
      });
  },

  /** Bascule de GN. L'ordre compte : on écrit ce qui est en attente
      AVANT de déplacer la fenêtre de lecture, sinon la dernière frappe
      part dans le projet qu'on vient d'ouvrir. */
  _basculerProjet(id) {
    if (id === Projets.actif()) return this._fermerPanneauProjets();
    this._quitter();
    if (!Projets.ouvrir(id)) return this._fermerPanneauProjets();
    this._rechargerTout();
    this._fermerPanneauProjets();
    this.ouvrirReseau();
    this._rendreProjet();
    this._statut(`GN ouvert : ${this._nomProjet(Projets.actif())}.`);
  },

  /** La suppression n'a pas d'annulation, et il ne peut pas y en avoir :
      la place libérée est ce qu'on venait chercher. On propose donc
      l'export AVANT, jamais après. */
  _supprimerProjet(id) {
    const r = Projets.resume(id);
    const nom = this._nomProjet(id);
    if (
      !confirm(
        `Supprimer « ${nom} » ?\n\n` +
          `${r.personnages} personnages, ${r.situations} situations, ` +
          `${formaterOctets(Projets.octets(id))}.\n\n` +
          "C'est définitif : il n'y a pas d'annulation.",
      )
    )
      return;
    if (confirm("Exporter une archive de ce GN avant de le supprimer ?")) {
      // On l'ouvre pour le lire, puis on revient : `Archive.construire`
      // lit le projet ACTIF, et exporter le mauvais serait pire que ne
      // rien exporter du tout.
      const retour = Projets.actif();
      Projets.ouvrir(id);
      telecharger(Archive.nomFichier(nom), JSON.stringify(Archive.construire(nom), null, 1));
      if (retour !== id) Projets.ouvrir(retour);
    }
    const suivant = Projets.supprimer(id);
    this._rechargerTout();
    this._rendreProjet();
    this._rendrePanneauProjets();
    if (suivant !== Projets.actif() || id === Projets.actif()) this.ouvrirReseau();
    this._statut(`« ${nom} » supprimé.`);
  },

  _fermerPanneauProjets() {
    const h = document.getElementById("projet-panneau");
    const b = document.getElementById("act-projet");
    if (h) h.hidden = true;
    if (b) b.setAttribute("aria-expanded", "false");
  },

  _brancherBarre() {
    const bProjet = document.getElementById("act-projet");
    if (bProjet) {
      this._rendreProjet();
      bProjet.addEventListener("click", (e) => {
        e.stopPropagation();
        const h = document.getElementById("projet-panneau");
        const ouvrir = h.hidden;
        if (ouvrir) this._rendrePanneauProjets();
        h.hidden = !ouvrir;
        bProjet.setAttribute("aria-expanded", String(ouvrir));
      });
      // Un panneau qui ne se referme qu'à son propre bouton reste ouvert
      // par-dessus le travail dès qu'on clique ailleurs.
      document.addEventListener("click", (e) => {
        const h = document.getElementById("projet-panneau");
        if (!h || h.hidden || h.contains(e.target)) return;
        this._fermerPanneauProjets();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") this._fermerPanneauProjets();
      });
    }

    document.getElementById("poids").addEventListener("click", () => this._detailPoids());

    document.getElementById("act-diagnostic").addEventListener("click", () => this.ouvrirCockpit());
    document.getElementById("act-espace").addEventListener("click", () => this.ouvrirEspace());

    /* Le bouton NOMME l'état courant, il ne promet pas le suivant : une
       bascule qui affiche « Sombre » alors qu'on est en clair, ou
       l'inverse, se lit de travers une fois sur deux. Il dit ce qui est,
       et son infobulle dit ce qu'un clic fera. */
    const bTheme = document.getElementById("act-theme");
    if (bTheme) {
      bTheme.addEventListener("click", () => Theme.cycler());
      Theme.subscribe((etat) => {
        bTheme.textContent = LIBELLES[etat];
        bTheme.dataset.etat = etat;
        bTheme.title =
          etat === "systeme"
            ? `Thème : suit l'appareil (actuellement ${Theme.effectif()}). Cliquez pour forcer le clair.`
            : etat === "clair"
              ? "Thème : clair, quel que soit l'appareil. Cliquez pour le sombre."
              : "Thème : sombre, quel que soit l'appareil. Cliquez pour revenir au réglage de l'appareil.";
      });
      Theme.init();
    }

    document.getElementById("act-exporter").addEventListener("click", () => {
      this._quitter();
      const titre = MondeStore.monde().titre;
      telecharger(Archive.nomFichier(titre), JSON.stringify(Archive.construire(titre), null, 1));
      this._statut(`Archive téléchargée. ${AVERTISSEMENT}`);
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
      // Ce qui est en cours de saisie part au store AVANT l'import :
      // après, il serait écrasé sans qu'on sache lequel a gagné.
      this._quitter();
      const inv = Archive.inventaire(paquet);
      const resume =
        `${inv.titre || "Archive sans titre"} (${inv.date}) — ${inv.personnages} personnages, ` +
        `${inv.liens} liens, ${inv.trames} trames, ${inv.situations} situations, ` +
        `${inv.informations} informations, ${inv.candidatures} candidatures` +
        (inv.fil ? ", et le fil de l'histoire." : ".");
      // Deux sémantiques opposées : on nomme laquelle avant d'écrire.
      const remplacer = confirm(
        `${resume}\n\nOK = REMPLACER tout ce qui est ici par l'archive.\n` +
          "Annuler = FUSIONNER (ajoute ce qui manque, ne touche pas à l'existant).",
      );
      const r = Archive.appliquer(paquet, remplacer ? "remplacer" : "fusionner");
      if (!r.ok) return this._statut(r.raison);
      this._rechargerTout();
      this.ouvrirReseau();
      this._statut(
        `Archive ${remplacer ? "appliquée en remplacement" : "fusionnée"} — ` +
          Object.entries(r.bilan).map(([k, v]) => `${k} : ${v}`).join(" · "),
      );
    });

    document.getElementById("act-seed").addEventListener("click", () => {
      // Même garde que « Vider », et pour une raison plus grave : ce
      // bouton EFFACE les neuf stores avant de charger Valmorel. Tant
      // qu'il ne comptait que les personnages, un projet où l'on avait
      // écrit le monde sans encore créer personne se faisait remplacer
      // SANS confirmation. Et la question parlait « du réseau et des
      // trames » alors que tout y passe.
      if (
        !this._projetVide() &&
        !confirm("Remplacer ce projet par le jeu d'essai « Valmorel » ? Tout ce qui y est écrit sera perdu.")
      )
        return;
      this._viderTout();
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
      // Un projet déjà vide n'a rien à vider : lui poser la question
      // « cette action n'est pas annulable » serait une alarme pour rien.
      if (this._projetVide()) return this._statut("Il n'y a rien à vider.");
      if (!confirm("Tout vider ? Cette action n'est pas annulable.")) return;
      this._viderTout();
      this.ouvrirReseau();
      this._statut("Tout est vidé.");
    });
  },

  /** Les neuf stores que « Vider » et « Jeu d'essai » remettent à zéro.
      La liste vivait en double, à deux boutons de distance : en ajouter
      un dixième demandait de penser aux deux endroits, et on ne l'aurait
      su qu'en retrouvant des restes du projet précédent. */
  _viderTout() {
    this._quitter();
    ReseauStore.vider();
    TrameStore.vider();
    InformationStore.vider();
    Derogations.vider();
    CastingStore.vider();
    RunStore.vider();
    MondeStore.vider();
    SuiviStore.vider();
    LiensStore.vider();
  },

  /** Ce projet est-il ENTIÈREMENT vide ?

      ── LA GARDE DOIT COUVRIR CE QUE LE BOUTON EFFACE ──
      « Vider » ne partait que si le réseau ou les trames avaient
      quelque chose : deux stores sur les neuf qu'il remet à zéro. Un
      projet où l'on avait écrit le monde, importé un casting, posé des
      liens ou tenu un journal de run, mais pas encore créé de
      personnage, ne pouvait donc plus être vidé du tout — le bouton ne
      faisait rien, sans confirmation, sans message, sans rien dans la
      console. Un bouton muet passe pour cassé, et il l'était.

      La règle est simple et se vérifie : une garde qui protège d'une
      action doit interroger tout ce que cette action touche. D'où la
      même liste que `_viderTout`, dans le même ordre.

      Le silence disparaît aussi : sur un projet réellement vide, on dit
      qu'il n'y a rien à vider plutôt que de ne rien répondre. */
  _projetVide() {
    return (
      !ReseauStore.personnages().length &&
      !ReseauStore.groupes().length &&
      !TrameStore.trames().length &&
      !TrameStore.situations().length &&
      !TrameStore.conclusions().length &&
      !InformationStore.informations().length &&
      !Derogations.compte() &&
      !CastingStore.candidatures().length &&
      !Object.keys(CastingStore.affectation()).length &&
      !RunStore.run() &&
      !RunStore.journal().length &&
      !Object.keys(RunStore.fils()).length &&
      !MondeStore.amorce() &&
      !SuiviStore.compte() &&
      !LiensStore.tous().length
    );
  },

  _statut(txt) {
    const el = document.getElementById("statut");
    if (!el) return;
    // Une alarme d'écriture ne se laisse pas remplacer par un message
    // d'information : elle dit que rien n'est enregistré, et c'est
    // toujours la chose la plus importante à l'écran.
    if (el.classList.contains("danger")) return;
    el.textContent = txt;
    el.hidden = !txt;
  },

  /** L'ALARME — distincte de `_statut`, qui informe. Elle reste posée
      jusqu'à ce qu'une écriture aboutisse : tant qu'elle est là, rien
      de ce qui est tapé n'est enregistré. `null` la retire. */
  _alerte(txt) {
    const el = document.getElementById("statut");
    if (!el) return;
    if (!txt) {
      el.classList.remove("danger");
      el.textContent = "";
      el.hidden = true;
      return;
    }
    el.textContent = txt;
    el.classList.add("danger");
    el.hidden = false;
  },

  /** L'indicateur de poids. Discret tant qu'il n'y a rien à dire, il
      change de couleur avant que le quota ne morde — `storage.js` sait
      signaler un échec d'écriture, mais c'est trop tard : la
      modification en cours est déjà perdue. */
  _rendrePoids() {
    const el = document.getElementById("poids");
    if (!el) return;
    const p = poids();
    el.textContent = formaterOctets(p.octets);
    el.className = `poids n-${p.niveau}`;
    el.title = `${Math.round(p.part * 100)} % d'une borne prudente de ${formaterOctets(BORNE)}. Cliquez pour le détail.`;
    el.hidden = false;
  },

  /** Le lien permanent vers le cockpit, quel que soit l'écran affiché —
      c'est le point d'ancrage qui permet d'y revenir sans repasser par
      l'accueil (PRODUCT_TRANSFORMATION.md §10). Le badge compte les
      diagnostics ouverts avec la même formule que l'écran lui-même :
      une seule vérité, `compterOuverts`. */
  _rendreBoutonDiagnostic() {
    const b = document.getElementById("act-diagnostic");
    if (b) {
      const n = compterOuverts(this._stores(), Derogations);
      b.innerHTML = `Diagnostic${n ? ` <span class="mode-badge">${n}</span>` : ""}`;
      b.classList.toggle("actif", this._ecran === "cockpit");
    }
    // Le bouton de l'espace dit si CE GN est rattaché — c'est la seule
    // chose qu'on a besoin de savoir sans ouvrir l'écran, et elle
    // rappelle qu'un GN rattaché n'est plus purement local.
    const e = document.getElementById("act-espace");
    if (!e) return;
    const r = rattachement(Projets.actif());
    e.innerHTML = r ? 'Espace <span class="es-pastille" title="Ce GN est rattaché">●</span>' : "Espace";
    e.title = r
      ? `Ce GN est rattaché à « ${r.espace} ». Il échange avec les membres de cet espace.`
      : "Écrire ce GN à plusieurs. Ce GN n'est rattaché à aucun espace : il reste sur cet appareil.";
    e.classList.toggle("actif", this._ecran === "espace");
  },

  _detailPoids() {
    const p = poids();
    const gros = p.parCle
      .slice(0, 3)
      .map((x) => `${x.cle} ${formaterOctets(x.octets)}`)
      .join(" · ");
    this._statut(`${conseil(p).replace(/\*\*/g, "")} — ${gros}.`);
  },

  _compteurs() {
    this._rendreNav();
    this._rendreProjet();
    this._rendrePoids();
    this._rendreBoutonDiagnostic();
    const el = document.getElementById("compteurs");
    if (!el) return;
    if (this._ecran === "cockpit") {
      const n = compterOuverts(this._stores(), Derogations);
      el.textContent = n ? `${n} ${Utils.plur(n, "point")} d'attention` : "rien à signaler";
      return;
    }
    if (this._ecran === "besoins") {
      const cles = besoinsPlats(this._stores()).map((b) => b.cle);
      const b = SuiviStore.bilan(cles);
      el.textContent = `${b.faits}/${b.total} ${Utils.plur(b.total, "fait")} · ${b.assignes} ${Utils.plur(b.assignes, "assigné")}`;
      return;
    }
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
window.SuiviStore = SuiviStore;
window.LiensStore = LiensStore;
// L'épreuve des règles se lance à la main, depuis la console : elle
// n'a pas d'écran parce qu'on la joue une fois par déploiement de
// règles, pas une fois par session d'écriture.
import("./core/epreuve.js")
  .then((m) => {
    window.Epreuve = m.Epreuve;
  })
  // Un import dynamique qui échoue ne dit rien : la promesse est
  // rejetée dans le vide, `window.Epreuve` reste absent, et on cherche
  // la panne du côté de la console. On le dit.
  .catch((e) => {
    console.warn("[gnomon] l'épreuve des règles n'a pas pu être chargée :", e.message);
  });

App.init();
