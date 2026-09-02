"use strict";

/* ============================================================
   LE GRAPHE DU RÉSEAU — la lentille qui manquait.
   ------------------------------------------------------------
   La vérité racine du projet est l'arête ; il lui fallait une vue qui
   la montre. Deuxième lentille sur les mêmes données que la liste,
   avec le même vocabulaire — ⇄ pour l'accord, ⇄̸ pour le désaccord,
   → pour le sens unique — pour qu'on passe de l'une à l'autre sans
   réapprendre à lire.

   ── UNE ARÊTE VISUELLE PAR PAIRE, PAS PAR LIEN ──
   Le modèle est orienté : Elena→Marek et Marek→Elena sont deux liens.
   Dessinés tels quels, ils se superposeraient exactement et l'un des
   deux serait invisible. On les **fusionne au rendu** — une ligne par
   paire — et c'est le TRAIT qui dit leur rapport :

     plein     les deux sens existent et concordent ;
     tireté    les deux existent mais diffèrent — l'asymétrie, qui est
               le matériau du GN, se voit enfin d'un coup d'œil ;
     pointillé un seul sens : quelqu'un compte pour l'autre sans
               réciproque.

   L'épaisseur porte l'importance, la couleur la tonalité, et `◎`
   marque le contact-miroir. Rien n'est décoratif.

   ── PAS DE SIMULATION DE FORCES ──
   Le moteur en propose une ; on ne s'en sert pas. Un force-layout
   brouille les groupes et se réorganise à chaque ouverture, alors que
   la structure sociale d'un GN EST ses groupes. On arrange donc
   **par groupes**, de façon déterministe, et l'auteur déplace ensuite
   — sa disposition est persistée.

   ── LE GESTE : « ET S'IL NE VIENT PAS ? » ──
   Le seul de tout l'outil qui n'existe nulle part ailleurs. On active
   le mode, on touche quelqu'un, et tout ce qui dépend de lui vire au
   rouge. On relâche, tout revient. La tolérance aux pannes de
   Morningstar, testable sur quarante personnages en une minute.
   ============================================================ */
import { GraphEngine } from "./graph/graphengine.js";
import { defection, classementFragilite } from "../core/defection.js";
import { TONALITES, IMPORTANCES } from "../core/reseaustore.js";
import { LienEditeur } from "./lienediteur.js";
import { degatsHtml } from "./degats.js";
import { Utils } from "../core/utils.js";

const COULEUR = {
  positif: "#2f6e4f",
  negatif: "#9e2b25",
  neutre: "#5a646b",
  complique: "#6b4e9e",
};
const EPAISSEUR = { primaire: 3.4, secondaire: 2, confort: 1.1 };
/** Ordre de « charge » : quand les deux sens diffèrent, c'est le plus
    chargé qui donne la couleur — une tension compte plus qu'un calme. */
const CHARGE = { negatif: 3, complique: 2, positif: 1, neutre: 0 };

/* Espacement de la disposition, en unités du monde. `ÉCART_MEMBRE` est la
   distance de centre à centre entre deux voisins d'une même couronne ;
   `ÉCART_GROUPES` le blanc laissé entre deux couronnes ; `MARGE_MONDE` la
   bordure autour du tout. Un nœud fait 32 unités de large. */
const ECART_MEMBRE = 68;
const ECART_GROUPES = 110;
const MARGE_MONDE = 90;

const ACCENT = "#1d4e7a";
const ROUGE = "#9e2b25";

export const ReseauGraphe = {
  _hote: null,
  _store: null,
  _stores: null,
  _selId: null,
  _mode: false, // mode défection
  _absent: null,
  _onOuvrir: null,
  _lienOuvert: null,
  _sig: "",

  monter(hote, store, stores, { onOuvrir = null } = {}) {
    this._hote = hote;
    this._store = store;
    this._stores = stores;
    this._onOuvrir = onOuvrir;
    this.rendre();
  },

  demonter() {
    GraphEngine.destroy();
    this._hote = null;
    this._sig = "";
  },

  /** Vrai seulement si CE widget est vivant et que son hôte est encore
      en place — même garde que le tableau. Chercher `#rg-hote` dans le
      DOM ne suffirait pas : quitter l'écran le masque sans le vider. */
  monteDans(parent) {
    return !!this._hote && !!parent && parent.contains(this._hote);
  },

  /** Ce qui, en changeant, oblige à REMONTER le moteur : quels nœuds,
      où ils sont, et quelles arêtes existent. Le STYLE n'y est pas —
      couleur, épaisseur, motif, mot et sens se repeignent en place
      (`_peindre`). C'est ce qui permet de régler la tonalité d'un lien
      depuis le flanc sans que le cadrage de l'auteur ne saute, et c'est
      la même discipline que la signature de l'atelier. */
  _signature() {
    return [
      this._store
        .personnages()
        .map((p) => `${p.id}:${p.nom}:${p.pj ? 1 : 0}:${p.x},${p.y}:${p.portrait ? 1 : 0}`)
        .join("|"),
      this._aretes()
        .map((e) => `${e.from}>${e.to}`)
        .join("|"),
      this._store.groupes().map((g) => `${g.id}:${this._store.membresDe(g.id).length}`).join(","),
    ].join("§");
  },

  /** Re-projette sans remonter, tant que la structure n'a pas bougé.
      Sans ça, la moindre écriture — et depuis que le flanc édite les
      liens, il y en a — remettait la vue à zéro. */
  rafraichir() {
    if (!this._hote) return;
    if (this._sig !== this._signature()) {
      this.rendre();
      return;
    }
    this._peindre();
    this._rafraichirFlanc();
  },

  /* ================= arrangement ================= */

  /** ── LA DISPOSITION SE CALCULE, ELLE N'EST PLUS EN DUR ──
      L'ancien arrangement posait les groupes sur un cercle de rayon 210
      autour du point (460, 300), et les membres sur une couronne plafonnée
      à 105. Ces trois nombres tenaient pour sept personnages ; à quarante,
      les couronnes se recouvraient et le cadre les tassait contre ses bords.

      Tout part maintenant du contenu : la couronne d'un groupe est assez
      large pour que ses membres ne se touchent pas, le cercle des groupes
      assez large pour que les couronnes ne se touchent pas, et le monde
      assez grand pour contenir le tout. Un GN de sept retrouve à peu près
      ses anciennes valeurs ; un GN de quarante-six s'étale au lieu de se
      tasser. */
  _disposition() {
    const persos = this._store.personnages();
    const groupes = [...this._store.groupes(), { id: null, nom: "Sans groupe" }].filter((g) =>
      persos.some((p) => p.groupeId === g.id),
    );
    const cercles = groupes.map((g) => {
      const membres = persos.filter((p) => p.groupeId === g.id);
      // Rayon d'une couronne de n membres espacés de ÉCART_MEMBRE.
      const r = membres.length < 2 ? 0 : Math.max(56, (ECART_MEMBRE * membres.length) / (2 * Math.PI));
      return { membres, r };
    });
    // Le cercle des groupes doit avoir de quoi loger toutes les couronnes
    // bout à bout, plus un blanc entre chacune.
    const besoin = cercles.reduce((n, c) => n + 2 * c.r + ECART_GROUPES, 0);
    const R = cercles.length > 1 ? Math.max(230, besoin / (2 * Math.PI)) : 0;
    // Ellipse plutôt que cercle : un cadre de graphe est plus large que haut,
    // et un monde carré s'y afficherait avec deux bandes vides sur les côtés.
    const rx = R * 1.22, ry = R * 0.78;
    const rmax = cercles.reduce((n, c) => Math.max(n, c.r), 0);
    return {
      cercles, rx, ry,
      cx: rx + rmax + MARGE_MONDE,
      cy: ry + rmax + MARGE_MONDE,
      w: Math.round((rx + rmax + MARGE_MONDE) * 2),
      h: Math.round((ry + rmax + MARGE_MONDE) * 2),
    };
  },

  /** Les dimensions du monde à demander au moteur. */
  _monde() {
    const d = this._disposition();
    return { w: d.w, h: d.h };
  },

  /** Place ceux qui n'ont pas de position : les groupes sur une ellipse,
      leurs membres en couronne autour de leur groupe. Rend la structure
      sociale lisible avant tout glissement. */
  arranger({ tout = false } = {}) {
    const persos = this._store.personnages();
    if (!persos.length) return;
    const d = this._disposition();

    d.cercles.forEach((c, gi) => {
      const a = (gi / d.cercles.length) * Math.PI * 2 - Math.PI / 2;
      const gx = d.cx + Math.cos(a) * d.rx;
      const gy = d.cy + Math.sin(a) * d.ry;
      c.membres.forEach((p, i) => {
        if (!tout && Number.isFinite(p.x) && Number.isFinite(p.y)) return;
        // La couronne démarre du côté opposé au centre : le groupe se lit
        // de l'extérieur vers l'intérieur, et les noms ne tombent pas tous
        // du même côté d'un groupe à l'autre.
        const b = a + (i / Math.max(1, c.membres.length)) * Math.PI * 2;
        this._store.poserPersonnage(
          p.id,
          Math.round(gx + Math.cos(b) * c.r),
          Math.round(gy + Math.sin(b) * c.r),
        );
      });
    });
  },

  /* ================= projection ================= */

  _noeuds() {
    return this._store.personnages().map((p) => ({
      id: p.id,
      label: p.nom.split(" ").slice(-1)[0],
      shape: p.pj ? "circle" : "diamond",
      portrait: p.portrait || "",
      glyph: p.portrait ? "" : initiales(p.nom),
      x: p.x,
      y: p.y,
    }));
  },

  /** Fusionne les deux sens en une arête visuelle. */
  _aretes() {
    const vus = new Set();
    const out = [];
    for (const l of this._store.liens()) {
      const paire = [l.de, l.vers].sort().join("|");
      if (vus.has(paire)) continue;
      vus.add(paire);
      const retour = this._store.reciproque(l);

      const memes =
        retour && retour.tonalite === l.tonalite && retour.importance === l.importance;
      const pattern = !retour ? "dotted" : memes ? "solid" : "dashed";
      const dominant =
        retour && CHARGE[retour.tonalite] > CHARGE[l.tonalite] ? retour.tonalite : l.tonalite;
      const imp =
        retour && EPAISSEUR[retour.importance] > EPAISSEUR[l.importance]
          ? retour.importance
          : l.importance;
      const miroir = l.miroir || (retour && retour.miroir);

      out.push({
        id: l.id,
        from: l.de,
        to: l.vers,
        color: COULEUR[dominant],
        width: EPAISSEUR[imp],
        pattern,
        dir: retour ? "none" : "forward",
        label: (miroir ? "◎ " : "") + (l.nature || ""),
        _paire: [l.de, l.vers],
      });
    }
    return out;
  },

  _poches() {
    const palette = ["#1d4e7a", "#6b4e9e", "#2f6e4f", "#8a6a2f", "#7a3a5c"];
    return this._store.groupes().map((g, i) => ({
      id: g.id,
      color: palette[i % palette.length],
      memberIds: this._store.membresDe(g.id).map((p) => p.id),
    }));
  },

  /* ================= rendu ================= */

  rendre() {
    const persos = this._store.personnages();
    if (!persos.length) {
      this._hote.innerHTML =
        '<p class="vide">Aucun personnage — le graphe a besoin de monde.</p>';
      return;
    }
    this.arranger();

    this._hote.innerHTML =
      '<div class="rg">' +
      '<div class="rg-barre">' +
      `<button type="button" id="rg-defection" class="rg-mode${this._mode ? " actif" : ""}" ` +
      `aria-pressed="${this._mode}">` +
      `${this._mode ? "Mode défection actif" : "Et s'il ne vient pas ?"}</button>` +
      '<button type="button" id="rg-ranger">Ranger</button>' +
      '<span class="rg-legende">' +
      Object.entries(TONALITES)
        .map(
          ([k, v]) =>
            `<span><i style="background:${COULEUR[k]}"></i>${Utils.escHtml(v)}</span>`,
        )
        .join("") +
      "<span>— plein : d'accord · tireté : en désaccord · pointillé : sens unique</span>" +
      "</span></div>" +
      '<div class="rg-corps">' +
      '<div class="rg-canvas" id="rg-canvas"></div>' +
      `<aside class="rg-flanc" id="rg-flanc">${this._flanc()}</aside>` +
      "</div></div>";

    this._monterGraphe();
    this._brancher();
    this._sig = this._signature();
  },

  _monterGraphe() {
    const hote = this._hote.querySelector("#rg-canvas");
    GraphEngine.destroy();
    GraphEngine.mount(hote, {
      nodes: this._noeuds(),
      edges: this._aretes(),
      accent: ACCENT,
      static: true,
      world: this._monde(),
      controls: true,
      onNodeMoved: (id, x, y) => this._store.poserPersonnage(id, Math.round(x), Math.round(y)),
      onNodeTap: (id) => {
        if (this._mode) {
          this._absent = this._absent === id ? null : id;
          this._peindre();
        } else {
          this._selId = id;
          GraphEngine.select(id);
        }
        this._rafraichirFlanc();
      },
      onBackgroundTap: () => {
        if (this._mode) this._absent = null;
        // Toucher le fond désélectionne — il fallait le DIRE au moteur, qui
        // gardait sinon son anneau et, désormais, tout un voisinage allumé.
        else { this._selId = null; GraphEngine.select(null); }
        this._peindre();
        this._rafraichirFlanc();
      },
    });
    GraphEngine.setPockets(this._poches());
    if (this._selId) GraphEngine.select(this._selId);
    this._peindre();
  },

  /** Repeint selon l'absent. Le moteur sait changer une couleur de
      nœud et d'arête sans tout remonter : on garde donc le cadrage de
      l'auteur pendant qu'il essaie les défections l'une après l'autre. */
  _peindre() {
    const noeuds = this._noeuds();
    const aretes = this._aretes();

    if (!this._absent) {
      for (const n of noeuds) GraphEngine.setNodeColor(n.id, null);
      // `label` et `dir` avec le reste : ils portent la nature du lien
      // et son sens unique, qui changent à l'édition. Les omettre
      // laisserait à l'écran un mot que le store n'a plus.
      for (const e of aretes)
        GraphEngine.updateEdgeStyle(e.id, {
          color: e.color,
          width: e.width,
          pattern: e.pattern,
          label: e.label,
          dir: e.dir,
        });
      return;
    }

    const d = defection(this._absent, this._stores);
    for (const n of noeuds)
      GraphEngine.setNodeColor(
        n.id,
        n.id === this._absent ? "#3a1512" : d.noeudsTouches.has(n.id) ? "#5c1f1a" : null,
      );
    for (const e of aretes) {
      const casse = e._paire.includes(this._absent);
      GraphEngine.updateEdgeStyle(e.id, {
        color: casse ? ROUGE : e.color,
        width: e.width,
        pattern: casse ? "dashed" : e.pattern,
        label: e.label,
        dir: e.dir,
      });
    }
  },

  /* ================= le flanc ================= */

  _flanc() {
    if (this._mode) return this._flancDefection();
    if (!this._selId) return this._flancRepos();
    return this._flancPersonnage();
  },

  _flancRepos() {
    const frag = classementFragilite(this._stores).slice(0, 4);
    return (
      '<p class="rg-titre">Le réseau</p>' +
      '<p class="rg-aide">Touchez quelqu\'un pour le détailler. Glissez pour ranger. ' +
      "Le trait dit si les deux personnes sont d'accord sur ce qui les lie.</p>" +
      (frag.length
        ? '<p class="rg-titre" style="margin-top:18px">Les plus fragiles</p>' +
          '<p class="rg-aide">Si l\'un d\'eux manque, voilà ce que ça coûte.</p>' +
          '<ul class="rg-liste">' +
          frag
            .map(
              (f) =>
                `<li><button type="button" data-essayer="${f.personnage.id}">` +
                `<span>${Utils.escHtml(f.personnage.nom)}</span>` +
                `<b>${f.gravite}</b></button></li>`,
            )
            .join("") +
          "</ul>"
        : "")
    );
  },

  _flancPersonnage() {
    const p = this._store.personnage(this._selId);
    if (!p) return this._flancRepos();
    const liens = this._store.liensDe(p.id);
    return (
      `<p class="rg-titre">${Utils.escHtml(p.nom)}</p>` +
      `<p class="rg-aide">${Utils.escHtml(p.role || "")}${p.pj ? "" : " · PNJ"}</p>` +
      '<ul class="rg-liste rg-liens">' +
      (liens.length
        ? liens
            .map((l) => {
              const q = this._store.personnage(l.vers);
              const r = this._store.reciproque(l);
              const sym = r && r.tonalite === l.tonalite && r.importance === l.importance;
              const ouvert = this._lienOuvert === l.id;
              /* C'est ICI qu'on voit qu'un lien devrait être primaire —
                 le graphe montre la forme du réseau, la fiche montre un
                 personnage. Renvoyer à la fiche pour régler ce qu'on
                 vient de repérer était le trajet de trop. */
              return (
                `<li class="t-${l.tonalite}${ouvert ? " ouvert" : ""}">` +
                `<span class="rg-fleche">${sym ? "⇄" : r ? "⇄̸" : "→"}</span>` +
                `<span>${Utils.escHtml(q ? q.nom : "?")}${l.miroir ? " ◎" : ""}` +
                `<i>${Utils.escHtml(l.nature) || "—"} · ${TONALITES[l.tonalite]} · ${IMPORTANCES[l.importance]}</i></span>` +
                `<button type="button" class="rg-modifier" data-lien="${l.id}" ` +
                `aria-expanded="${ouvert}" title="Régler ce lien">${ouvert ? "Fermer" : "Régler"}</button>` +
                (ouvert
                  ? `<div class="rg-edit">${LienEditeur.html(this._store, l, p)}</div>`
                  : "") +
                "</li>"
              );
            })
            .join("")
        : '<li class="rg-vide">aucun contact déclaré</li>') +
      "</ul>" +
      `<button type="button" class="rg-ouvrir" data-ouvrir="${p.id}">Ouvrir la fiche</button>`
    );
  },

  _flancDefection() {
    if (!this._absent)
      return (
        '<p class="rg-titre alarme">Et s\'il ne vient pas ?</p>' +
        '<p class="rg-aide">Touchez quelqu\'un : tout ce qui dépend de lui vire au rouge. ' +
        "Touchez-le à nouveau, ou le fond, pour revenir.</p>" +
        '<p class="rg-aide">C\'est la question que Morningstar pose et que personne n\'outille : ' +
        "la redondance est un choix de design, pas un accident.</p>"
      );

    // Le texte des dégâts vit dans `degats.js`, partagé avec la fiche :
    // le calcul était déjà commun, le rendu ne l'était pas, et deux
    // textes pour un même calcul finissent par dire deux choses.
    const d = defection(this._absent, this._stores);
    return degatsHtml(d, { titre: `Sans ${d.personnage.nom}` });
  },

  _rafraichirBarre() {
    const b = this._hote.querySelector("#rg-defection");
    if (!b) return;
    b.className = `rg-mode${this._mode ? " actif" : ""}`;
    b.setAttribute("aria-pressed", String(this._mode));
    b.textContent = this._mode ? "Mode défection actif" : "Et s'il ne vient pas ?";
  },

  _rafraichirFlanc() {
    const f = this._hote.querySelector("#rg-flanc");
    if (!f) return;
    // Même règle que la fiche (cf. `Fiche._reprojeterLiens`) : on
    // reconstruit toujours — sinon le résumé du lien resterait périmé
    // sous l'éditeur ouvert — et on reporte ce que le store n'a pas
    // encore, c'est-à-dire la frappe en cours et le curseur.
    const a = document.activeElement;
    const vif = a && f.contains(a) && a.dataset.le ? a : null;
    const garde = vif
      ? {
          l: vif.dataset.l,
          le: vif.dataset.le,
          texte: vif.type === "text" ? vif.value : null,
          debut: vif.type === "text" ? vif.selectionStart : null,
          fin: vif.type === "text" ? vif.selectionEnd : null,
        }
      : null;

    f.innerHTML = this._flanc();
    this._brancherFlanc();

    if (!garde) return;
    const el = f.querySelector(`[data-le="${garde.le}"][data-l="${garde.l}"]`);
    if (!el) return;
    if (garde.texte !== null) el.value = garde.texte;
    el.focus();
    if (garde.texte !== null) el.setSelectionRange(garde.debut, garde.fin);
  },

  /* ================= câblage ================= */

  _brancher() {
    const q = (s) => this._hote.querySelector(s);
    q("#rg-defection").addEventListener("click", () => {
      this._mode = !this._mode;
      this._absent = null;
      this._selId = null;
      GraphEngine.select(null); // le voisinage mis en avant n'a plus cours ici
      // On re-rend la barre plutôt que de retoucher trois attributs à la
      // main : le rendu était la SEULE source de l'état visuel, et le
      // bricoler en parallèle créait deux vérités — le texte suivait
      // `_mode`, la classe non, et le moindre re-rendu les désaccordait.
      this._rafraichirBarre();
      this._peindre();
      this._rafraichirFlanc();
    });
    q("#rg-ranger").addEventListener("click", () => {
      this.arranger({ tout: true });
      this._monterGraphe();
    });
    this._brancherFlanc();
  },

  _brancherFlanc() {
    for (const b of this._hote.querySelectorAll("[data-ouvrir]"))
      b.addEventListener("click", () => this._onOuvrir && this._onOuvrir(b.dataset.ouvrir));
    for (const b of this._hote.querySelectorAll("[data-essayer]"))
      b.addEventListener("click", () => {
        this._mode = true;
        this._absent = b.dataset.essayer;
        this.rendre();
      });
    for (const b of this._hote.querySelectorAll("[data-lien]"))
      b.addEventListener("click", () => {
        this._lienOuvert = this._lienOuvert === b.dataset.lien ? null : b.dataset.lien;
        this._rafraichirFlanc();
      });
    LienEditeur.brancher(this._hote.querySelector("#rg-flanc"), this._store, {
      avantSuppression: () => {
        this._lienOuvert = null;
      },
    });
  },
};

function initiales(nom) {
  return String(nom || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0].toUpperCase())
    .join("");
}
