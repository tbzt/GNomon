"use strict";

/* ============================================================
   RÉSEAU — le casting, en trois lentilles.
   ------------------------------------------------------------
   **Une vérité, trois vues** — la doctrine du projet appliquée là où
   elle sert le plus.

   · **La liste** met les couvertures côte à côte : elle dit d'un coup
     d'œil qui est écrit et qui ne l'est pas, ce qu'aucune relecture de
     quarante fiches ne donne.
   · **Le graphe** montre ce que la liste ne peut pas : la forme du
     réseau, les groupes, et surtout **ce qui casse si quelqu'un ne
     vient pas**.
   · **Le tableau** est la seule des trois où l'on ÉCRIT : une ligne par
     personnage, les mêmes champs que la fiche mis en colonnes. Il sert
     quand la question porte sur l'ensemble — remplir les fonctions
     narratives manquantes, reclasser un groupe, comparer quarante
     morales — là où ouvrir quarante fiches est le vrai coût.

   Aucune n'est « la vraie » : les trois lisent le même store, avec le
   même vocabulaire (⇄ accord · ⇄̸ désaccord · → sens unique).
   ============================================================ */
import { scoreCouverture } from "../core/couverture.js";
import { TONALITES, IMPORTANCES, FONCTIONS } from "../core/reseaustore.js";
import { ReseauGraphe } from "./reseaugraphe.js";
import { Tableau } from "./tableau.js";
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
      // Dissoudre : le store désaffecte les membres, il ne les supprime
      // pas. On retire le classeur, pas les gens — et la phrase le dit,
      // parce que « supprimer un groupe » se lit autrement.
      const gx = e.target.closest("[data-groupe-x]");
      if (gx) {
        const id = gx.dataset.groupeX;
        const g = this._store.groupe(id);
        const n = this._store.membresDe(id).length;
        if (
          confirm(
            `Dissoudre « ${g ? g.nom : "ce groupe"} » ?\n\n` +
              (n
                ? `${n} personnage${n > 1 ? "s" : ""} ${n > 1 ? "deviennent" : "devient"} sans groupe. Personne n'est supprimé.`
                : "Il est déjà vide."),
          )
        )
          this._store.supprimerGroupe(id);
        return;
      }
      const carte = e.target.closest("[data-personnage]");
      if (carte && this._onOuvrir) this._onOuvrir(carte.dataset.personnage);
    });

    /* ── UN `role="button"` DOIT RÉPONDRE COMME UN BOUTON ──
       La carte est annoncée « bouton » et prend le focus, mais seul le
       clic était écouté : au clavier, Entrée ne faisait rien. C'est le
       geste PRINCIPAL de l'application — ouvrir une fiche — et il était
       inatteignable sans souris. La matrice et le casting gèrent déjà
       Entrée et Espace sur leurs cases ; la connaissance était dans
       l'équipe, elle n'avait pas été appliquée ici. */
    this._hote.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const carte = e.target.closest("[data-personnage]");
      if (!carte || !this._onOuvrir) return;
      // Espace fait défiler la page par défaut : sur une commande, non.
      e.preventDefault();
      this._onOuvrir(carte.dataset.personnage);
    });

    // Le renommage part au `change` — donc à la sortie du champ, pas à
    // la frappe : `rendre()` reconstruit tout à chaque écriture, et
    // enregistrer lettre par lettre arracherait le champ des doigts.
    this._hote.addEventListener("change", (e) => {
      const champ = e.target.closest(".groupe-nom");
      if (!champ) return;
      const sec = champ.closest("[data-groupe]");
      const id = sec && sec.dataset.groupe;
      if (!id) return;
      const val = champ.value.trim();
      // Un groupe sans nom serait une section anonyme qu'on ne saurait
      // plus désigner : on repose l'ancien plutôt que de l'accepter.
      if (!val) {
        const g = this._store.groupe(id);
        champ.value = g ? g.nom : "";
        return;
      }
      this._store.majGroupe(id, { nom: val });
    });

    this.rendre();
  },

  demonter() {
    ReseauGraphe.demonter();
    Tableau.demonter();
  },

  rendre() {
    const persos = this._store.personnages();
    const barre =
      '<div class="lentilles">' +
      `<button type="button" class="lentille${this._lentille === "liste" ? " actif" : ""}" data-lentille="liste">Liste</button>` +
      `<button type="button" class="lentille${this._lentille === "graphe" ? " actif" : ""}" data-lentille="graphe">Graphe</button>` +
      `<button type="button" class="lentille${this._lentille === "tableau" ? " actif" : ""}" data-lentille="tableau">Tableau</button>` +
      '<span class="spacer"></span>' +
      '<button type="button" class="creer-perso" data-creer>+ Personnage</button>' +
      "</div>";

    if (!persos.length) {
      ReseauGraphe.demonter();
      Tableau.demonter();
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

    /* Le tableau se monte UNE fois et se rafraîchit ensuite. Le
       reconstruire à chaque événement du store arracherait le champ
       sous le curseur — or c'est la seule lentille où l'on saisit.
       C'est le widget lui-même qui dit s'il est en service — la
       présence de son nœud dans le DOM ne le dit pas : quitter l'écran
       le masque sans le vider. */
    if (this._lentille === "tableau") {
      ReseauGraphe.demonter();
      if (Tableau.monteDans(this._hote)) {
        Tableau.rafraichir();
        return;
      }
      this._hote.innerHTML = barre + '<div id="tb-hote"></div>';
      const h = this._hote.querySelector("#tb-hote");
      Tableau.monter(h, this._store, { onOuvrir: this._onOuvrir });
      Tableau.brancher(h);
      return;
    }

    if (this._lentille === "graphe") {
      Tableau.demonter();
      /* Le graphe se monte UNE fois et se rafraîchit ensuite, comme le
         tableau. Le remonter à chaque événement du store remettrait la
         vue de l'auteur à zéro — invisible tant que le graphe était en
         lecture seule, fatal depuis que son flanc édite les liens. */
      if (ReseauGraphe.monteDans(this._hote)) {
        ReseauGraphe.rafraichir();
        return;
      }
      this._hote.innerHTML = barre + '<div id="rg-hote"></div>';
      ReseauGraphe.monter(this._hote.querySelector("#rg-hote"), this._store, this._stores, {
        onOuvrir: this._onOuvrir,
      });
      return;
    }

    ReseauGraphe.demonter();
    Tableau.demonter();
    const groupes = [...this._store.groupes(), { id: null, nom: "Sans groupe" }];
    this._hote.innerHTML =
      barre +
      groupes
      .map((g) => {
        const membres = persos.filter((p) => p.groupeId === g.id);
        // Un groupe RÉEL resté sans membre s'affiche quand même, vide.
        // Le masquer le laisserait vivre dans les sélecteurs sans
        // qu'aucun écran ne permette de le renommer ni de le dissoudre —
        // c'est la règle du portrait manquant du trombinoscope : un trou
        // visible se comble, un trou caché reste. « Sans groupe », lui,
        // n'est pas un groupe mais le reste : vide, il ne dit rien.
        if (!membres.length && !g.id) return "";
        return (
          `<section class="groupe" data-groupe="${g.id || ""}">` +
          this._enteteGroupe(g, membres.length) +
          (membres.length
            ? membres.map((p) => this._carte(p)).join("")
            : '<p class="groupe-vide">Aucun membre. Rangez quelqu\'un dedans depuis la lentille Tableau, ' +
              "ou dissolvez-le.</p>") +
          "</section>"
        );
      })
      .join("");
  },

  /** Le nom d'un groupe s'écrit là où il s'affiche. « Sans groupe »
      n'en est pas un — c'est le reste, et il n'a donc ni nom modifiable
      ni dissolution. */
  _enteteGroupe(g, n) {
    if (!g.id) return `<h2>${Utils.escHtml(g.nom)}</h2>`;
    return (
      '<h2 class="groupe-tete">' +
      `<input class="groupe-nom" value="${Utils.escHtml(g.nom)}" aria-label="Nom du groupe" />` +
      `<span class="groupe-compte">${n} ${Utils.plur(n, "membre")}</span>` +
      `<button type="button" class="groupe-x" data-groupe-x="${g.id}" ` +
      'title="Retire le groupe ; ses membres deviennent sans groupe">Dissoudre</button>' +
      "</h2>"
    );
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
