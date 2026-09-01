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

/** ── UN SIGNAL RÉPÉTÉ N'EST PAS N PROBLÈMES ──
    C'est le raisonnement que `depuisTemps` tient déjà d'un cran plus
    bas : trois scènes simultanées font trois paires, mais pour l'auteur
    c'est UN problème — « il est attendu partout à 21 h ». Vingt PJ sans
    contact positif, c'est pareil : ce n'est pas vingt fautes, c'est une
    seule — les liens ne sont pas encore écrits.

    Sans ce regroupement, le premier rang n'a aucune borne. Mesuré sur
    un GN de quarante PJ à mi-écriture : 124 cartes « attention » et
    27 448 px de page, c'est-à-dire une liste qu'on parcourt — exactement
    ce que cet écran existe pour ne pas être.

    Rien n'est perdu : le paquet se déplie sur les cartes ENTIÈRES, avec
    leur détail, leur source et leur bouton d'écart. « Moins
    d'informations, plus pertinentes », jamais « moins d'explications ». */
const SEUIL_PAQUET = 4;

/** La phrase collective, par signal. Un `cle` absent d'ici ne se
    regroupe pas — le défaut sûr est de tout montrer, pas de résumer
    avec une formule inventée. */
const TITRE_PAQUET = {
  seul: (n) => `${n} personnages ne sont le contact primaire de personne`,
  heros: (n) => `${n} personnages ne sont le point de vue d'aucune situation`,
  positif: (n) => `${n} personnages n'ont aucun contact positif`,
  densite: (n) => `${n} personnages ont un réseau de contacts déséquilibré`,
  mixite: (n) => `${n} personnages n'ont d'intrigue que d'un seul côté`,
  differenciation: (n) => `${n} paires pensent pareil dans le même groupe`,
  "prise:absente": (n) => `${n} personnages n'apparaissent dans aucune situation écrite`,
  "fragilite:defection": (n) => `${n} personnages sont des points de fragilité du réseau`,
  suites: (n) => `${n} situations ne mènent nulle part`,
  armee: (n) => `${n} situations n'ont personne en scène pour porter ce qu'elles nécessitent`,
  chaine: (n) => `Ce qui s'apprend dans ${n} situations ne sert nulle part ensuite`,
  defection: (n) => `${n} situations tiennent à une seule personne`,
  miroir: (n) => `${n} situations retiennent un contact-miroir attendu ailleurs`,
  "reference:orpheline": (n) => `${n} situations référencent un personnage supprimé`,
  "promesse:condition-fragile": (n) =>
    `${n} situations semblent promettre une révélation difficile à déclencher`,
  "acces:boucle-fermee": (n) => `${n} ensembles de situations sans entrée écrite`,
  "information:sans-porteur": (n) => `${n} informations n'ont encore aucun porteur`,
  ponts: (n) => `${n} groupes n'ont aucun contact hors d'eux-mêmes`,
  "temps:collision": (n) => `${n} personnes sont attendues à deux endroits à la fois`,
};

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
  // Les paquets dépliés, par `cle`. Persistant entre deux rendus : sinon
  // écarter une alerte d'un paquet ouvert le refermerait sous les doigts.
  _paquetsOuverts: new Set(),

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
  /** ── LA PLACE DE L'AUTEUR NE SE PERD PAS ──
      Écarter une alerte est un geste qu'on RÉPÈTE : on descend la liste
      et on justifie au fur et à mesure. Or `rendre()` réécrit tout, et
      la carte écartée quitte le rang ouvert pour rejoindre le bas — le
      défilement retombait donc à zéro à chaque justification. Mesuré :
      6 000 px avant, 178 après, sur une page de 45 mètres.

      Restaurer `scrollY` tel quel ne suffit pas, puisque la hauteur
      au-dessus vient de changer. On s'ancre donc sur une CARTE : la
      première encore visible, et la distance entre son haut et celui de
      la fenêtre. Après reconstruction, on la retrouve par sa clé et on
      remet cette distance. Si elle a disparu — c'est le cas de celle
      qu'on vient d'écarter — on descend la liste des suivantes, qui a
      été prise dans le même ordre. */
  _ancre() {
    if (!this._hote || !this._hote.querySelector(".ck")) return null;
    const cartes = [...this._hote.querySelectorAll("li[data-cle]")];
    for (const li of cartes) {
      const y = li.getBoundingClientRect().top;
      if (y >= 0)
        return { cles: cartes.slice(cartes.indexOf(li)).map((x) => x.dataset.cle), y };
    }
    return null;
  },

  _restaurer(ancre) {
    if (!ancre) return;
    for (const cle of ancre.cles) {
      const li = this._hote.querySelector(`li[data-cle="${CSS.escape(cle)}"]`);
      if (!li) continue;
      window.scrollBy(0, li.getBoundingClientRect().top - ancre.y);
      return;
    }
  },

  rendre() {
    if (!this._hote) return;
    const ancre = this._ancre();
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
    this._restaurer(ancre);
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
        `<ul class="ck-liste">${this._items(items, ecartees)}</ul>` +
        "</section>"
      );
    }).join("");
  },

  /** Les cartes d'une catégorie, les signaux répétés repliés en paquets.
      L'ordre de `diagnostics()` est conservé : un paquet prend la place
      de sa première carte, donc le plus grave reste devant. */
  _items(items, ecartees) {
    const parCle = new Map();
    for (const d of items) {
      if (!parCle.has(d.cle)) parCle.set(d.cle, []);
      parCle.get(d.cle).push(d);
    }
    const out = [];
    for (const [cle, groupe] of parCle) {
      const titre = TITRE_PAQUET[cle];
      // En dessous du seuil, ou sans phrase collective écrite : on
      // montre tout. Résumer avec une formule inventée serait pire que
      // de ne pas résumer.
      if (groupe.length < SEUIL_PAQUET || !titre)
        out.push(...groupe.map((d) => this._carte(d, ecartees)));
      else out.push(this._paquet(cle, titre(groupe.length), groupe, ecartees));
    }
    return out.join("");
  },

  _paquet(cle, titre, groupe, ecartees) {
    const ouvert = this._paquetsOuverts.has(cle);
    return (
      `<li class="ck-diag ck-paquet${ouvert ? " deplie" : ""}" data-cle="paquet:${Utils.escHtml(cle)}">` +
      `<p class="ck-titre">${Utils.escHtml(titre)}</p>` +
      `<p class="ck-source">${Utils.escHtml(groupe[0].source)}</p>` +
      `<button type="button" class="ck-deplier" data-paquet="${Utils.escHtml(cle)}" ` +
      `aria-expanded="${ouvert}">${ouvert ? "Replier" : `Voir les ${groupe.length}`}</button>` +
      (ouvert
        ? `<ul class="ck-liste ck-sous">${groupe.map((d) => this._carte(d, ecartees)).join("")}</ul>`
        : "") +
      "</li>"
    );
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
      `<li class="ck-diag${ecartee ? " ecartee" : ""}${hypothese ? " hypothese" : ""}" ` +
      `data-cle="${Utils.escHtml(cle)}">` +
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

    for (const b of q("[data-paquet]"))
      b.addEventListener("click", () => {
        const k = b.dataset.paquet;
        this._paquetsOuverts.has(k)
          ? this._paquetsOuverts.delete(k)
          : this._paquetsOuverts.add(k);
        this.rendre();
      });

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
        // `preventScroll` : le champ apparaît là où on vient de cliquer,
        // donc il est déjà sous les yeux. Sans ça, le navigateur le fait
        // défiler « en vue » et emporte la page de plusieurs centaines de
        // pixels — mesuré à +881 sur un paquet déplié. L'ancrage de
        // `rendre()` tient la place ; le focus n'a pas à la reprendre.
        if (ta) ta.focus({ preventScroll: true });
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
