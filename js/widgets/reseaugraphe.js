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

  monter(hote, store, stores, { onOuvrir = null } = {}) {
    this._hote = hote;
    this._store = store;
    this._stores = stores;
    this._onOuvrir = onOuvrir;
    this.rendre();
  },

  demonter() {
    GraphEngine.destroy();
  },

  /* ================= arrangement ================= */

  /** Place ceux qui n'ont pas de position : les groupes sur un cercle,
      leurs membres en petite couronne autour de leur groupe. Rend la
      structure sociale lisible avant tout glissement. */
  arranger({ tout = false } = {}) {
    const persos = this._store.personnages();
    if (!persos.length) return;
    const groupes = [...this._store.groupes(), { id: null, nom: "Sans groupe" }].filter((g) =>
      persos.some((p) => p.groupeId === g.id),
    );
    const cx = 460;
    const cy = 300;
    const R = groupes.length > 1 ? 210 : 0;

    groupes.forEach((g, gi) => {
      const membres = persos.filter((p) => p.groupeId === g.id);
      const a = (gi / groupes.length) * Math.PI * 2 - Math.PI / 2;
      const gx = cx + Math.cos(a) * R;
      const gy = cy + Math.sin(a) * R;
      const r = Math.min(105, 34 + membres.length * 16);
      membres.forEach((p, i) => {
        if (!tout && Number.isFinite(p.x) && Number.isFinite(p.y)) return;
        const b = (i / Math.max(1, membres.length)) * Math.PI * 2;
        this._store.poserPersonnage(
          p.id,
          Math.round(gx + Math.cos(b) * (membres.length === 1 ? 0 : r)),
          Math.round(gy + Math.sin(b) * (membres.length === 1 ? 0 : r)),
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
  },

  _monterGraphe() {
    const hote = this._hote.querySelector("#rg-canvas");
    GraphEngine.destroy();
    GraphEngine.mount(hote, {
      nodes: this._noeuds(),
      edges: this._aretes(),
      accent: ACCENT,
      static: true,
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
        else this._selId = null;
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
      for (const e of aretes)
        GraphEngine.updateEdgeStyle(e.id, { color: e.color, width: e.width, pattern: e.pattern });
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
              return (
                `<li class="t-${l.tonalite}"><span class="rg-fleche">${sym ? "⇄" : r ? "⇄̸" : "→"}</span>` +
                `<span>${Utils.escHtml(q ? q.nom : "?")}${l.miroir ? " ◎" : ""}` +
                `<i>${Utils.escHtml(l.nature) || "—"} · ${TONALITES[l.tonalite]} · ${IMPORTANCES[l.importance]}</i></span></li>`
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

    const d = defection(this._absent, this._stores);
    const bloc = (titre, items, ton = "") =>
      items.length
        ? `<p class="rg-sous ${ton}">${titre}</p><ul class="rg-degats">${items.map((x) => `<li>${x}</li>`).join("")}</ul>`
        : "";

    return (
      `<p class="rg-titre alarme">Sans ${Utils.escHtml(d.personnage.nom)}</p>` +
      (d.gravite
        ? `<p class="rg-aide"><b>${d.gravite}</b> ${Utils.plur(d.gravite, "dégât")} ${Utils.plur(d.gravite, "irrécupérable")}.</p>`
        : '<p class="rg-aide ok">Rien ne casse. Le GN tient sans cette personne.</p>') +
      bloc(
        "Scènes sans point de vue",
        d.orphelines.map((s) => Utils.escHtml(s.titre)),
        "grave",
      ) +
      bloc(
        "Scènes fragilisées",
        d.fragilisees.map(
          (s) =>
            `${Utils.escHtml(s.titre)} — ${s.morte ? "<b>plus aucun joueur</b>" : `${s.restants} ${Utils.plur(s.restants, "joueur")} ${Utils.plur(s.restants, "restant")}`}`,
        ),
      ) +
      bloc(
        "Miroirs perdus",
        d.miroirsPerdus.map((m) => `${Utils.escHtml(m.nom)} se retrouve sans contact-miroir`),
        "grave",
      ) +
      bloc(
        "Informations que personne d'autre ne porte",
        d.informationsOrphelines.map(
          (i) =>
            Utils.escHtml(i.contenu) +
            (i.requisePar.length
              ? ` — requise par ${i.requisePar.map(Utils.escHtml).join(", ")}`
              : ""),
        ),
        "grave",
      )
    );
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
    f.innerHTML = this._flanc();
    this._brancherFlanc();
  },

  /* ================= câblage ================= */

  _brancher() {
    const q = (s) => this._hote.querySelector(s);
    q("#rg-defection").addEventListener("click", () => {
      this._mode = !this._mode;
      this._absent = null;
      this._selId = null;
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
