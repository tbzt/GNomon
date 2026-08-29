"use strict";

/* ============================================================
   TABLEAU — la troisième lentille : tout le casting d'un coup.
   ------------------------------------------------------------
   La fiche est faite pour ÉCRIRE un personnage : elle donne toute la
   place à un seul. Mais une partie du travail est d'un autre ordre —
   « les quarante ont-ils tous une morale ? », « lesquels n'ont pas de
   fonction narrative ? », « je veux passer six personnages du groupe A
   au groupe B ». Fiche par fiche, c'est quarante allers-retours.

   Le tableau ne remplace pas la fiche, il répond aux questions que la
   fiche ne sait pas poser : celles qui portent sur **l'ensemble**.

   ── CE QUI SE SAISIT ET CE QUI SE LIT ──
   Les colonnes claires sont éditables : ce sont les champs du store.
   Les colonnes grisées sont **dérivées** — couverture, contacts, liens
   primaires reçus, miroir. On ne les saisit pas, on les obtient en
   écrivant. Les rendre modifiables serait mentir sur ce qu'elles sont.
   Le background et le portrait s'y montrent en volume, pas en contenu :
   un tableau n'est pas le bon endroit pour écrire trois pages.

   ── LE CURSEUR NE DOIT JAMAIS SAUTER ──
   Chaque frappe enregistrée émet un événement, et l'application
   redessine. Redessiner un tableau où quelqu'un est en train de taper
   lui arrache le champ des doigts, perd le défilement et remonte en
   haut de quarante lignes. D'où deux rendus distincts : `rendre()`
   reconstruit, `rafraichir()` ne retouche que les cellules dérivées et
   les champs qui n'ont PAS le curseur. C'est la même discipline que la
   fiche et le graphe, appliquée ici où elle est la plus visible.

   Un tri qui déplacerait la ligne qu'on modifie serait le même dégât :
   on trie au clic, jamais pendant la frappe.
   ============================================================ */
import { scoreCouverture } from "../core/couverture.js";
import { FONCTIONS } from "../core/reseaustore.js";
import { Utils } from "../core/utils.js";

const SEUIL_ALERTE = 5;

/* ---------------------------------------------------------------
   Les colonnes. `jeu` range chacune dans une famille : on n'affiche
   pas dix-neuf colonnes à la fois, on choisit ce qu'on regarde.
   `d` marque les dérivées (lecture seule).
   --------------------------------------------------------------- */
const COLONNES = [
  { cle: "nom", nom: "Nom", type: "texte", l: 15, jeu: "identite", figee: true },
  { cle: "role", nom: "Rôle", type: "texte", l: 13, jeu: "identite" },
  { cle: "pj", nom: "PJ", type: "bool", l: 3.6, jeu: "identite" },
  { cle: "groupeId", nom: "Groupe", type: "groupe", l: 11, jeu: "identite" },
  { cle: "fonction", nom: "Fonction", type: "enum", opts: FONCTIONS, l: 12, jeu: "identite" },
  { cle: "archetype", nom: "Archétype", type: "texte", l: 11, jeu: "identite" },

  { cle: "moral", nom: "Morale", type: "texte", l: 17, jeu: "ressort" },
  { cle: "desir", nom: "Désir", type: "texte", l: 17, jeu: "ressort" },
  { cle: "besoin", nom: "Besoin", type: "texte", l: 17, jeu: "ressort" },
  { cle: "faiblesse", nom: "Faiblesse", type: "texte", l: 15, jeu: "ressort" },
  { cle: "pouvoirs", nom: "Pouvoirs", type: "texte", l: 15, jeu: "ressort" },
  { cle: "transformation", nom: "Transformation", type: "texte", l: 17, jeu: "ressort" },
  { cle: "surprise", nom: "Surprise", type: "bool", l: 4.6, jeu: "ressort" },

  { cle: "_couv", nom: "Couv.", d: true, l: 5, jeu: "etat", num: true },
  { cle: "_contacts", nom: "Contacts", d: true, l: 5.4, jeu: "etat", num: true },
  { cle: "_primaires", nom: "Prim. reçus", d: true, l: 6.4, jeu: "etat", num: true },
  { cle: "_miroir", nom: "Miroir", d: true, l: 8, jeu: "etat" },
  { cle: "_bg", nom: "Background", d: true, l: 6.4, jeu: "etat", num: true },
  { cle: "_objectifs", nom: "Obj.", d: true, l: 4.2, jeu: "etat", num: true },
  { cle: "_portrait", nom: "Portrait", d: true, l: 5, jeu: "etat" },
];

/** Les jeux de colonnes. `nom` est toujours là : c'est la colonne figée
    à gauche, sans laquelle on ne sait plus de qui parle la ligne. */
const JEUX = [
  { cle: "identite", nom: "Identité", cols: ["identite"], plus: ["_couv"] },
  { cle: "ressort", nom: "Ressorts", cols: ["ressort"], plus: ["_couv"] },
  { cle: "etat", nom: "État", cols: ["etat"], plus: ["role", "pj"] },
  { cle: "tout", nom: "Tout", cols: ["identite", "ressort", "etat"], plus: [] },
];

/** Ce qui n'est pas une valeur mais un fait dérivé du réseau entier. */
function derive(store, p) {
  const { couvert, total } = scoreCouverture(store, p.id);
  const miroir = store.miroirDe(p.id);
  return {
    _couv: { txt: `${couvert}/${total}`, alerte: couvert < SEUIL_ALERTE, tri: couvert },
    _contacts: (() => {
      const n = store.liensDe(p.id).length;
      return { txt: String(n), alerte: n === 0, tri: n };
    })(),
    _primaires: (() => {
      const n = store.liensVers(p.id).filter((l) => l.importance === "primaire").length;
      return { txt: String(n), alerte: n === 0, tri: n };
    })(),
    _miroir: (() => {
      const q = miroir && store.personnage(miroir.de === p.id ? miroir.vers : miroir.de);
      return { txt: q ? q.nom : "—", alerte: !q, tri: q ? q.nom : "" };
    })(),
    _bg: (() => {
      const n = (p.background || "").length;
      return {
        txt: n ? n.toLocaleString("fr-FR") : "—",
        alerte: !n,
        tri: n,
        titre: n ? `${n} signes de background` : "aucun background écrit",
      };
    })(),
    _objectifs: (() => {
      const n = (p.objectifs || []).length;
      return { txt: n ? String(n) : "—", alerte: !n, tri: n };
    })(),
    _portrait: (() => {
      const a = !!p.portrait;
      const i = (p.images || []).length;
      return {
        txt: a ? (i ? `oui +${i}` : "oui") : "—",
        alerte: !a,
        tri: (a ? 1 : 0) * 100 + i,
        titre: a ? `portrait${i ? ` et ${i} image(s)` : ""}` : "aucun portrait",
      };
    })(),
  };
}

export const Tableau = {
  _hote: null,
  _store: null,
  _onOuvrir: null,
  _jeu: "identite",
  _tri: null, // { cle, sens: 1 | -1 } — null = ordre d'écriture
  _q: "",
  _fGroupe: "",
  _fRole: "",
  _fIncomplets: false,
  _sig: "",

  monter(hote, store, { onOuvrir = null } = {}) {
    this._hote = hote;
    this._store = store;
    this._onOuvrir = onOuvrir;
    this._sig = "";
    this.rendre();
  },

  demonter() {
    this.flush();
    this._hote = null;
    this._sig = "";
  },

  /** Vrai seulement si CE widget est vivant et que son hôte est encore
      à sa place. Chercher `#tb-hote` dans le DOM ne suffit pas : après
      un `demonter()`, le nœud reste en place — l'écran est simplement
      masqué, pas vidé — et on le prenait pour un tableau en service. On
      rafraîchissait alors un cadavre : la grille restait à l'écran,
      figée, ses boutons sans effet. */
  monteDans(parent) {
    return !!this._hote && !!parent && parent.contains(this._hote);
  },

  /** Écrit ce qui est sous le curseur AVANT que l'écran disparaisse.
      `change` ne se déclenche qu'à la perte de focus ; un champ retiré
      du DOM alors qu'il l'a encore ne le déclenche pas. Un clic de
      souris sur un onglet passe par un `blur` et sauve donc la mise,
      mais pas une navigation au clavier ni un changement de hash. Sans
      ce filet, une valeur tapée puis quittée « autrement » disparaît —
      la même famille de bug que le carnet de la fiche. */
  flush() {
    const a = document.activeElement;
    if (this._hote && a && a.dataset && a.dataset.champ && this._hote.contains(a))
      this._enregistrer(a);
  },

  _enregistrer(t) {
    const champ = t.dataset.champ;
    if (!champ) return;
    const tr = t.closest("tr[data-p]");
    if (!tr) return;
    const v =
      t.type === "checkbox"
        ? t.checked
        : champ === "groupeId" || champ === "fonction"
          ? t.value || null
          : t.value;
    const p = this._store.personnage(tr.dataset.p);
    // Rien à écrire si rien n'a changé : sinon `flush()` provoquerait une
    // écriture et un événement à chaque sortie d'écran, pour rien.
    if (p && p[champ] === v) return;
    this._store.majPersonnage(tr.dataset.p, { [champ]: v });
  },

  /* ---------------- sélection des lignes et des colonnes ---------------- */

  _colonnes() {
    const j = JEUX.find((x) => x.cle === this._jeu) || JEUX[0];
    const dedans = COLONNES.filter(
      (c) => c.cle !== "nom" && (j.cols.includes(c.jeu) || j.plus.includes(c.cle)),
    );
    // L'ordre déclaré fait foi : « role, pj » ajoutés au jeu « État »
    // doivent rester devant, comme dans COLONNES.
    dedans.sort((a, b) => COLONNES.indexOf(a) - COLONNES.indexOf(b));
    return [COLONNES[0], ...dedans];
  },

  _lignes() {
    const s = this._store;
    let ps = s.personnages();

    if (this._fRole) ps = ps.filter((p) => (this._fRole === "pj" ? p.pj : !p.pj));
    if (this._fGroupe)
      ps = ps.filter((p) =>
        this._fGroupe === "_sans" ? !p.groupeId : p.groupeId === this._fGroupe,
      );
    if (this._fIncomplets)
      ps = ps.filter((p) => scoreCouverture(s, p.id).couvert < SEUIL_ALERTE);

    if (this._q) {
      // On cherche dans TOUS les champs de texte, pas seulement dans le
      // nom : on retrouve un personnage par un mot de sa morale.
      const q = Utils.searchNorm(this._q);
      ps = ps.filter((p) =>
        Utils.searchNorm(
          [
            p.nom,
            p.role,
            p.archetype,
            p.moral,
            p.desir,
            p.besoin,
            p.faiblesse,
            p.pouvoirs,
            p.transformation,
            p.background,
          ].join(" "),
        ).includes(q),
      );
    }

    if (this._tri) {
      const { cle, sens } = this._tri;
      const col = COLONNES.find((c) => c.cle === cle);
      const val = (p) => {
        if (col && col.d) return derive(s, p)[cle].tri;
        if (cle === "groupeId") {
          const g = s.groupe(p.groupeId);
          return g ? g.nom : "";
        }
        if (cle === "fonction") return p.fonction ? FONCTIONS[p.fonction] : "";
        const v = p[cle];
        return typeof v === "boolean" ? (v ? 1 : 0) : String(v ?? "");
      };
      // Copie : `personnages()` rend le tableau interne du store, le
      // trier en place réordonnerait les données elles-mêmes.
      ps = [...ps].sort((a, b) => {
        const x = val(a);
        const y = val(b);
        if (typeof x === "number" && typeof y === "number") return (x - y) * sens;
        // Les cases vides tombent toujours en bas, dans les deux sens :
        // on trie pour trouver ce qui est écrit, pas ce qui manque.
        if (!x && y) return 1;
        if (x && !y) return -1;
        return String(x).localeCompare(String(y), "fr") * sens;
      });
    }
    return ps;
  },

  /** Ce qui, en changeant, oblige à tout reconstruire. Le CONTENU des
      champs n'y est pas : c'est précisément ce qu'on modifie en tapant. */
  _signature(lignes, cols) {
    return [
      this._jeu,
      this._tri ? this._tri.cle + this._tri.sens : "-",
      cols.length,
      lignes.map((p) => p.id).join(","),
      this._store.groupes().length,
    ].join("|");
  },

  /* ---------------- rendu ---------------- */

  rendre() {
    if (!this._hote) return;
    const cols = this._colonnes();
    const lignes = this._lignes();
    const total = this._store.personnages().length;
    const garde = this._hote.querySelector(".tb-defil");
    const defil = garde ? { x: garde.scrollLeft, y: garde.scrollTop } : null;

    this._hote.innerHTML =
      this._barreHtml(lignes.length, total) +
      '<div class="tb-defil"><table class="tb"><thead><tr>' +
      cols.map((c) => this._enteteHtml(c)).join("") +
      '<th class="tb-fin"></th></tr></thead><tbody>' +
      lignes.map((p) => this._ligneHtml(p, cols)).join("") +
      "</tbody><tfoot><tr>" +
      `<td colspan="${cols.length + 1}"><button type="button" class="tb-ajout" data-ajout>` +
      "＋ Ajouter un personnage</button></td></tr></tfoot></table>" +
      `<p class="vide"${lignes.length ? " hidden" : ""}>Aucun personnage ne correspond à ce filtre.</p>` +
      "</div>" +
      `<p class="tb-pied">Les colonnes grises sont <b>dérivées</b> du réseau : elles se remplissent en écrivant les liens, pas ici. Entrée ou Tab enregistre.</p>`;

    this._sig = this._signature(lignes, cols);
    const d = this._hote.querySelector(".tb-defil");
    if (d && defil) {
      d.scrollLeft = defil.x;
      d.scrollTop = defil.y;
    }
  },

  /** Redessine sans toucher au champ qui a le curseur. Reconstruit
      seulement si la structure a bougé (ligne ajoutée, tri changé…). */
  rafraichir() {
    if (!this._hote) return;
    const cols = this._colonnes();
    const lignes = this._lignes();
    if (this._signature(lignes, cols) !== this._sig) {
      this.rendre();
      return;
    }
    const actif = document.activeElement;
    for (const p of lignes) {
      const tr = this._hote.querySelector(`tr[data-p="${p.id}"]`);
      if (!tr) continue;
      const dv = derive(this._store, p);
      for (const c of cols) {
        const td = tr.querySelector(`[data-c="${c.cle}"]`);
        if (!td) continue;
        if (c.d) {
          const v = dv[c.cle];
          td.textContent = v.txt;
          td.classList.toggle("alerte", !!v.alerte);
          if (v.titre) td.title = v.titre;
          continue;
        }
        const ch = td.querySelector("input, select");
        if (!ch || ch === actif) continue; // ← jamais sous les doigts
        if (c.type === "bool") ch.checked = !!p[c.cle];
        else {
          const v = c.cle === "groupeId" ? (p.groupeId ?? "") : (p[c.cle] ?? "");
          if (ch.value !== String(v)) ch.value = v;
          if (c.type === "texte") ch.title = String(v);
        }
      }
      tr.classList.toggle("pnj", !p.pj);
    }
    const cpt = this._hote.querySelector(".tb-compte");
    if (cpt) cpt.textContent = this._compteTxt(lignes.length, this._store.personnages().length);
  },

  _compteTxt(n, total) {
    return n === total
      ? `${total} ${Utils.plur(total, "personnage")}`
      : `${n} sur ${total}`;
  },

  _barreHtml(n, total) {
    const groupes = this._store.groupes();
    return (
      '<div class="tb-barre">' +
      '<div class="tb-jeux" role="group" aria-label="Colonnes affichées">' +
      JEUX.map(
        (j) =>
          `<button type="button" class="tb-jeu${this._jeu === j.cle ? " actif" : ""}" ` +
          `data-jeu="${j.cle}" aria-pressed="${this._jeu === j.cle}">${j.nom}</button>`,
      ).join("") +
      "</div>" +
      '<label class="tb-champ"><span>Chercher</span>' +
      `<input type="search" class="tb-q" value="${Utils.escHtml(this._q)}" placeholder="nom, rôle, morale…" /></label>` +
      '<label class="tb-champ"><span>Groupe</span><select class="tb-fg">' +
      `<option value="">tous</option>` +
      groupes
        .map(
          (g) =>
            `<option value="${Utils.escHtml(g.id)}"${this._fGroupe === g.id ? " selected" : ""}>${Utils.escHtml(g.nom)}</option>`,
        )
        .join("") +
      `<option value="_sans"${this._fGroupe === "_sans" ? " selected" : ""}>sans groupe</option>` +
      "</select></label>" +
      '<label class="tb-champ"><span>Rôle</span><select class="tb-fr">' +
      `<option value="">tous</option>` +
      `<option value="pj"${this._fRole === "pj" ? " selected" : ""}>PJ</option>` +
      `<option value="pnj"${this._fRole === "pnj" ? " selected" : ""}>PNJ</option>` +
      "</select></label>" +
      `<label class="tb-case"><input type="checkbox" class="tb-fi"${this._fIncomplets ? " checked" : ""} /> ` +
      `<span>couverture &lt; ${SEUIL_ALERTE}</span></label>` +
      '<span class="spacer"></span>' +
      `<span class="tb-compte">${this._compteTxt(n, total)}</span>` +
      (this._tri
        ? '<button type="button" class="tb-detri" title="Revenir à l\'ordre d\'écriture">Dé-trier</button>'
        : "") +
      '<button type="button" class="tb-copier" title="Copie les colonnes affichées, tabulées : se colle tel quel dans un tableur.">Copier</button>' +
      "</div>"
    );
  },

  _enteteHtml(c) {
    const actif = this._tri && this._tri.cle === c.cle;
    const fleche = actif ? (this._tri.sens > 0 ? " ↑" : " ↓") : "";
    return (
      `<th class="${c.d ? "derivee " : ""}${c.figee ? "figee " : ""}${c.num ? "num " : ""}${actif ? "trie" : ""}" ` +
      `style="--l:${c.l}em"${actif ? ` aria-sort="${this._tri.sens > 0 ? "ascending" : "descending"}"` : ""}>` +
      `<button type="button" data-tri="${c.cle}">${Utils.escHtml(c.nom)}<i>${fleche}</i></button></th>`
    );
  },

  _ligneHtml(p, cols) {
    return (
      `<tr data-p="${p.id}"${p.pj ? "" : ' class="pnj"'}>` +
      cols.map((c) => this._celluleHtml(p, c)).join("") +
      '<td class="tb-fin"><button type="button" class="tb-ouvrir" data-ouvrir title="Ouvrir la fiche complète">Fiche</button></td>' +
      "</tr>"
    );
  },

  _celluleHtml(p, c) {
    const base = `class="${c.figee ? "figee " : ""}${c.num ? "num " : ""}${c.d ? "derivee " : ""}" data-c="${c.cle}" style="--l:${c.l}em"`;

    if (c.d) {
      const v = derive(this._store, p)[c.cle];
      return (
        `<td class="derivee${c.figee ? " figee" : ""}${c.num ? " num" : ""}${v.alerte ? " alerte" : ""}" ` +
        `data-c="${c.cle}" style="--l:${c.l}em"` +
        (v.titre ? ` title="${Utils.escHtml(v.titre)}"` : "") +
        `>${Utils.escHtml(v.txt)}</td>`
      );
    }

    if (c.type === "bool")
      return (
        `<td ${base}><input type="checkbox" data-champ="${c.cle}"${p[c.cle] ? " checked" : ""} ` +
        `aria-label="${Utils.escHtml(c.nom)} — ${Utils.escHtml(p.nom)}" /></td>`
      );

    if (c.type === "groupe") {
      const gs = this._store.groupes();
      return (
        `<td ${base}><select data-champ="groupeId" aria-label="Groupe — ${Utils.escHtml(p.nom)}">` +
        `<option value=""${p.groupeId ? "" : " selected"}>—</option>` +
        gs
          .map(
            (g) =>
              `<option value="${Utils.escHtml(g.id)}"${p.groupeId === g.id ? " selected" : ""}>${Utils.escHtml(g.nom)}</option>`,
          )
          .join("") +
        "</select></td>"
      );
    }

    if (c.type === "enum")
      return (
        `<td ${base}><select data-champ="${c.cle}" aria-label="${Utils.escHtml(c.nom)} — ${Utils.escHtml(p.nom)}">` +
        `<option value=""${p[c.cle] ? "" : " selected"}>—</option>` +
        Object.entries(c.opts)
          .map(
            ([k, lib]) =>
              `<option value="${k}"${p[c.cle] === k ? " selected" : ""}>${Utils.escHtml(lib)}</option>`,
          )
          .join("") +
        "</select></td>"
      );

    const v = String(p[c.cle] ?? "");
    return (
      `<td ${base}><input type="text" data-champ="${c.cle}" value="${Utils.escHtml(v)}" ` +
      `title="${Utils.escHtml(v)}" aria-label="${Utils.escHtml(c.nom)} — ${Utils.escHtml(p.nom)}" /></td>`
    );
  },

  /* ---------------- interaction ---------------- */

  /** Branché UNE FOIS par l'hôte, en délégation : le tableau se
      reconstruit souvent, des écouteurs posés sur les cellules
      partiraient avec elles. */
  brancher(hote) {
    hote.addEventListener("click", (e) => {
      const jeu = e.target.closest("[data-jeu]");
      if (jeu) {
        this._jeu = jeu.dataset.jeu;
        this.rendre();
        return;
      }
      const tri = e.target.closest("[data-tri]");
      if (tri) {
        const cle = tri.dataset.tri;
        // Trois états, comme le thème : ordre d'écriture → ↑ → ↓ →
        // ordre d'écriture. L'ordre de saisie est une information ; on
        // doit pouvoir y revenir.
        if (!this._tri || this._tri.cle !== cle) this._tri = { cle, sens: 1 };
        else if (this._tri.sens === 1) this._tri = { cle, sens: -1 };
        else this._tri = null;
        this.rendre();
        return;
      }
      if (e.target.closest(".tb-detri")) {
        this._tri = null;
        this.rendre();
        return;
      }
      if (e.target.closest(".tb-copier")) {
        this._copier(e.target.closest(".tb-copier"));
        return;
      }
      if (e.target.closest("[data-ajout]")) {
        this._ajouter();
        return;
      }
      const ouvrir = e.target.closest("[data-ouvrir]");
      if (ouvrir && this._onOuvrir) {
        const tr = ouvrir.closest("tr[data-p]");
        if (tr) this._onOuvrir(tr.dataset.p);
      }
    });

    // `change` et non `input` : on enregistre quand le champ est quitté
    // ou validé. Enregistrer à chaque frappe multiplierait les écritures
    // et les redessins pour rien.
    hote.addEventListener("change", (e) => {
      const t = e.target;
      if (t.matches(".tb-q, .tb-fg, .tb-fr, .tb-fi")) return this._filtre(t);
      this._enregistrer(t);
    });

    // La recherche est le seul filtre qui réagit à la frappe : attendre
    // le `change` obligerait à quitter le champ pour voir le résultat.
    hote.addEventListener("input", (e) => {
      if (e.target.matches(".tb-q")) this._filtre(e.target);
    });

    hote.addEventListener("keydown", (e) => {
      // Entrée descend d'une ligne dans la MÊME colonne — le geste de
      // tableur. Le `change` part au passage, donc c'est aussi ce qui
      // enregistre. Sur la dernière ligne, on se contente de sortir.
      if (e.key === "Enter" && e.target.matches("input[type=text]")) {
        e.preventDefault();
        const td = e.target.closest("td");
        const tr = e.target.closest("tr[data-p]");
        const suivante = tr && tr.nextElementSibling;
        const cible =
          suivante && td
            ? suivante.querySelector(`[data-c="${td.dataset.c}"] input[type=text]`)
            : null;
        if (cible) {
          cible.focus();
          cible.select();
        } else e.target.blur();
      }
      if (e.key === "Escape" && e.target.matches(".tb-q")) {
        e.target.value = "";
        this._filtre(e.target);
      }
    });
  },

  /** Le filtre courant sert de CONTEXTE : filtré sur un groupe, on crée
      dans ce groupe ; filtré sur les PNJ, on crée un PNJ. Sinon la
      ligne apparaîtrait puis disparaîtrait aussitôt, filtrée par le
      filtre même qui l'a inspirée. La recherche, elle, est levée : on
      ne peut pas deviner un texte qui la satisferait. */
  _ajouter() {
    const p = this._store.creerPersonnage({
      nom: "",
      pj: this._fRole !== "pnj",
      groupeId: this._fGroupe && this._fGroupe !== "_sans" ? this._fGroupe : null,
    });
    this._q = "";
    this.rendre();
    const inp = this._hote.querySelector(`tr[data-p="${p.id}"] input[type=text]`);
    if (inp) {
      inp.focus();
      inp.scrollIntoView({ block: "nearest" });
    }
  },

  _filtre(t) {
    if (t.matches(".tb-q")) this._q = t.value.trim();
    else if (t.matches(".tb-fg")) this._fGroupe = t.value;
    else if (t.matches(".tb-fr")) this._fRole = t.value;
    else if (t.matches(".tb-fi")) this._fIncomplets = t.checked;

    // Le champ de recherche a le curseur : un `rendre()` complet le lui
    // prendrait à la première lettre. On ne refait que le corps.
    const cols = this._colonnes();
    const lignes = this._lignes();
    const corps = this._hote.querySelector("tbody");
    if (!corps) return this.rendre();
    corps.innerHTML = lignes.map((p) => this._ligneHtml(p, cols)).join("");
    this._sig = this._signature(lignes, cols);
    const cpt = this._hote.querySelector(".tb-compte");
    if (cpt) cpt.textContent = this._compteTxt(lignes.length, this._store.personnages().length);
    const vide = this._hote.querySelector(".tb-defil .vide");
    if (vide) vide.hidden = lignes.length > 0;
  },

  /** Tabulé, donc collable directement dans un tableur. C'est la donnée
      d'auteur telle quelle : elle ne va pas plus loin que le
      presse-papier de la personne qui clique. */
  _copier(bouton) {
    const cols = this._colonnes();
    const lignes = this._lignes();
    const cell = (p, c) => {
      if (c.d) return derive(this._store, p)[c.cle].txt;
      if (c.type === "bool") return p[c.cle] ? "oui" : "non";
      if (c.cle === "groupeId") {
        const g = this._store.groupe(p.groupeId);
        return g ? g.nom : "";
      }
      if (c.type === "enum") return p[c.cle] ? c.opts[p[c.cle]] : "";
      // Une tabulation ou un retour à la ligne dans une valeur casserait
      // la grille : on les aplatit.
      return String(p[c.cle] ?? "").replace(/[\t\r\n]+/g, " ");
    };
    const tsv = [
      cols.map((c) => c.nom).join("\t"),
      ...lignes.map((p) => cols.map((c) => cell(p, c)).join("\t")),
    ].join("\n");

    const dire = (txt) => {
      if (!bouton) return;
      const avant = bouton.textContent;
      bouton.textContent = txt;
      setTimeout(() => {
        bouton.textContent = avant;
      }, 1800);
    };
    navigator.clipboard
      .writeText(tsv)
      .then(() => dire(`${lignes.length} ${Utils.plur(lignes.length, "ligne")} ✓`))
      .catch(() => dire("Refusé"));
  },
};
